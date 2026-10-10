# Cheapsk8 🆓

A freebie-finder API + GPT. Scours the internet for free samples, trials,
giveaways, events, birthday perks, and digital goods.

## Web UI

A React + shadcn-style interface lives in `web/`. To run it locally:

```bash
cd web
npm install
npm run dev
```

It talks to the API at `https://cheapsk8-production.up.railway.app` by default
(override with `VITE_API_URL`).

## API Quickstart

```bash
pip install -r requirements.txt
TAVILY_API_KEY=your-key uvicorn app:app --reload
```

Test it:
```bash
curl "http://localhost:8000/freebies?category=samples&query=coffee"
curl "http://localhost:8000/categories"
```

## API

| Endpoint | What |
|---|---|
| `GET /freebies` | `category`, `query`, `location`, `limit` → structured freebie listings |
| `GET /categories` | Available categories with examples |
| `GET /health` | Health check + Tavily key status |

## GPT Setup (GPT Store)

1. Deploy this API somewhere public (Railway, Fly.io, Render).
2. In ChatGPT, create a new GPT (requires ChatGPT Plus).
3. Paste `gpt_instructions.md` as the instructions.
4. Add an Action: import from URL → `https://your-host/openapi.json`
   (FastAPI auto-generates this at `/openapi.json`).
5. Set the Action's authentication to None (or API key if you add auth).
6. Publish to the GPT Store.

## Categories

- **samples** — free product samples
- **trials** — free trials (streaming, software, meal kits)
- **giveaways** — sweepstakes and giveaways
- **events** — free local events (needs location)
- **birthday** — birthday freebies
- **digital** — free ebooks, courses, games
- **food** — free food deals (needs location)

## Notes

- Powered by [Tavily](https://tavily.com) search (1,000 free searches/month).
- Results are marked `unverified` by default — the GPT is instructed to flag
  anything that looks sketchy or expired.
- No auth on the API by default. Add an API key header before going public
  if you want to limit usage.
