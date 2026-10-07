# Local Visual Verification

All 16 observed student routes have local candidate screenshots at 1536 × 735 CSS pixels. `pnpm --dir client verify` regenerates them and checks direct loading, navigation, history, local downloads, read-only forms, and absence of external HTTP requests.

Only Tutorías and Manuales have sanitized SUM reference images. Comparisons exclude redacted identity/academic regions. No screenshot-equivalence claim is made for the other 14 routes.

## Reference Image Comparisons

| Element | SUM evidence | Local | Status |
| --- | --- | --- | --- |
| Tutorías main origin | (280, 70) | (280, 70) | Matches |
| Tutorías main size | 1256 × 568 | 1256 × 568 | Matches |
| Tutorías title | (300, 90), 1216 × 46 | Same | Matches |
| Tutorías table origin/width | (320, 477), 1176 | Same | Matches |
| Tutorías column labels and empty state | Six columns, no registered tutors | Same | Matches; minor text/border rasterization differences remain |
| Manuales first resource origin | Reference crop ≈ (60, 163) | Main crop (60, 163) | Matches |
| Manuales first resource height | ≈ 79 | 79 | Matches |
| Manuales resource width | Notes: 525; image: ≈ 533 | 533 | Notes and image disagree; image geometry used |
| Manuales stacked cards | 79–100 px | 79–99 px | Within 1 px in visible cards |
| Manuales gray top strip | Visible below header | Reproduced | Corrected |
| Manuales content below viewport | Reference capture clips white content | Local content remains scrollable | Scroll/capture state unresolved |
| Identity and academic summary | Redacted in reference | Fictional fixtures | Excluded from visual comparison |

## Route Coverage

| Screen | Candidate | Evidence available | Local main height |
| --- | --- | --- | --- |
| home | [home/candidate.png](./home/candidate.png) | Structure and measurements only | 3832.00 px |
| perfil | [perfil/candidate.png](./perfil/candidate.png) | Structure and measurements only | 931.00 px |
| historial | [historial/candidate.png](./historial/candidate.png) | Structure and measurements only | 840.00 px |
| formulario-datos | [formulario-datos/candidate.png](./formulario-datos/candidate.png) | Structure and measurements only | 5588.00 px |
| ficha-socioeconomica | [ficha-socioeconomica/candidate.png](./ficha-socioeconomica/candidate.png) | Structure and measurements only | 9151.00 px |
| matricula-informacion | [matricula-informacion/candidate.png](./matricula-informacion/candidate.png) | Structure and measurements only | 665.00 px |
| programacion-asignaturas | [programacion-asignaturas/candidate.png](./programacion-asignaturas/candidate.png) | Structure and measurements only | 7364.62 px |
| reportes-prematricula | [reportes-prematricula/candidate.png](./reportes-prematricula/candidate.png) | Structure and measurements only | 761.00 px |
| reportes-matricula | [reportes-matricula/candidate.png](./reportes-matricula/candidate.png) | Structure and measurements only | 839.00 px |
| reportes-horarios | [reportes-horarios/candidate.png](./reportes-horarios/candidate.png) | Structure and measurements only | 1057.00 px |
| reportes-evaluaciones | [reportes-evaluaciones/candidate.png](./reportes-evaluaciones/candidate.png) | Structure and measurements only | 604.00 px |
| reportes-deudas | [reportes-deudas/candidate.png](./reportes-deudas/candidate.png) | Structure and measurements only | 587.00 px |
| asistencia | [asistencia/candidate.png](./asistencia/candidate.png) | Structure and measurements only | 832.00 px |
| tutoria | [tutoria/candidate.png](./tutoria/candidate.png) | Sanitized image and notes | 568.00 px |
| plan-estudios | [plan-estudios/candidate.png](./plan-estudios/candidate.png) | Structure and measurements only | 4006.62 px |
| manuales | [manuales/candidate.png](./manuales/candidate.png) | Sanitized image and notes | 1064.00 px |

## Measurement Checks and Remaining Gaps

- Shared shell dimensions match the recorded desktop geometry on every route.
- Home was also rendered at its original 1038 × 711 reference viewport. Its first shortcut card starts at (301, 691) and is 464 px wide; these positions are asserted by `verify`.
- Profile tabs and major two-column layout use the observed geometry. Academic and password tab contents were not observed and remain disabled.
- Report table origins match the recorded positions: prematrícula y=575, matrícula y=653, evaluaciones y=513, deudas y=477. Course programming and curriculum headers begin at y=513 and y=445.
- Attendance uses top-of-page y=513 for its grouped header; the source capture was scrolled 167 px, making its observed y=346.
- Personal data forms: source recorded 61 textboxes/80 comboboxes; the local draft has 46/69. Socioeconomic forms: source recorded 107/76; the local draft has 74/108. The observed 8/12 form sections are represented. Exact field names, types, ordering, and some page heights require further sanitized evidence.
- The source page did not finish loading during a label-only follow-up attempt. No additional source field values or screenshots were retained.
- Institutional assets, header dropdown/hover behavior, home shortcut result states, narrow layouts, and unobserved action results remain unverified.
- Local downloads are fixture CSV exports, not replicas of unobserved SUM-generated PDFs or documents.

Build, lint, and Chromium verification results are recorded alongside `check-results.json` and `measurements.json`.

## Final Validation

- `pnpm --dir client build`: passed, exit 0.
- `pnpm --dir client lint`: passed, exit 0.
- `pnpm --dir client verify`: passed, 16 routes, zero page errors, zero console errors, zero external HTTP requests.
- All 16 route directories contain `candidate.png` and verification notes. Two additional main-region captures support comparison with the sanitized image references.
