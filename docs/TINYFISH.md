# TinyFish travel research

The planner includes source-backed trip essentials and a stays/experiences
shortlist. Visitors, including guests, pay nothing. There is no checkout,
subscription, credits purchase or funding prompt in Wanderers.

## Local setup

Use the existing backend setup in the README first. From the repository root:

```sh
backend/venv/bin/python scripts/store-tinyfish-key.py
```

The prompt hides the key. The script writes AES-256-GCM ciphertext to
`backend/.env.local`, using a separate random 256-bit key in
`.runtime/tinyfish-env.key`. Both files are ignored and owner-readable only.
Keep a secure, separate backup of the encryption key. The ciphertext is not
recoverable without it; a reader with both files can decrypt it.

The script preserves other settings, removes an old local plaintext TinyFish
entry, and resets verification switches on every rotation. Remove old plaintext
`TINYFISH_API_KEY` entries from `backend/.env` or the shell environment as well:
an environment-supplied key takes precedence. No real TinyFish key is included
in the repository or test fixtures.

For production, provide `TINYFISH_API_KEY` through the backend host's secret
store. Never use a `VITE_*` variable for it. Restart the backend after changes.
Apply `alembic upgrade head` against the intended database before deployment.
The additive migration preserves existing users and trips.

## Account and source verification

All provider calls are disabled by default. Before enabling them:

1. Verify the account's actual Search/Fetch allowances and metering. Use a key
   dedicated to this app, and leave automatic wallet reload disabled. Set
   `TINYFISH_DISCOVERY_VERIFIED=true` only after confirming the allowances.
2. Check the account's Agent rate and default maximum steps. The shipped rate
   is 16 thousandths of USD per step ($0.016), and the fallback limit is 150
   steps. Update the rate if this account differs. If the default maximum
   cannot be confirmed, keep paid browsing disabled.
3. Confirm whether custom step limits are enabled for the account. Only then
   set `TINYFISH_CUSTOM_STEP_LIMIT=true`; this sends a 25-step cap. Non-beta
   accounts must leave this false. The API currently beta-gates custom caps.
4. Set `TINYFISH_BILLING_VERIFIED=true` after checking billing. Pilot one source
   at a time using the same authenticated research endpoint and bounded
   settings. Record the observed dates/occupancy, source URL, price basis,
   final status and reported step count. A source is enabled for that pilot
   through `TINYFISH_LIVE_SOURCES`; remove it on failure and add the next source
   only after validating the previous one. These pilots spend from the same
   $9 ledger and must not reset it.
5. Enable only tested sources in the JSON array, for example
   `TINYFISH_LIVE_SOURCES=["booking"]`. Approved IDs are `booking`, `makemytrip`,
   `thrillophilia`, and `official`. Login walls, blocked pages and unavailable
   prices remain supplier links rather than verified offers.

### Local verification — 2026-10-20

The supplied key is encrypted locally. The wallet endpoint confirmed the
$0.016 Agent step rate, zero-priced Search/Fetch meters and unconfigured
automatic reload. Discovery is enabled locally; shipped defaults stay disabled.
Custom step-limit access is unverified, so the 150-step reservation stays in use.

The first Booking pilot returned five hotel links in 24 steps ($0.384), but did
not confirm the requested dates. Prices were withheld and Booking remains
disabled for live visitor checks. Discovery and supplier links are usable.
Account verification alone does not establish that a supplier works.

A second, bounded Thrillophilia pilot completed in 16 steps ($0.256), returning
three experience links without confirmed date-specific prices. It also stays
disabled for visitor live checks. Total pilot usage is $0.64 with no outstanding
reservation; the $9 lifetime ledger and daily limits were preserved. The real
essentials discovery returned five source cards and four fetched excerpts,
retaining the remaining link as a useful partial result.

Check current [Agent controls](https://docs.tinyfish.ai/agent-api/reference),
[run limits](https://docs.tinyfish.ai/key-concepts/runs) and
[pricing](https://www.tinyfish.ai/pricing) during onboarding. Paid pilots use
the owner's actual key and an atomic usage reservation.

## Spending and recovery

`TINYFISH_BUDGET_MUSD=9000` is a lifetime app allowance of $9, stored as integer
thousandths of USD. Configuration permits lowering this allowance, not raising
it above $9. It is not a daily reset and changing keys does not reset it.

A shared database row serializes reservations and settlements across workers.
Each run reserves its entire verified maximum: normally $2.40 for 150 steps,
or $0.40 for the opt-in 25-step cap. Completed/cancelled/failed runs settle
only when the provider reports a non-negative integer step count. Missing
usage keeps the reservation. External activity in the TinyFish account is not
included in this app ledger; do not share the integration key with other apps.

Admissions also enforce one active run and one paid check per identity per UTC
day, two active runs globally, and two paid checks per IP per UTC day. IPs are
stored as keyed hashes. Discovery reserves conservative daily quotas of 100
searches and 300 fetched URLs. Failed calls still consume their quota slot.

A lost creation response or interrupted process becomes `UNKNOWN`; the full
reservation stays held and retries reuse that job. Do not delete the ledger,
reset reservations or blindly retry a provider creation. If no provider run ID
was received, reconcile the matching time/goal in the TinyFish dashboard before
an operator changes any stored accounting. The public API exposes no accounting
reset or balance, and supplier links remain available when checks are limited.

## Interface and data guarantees

- `POST /api/v1/research`: validated catalog trip, occupancy, category,
  discovery/live mode and approved source ID. It accepts no raw URL or goal.
- `GET /api/v1/research/{id}`: owner-only status/results, without starting a run.
- `POST /api/v1/research/{id}/cancel`: owner-only cancellation and usage refresh.

Discovery uses at most three searches and five fetched URLs per request.
Stays/experiences are capped at five displayed cards per category. Completed
essentials cache for six hours, shortlists for one hour and live offers for
fifteen minutes. Caches are owner-specific and include the full query inputs.

Stays require matching check-in, check-out, adults and rooms before a price is
date-checked. Experiences require a valid activity date within the trip and
matching adults; hotel rooms do not apply. Currency, price basis, taxes and
cancellation terms are never guessed. Search snippets cannot establish price
or availability. There is no currency conversion or automatic booking.

External content renders as text and links must match approved HTTPS domains.
Jobs use a fresh browser without stored profiles or vault credentials. Source
instructions are untrusted; goals permit read-only search/date filtering only.

The UI restores job IDs from session storage using hashes of the session and
query, rejects stale results after edits, polls every three seconds while the
document and panel are visible, and stops polling when unmounted. Closing a page does not
cancel a provider run: it remains bounded and resumable. Use Cancel to request
provider cancellation; completed work can still incur usage.

## Verification

```sh
npm --prefix frontend test
npm --prefix frontend run build
cd backend
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib:/usr/local/lib:/usr/lib venv/bin/python -m unittest discover -s tests -v
```

With the frontend on port 5175, run `node pdf-generator/check-research.cjs`.
It intercepts all API/supplier traffic with fixtures: no real TinyFish calls,
charges, guest records or bookings. Set `WANDERER_URL` and `CHROME_PATH` if needed.
Screenshots are saved to the ignored `artifacts/` directory.

The broader `alembic check` reports pre-existing user/catalog index differences
from the initial migration. The research migration test separately verifies
that the new tables match their models and preserves existing records across
upgrade/downgrade. PostgreSQL runtime concurrency remains a deployment check;
the automated concurrent-admission tests use SQLite.
