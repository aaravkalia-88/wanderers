# Vercel deployment verification

Journeys were derived from the deployment request: deploy from the repository root, open a frontend deep link directly, and install reproducible dependencies without the reported source-map vulnerability.

The existing Vercel production deployment reported `ENOENT` and `Command "vite build" exited with 127`. The frontend already built locally; its dependencies and scripts live in `frontend/`, not at the repository root.

## RED

`cd frontend && node --test tests/deployment.test.mjs` executed three tests and failed all three: the root `vercel.json` was missing, and the lockfile resolved `source-map-js` to vulnerable version `1.2.1`. Checkpoint: `c4f5a9d`.

## GREEN

| Guarantee | Check | Result |
| --- | --- | --- |
| Root deployment installs/builds the frontend and publishes its Vite output | Deployment configuration test | PASS |
| Page links resolve to the SPA; API and asset requests avoid the HTML fallback | Deployment route test | PASS |
| Dependencies stay locked and use the source-map fix | Lockfile regression test | PASS |
| Existing map and session behavior still passes | `npm --prefix frontend test` | 26/26 PASS |
| A clean install and the configured production build succeed | `npm ci --prefix frontend --ignore-scripts`, `npm --prefix frontend run build` | PASS |
| Frontend types remain valid | `node frontend/node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json` | PASS |
| Dependency audit is clean | `npm audit fix --ignore-scripts` and clean install audit | 0 vulnerabilities |
| Diff contains no whitespace errors | `git diff --check` | PASS |

The source-map change is a compatible transitive patch to `1.2.2`. No application behavior or backend code changed. No lint script is configured. Application-wide coverage was not measured; this change adds deployment configuration and a dependency update rather than executable product logic. The production build still warns about the existing large 3D map bundle.

## Production verification

Commit `d41efcc9aeca2f9ca7e895f3c0419334998347e2` was pushed to `main` and deployed to the existing `wanderers` project. Vercel reported production deployment `dpl_HzrgwStHq7GYWNBdpn4egs26TRqb` as `READY` on 2026-10-12. The account reports an active `hobby` plan; no upgrade was requested.

Unauthenticated checks at `https://wanderers-omega.vercel.app` returned the React document with HTTP 200 for `/`, `/passport`, `/places/2`, and `/settings`. `/india-states.geojson` returned HTTP 200 with its GeoJSON content type. `/api/v1/health` and `/assets/missing.js` returned HTTP 404 without the SPA document. The homepage rendered in the browser with the destination journey and navigation. The generated `wanderers-dx41.vercel.app` alias redirects to Vercel authentication; use the public `wanderers-omega.vercel.app` alias.

Backend integration remains pending until a FastAPI service, durable database, CORS origins, and `VITE_API_BASE_URL` are configured. See the README for those settings.
