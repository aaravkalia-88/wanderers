# TinyFish implementation evidence — 2026-10-20

Source: the user-approved TinyFish integration plan in this chat. Visitors,
including guests, pay nothing; owner-funded usage has a $9 lifetime pilot cap.

## Test-first checkpoints

- `05786e6`: six API acceptance tests executed; five failed because research
  endpoints were missing (RED). `3d22540` adds the guarded backend and records
  two executed failing frontend helper cases.
- `f379764`: frontend helper tests/build passed; a new lost-start recovery
  regression failed because abandoned creation remained `STARTING`.
- `4fa277a`: recovery and fixture-only browser flows passed; new experience
  date and currency regressions both failed for their intended reasons.
- `60414bc`: experience/currency fixes passed; the invalid calendar-date
  regression failed because a nonexistent date could be accepted.
- Final implementation parses activity dates, keeps price validation strict,
  and passes all targets below. No provider call or charge was needed for tests.

## Guarantees and results

| Behaviour | Evidence | Result |
| --- | --- | --- |
| Guests can research; private jobs require their owner; all requests are validated | Backend research acceptance tests | PASS |
| Disabled account/source settings make no provider calls and preserve links | Backend mocked-provider tests | PASS |
| Concurrent threads and separate processes cannot overspend the shared ledger | Twelve concurrent admissions and four independent Python processes against SQLite | PASS |
| One active/daily check per identity and two daily checks per IP | Durable-admission tests | PASS |
| Reservations survive ambiguous starts, cancelled runs and missing usage; settlement happens once | Mocked provider lifecycle tests | PASS |
| Search/Fetch quota exhaustion, malformed data, partial failures and unsafe links are handled | Backend discovery/adapter tests | PASS |
| Dates, occupancy, activity dates, currency and invalid numeric prices are checked | Normalization regressions | PASS |
| Local key storage is encrypted, owner-only and preserves unrelated settings; wrong keys fail closed | Encryption and storage-script tests | PASS |
| The migration preserves users/trips and matches the new research models | Upgrade/downgrade/re-upgrade test with fixtures | PASS |
| Default checkout dates and session-isolated resume keys are stable | Two frontend helper tests | PASS |
| Panels support partial results, safe external text, keyboard tabs, retries, cancellation and reload recovery | Fixture-only headless Chrome test | PASS |
| Hidden/offscreen panels pause active-job polling and trip edits reject stale responses | Fixture-only headless Chrome test | PASS |
| Desktop/mobile and light/dark layouts fit without horizontal overflow | Browser assertions and reviewed screenshots | PASS |

## Verification loop

- **Build/types — PASS:** `npm --prefix frontend run build` (`tsc && vite build`).
  Existing large WebGL chunk warning remains.
- **Frontend tests — PASS:** `npm --prefix frontend test`, 34/34.
- **Backend tests — PASS:** from `backend`,
  `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib:/usr/local/lib:/usr/lib venv/bin/python -m coverage run --source=app.services.tinyfish,app.api.v1.research,app.core.tinyfish_secret -m unittest discover -s tests -v`,
  48/48. `venv/bin/python -m coverage report -m` reports 95% statement coverage
  across those three new modules (309 statements, 15 uncovered). This is not
  whole-application or frontend coverage.
- **Browser — PASS:** `node pdf-generator/check-research.cjs` against the local
  frontend. All provider/API traffic is intercepted; no production records or
  TinyFish calls are used. Screenshots are ignored artifacts.
- **Syntax/diff — PASS:** Python compilation, `node --check` for the browser
  harness, and `git diff --check`. No standalone linter is configured.
- **Security review — PASS for this change:** key stays on the server; local
  encryption uses authenticated AES-256-GCM with a separate ignored key;
  structured inputs replace arbitrary goals/URLs; output links are restricted;
  external content is rendered as text; responses inherit authenticated
  `no-store` headers; the usage ledger is private and reserves full run bounds.

## Limits and rollout gates

The supplied key is stored encrypted locally and is absent from tracked files.
An authenticated wallet lookup on 2026-10-20 confirmed the $0.016 Agent step
rate, zero-priced Search/Fetch meters and unconfigured automatic reload. The
app allowance remains $9 regardless of the account's wallet balance. Local
discovery and billing verification flags are enabled; shipped defaults remain
disabled. Custom step-limit beta access is unverified, so paid pilots reserve
the documented 150-step maximum ($2.40).

The initial Booking pilot completed in 24 steps ($0.384), returning five hotel
links with empty check-in/check-out fields. Prices were withheld and
availability remained unconfirmed. Booking stays disabled for visitor live
checks. Pilots use the same durable ledger and daily limits as normal requests;
neither the budget nor counters are reset for verification.
See [setup and verification gates](TINYFISH.md).

The Thrillophilia pilot completed in 16 steps ($0.256) with three experience
links and no confirmed date-specific prices; it remains disabled as well.
Combined paid usage is $0.64 and outstanding reservations are zero. Real
essentials discovery produced five source cards with four fetched excerpts,
demonstrating partial-result handling without invented content. No further
paid pilots were started after these two checks from the same IP that day.

Final verification in this release reran the 34 frontend tests, 48 isolated
backend tests (95% across the research modules), production build/types and
fixture browser assertions. The scoped security and diff review found no
credential in tracked files or unsafe output path in the changed code. Local
Markdown links and the self-contained SVG cover were checked. No standalone
linter is configured. CodeRabbit CLI was unavailable in this session; no
CodeRabbit review is claimed.

Both agreed planner options are included: source-backed trip essentials and
stays/experiences comparison. The hackathon README highlights Search/Fetch
discovery and asynchronous Agent checks, distinguishing implemented behavior,
fixture tests and supplier rollout gates. No production backend was deployed.
At the user's final instruction, this release covers the features,
documentation and GitHub push; the user will create the new Vercel deployment.
The GitHub About URL was corrected to the existing public frontend alias.

SQLite thread/process accounting was exercised. PostgreSQL execution remains a
deployment check. The broader `alembic check` reports pre-existing user/catalog
index drift from migration 0001; the new research tables match their models.

Modern Web Guidance `progress` informed native indeterminate progress with a
label and polite status announcements. Completion does not move focus. No
additional UI framework, browser runtime or TinyFish SDK was added.
