# Repository Guidelines

## Project Scope and Structure

This repository recreates the observable frontend of the UNMSM Sistema Único de Matrícula (SUM). Work in `client/` for the independent React application. Its source is in `client/src/`, static files in `client/public/`, and imported images in `client/src/assets/`. Store SUM observations in `evidence/sum/<screen>/` with a screenshot and concise notes on structure, measurements, and interactions.

## SUM Reference and Safety

Treat the authenticated SUM site as read-only reference evidence. Inspect only pages and controls available to the authorized account; never bypass access controls, probe administrative features, or access another student's data. Do not submit enrollment, change personal details, upload files, or perform any action that could change SUM state. If an observation requires a changed state, ask the account operator to create it manually. Sanitize screenshots and replace personal values with placeholders such as `STUDENT_ID` before saving or sharing them. Never inspect backend internals for frontend discovery.

## Development Commands

Run commands from the repository root:

```sh
pnpm --dir client dev      # Start the Vite development server
pnpm --dir client build    # Type-check and create a production build
pnpm --dir client lint     # Run ESLint
pnpm --dir client preview  # Serve the production build locally
```

There is no configured test script or test framework yet. Run `build` and `lint` for changes to the client.

## Code Style

Use TypeScript and React function components. Follow the existing two-space indentation, single quotes, and no-semicolon style. Name components and component files in PascalCase; use camelCase for functions, variables, and hooks. Keep styles near the relevant screen or component and reuse the existing CSS conventions. Avoid adding dependencies unless the feature needs them.

## Testing and Visual Review

Match the observed SUM evidence rather than inventing behavior. For visual changes, compare the local screen with its reference at the same viewport, route, scroll position, and interaction state. Run `pnpm --dir client build` and `pnpm --dir client lint`; report any check that could not run.

## Commits and Pull Requests

No project commit history is available to establish a message convention. Use a short imperative subject, for example `Add student profile screen`. PRs should explain the user-visible change, link relevant evidence, list validation commands and results, and include sanitized before/after screenshots for visual work. Never include unsanitized student information.
