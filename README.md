# Cheapsk8 🆓

Your freebie hunter. Finds free samples, trials, giveaways, events, birthday
perks, and digital goods across the internet — then emails you the good ones.

**Live:** https://cheapsk8-production.up.railway.app
<img width="1078" height="1082" alt="Screenshot 2026-10-11 at 10 43 08 PM" src="https://github.com/user-attachments/assets/72f403a7-92e5-4bd2-a460-0fb30209a277" />
<img width="1074" height="1075" alt="Screenshot 2026-10-11 at 10 50 41 PM 1" src="https://github.com/user-attachments/assets/5b2c1046-ff2c-4b0e-ba2d-4cb97f221314" />


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
VITE_API_URL=http://localhost:8000 npm run dev  # http://localhost:5173
```

The command above connects the UI to your local API. `VITE_API_URL` can point
to another backend; if omitted, the UI uses the hosted API.

To deploy the frontend: import the repo in [Vercel](https://vercel.com),
set root directory to `web`.

### Testing

Vitest + Testing Library. 18 tests covering the API client, `cn()` utility,
and the location autocomplete component.

```bash
cd web
npm test          # run once
npm run test:watch  # watch mode
```

| File | What it tests |
|---|---|
| `src/test/api.test.js` | All API client functions — URL building, params, error handling |
| `src/test/utils.test.js` | `cn()` class merging |
| `src/test/LocationAutocomplete.test.jsx` | Debounce, suggestions, selection, fallbacks |

## API Quickstart

Prerequisites: Python 3.10+ and Node.js 20.19+ or 22.12+ (for the web UI).
You can run the RSS-backed API without API keys; set a Tavily key to enable live
web search, and Resend/Digest credentials only for email and digest features.

Clone the repository and start the API:

```bash
git clone https://github.com/acbharath14/Cheapsk8.git
cd Cheapsk8
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app:app --reload
```

From the repository root in a second terminal, start the web UI and point it
at the local API:

```bash
cd web
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Open `http://localhost:5173`. On Windows PowerShell, activate the virtual
environment with `.venv\Scripts\Activate.ps1`; set environment variables with
`$env:NAME="value"` before starting the relevant command.

To enable Tavily search locally, set `TAVILY_API_KEY` in the API terminal
before starting Uvicorn. Email notifications and keyword-alert/digest emails
also require `RESEND_API_KEY`; scheduled digests additionally require
`DIGEST_SECRET` configured as a GitHub Actions repository secret. Never commit
real API keys, digest tokens, or subscriber database files.

With the API running, these endpoints can be tried directly:

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
| `TAVILY_API_KEY` | No (RSS works without it) | [tavily.com](https://tavily.com) API key for live web search |
| `RESEND_API_KEY` | No (email features only) | [resend.com](https://resend.com) API key |
| `RESEND_FROM` | No | From address (defaults to Resend onboarding) |
| `DIGEST_SECRET` | Yes (for digest) | Random string protecting `/digest` |
| `CHEAPSK8_DB` | No | SQLite path (defaults to `cheapsk8.db`) |

> **Resend note:** the free tier's onboarding address only sends to your signup
> email. Verify a domain in Resend to email other subscribers.

## Scheduled Digest (GitHub Actions)

To enable scheduled digests, include
`.github/workflows/weekly-digest.yml` in the repository's default branch. It
runs Mondays at 14:00 UTC (9am EST / 10am EDT) and can also be triggered
manually. Add `DIGEST_SECRET` to repo secrets (Settings → Secrets → Actions).

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
    ├── vitest.config.js        # Vitest + jsdom config
    └── src/test/               # 18 tests (api, utils, autocomplete)
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
