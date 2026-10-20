# Wanderer development field notes

## Run locally

From the project root:

```sh
bash run_local.sh
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). The API runs on port 8000; Vite proxies `/api` requests. Stop both services with Ctrl+C.

If dependencies are missing, install them first:

```sh
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
# For a new checkout only: copy .env.example to .env and set a random SECRET_KEY.
cd ../frontend
npm install
```

The existing local `.env` is preserved. For a deployed build, configure `VITE_API_BASE_URL` before building and configure the API's CORS origins. Never commit `.env` or database files containing personal travel records.

## Deploy the frontend on Vercel

The current public frontend is [wanderers-znqi.vercel.app](https://wanderers-znqi.vercel.app).
The user supplied this deployment URL on 2026-10-20.

Import `aaravkalia-88/wanderers` into Vercel and keep **Root Directory** at the repository root (leave it empty). The root `vercel.json` sets the Vite framework, installs with `npm ci --prefix frontend`, builds with `npm --prefix frontend run build`, and publishes `frontend/dist`. Use Node.js **24.x**. Clear old dashboard command overrides if they still point to `vite build` at the repository root.

The routing rule serves the React app for direct page links such as `/passport`, `/places/2`, and `/settings`. Existing public files are served normally; missing `/api` and `/assets` requests retain real 404 responses instead of receiving HTML.

The frontend can deploy before the backend. Destination browsing uses the bundled catalog, but accounts, passports, saved trips, community stories, weather, and AI requests require the FastAPI service. The development Vite proxy is not part of the production build.

When the backend is available, add the following **Vercel environment variable** for Production and Preview, then redeploy:

```text
VITE_API_BASE_URL=https://your-api-host.example/api/v1
```

This value is public and compiled into the frontend. Never put `SECRET_KEY`, database credentials, or the Hugging Face key in a `VITE_*` variable. `VITE_CARTO_API_KEY` and `VITE_ROUTING_URL` are optional public configuration described below.

### Backend setup

Deploy `backend/` to a Python host with PostgreSQL and the system libraries required by WeasyPrint. Start the service from that directory with `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"` (use your host's assigned port). Configure `DATABASE_URL`, a securely generated `SECRET_KEY`, and `CORS_ORIGINS` as a JSON array containing your exact frontend origins, for example `["https://wanderers-znqi.vercel.app"]`. Include preview origins explicitly when testing previews. Set `AUTO_CREATE_SCHEMA=false` and run `alembic upgrade head` before starting the service. Startup then seeds the destination catalog.

Check `/api/v1/health/ready`, then verify guest creation, sign-in, saving a place, and reload persistence from the frontend. `HUGGINGFACE_API_KEY` is required for AI chat; Redis is optional and falls back to in-memory caching. Do not use a local SQLite file for a serverless deployment: personal journals need a durable database. The Socket.IO service in `services/realtime/` is separate and is not used by this frontend deployment.

### When backend features fail on the deployed frontend

The Vercel project publishes `frontend/dist`. Its `/api` fallback does not run
the Python backend. If the frontend requests `/api/v1/health` on the Vercel
domain and receives a Vercel 404, first connect the hosted FastAPI URL rather
than copying provider keys into the frontend.

| Configuration | Set it on | Why |
| --- | --- | --- |
| `VITE_API_BASE_URL=https://YOUR-FASTAPI-HOST/api/v1` | Vercel Production, and Preview if used | Direct the browser to the hosted API; rebuild/redeploy after changing it |
| `CORS_ORIGINS=["https://wanderers-znqi.vercel.app"]` | FastAPI host | Allow requests from the new frontend origin; include other active origins explicitly |
| `DATABASE_URL`, `SECRET_KEY` | FastAPI host's secret store | Durable records and session signing |
| `TINYFISH_API_KEY` | FastAPI host's secret store | Source research; keep verification gates and the existing budget ledger |
| `HUGGINGFACE_API_KEY` | FastAPI host's secret store | Optional AI chat |
| `VITE_CARTO_API_KEY` | Vercel, if a tile key is needed | Public browser map configuration; this key is visible to site visitors |

Local `.env.local` and `.runtime/` files are ignored by Git and are not uploaded
by a Git deployment. Do not put TinyFish, Hugging Face, database or signing
secrets in any `VITE_*` variable. Never reset the research ledger or enable an
unverified live source to work around a deployment problem.

Verify the hosted API's `/api/v1/health/ready` first, then a browser request from
the new frontend. A Vercel 404 indicates a missing route; a failed CORS check
indicates the API's allowed origins; a JSON 401 indicates authentication; a
research 503 can indicate the intentional account/source rollout gate. These
failures have different causes and do not all mean an invalid provider key.


## Validation

```sh
npm --prefix frontend test
npm --prefix frontend run build
cd backend
venv/bin/python -m unittest discover -s tests -v
```

On macOS, WeasyPrint may need `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib:/usr/local/lib:/usr/lib` before the Python command. The backend tests use isolated temporary databases.
