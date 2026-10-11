# Cheapsk8 🆓

Your freebie hunter. Finds free samples, trials, giveaways, events, birthday
perks, and digital goods across the internet — then emails you the good ones.

**Live API:** `https://cheapsk8-production.up.railway.app`

## Features

### 🔍 Freebie Search
Aggregates from two sources, deduplicated:
- **Tavily web search** — live queries across the web (1,000 free searches/mo)
- **RSS feeds** — curated feeds from Free Stuff Finder, Yo! Free Samples, and
  Freeflys (30-min cache, no API cost)

`GET /freebies?category=samples&query=coffee&location=&limit=8&sources=all`
- `sources` can be `all`, `search`, or `rss`

### 📧 Email Notifications
Select freebies on any card → floating bar appears → enter email → consolidated
HTML email sent via [Resend](https://resend.com).

`POST /notify` — `{email, freebies[], subject?}`

### 🔔 Keyword Alerts
"Notify me when *free coffee* appears." Managed from the web UI Alerts panel.
The weekly digest job checks alerts against fresh freebies and sends separate
match emails.

- `POST /alerts` — `{email, keyword}`
- `GET /alerts?email=` — list a user's alerts
- `DELETE /alerts` — `{email, keyword}`

### 📰 Weekly Digest
Footer signup → stored in SQLite → GitHub Actions cron (Mondays 9am ET)
triggers `POST /digest?token=` → top 15 freebies emailed to all subscribers,
plus keyword alert matches.

- `POST /subscribe` — `{email, categories[]}`
- `POST /unsubscribe` — `{email}`
- `POST /digest?token=DIGEST_SECRET` — protected trigger

### 🔖 Saved Freebies
Bookmark icon on every card. Saved to localStorage. Discover / Saved tabs.

### 📋 Claim Guide Modal
Click any card → modal with full description, step-by-step claim instructions,
source domain, and a "This worked for me" button.

### 📍 Location Autocomplete
Type 3+ characters → OpenStreetMap Nominatim suggestions (debounced, no key).

## Web UI

React + Vite + Tailwind + shadcn-style components. Dark mode by default.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Set `VITE_API_URL` to point at a different backend (defaults to Railway).

To deploy the frontend: import the repo in [Vercel](https://vercel.com),
set root directory to `web`.

## API Quickstart

```bash
pip install -r requirements.txt
TAVILY_API_KEY=your-key uvicorn app:app --reload
```

```bash
curl "http://localhost:8000/freebies?category=samples&query=coffee"
curl "http://localhost:8000/freebies?sources=rss&limit=5"
curl "http://localhost:8000/categories"
curl "http://localhost:8000/health"
```

## API Reference

| Endpoint | Method | What |
|---|---|---|
| `/freebies` | GET | `category`, `query`, `location`, `limit`, `sources` → freebie listings |
| `/categories` | GET | Available categories with examples |
| `/notify` | POST | `{email, freebies[], subject?}` → consolidated email |
| `/alerts` | POST | `{email, keyword}` → create keyword alert |
| `/alerts?email=` | GET | List user's alerts |
| `/alerts` | DELETE | `{email, keyword}` → remove alert |
| `/subscribe` | POST | `{email, categories[]}` → weekly digest signup |
| `/unsubscribe` | POST | `{email}` → remove from digest |
| `/subscribers/count` | GET | Subscriber count (no emails exposed) |
| `/digest?token=` | POST | Trigger weekly digest + alert emails |
| `/health` | GET | Health check + Tavily status |

## Environment Variables

| Variable | Required | What |
|---|---|---|
| `TAVILY_API_KEY` | Yes (for search) | [tavily.com](https://tavily.com) API key |
| `RESEND_API_KEY` | Yes (for email) | [resend.com](https://resend.com) API key |
| `RESEND_FROM` | No | From address (defaults to Resend onboarding) |
| `DIGEST_SECRET` | Yes (for digest) | Random string protecting `/digest` |
| `CHEAPSK8_DB` | No | SQLite path (defaults to `cheapsk8.db`) |

> **Resend note:** the free tier's onboarding address only sends to your signup
> email. Verify a domain in Resend to email other subscribers.

## Scheduled Digest (GitHub Actions)

`.github/workflows/weekly-digest.yml` — cron Mondays 9am ET + manual trigger.
Requires `DIGEST_SECRET` in repo secrets (Settings → Secrets → Actions).

## GPT Setup (GPT Store)

Requires ChatGPT Plus to create.

1. In ChatGPT, create a new GPT.
2. Paste `gpt_instructions.md` as the instructions.
3. Add an Action → Import from URL → `https://your-host/openapi.json`.
4. Publish to the GPT Store.

## Project Structure

```
├── app.py              # FastAPI backend (search, RSS, email, digest, alerts)
├── requirements.txt
├── Procfile            # Railway start command
├── gpt_instructions.md # GPT Store instructions
├── README.md
└── web/                # React frontend
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── ui/             # shadcn-style: button, card, input, badge
    │   │   └── LocationAutocomplete.jsx
    │   └── lib/
    │       ├── api.js          # API client
    │       └── utils.js        # cn() helper
    └── public/
        └── favicon.svg
```

## Categories

| ID | Label | Example |
|---|---|---|
| `samples` | Free Samples | skincare, snacks, pet food |
| `trials` | Free Trials | streaming, software, meal kits |
| `giveaways` | Giveaways & Sweepstakes | electronics, gift cards |
| `events` | Free Local Events | concerts, museums (needs location) |
| `birthday` | Birthday Freebies | Starbucks, Sephora |
| `digital` | Free Digital Goods | ebooks, courses, games |
| `food` | Free Food | samples, restaurant promos (needs location) |
