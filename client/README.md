# SUM Student Frontend

A standalone reconstruction of the 16 observed student screens. All default records are fictional. The client does not authenticate with SUM. It defaults to local typed mocks and only sends requests to an explicitly configured API base.

## Data sources

Contracts in `../raw-types/` describe the response envelopes. `../raw-types/README.md` provides the twelve routes and `accion` values. Mocks satisfy those contracts and share one fictional student and course set. JSON date fields are strings even where the extracted source types use `Date`.

By default the client uses mocks and makes no data requests. Set `VITE_SUM_DATA_MODE=api` and `VITE_SUM_API_BASE_URL=/api-proxy` to use an operator configured proxy, or set the base URL to an explicitly approved API host. API mode uses POST for all twelve queries. The README specifies POST for the first four and omits the method for eight; using POST for those eight is an assumption that needs confirmation against an authorized capture. The client sends session cookies, so the operator must configure the proxy, session, and CORS. The client does not call SUM's host by default.

Debt has no supplied raw type; its payload remains opaque and the screen does not claim that an empty response proves there is no debt. Tutoring and evaluation item fields are also unknown; their default mock lists are empty and unknown items are not rendered as invented columns. History and socioeconomic screens retain labelled demonstration values because this README does not document endpoints for them.

Copy `.env.example` for local setup. `pnpm --dir client test:data` checks typed mock consistency, API URL/action and error behavior, adapters, and schedule slots.

## Development

Run from the repository root:

```sh
pnpm --dir client install
pnpm --dir client dev
pnpm --dir client build
pnpm --dir client lint
pnpm --dir client verify
```

`verify` starts its own Vite server on port 5181, renders each route at 1536 × 735, exercises navigation and local downloads, blocks external HTTP requests, and saves screenshots and results in `evidence/local/`. It uses Google Chrome when installed at `/usr/bin/google-chrome`; otherwise install Chromium with `pnpm --dir client exec playwright install chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another local Chromium executable.

## Routing and Components

TanStack Router generates `src/routeTree.gen.ts` from `src/routes/` through its Vite plugin. Edit route files, not the generated tree. The root route renders the shared sidebar/header through `components/Shell.tsx`. Screens reuse the table, student-summary, download, and form components. Fictional values are defined in `src/data/` and the screen fixtures.

Open `/alumnoWebSum/v2/inicio` to enter the student frontend. The sidebar exposes every observed route. Links support browser history and direct loading.

## Reference Coverage

Source observations live in `../evidence/sum/`. Only Tutorías and Manuales have sanitized image references; other screens are based on recorded structure and measurements. Personal and socioeconomic field labels are representative where discovery omitted the detailed field layout. Unobserved profile tabs, resource destinations, modification controls, and row-action states remain disabled. Download controls export local fixture CSV files; their SUM download format was not observed.

See `../evidence/local/verification.md` for the visual comparison ledger and remaining limits.
