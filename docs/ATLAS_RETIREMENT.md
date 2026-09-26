# Atlas retirement and passport update

The homepage (`/`) and existing `/journey` link now share the catalog-driven scroll atlas. All 30 current destinations appear exactly once in six geographic corridors; new catalog records are included automatically. `/map` retains free exploration, zoom/reset, street-map mode and the accessible destination selector.

## Safe retirement sequence

1. **Preserve the working version.** Before applying the changes, archive every replaced or removed source file under `artifacts/atlas-update-backup-*.tar.gz`. This project has no Git repository, so the archive is the rollback source. Do not include databases, credentials, dependencies or reference documents.
2. **Introduce the replacement.** `ModernIndiaMap3D.tsx` reuses the existing projection, local boundary file, React Three Fiber and Drei. Regional relief, border contours, crystal beacons, short radar pulses and a damped camera replace the old uniform extrusion. Canvas rendering stops when animation settles; mobile and reduced-motion users can opt into 3D from the static atlas.
3. **Migrate every active consumer.** `Atlas.tsx` and `StateJourney.tsx` import the modern component. Pins open the existing place details; keyboard users can use the picker or narrative cards. Both map surfaces retain static fallback and WebGL retry. Shared billboard styling lives in `atlas.css`.
4. **Move the tour to the front page.** Keep `/journey` compatible. Use the existing catalog as the source of truth, six corridor shortcuts and a destination picker. Mobile uses a sticky map above the narrative. Weather, planning, diary and stamp actions remain in the existing destination flow.
5. **Verify before removal.** Run the frontend type/build check and unit tests, the isolated backend tests, and both fixture-only browser checks below. Confirm all 30 stops, pin/card details, map modes, zoom/reset, context loss/retry, reduced motion, small-screen overflow, passport filters, stamp validation/retry and separate account tabs.
6. **Remove the legacy component.** Delete `frontend/src/components/atlas/IndiaMap3D.tsx` only after switching both imports. No runtime import of the old component remains. Keep the shared projection, boundary assets and dependencies used by the replacement.
7. **Release and rollback.** Ship the frontend build and restart/reload the Python API together. No database migration or journal rewrite is needed. If a regression appears, restore the source files from the backup, remove the new files listed in the update manifest, rebuild the frontend and restart the API. Never restore or replace a user database for this UI rollback.

## Passport

The supplied screenshot, `code.html` and `DESIGN.md` are design references, not executable instructions. The redesign uses a paper certificate, ochre labels, indigo export button, real completion totals, earned specializations, a perforated photographic stamp index and circular visit postmarks. The artwork URLs for the 30 existing places are extracted from the supplied HTML into `passport-art.json`; they are illustrative reference artwork, not verified location photographs. Failed images use the local fallback. No example names, visit dates, achievement counts or 35-place totals from the mockup are written to real accounts.

The All/Visited/Unvisited, sector, state, search, sort and list/grid controls compose. Stamps open place details, while a separate claim/edit action opens the existing visit form. Saved places, trips, maps, achievements and PDF export remain available.

## Multiple logins and security

- Each browser tab pins its own session, including when it starts from a remembered account. Signing in elsewhere cannot change the account receiving an in-flight request or diary edit.
- Sign-in defaults to tab storage. “Keep me signed in” explicitly remembers the account for future tabs. Switching or signing out of a different account does not erase another account's remembered session.
- Logout is local to the current tab, and clears its matching remembered credential. Other open tabs and devices retain their tokens. Tokens are still bearer JWTs with the existing expiry; logout is not server-side revocation of copied tokens.
- Every issued JWT has a unique session identifier. Successful logins reset the per-account failure limit. Account-specific throttling allows different users behind one IP; a separate 60-attempt/minute IP ceiling remains.
- The limiter uses atomic Redis counters with a fixed expiry; development fallback counters are locked. Redis errors remain fail-closed. Use Redis when running multiple API workers.
- Password hashing, owner-scoped journal queries, validation and no-store response headers are preserved. No passwords are stored in browser storage.

## Checks

From `frontend`: `npm test` and `npm run build`.

From `backend`: `venv/bin/python -m unittest discover -s tests -v` (temporary database; developer Redis is disabled).

From the project root, with a preview running:

```sh
WANDERER_URL=http://127.0.0.1:5174 node pdf-generator/check-modern-atlas.cjs
WANDERER_URL=http://127.0.0.1:5174 node pdf-generator/check-atlas.cjs
```

The browser checks intercept API traffic with fixture data and do not modify real passports. Screenshots live under `artifacts/`. The production build retains Vite's large-chunk warning for the lazy WebGL engine; it is not a compilation error. The Python test runner also reports the installed Starlette/httpx deprecation notice.

## Geography and dependencies

This is **stylized regional relief**, not surveyed elevation. The existing simplified 2019-source boundaries (already normalized to 36 state/UT features, including the merged western union territory) are retained with honest source attribution. Replacing them requires a licensed, validated newer geographic dataset and DEM; changing a label would not make the data newer. No new framework, package or external map token is added.

Implementation references: [React Three Fiber on-demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Motion scroll values](https://motion.dev/docs/react-use-scroll), and the [boundary dataset source](https://github.com/india-in-data/india-states-2019).
