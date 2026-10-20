# Encrypted local CARTO configuration

Source: user request on 2026-10-20; journeys derived for this change.

As a developer, I can use the supplied CARTO tile key without storing it in
plaintext in an environment file or committing it. Existing map, passport and
trip-route callers continue to use the shared `TravelMap` component.

## RED and GREEN

- RED: `cd frontend && node --test tests/carto-env.test.mjs` ran six tests;
  all failed because the encrypted configuration loader did not exist.
  Local checkpoint: `b15cb9c`.
- GREEN: the same six tests passed after implementing the loader and Vite
  configuration. No frontend runtime dependency was added.
- Coverage: `cd frontend && node --test --experimental-test-coverage
  --test-coverage-include='config/carto-env.mjs' tests/*.test.mjs` passed 32/32
  tests. The new loader has 100% line, branch and function coverage. This
  coverage figure applies only to that loader.

| Guarantee | Test | Result |
| --- | --- | --- |
| Authenticated ciphertext becomes the existing map key; encryption material is not exposed through Vite defines | `carto-env.test.mjs`, encrypted configuration | PASS |
| Unconfigured checkouts work; a public deployment key takes precedence without requiring a local encryption key | `carto-env.test.mjs`, deployment configuration | PASS |
| Missing or incorrect encryption keys, altered ciphertext and malformed envelopes fail with a sanitized error | `carto-env.test.mjs`, four rejection cases | PASS |

## Verification

- Build/types: `npm run build` in `frontend` passed (`tsc && vite build`).
  Existing large WebGL chunk warning remains.
- Lint: no lint script is configured. `node --check` passed for the loader and
  new test file; `git diff --check` passed.
- Tests: 32/32 frontend tests passed, including six new configuration tests.
- Integration: Vite's development transform supplies the decrypted key to
  `TravelMap`; the production map bundle contains the configured tile key.
- Live provider: Voyager and dark tiles, both standard and `@2x`, each returned
  HTTP 200 and a valid PNG signature using the supplied key.
- Storage/security: `frontend/.env.local` contains ciphertext only. It and
  `.runtime/carto-env.key` are ignored by Git and have mode 0600; `.runtime`
  has mode 0700. No plaintext environment file was generated. Encryption
  key material and ciphertext were verified absent from browser bundles;
  tracked source contains no supplied credential.
- Diff: limited to the loader, Vite configuration, environment example, tests
  and documentation. Map callers, tile styles and attribution are unchanged.

## Limits

The existing map requests CARTO directly, so the tile key is public in browser
requests and compiled JavaScript, consistent with [Vite's environment variable
documentation](https://vite.dev/guide/env-and-mode). This is storage encryption,
not a server-side secret proxy. Anyone with access to both local files can
decrypt the value; keep a separate secure backup of the encryption key.

No production deployment, full browser interaction test or backend test was
performed. The backend is unaffected by this frontend configuration change.
