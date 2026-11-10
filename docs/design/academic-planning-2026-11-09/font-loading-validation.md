# Geist Serif implementation and validation

Date: 2026-11-09. User-selected font, applied only to the internal academic-planning product. This is a local design decision, not SUM-observed behavior. Source and licensing research: [font-loading-research.md](font-loading-research.md).

## Implementation

`client/src/components/PlanningShell.css` declares one normal 400 face with `font-display: swap`, a relative Vite asset URL, and Georgia/Times fallbacks. `.planning-root` owns the family and disables synthesized weights/styles. Existing planning portals render inside this scope. Hierarchy remains through size, spacing, contrast and selected surfaces; upstream provides no bold/italic faces. No dependency, preload, API contract or student typography was added or changed for this font.

The unmodified official WOFF2 is 46,904 bytes, SHA-256 `98979c19f111bc48d731702d40b8707845b667def7f722ee1b49346a75151dad`. Full OFL copyright/license is distributed under `/fonts/geist-serif/OFL.txt`; asset provenance is in `client/src/assets/fonts/README.md`.

## Executed acceptance

| Criterion | Check | Actual result |
| --- | --- | --- |
| Correct, separately emitted asset | Production build, hash, CSS reference and license comparison | One `GeistSerif-Regular-BhcLWGg-.woff2`, 46,904 bytes, matching SHA-256; one CSS URL reference; full license copied; no global preload |
| Actual selected font | Chromium FontFaceSet and computed planning family | Regular 400 loaded, Geist Serif selected, synthesis `none`; one WOFF2 resource, encoded body 46,904 bytes |
| Readable failure state | New context aborting only Geist Serif WOFF2 | No loaded Geist Serif face; planning text and generation control remain visible through fallback |
| Student/chooser isolation | Fresh independent context for each of `/local/modulos`, `/local/login`, `/alumnoWebSum/v2/inicio` | Zero Geist Serif requests; zero planning roots |
| Preserved behavior and responsive layout | `pnpm --dir client verify:planning-redesign` on its own newly launched, entirely synthetic stack | **12/12 passed**, including real generation, adjustment, save, normative response/error, advisor, keyboard, narrow layouts and 200% text reflow; no page exceptions or external requests |
| Client checks | Build, lint, `test:data` | Passed; **297/297** data tests |
| Visual readability | Root inspected updated desktop timetable, 390px preparation and 200% text screenshots | Hierarchy and wrapped headings remain readable; no document-wide overflow in scripted viewport checks |

Machine acceptance and updated individual screenshots: [local evidence](../../../evidence/local/planning-redesign-2026-11-09/acceptance.json). Previous comparison composites in that directory predate this font and are not typography acceptance evidence.

## Performance limits

`src/assets` was chosen for automatic content-hashed URLs, not an inherent speed advantage over `public`. This adds 45.8 KiB of font payload to planning compared with its previous system-font stack. It avoids extra variants, base64 embedding, third-party runtime requests and font downloads on the tested cold student/chooser entries.

Production cache headers and warm-cache reuse depend on the deployment and were not verified on this Vite development stack. No numerical LCP/CLS improvement, throttled-network improvement or pixel parity with the inspiration images is claimed. `swap` can change wrapping when fallback metrics differ. The production artifact is prepared for versioned caching; hosting should supply the desired cache policy.
