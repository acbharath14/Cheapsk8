"""Cheapsk8 — freebie finder API.

A FastAPI backend for the Cheapsk8 GPT. Aggregates freebies from:
  - Tavily web search (live queries)
  - RSS feeds from freebie aggregator sites (curated sources)

Run:  uvicorn app:app --host 0.0.0.0 --port 8000
Env:  TAVILY_API_KEY (required for search)
      RESEND_API_KEY (required for /notify, /digest)
      RESEND_FROM (optional, defaults to Resend onboarding address)
      DIGEST_SECRET (required for /digest trigger)
"""

from __future__ import annotations

import os
import html
import sqlite3
import time
import xml.etree.ElementTree as ET
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
        title = html.unescape((item.findtext("title") or "Untitled").strip())
        link = (item.findtext("link") or "").strip()
        desc = html.unescape((item.findtext("description") or "").strip())
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


RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "Cheapsk8 <onboarding@resend.dev>")


def _send_email(to: str, subject: str, html: str) -> None:
    """Send an HTML email via Resend API."""
    if not RESEND_API_KEY:
        raise HTTPException(500, "Email not configured (RESEND_API_KEY missing)")
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"from": RESEND_FROM, "to": [to], "subject": subject,
                  "html": html},
            timeout=20,
        )
    except requests.Timeout:
        raise HTTPException(504, "Email service timed out")
    except requests.ConnectionError:
        raise HTTPException(502, "Could not reach email service")
    except requests.RequestException as e:
        raise HTTPException(502, f"Email request failed: {e}")
    if resp.status_code == 401:
        raise HTTPException(500, "Email API key invalid")
    if resp.status_code == 422:
        raise HTTPException(400, f"Email rejected: {resp.text[:200]}")
    if resp.status_code >= 400:
        raise HTTPException(502,
                            f"Email send failed: {resp.text[:200]}")


@app.post("/notify")
def send_notification(req: NotifyRequest):
    """Email a consolidated list of selected freebies to the user."""
    if not _valid_email(req.email):
        raise HTTPException(400, "Invalid email address")
    if not req.freebies:
        raise HTTPException(400, "No freebies selected")
    if len(req.freebies) > 20:
        raise HTTPException(400, "Too many freebies (max 20)")
    rows = ""
    for f in req.freebies:
        rows += (
            f'<tr><td style="padding:12px;border-bottom:1px solid #eee;">'
            f'<a href="{f.url}" style="font-weight:bold;color:#059669;">{f.title}</a>'
            f'<br><span style="color:#666;font-size:13px;">{f.description[:150]}</span>'
            f'<br><span style="font-size:12px;color:#999;">{f.category} · {f.how_to_claim or "via web"}</span>'
            f'</td></tr>'
        )
    html = f"""<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#059669;">🆓 Your Cheapsk8 Freebies</h2>
    <p>Here are the {len(req.freebies)} freebies you picked:</p>
    <table style="width:100%;border-collapse:collapse;">{rows}</table>
    <p style="color:#999;font-size:12px;margin-top:24px;">
    Happy hunting! — Cheapsk8<br>
    <a href="https://github.com/acbharath14/Cheapsk8">github.com/acbharath14/Cheapsk8</a>
    </p></body></html>"""
    _send_email(req.email, req.subject, html)
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
        if remaining > 0:
            if not TAVILY_API_KEY:
                # No key — RSS results stand alone.
                pass
            else:
                try:
                    search_query = _build_query(category, query, location)
                    for r in _tavily_search(search_query, max_results=remaining):
                        freebies.append(Freebie(
                            title=html.unescape(r.get("title", "Untitled"))[:120],
                            description=html.unescape((r.get("content", "") or ""))[:300].strip(),
                            url=r.get("url", ""),
                            category=category,
                            status="unverified",
                        ))
                except HTTPException:
                    # Search failed — RSS results still returned.
                    pass

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


# --- Weekly digest: subscriber storage (SQLite) ---

DB_PATH = os.environ.get("CHEAPSK8_DB", "cheapsk8.db")
DIGEST_SECRET = os.environ.get("DIGEST_SECRET", "")  # Protects /digest trigger.


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subscribers ("
        "email TEXT PRIMARY KEY, categories TEXT DEFAULT 'samples', "
        "created_at TEXT DEFAULT (datetime('now')))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS alerts ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "email TEXT NOT NULL, keyword TEXT NOT NULL, "
        "created_at TEXT DEFAULT (datetime('now')), "
        "UNIQUE(email, keyword))"
    )
    conn.commit()
    return conn


from contextlib import contextmanager

import re
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def _valid_email(email: str) -> bool:
    return bool(email and _EMAIL_RE.match(email.strip()))

@contextmanager
def _db_safe():
    """Yield a DB connection, always closing it. Raises 503 on DB failure."""
    conn = None
    try:
        conn = _db()
        yield conn
        conn.commit()
    except sqlite3.Error as e:
        if conn:
            try: conn.rollback()
            except Exception: pass
        raise HTTPException(503, f"Database unavailable: {e}")
    finally:
        if conn:
            try: conn.close()
            except Exception: pass


class AlertRequest(BaseModel):
    email: str
    keyword: str


@app.post("/alerts")
def create_alert(req: AlertRequest):
    """Create a keyword alert — emailed when matching freebies appear."""
    if not _valid_email(req.email) or not req.keyword.strip():
        raise HTTPException(400, "Valid email and keyword required")
    with _db_safe() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO alerts (email, keyword) VALUES (?, ?)",
            (req.email.lower().strip(), req.keyword.strip().lower()),
        )
    return {"status": "alert_created", "email": req.email,
            "keyword": req.keyword.strip()}


@app.delete("/alerts")
def delete_alert(req: AlertRequest):
    """Remove a keyword alert."""
    with _db_safe() as conn:
        conn.execute("DELETE FROM alerts WHERE email = ? AND keyword = ?",
                     (req.email.lower().strip(), req.keyword.strip().lower()))
    return {"status": "alert_deleted"}


@app.get("/alerts")
def list_alerts(email: str = Query(...)):
    """List a user's keyword alerts."""
    with _db_safe() as conn:
        rows = conn.execute(
            "SELECT keyword, created_at FROM alerts WHERE email = ?",
            (email.lower().strip(),)).fetchall()
    return {"email": email,
            "alerts": [{"keyword": r[0], "created_at": r[1]} for r in rows]}


class SubscribeRequest(BaseModel):
    email: str
    categories: list[str] = ["samples"]


@app.post("/subscribe")
def subscribe(req: SubscribeRequest):
    """Subscribe an email to the weekly freebie digest."""
    if not _valid_email(req.email):
        raise HTTPException(400, "Invalid email address")
    valid = {"samples", "trials", "giveaways", "events",
             "birthday", "digital", "food"}
    cats = [c for c in req.categories if c in valid] or ["samples"]
    with _db_safe() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO subscribers (email, categories) VALUES (?, ?)",
            (req.email.lower().strip(), ",".join(cats)),
        )
    return {"status": "subscribed", "email": req.email, "categories": cats}


@app.post("/unsubscribe")
def unsubscribe(req: SubscribeRequest):
    """Remove an email from the weekly digest."""
    with _db_safe() as conn:
        conn.execute("DELETE FROM subscribers WHERE email = ?",
                     (req.email.lower().strip(),))
    return {"status": "unsubscribed", "email": req.email}


@app.get("/subscribers/count")
def subscriber_count():
    """How many digest subscribers (no emails exposed)."""
    with _db_safe() as conn:
        n = conn.execute("SELECT COUNT(*) FROM subscribers").fetchone()[0]
    return {"count": n}


def _build_digest_html(freebies: list[Freebie]) -> str:
    rows = ""
    for f in freebies:
        rows += (
            f'<tr><td style="padding:12px;border-bottom:1px solid #eee;">'
            f'<a href="{f.url}" style="font-weight:bold;color:#059669;">{f.title}</a>'
            f'<br><span style="color:#666;font-size:13px;">{f.description[:150]}</span>'
            f'<br><span style="font-size:12px;color:#999;">{f.category} · {f.how_to_claim or "via web"}</span>'
            f'</td></tr>'
        )
    return f"""<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#059669;">🆓 Your Weekly Cheapsk8 Digest</h2>
    <p>The best freebies we found this week — {len(freebies)} picks:</p>
    <table style="width:100%;border-collapse:collapse;">{rows}</table>
    <p style="color:#999;font-size:12px;margin-top:24px;">
    You're getting this because you subscribed at Cheapsk8.<br>
    <a href="https://github.com/acbharath14/Cheapsk8">Unsubscribe anytime</a>
    </p></body></html>"""


@app.post("/digest")
def trigger_digest(token: str = Query("", description="DIGEST_SECRET")):
    """Generate and email the weekly digest to all subscribers.

    Called by a scheduled job (e.g. GitHub Actions cron). Protected by token.
    """
    if not DIGEST_SECRET or token != DIGEST_SECRET:
        raise HTTPException(403, "Invalid token")

    with _db_safe() as conn:
        subs = conn.execute("SELECT email, categories FROM subscribers").fetchall()
    if not subs:
        return {"status": "no_subscribers"}

    # Gather top freebies across popular categories.
    all_freebies: list[Freebie] = []
    for cat in ("samples", "giveaways", "food", "trials"):
        all_freebies.extend(_get_rss_freebies(cat, "", 5))
    # Deduplicate.
    seen, digest_list = set(), []
    for f in all_freebies:
        if f.url not in seen:
            seen.add(f.url)
            digest_list.append(f)
    digest_list = digest_list[:15]
    if not digest_list:
        return {"status": "no_freebies"}

    html = _build_digest_html(digest_list)

    sent, failed = 0, 0
    for email, _cats in subs:
        try:
            _send_email(email, "🆓 Your Weekly Cheapsk8 Digest", html)
            sent += 1
        except Exception:
            failed += 1

    # --- Keyword alerts: match alerts against fresh freebies ---
    with _db_safe() as conn:
        alert_rows = conn.execute("SELECT email, keyword FROM alerts").fetchall()

    alerts_sent = 0
    alerts_failed = 0
    # Group by email.
    from collections import defaultdict
    by_email: dict[str, list[str]] = defaultdict(list)
    for email, kw in alert_rows:
        by_email[email].append(kw)

    for email, keywords in by_email.items():
        matches: list[Freebie] = []
        for kw in keywords:
            for f in digest_list:
                if kw in (f.title + " " + f.description).lower() \
                        and f.url not in {m.url for m in matches}:
                    matches.append(f)
        if not matches:
            continue
        try:
            rows_html = ""
            for f in matches[:10]:
                rows_html += (
                    f'<tr><td style="padding:12px;border-bottom:1px solid #eee;">'
                    f'<a href="{f.url}" style="font-weight:bold;color:#059669;">{f.title}</a>'
                    f'<br><span style="color:#666;font-size:13px;">{f.description[:150]}</span>'
                    f'</td></tr>'
                )
            alert_html = f"""<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#059669;">🔔 Cheapsk8 Alert — new matches!</h2>
            <p>We found {len(matches)} freebies matching your keywords
            ({", ".join(keywords)}):</p>
            <table style="width:100%;border-collapse:collapse;">{rows_html}</table>
            </body></html>"""
            _send_email(email,
                        f"🔔 Cheapsk8 Alert: {len(matches)} new freebie matches",
                        alert_html)
            alerts_sent += 1
        except HTTPException as e:
            # Track but don't stop — other users' alerts should still send.
            alerts_failed += 1

    return {"status": "done", "sent": sent, "failed": failed,
            "freebies": len(digest_list), "alerts_sent": alerts_sent,
            "alerts_failed": alerts_failed}


@app.get("/health")
def health():
    return {"status": "ok", "tavily_configured": bool(TAVILY_API_KEY)}
