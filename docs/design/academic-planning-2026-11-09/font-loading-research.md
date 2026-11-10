# Geist Serif: loading research

Date: **2026-11-09**. Research only; implementation belongs to the root agent. Primary public sources were fetched as documents/API responses, without browser, REA, production SUM, local servers, installation or private data access. Font and package bytes were inspected in memory only; no binaries were saved.

## Recommendation for this repository

Self-host **one unmodified Geist Serif Regular WOFF2**, referenced by `@font-face` in planning-specific CSS, with `font-style: normal`, `font-weight: 400`, `font-display: swap` and a serif fallback. Prefer `client/src/assets/fonts/GeistSerif-Regular.woff2` plus a relative CSS `url()` so Vite fingerprints it. Preserve the reference-inspired layout, shadcn components and every interaction. Apply typography only within `/local/programacion-academica` and its panels, respecting [the binding design direction](../../design-direction.md); student SUM and `/` / `/local/modulos` stay unchanged.

**`public` is a storage/URL choice, not an alternative to CSS.** Both storage options still require `@font-face` and a scoped `font-family`. Moving identical bytes to `public` does not inherently make them faster. The recommendation above is a repository-specific implementation decision, not a measured performance result.

## Verified upstream artifact and license

The selected [Vercel Serif page](https://vercel.com/font?type=serif) links to the official repository/release and identifies OFL licensing. The official [v1.9.2 release](https://github.com/vercel/geist-font/releases/tag/v1.9.2) resolves to commit **`ef2597cfc42f4797676df105517ccc0a1cfa6569`**, verified through the [tag API](https://api.github.com/repos/vercel/geist-font/git/ref/tags/v1.9.2). Use that immutable commit, rather than `main` or `latest`, for reproducible acquisition.

| Artifact | Verified path / download |
| --- | --- |
| Recommended static Regular WOFF2 | [`fonts/GeistSerif/webfonts/GeistSerif-Regular.woff2`](https://raw.githubusercontent.com/vercel/geist-font/ef2597cfc42f4797676df105517ccc0a1cfa6569/fonts/GeistSerif/webfonts/GeistSerif-Regular.woff2) |
| Optional shape-variable WOFF2 | [`fonts/GeistSerif/webfonts/GeistSerifVF.woff2`](https://raw.githubusercontent.com/vercel/geist-font/ef2597cfc42f4797676df105517ccc0a1cfa6569/fonts/GeistSerif/webfonts/GeistSerifVF.woff2) |
| Required license/copyright notice | [`LICENSE.txt`](https://raw.githubusercontent.com/vercel/geist-font/ef2597cfc42f4797676df105517ccc0a1cfa6569/LICENSE.txt) |
| Official release archive | [`geist-font-v1.9.2.zip`](https://github.com/vercel/geist-font/releases/download/v1.9.2/geist-font-v1.9.2.zip) — release asset existence verified; archive contents not inspected |
| Published package alternative | [`geist@1.9.2` metadata](https://registry.npmjs.org/geist/1.9.2), [`geist-1.9.2.tgz`](https://registry.npmjs.org/geist/-/geist-1.9.2.tgz) |

The npm tarball was inspected in memory: exact members are `package/dist/fonts/geist-serif/GeistSerif-Regular.woff2`, `package/dist/fonts/geist-serif/GeistSerifVF.woff2` and `package/LICENSE.txt`. The [package implementation](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/packages/next/dist/serif-regular.js) uses `next/font/local`; this Vite application needs the font asset and CSS, without installing that Next.js integration.

Direct raw WOFF2 responses returned the `wOF2` signature:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Regular | 46,904 (45.8 KiB) | `98979c19f111bc48d731702d40b8707845b667def7f722ee1b49346a75151dad` |
| Variable | 49,036 (47.9 KiB) | `022e59b139ab2ce6962d91fe08539ea9e5f4a734d1bdffbf6fbbb9bc46921e96` |

The pinned [OFL 1.1 license](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/LICENSE.txt) permits embedding and redistribution with software, retaining its copyright notice and license. Fonts cannot be sold alone; modified fonts remain under OFL and must respect any reserved names. For implementation, copy the full upstream notice alongside the distributed font and keep attribution accessible. Using the unmodified Regular avoids a custom derivative. If subsetting later, review those conditions and retain provenance; do not assume modification removes licensing obligations.

## Weights, axes and Spanish

**This Serif is not a 100–900 weight-variable family.** Official [Regular](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/packages/next/dist/serif-regular.js) and [variable](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/packages/next/dist/serif-variable.js) integrations both declare weight **400**. The verified artifact tree provides Regular, Square, Triangle and Heart, with no bold or italic Serif files. Do not declare `font-weight: 100 900`, or claim genuine 600/700/italic faces exist.

The variable TTF's `fvar` metadata, read directly in memory, has only **`ELSH`, minimum/default 0, maximum 100**; `OS/2.usWeightClass` is 400. The official [package README](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/packages/next/README.md#geist-serif-variants) maps Regular = 0, Square = 25, Triangle = 50 and Heart = 100. The [build script](https://github.com/vercel/geist-font/blob/ef2597cfc42f4797676df105517ccc0a1cfa6569/scripts/build-geist-serif.py) explains that this axis switches glyphs, and produces WOFF2 from the TTF. There is no weight, width, optical-size or italic axis in the inspected variable TTF. Use the smaller static Regular when no shape switching is requested.

The [selected official glyph inspector](https://vercel.com/font?type=serif) lists accented Latin letters. The pinned [Serif glyph sources](https://github.com/vercel/geist-font/tree/ef2597cfc42f4797676df105517ccc0a1cfa6569/sources/GeistSerif.glyphspackage/glyphs) and the variable TTF's Unicode cmap ranges include `ÁÉÍÓÚÜÑ áéíóúüñ ¿¡ ºª €` and combining acute, tilde and diaeresis. This supports Spanish coverage; it is not a browser shaping or visual-quality test. No Latin-only prebuilt Serif subset was found among the official font/package files inspected. Start with the complete 45.8 KiB Regular rather than an ASCII subset that loses Spanish or an unverified third-party subset.

Because only normal 400 exists, existing bold planning labels may become browser-synthesized bold if they inherit Serif. Root should explicitly verify that appearance and preserve hierarchy. Never relabel synthetic bold as an upstream weight. Upstream describes Serif as a display family; compact tables and controls require actual readability checks, without redesigning the approved layout.

## `src/assets` versus `public`

According to [Vite static asset handling](https://vite.dev/guide/assets):

| Placement | Build behavior | Practical consequence |
| --- | --- | --- |
| `src/assets/fonts/…` through CSS `url()` | Joins the build asset graph; emitted filename gets a hash | Automatic changed-content URL; preferred here |
| `public/fonts/…` through `/fonts/…` | Copied verbatim to build root | Stable filename; manage versioning/cache invalidation explicitly |

Vite generally recommends imports unless public-directory guarantees are needed. Small imported assets may become base64 under `assetsInlineLimit`; avoid that for fonts and verify a separate emitted WOFF2. Neither placement sets production HTTP cache headers. Content hashes enable safe long-lived immutable caching when the deployment supplies appropriate headers. A public asset could achieve equivalent caching with an explicitly versioned filename, but placement alone supplies no speed advantage.

## Display strategy and route loading

The [CSS Fonts specification](https://www.w3.org/TR/css-fonts-4/#font-display-desc) gives `swap` a very short block period and unlimited opportunity to replace fallback after loading. `optional` uses the font only if available promptly and avoids a later font-induced jump; a browser may deprioritize, abort or skip its download. Timing is browser-controlled, not an exact cross-browser promise.

| Strategy | Benefit | Cost for this task |
| --- | --- | --- |
| `swap` — recommended | Text appears promptly; successful loading eventually displays the explicitly selected Serif | Different fallback metrics can change wrapping/layout |
| `optional` | Prioritizes stable first rendering, avoiding late swaps | Slow first visits may show fallback throughout the page lifetime |

This recommendation balances performance with the user's explicit font choice. `optional` is appropriate only if fallback for an entire slow visit is acceptable. It does not guarantee fewer transferred bytes. [Google's font guidance](https://web.dev/articles/font-best-practices) supports self-hosted WOFF2, limited font variants, careful display policy and avoiding inlined fonts. Measure before claiming any LCP/CLS improvement; choose fallback metric adjustments from real font measurements, not guessed values.

Do **not** add Serif preload to shared `client/index.html`: it would request a planning-only resource on student/module-chooser entry. Initially rely on normal CSS discovery and actual planning use. A global `@font-face` declaration alone does not require downloading an unused family, but global family assignment or preload can. Apply the family only to the planning scope, including planning-owned Radix portals if they render outside `.planning-root`, without restyling shared student primitives.

If measurement later identifies late font discovery, consider at most one planning-route-only preload for Regular using the exact emitted URL, `as="font"`, `type="font/woff2"` and `crossorigin`. Remove route-owned preload when leaving that route; do not preload other variants or add a third-party connection. Preload consumes bandwidth even when unused and competes with other resources; [Google's preload guidance](https://web.dev/articles/preload-critical-assets) recommends selecting genuinely critical assets and matching font CORS mode.

## Local evidence, limits and acceptance handoff

Repository facts supplied by root, **not independently re-verified here**: `PlanningShell.css` currently uses system-ui; student `index.css` declares Poppins 400 at `/fonts/poppins-latin.ttf`, 152 KiB, `swap`; `client/index.html` has no font preload. Directly reviewed `client/vite.config.ts`: no custom `assetsInlineLimit`, `publicDir` or font-specific build rule. Root/client instructions and design direction were read. No code lookup was needed; CSS/config inspection does not require CodeGraph initialization.

Documentation acceptance completed: immutable asset/license URLs were fetched; WOFF2 signatures, sizes and hashes checked; tag commit and npm tar members checked; official weight/axis documentation checked against upstream TTF metadata; all recommendations separated from upstream facts. Only this Markdown artifact was written. No app checks were run for this documentation stage.

Implementation acceptance for root, **planned, not executed**:

| Criterion | Check and expected result |
| --- | --- |
| Reproducible lawful asset | Download pinned Regular; SHA-256 equals table; distribute full pinned license |
| Separate cached resource | Build output contains one referenced hashed WOFF2, no base64 embedding; inspect deployment cache headers separately |
| Route isolation | Cold student/module-chooser loads request no Geist Serif; planning entry requests only Regular; repeat navigation reuses cache |
| Chosen typography | Planning normal text resolves to Geist Serif after loading; Spanish sample renders; font failure leaves readable fallback |
| Preserved UI | Same route/content/state: sidebar, shadcn dialogs/sheets, tables and Semana retain layout and interactions; check narrow screen, 200% zoom and keyboard paths |
| Honest weight behavior | Inspect existing 500–700 labels; document synthetic rendering or use a deliberate scoped normal-weight hierarchy without claiming extra faces |
| Measured performance | Compare cold/throttled and warm runs for transfer, discovery, LCP/CLS and wrapping; no numerical improvement claimed beforehand |

Student visual regression, client checks and any synthetic integration scenarios required by the implementation assignment remain root responsibilities. Browser behavior, actual cache headers, route chunk timing and compact-text readability remain unverified in this research stage.
