# SUM Student Frontend

A standalone reconstruction of the 16 observed student screens. All records are fictional. The client does not authenticate with SUM or call SUM endpoints.

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
