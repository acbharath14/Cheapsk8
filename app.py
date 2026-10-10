"""Cheapsk8 — freebie finder API.

A FastAPI backend for the Cheapsk8 GPT. Searches the web for freebies
(free samples, trials, giveaways, events, birthday freebies) using Tavily.

Run:  uvicorn app:app --host 0.0.0.0 --port 8000
Env:  TAVILY_API_KEY (required)
"""

from __future__ import annotations

import os
import time
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Cheapsk8",
    description="Find free stuff online — samples, trials, giveaways, events.",
    version="1.0.0",
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


@app.get("/freebies", response_model=FreebiesResponse)
def get_freebies(
    category: Category = Query("samples", description="Freebie category"),
    query: str = Query("", description="Search keywords (e.g. 'coffee', 'skincare')"),
    location: str = Query("", description="City/state for local events/food"),
    limit: int = Query(8, ge=1, le=15, description="Max results"),
):
    """Find freebies by category. Returns structured listings with claim info."""
    search_query = _build_query(category, query, location)
    results = _tavily_search(search_query, max_results=limit)

    freebies = []
    for r in results:
        freebies.append(Freebie(
            title=r.get("title", "Untitled")[:120],
            description=(r.get("content", "") or "")[:300].strip(),
            url=r.get("url", ""),
            category=category,
            status="unverified",
        ))

    return FreebiesResponse(
        query=query,
        category=category,
        location=location,
        count=len(freebies),
        freebies=freebies,
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
