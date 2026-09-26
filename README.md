# Wanderer

A React + FastAPI travel discovery site for India's lesser-known places. This implementation follows the core discovery → planning → visit → passport journey in `SUPER_IMPROVEMENT.md` and retains the archival passport styling in `stitch_travel_stamp_passport_system`.

## Run locally

From the project root:

```sh
bash run_local.sh
```

Open **http://127.0.0.1:5173**. The API runs on port 8000; Vite proxies `/api` requests. Stop both services with Ctrl+C.

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

## Working features

- Editorial home page with the supplied Google Stitch colour direction: coral red, teal and amber accents, cool light surfaces, and charcoal dark mode. Responsive destination cards, SVG icons, subtle motion, and reduced-motion support.
- Settings at `/settings` with persistent Light / Dark / System appearance and desktop Top / Bottom / Both navigation. The bottom menu includes Home, Explore, 3D Map, Trips, Community, Passport, About, Profile and Settings, arranged in two rows on small screens. Stories live under Community.
- Recovered catalog of 30 places from the legacy database, with coordinates, category groups, suggested activities, trip durations, estimated budgets, and travel notes.
- Search by destination/state/category and simple phrases, combinable state/status/budget filters, sorting, incremental results, and saved-category recommendations.
- Deep links at `/places/:id`, with a keyboard-accessible detail dialog, nearest catalog destinations, exact-coordinate map links, and hotel/restaurant search links.
- Current weather, feels-like temperature, humidity, wind, visibility, rain probability, UV, sunrise/sunset, and five-day forecasts. Requests load as cards enter view and are cached for 15 minutes. Provider failures show an explicit retry state.
- Interactive Leaflet/CARTO maps, location requests, selectable markers, and marker colors based on travel status. At this catalog size all 30 markers are lightweight; clustering is not yet needed.
- Database-backed guest passports, account registration that preserves the guest journal, and sign-in to an existing passport.
- Passport dashboard with searchable, sortable stamps, state filters, saved places, saved trips, a discoveries map, achievements, a quick visit logger, and journal export.
- Sign-in and registration with password visibility, a default “Keep me signed in” option, tab-only sessions when unchecked, and device sign-out. Browser storage keeps the session token, never the password.
- Custom 404 for unknown paths and missing destinations; a branded loading screen during passport/map loading with random travel jokes, shuffle/pause controls, and reduced-motion support. Preview at `/404` and `/loading`.
- Saved / Want To Visit / Exploring / Visited / Not Visited statuses, visit dates, personal ratings, editable memories, stable stamp IDs, and journal exports.
- Travel XP, four tiers, progress, achievements, state collections, and a map of discoveries.
- Trip dates, origin, travelers, travel style, transport mode, budget estimates, generated day plans, persistent trips, and reopening a saved plan. Add and reorder up to three stops, choose a starting city or use your location, and save the starting coordinates and ordered stops with the trip. Save a reopened plan to create a new copy.

## Data and integration boundaries

This is a substantial implementation of the core product, **not completion of every item in the 42-section roadmap**.

- Local persistence uses the existing SQLite configuration. Models also support PostgreSQL via `DATABASE_URL`; PostgreSQL deployment and migration of existing records have not been performed or verified here. Startup creates missing tables and seeds missing catalog destinations without replacing existing records.
- The legacy catalog supplies destination descriptions and coordinates. Newly added costs, durations, difficulty, and activities are clearly labeled planning estimates. Destination photography is illustrative, not verified place-specific imagery. Districts, nearest airports/stations, local history, seasonal access, and detailed culture/food information still need editorial verification.
- Weather uses [Open-Meteo](https://open-meteo.com/en/docs). Maps use [Leaflet](https://leafletjs.com/reference.html), CARTO tiles and OpenStreetMap attribution. Fonts, images, maps, and weather need internet access. Icons and the image fallback are local.
- In-app driving routes use [OSRM](https://project-osrm.org/docs/v5.24.0/api/) with road geometry, distance, estimated duration, numbered stops, and automatic viewport fitting. Requests are cancelled on edits and cached for the session. Unavailable routes show a retry state; no straight line is presented as a road route. Walking directions and public transport legs open in Google Maps; traffic-aware routing and automatic stop optimization are not implemented.
- City lookup uses [Open-Meteo / GeoNames](https://open-meteo.com/en/docs/geocoding-api), with explicit result selection. CARTO tiles use `VITE_CARTO_API_KEY` from `frontend/.env.local` when configured; local environment files are ignored. The default routing endpoint can be overridden with `VITE_ROUTING_URL`. Restart Vite after environment changes. Hotel/restaurant inventories and booking integrations remain external.
- Personal travel notes and ratings remain private. Public profiles, destination-linked text stories, durable drafts, the community feed, reporting, and moderation API controls are now available. Reviews, comments, likes, follows, photos/uploads, and the moderator interface remain future work. See `PUBLIC_IMPLEMENTATION_PLAN.md` for the phased rollout and exact first-release scope.
- Search is deterministic keyword matching with a few aliases, not an AI natural-language service. Recommendations use saved categories, not real-time weather or geolocation ranking.
- XP is derived from current visit records; unmarking a visit reverses associated progression. Editing/repeating a visit never awards duplicate XP. Reward rules and tiers live in `backend/app/services/travel.py`. A historical XP transaction ledger and configurable admin UI remain future work.
- Guest credentials are stored in this browser. Create an account to return to the journal on another device. JWTs currently expire after seven days. Account recovery, token refresh, distributed rate limiting, and production operations still require deployment work.

## Validation

```sh
cd frontend
npm run build
npm test
cd ../backend
venv/bin/python -m unittest discover -s tests -v
```

The backend suite uses an isolated temporary database. It checks ownership boundaries, visit validation, duplicate XP, stamp persistence, registration/login, trip persistence, and milestone progression.

With both servers running, `node pdf-generator/check-wanderer.cjs` runs a headless browser test using the existing Chrome for Testing installation in this checkout. It exercises search, saves, visits, reload persistence, budgeting, trip saving, markers, live weather, deep links, keyboard dismissal, and mobile overflow. Screenshots are saved to `artifacts/`.

`node pdf-generator/check-settings-routes.cjs` checks preference persistence, system theme changes, charcoal colours, desktop and mobile navigation, a live route and configured CARTO tiles, then uses deterministic route/search responses to check stop ordering, save/reopen, transport modes, errors, retries and stale request cancellation.

Session recovery distinguishes expired/rejected sign-ins from connection failures. Sign in again to restore an account or explicitly start a new guest passport; existing server records are retained. Temporary network failures retry the existing session, and reconnecting to the network or signing in in another tab refreshes the passport automatically. `npm test` in `frontend` checks these recovery and request-race cases.

With the frontend running, `node pdf-generator/check-passport-login.cjs` verifies passport navigation/search, login errors, local and tab-only session persistence, logout, loading facts, unknown routes, and mobile light/dark layouts. It uses deterministic API responses without changing any real journal and saves screenshots to `artifacts/`.

Security and login checks also cover legacy bcrypt accounts, account/guest classification, required token expiry, non-cacheable private responses, registration validation, and escaped PDF export text with resource loading disabled. The browser login check uses installed Chrome when the bundled test browser is absent; set `WANDERER_URL` to test a different local port.

## Public community — first release

Open `/community` or `/blogs` to browse stories, `/write` to create and manage drafts, and `/profile` to choose whether your community profile is public. Profiles default to private. Publishing a story requires an account and explicit public-profile consent; existing Passport notes, ratings, dates and trips stay private. See [the implementation plan](PUBLIC_IMPLEMENTATION_PLAN.md) for features, verification and remaining work.
