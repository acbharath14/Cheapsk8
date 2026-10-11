"""Cheapsk8 — freebie finder API.

A FastAPI backend for the Cheapsk8 GPT. Aggregates freebies from:
  - Tavily web search (live queries)
  - RSS feeds from freebie aggregator sites (curated sources)

Run:  uvicorn app:app --host 0.0.0.0 --port 8000
Env:  TAVILY_API_KEY (required for search)
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (for /notify)
"""

from __future__ import annotations

import os
import smtplib
import time
import xml.etree.ElementTree as ET
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Cheapsk8",
    description="Find free stuff online — samples, trials, giveaways, events.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"

# Category → search query templates.
CATEGORY_QUERIES = {
    "samples": "free samples {query} 2026",
    "trials": "free trial {query} 2026 no credit card",
    "giveaways": "giveaway sweepstakes {query} 2026 enter free",
    "events": "free events {location} {query} 2026",
    "birthday": "birthday freebies {query} 2026",
    "digital": "free {query} ebook course download 2026",
    "food": "free food {query} {location} 2026",
}

Category = Literal[
    "samples", "trials", "giveaways", "events",
    "birthday", "digital", "food",
]


class Freebie(BaseModel):
    title: str
    description: str = ""
    url: str
    category: str
    expires: str = "Unknown"
    how_to_claim: str = ""
    status: Literal["verified", "unverified", "expired"] = "unverified"


class FreebiesResponse(BaseModel):
    query: str
    category: str
    location: str = ""
    count: int
    freebies: list[Freebie]
    searched_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


def _tavily_search(query: str, max_results: int = 8) -> list[dict]:
    """Search via Tavily. Returns raw result dicts."""
    if not TAVILY_API_KEY:
        raise HTTPException(500, "TAVILY_API_KEY not configured")
    try:
        resp = requests.post(
            TAVILY_SEARCH_URL,
            headers={"Content-Type": "application/json"},
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": False,
            },
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json().get("results", [])
    except requests.Timeout:
        raise HTTPException(504, "Search timed out")
    except Exception as e:
        raise HTTPException(502, f"Search failed: {e}")


def _build_query(category: str, query: str, location: str) -> str:
    template = CATEGORY_QUERIES.get(category, "{query} free 2026")
    return template.format(
        query=query or "", location=location or ""
    ).strip()


# Curated RSS feeds from freebie aggregator sites.
# Each entry: (feed URL, source label, default category)
RSS_FEEDS = [
    ("https://freestufffinder.com/feed/", "Free Stuff Finder", "samples"),
    ("https://yofreesamples.com/feed/", "Yo! Free Samples", "samples"),
    ("https://freeflys.com/feed/", "Freeflys", "giveaways"),
]

# In-memory RSS cache: {feed_url: (timestamp, items)}
_rss_cache: dict = {}
RSS_CACHE_TTL = 1800  # 30 minutes


def _fetch_rss(feed_url: str, source: str, default_category: str,
               limit: int = 10) -> list[Freebie]:
    """Fetch and parse an RSS feed. Returns Freebie list. Cached 30 min."""
    now = time.time()
    if feed_url in _rss_cache:
        ts, items = _rss_cache[feed_url]
        if now - ts < RSS_CACHE_TTL:
            return items[:limit]

    try:
        resp = requests.get(feed_url, timeout=15,
                            headers={"User-Agent": "Cheapsk8/1.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        return []  # Feed down — don't break the whole response.

    items = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "Untitled").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or "").strip()
        # Strip HTML tags from description.
        import re
        desc = re.sub(r"<[^>]+>", "", desc).strip()
        if not link:
            continue
        items.append(Freebie(
            title=title[:120],
            description=desc[:300],
            url=link,
            category=default_category,
            status="unverified",
            how_to_claim=f"via {source}",
        ))
        if len(items) >= 20:  # Cap per feed before caching.
            break

    _rss_cache[feed_url] = (now, items)
    return items[:limit]


def _get_rss_freebies(category: str, query: str, limit: int) -> list[Freebie]:
    """Aggregate RSS feeds, optionally filtered by query keywords."""
    all_items: list[Freebie] = []
    per_feed = max(3, limit // len(RSS_FEEDS))
    for feed_url, source, default_cat in RSS_FEEDS:
        # Use the feed's category unless user picked a specific one.
        items = _fetch_rss(feed_url, source, default_cat, limit=per_feed)
        all_items.extend(items)

    # Keyword filter.
    if query:
        keywords = query.lower().split()
        all_items = [
            f for f in all_items
            if any(kw in (f.title + " " + f.description).lower()
                   for kw in keywords)
        ]

    # Deduplicate by URL.
    seen = set()
    deduped = []
    for f in all_items:
        if f.url not in seen:
            seen.add(f.url)
            deduped.append(f)

    return deduped[:limit]


class NotifyRequest(BaseModel):
    email: str
    freebies: list[Freebie]
    subject: str = "Your Cheapsk8 freebies 🆓"


def _send_email(to: str, subject: str, freebies: list[Freebie]) -> None:
    """Send consolidated freebie list via SMTP (env-configured)."""
    host = os.environ.get("SMTP_HOST", "")
    if not host:
        raise HTTPException(500, "Email not configured (SMTP_HOST missing)")

    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASS", "")
    from_addr = os.environ.get("SMTP_FROM", user)

    # Build HTML email.
    rows = ""
    for f in freebies:
        rows += (
            f'<tr><td style="padding:12px;border-bottom:1px solid #eee;">'
            f'<a href="{f.url}" style="font-weight:bold;color:#059669;">{f.title}</a>'
            f'<br><span style="color:#666;font-size:13px;">{f.description[:150]}</span>'
            f'<br><span style="font-size:12px;color:#999;">{f.category} · {f.how_to_claim or "via web"}</span>'
            f'</td></tr>'
        )

    html = f"""<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#059669;">🆓 Your Cheapsk8 Freebies</h2>
    <p>Here are the {len(freebies)} freebies you picked:</p>
    <table style="width:100%;border-collapse:collapse;">{rows}</table>
    <p style="color:#999;font-size:12px;margin-top:24px;">
    Happy hunting! — Cheapsk8<br>
    <a href="https://github.com/acbharath14/Cheapsk8">github.com/acbharath14/Cheapsk8</a>
    </p></body></html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        if user and password:
            server.login(user, password)
        server.send_message(msg)


@app.post("/notify")
def send_notification(req: NotifyRequest):
    """Email a consolidated list of selected freebies to the user."""
    if not req.freebies:
        raise HTTPException(400, "No freebies selected")
    if len(req.freebies) > 20:
        raise HTTPException(400, "Too many freebies (max 20)")
    _send_email(req.email, req.subject, req.freebies)
    return {"status": "sent", "to": req.email, "count": len(req.freebies)}


@app.get("/freebies", response_model=FreebiesResponse)
def get_freebies(
    category: Category = Query("samples", description="Freebie category"),
    query: str = Query("", description="Search keywords (e.g. 'coffee', 'skincare')"),
    location: str = Query("", description="City/state for local events/food"),
    limit: int = Query(8, ge=1, le=15, description="Max results"),
    sources: str = Query("all", description="'all', 'search', or 'rss'"),
):
    """Find freebies by category. Aggregates Tavily search + RSS feeds."""
    freebies: list[Freebie] = []

    # 1. RSS feeds (curated, fast, cached).
    if sources in ("all", "rss"):
        freebies.extend(_get_rss_freebies(category, query, limit))

    # 2. Tavily live search (fills remaining slots).
    if sources in ("all", "search"):
        remaining = limit - len(freebies)
        if remaining > 0 and TAVILY_API_KEY:
            search_query = _build_query(category, query, location)
            for r in _tavily_search(search_query, max_results=remaining):
                freebies.append(Freebie(
                    title=r.get("title", "Untitled")[:120],
                    description=(r.get("content", "") or "")[:300].strip(),
                    url=r.get("url", ""),
                    category=category,
                    status="unverified",
                ))

    # Deduplicate by URL across sources.
    seen = set()
    deduped = []
    for f in freebies:
        if f.url not in seen:
            seen.add(f.url)
            deduped.append(f)

    return FreebiesResponse(
        query=query,
        category=category,
        location=location,
        count=len(deduped),
        freebies=deduped[:limit],
    )


@app.get("/categories")
def list_categories():
    """List available freebie categories."""
    return {
        "categories": [
            {"id": "samples", "label": "Free Samples", "example": "skincare, snacks, pet food"},
            {"id": "trials", "label": "Free Trials", "example": "streaming, software, meal kits"},
            {"id": "giveaways", "label": "Giveaways & Sweepstakes", "example": "electronics, gift cards"},
            {"id": "events", "label": "Free Local Events", "example": "concerts, museums (needs location)"},
            {"id": "birthday", "label": "Birthday Freebies", "example": "Starbucks, Sephora"},
            {"id": "digital", "label": "Free Digital Goods", "example": "ebooks, courses, games"},
            {"id": "food", "label": "Free Food", "example": "samples, restaurant promos (needs location)"},
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok", "tavily_configured": bool(TAVILY_API_KEY)}
