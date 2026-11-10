# R5 implementation and verification handoff

Date: 2026-11-10. Branch: `feat/planning-shadcn`. Scope: internal `/local/programacion-academica` only. Work performed directly, without delegates, commits, branch/worktree operations or changes to student screens, data adapters, shared contracts, backend source, API effects, validation or save semantics. The initial dirty/untracked checkout was recorded with `git status --short` before the first edit.

## Sources and status

Binding local design decisions: `docs/design/academic-planning-2026-11-10/redesign-spec.md`, its `horario-target.png`, `docs/design-direction.md` where compatible, and `client/src/components/ui/README.md`. The reference is a product design target, not SUM evidence. CodeGraph was consulted before code exploration. Existing components and handlers were reused. Runtime evidence in this directory is observed on the dedicated synthetic stack, not production behavior or pixel parity.

## Files changed by this worker

- `client/src/components/PlanningShell.css`
- `client/src/components/ui/Collapsible.tsx`
- `client/src/screens/AcademicPreparationCourses.tsx`
- `client/src/screens/AcademicPreparationCourses.css`
- `client/src/screens/AcademicResourceEditor.tsx`
- `client/src/screens/AcademicResourceEditor.css`
- `client/src/screens/AcademicScheduling.tsx`
- `client/src/screens/AcademicTeacherReview.tsx`
- `client/src/screens/PlanningContextPanel.css`
- `client/src/screens/PlanningPreparationSummary.tsx`
- `client/src/screens/PlanningSections.css`
- `client/src/screens/PlanningStatusBar.tsx`
- `client/src/screens/PlanningStatusBar.css`
- `client/src/screens/PlanningWeekView.css`

Main acceptance scripts:

- `client/scripts/verify-planning-redesign.mjs`
- `client/scripts/verify-planning-redesign-stack.mjs`

Migrated, not executed (every file passed `node --check`):

- `client/scripts/verify-academic-erp.mjs`
- `client/scripts/verify-academic-persistence.mjs`
- `client/scripts/verify-academic-manual.mjs`
- `client/scripts/verify-academic-teacher-review.mjs`
- `client/scripts/verify-academic-resources.mjs`
- `client/scripts/verify-academic-scheduling.mjs`
- `client/scripts/verify-academic-demand.mjs`
- `client/scripts/verify-academic-compose.mjs`
- `client/scripts/verify-academic-week.mjs`
- `client/scripts/verify-academic-week-scenarios.mjs`
- `client/scripts/verify-academic-preparation.mjs`
- `client/scripts/verify-academic-publication.mjs`
- `client/scripts/verify-cycle-complete.mjs`
- `client/scripts/verify-planning-result.mjs`
- `client/scripts/verify-planning-shimmer.mjs`
- `client/scripts/verify-planning-chat.mjs`

Created: this report, `acceptance.json`, screenshots and logs under `evidence/local/planning-redesign-2026-11-10/`. No 2026-11-09 evidence was overwritten.

## Part A: criterion → implementation → verification

| Defect | Change and expected result | Actual verification / limit |
| --- | --- | --- |
| 1. Course table height | Complete flex/min-height chain through content, preparation, fieldset and workbench; table scrolls in remaining space, demand trigger below; existing vertical resizable detail retained | Passed table height >55% of content, opening/closing course detail; screenshot shows multiple cycle groups instead of four rows |
| 2. Course clipping | Remove Inspector column; course-name link retains `Inspeccionar {courseId}`; row click ignores interactive descendants, selected inspector row has `aria-selected`; fixed compact numeric columns, wrapping name | Passed no Inspector column and no horizontal scroll at 620px. Screenshot exposed numeric value clipping: widened numeric cells and hid browser spin decorations while retaining number input semantics. Final additional 8px capacity-header width passed build/lint only |
| 3. Resource clipping | Remove actions columns; names retain `Abrir ficha de {name}` and open existing sheets; row click and `aria-selected`; flexible name, compact other columns, table minimum 620px with internal scrolling below that width | 1440/1100 screenshots and document-overflow checks captured both tabs. Final screenshot review found long codes overlapping names: final patch truncates codes with full title, uses readable compact header abbreviations and gives units adequate width. That patch passed build/lint but was not browser rerun |
| 4. Disclosures | Shared planning-only trigger class through existing Radix wrapper; left chevron rotates with data-state; ghost, 32px, token-sized 14px text; existing native course/review summaries and demand dialog trigger share affordance; removed resource +/- duplication | Build/lint and captured Resumen/Cursos/Recursos views; no API/handler replacement. Radix aria-expanded behavior retained |
| 5. Readiness list | Corregir only when invalidCourses > 0; merge resource facts into one row and link | Passed zero Corregir links when no corrections and exactly one Revisar recursos link |
| 6. Detail facts | Responsive grid with min(100%, 9rem) columns, labels above values, no vertical dividers; shared docked title token is 18px | Build/lint; section selection/detail open and close passed. Course editor already uses stacked label controls; teacher detail uses a table, not this fact markup. Exact narrow label layout not separately asserted |
| 7. Assistant rail | Rail only at >=1280px; pixel minimum 280px, content minimum remains 45%; existing initial closed-below-1280 rule retained; narrower opened assistant uses Sheet | Passed initial rail width >=280px, close gives >200px back, keyboard reopening and Sheet at 1100px |
| 8. First hour | Offset only first time label with padding and transform override; hourHeight and block geometry unchanged | Build/lint and week screenshot; no separate pixel assertion |
| 9. Result wrapping | Group facts in wrapping flex container; actions can take next line and align right | Build/lint and 1440/1100 schedule screenshots |

## Static checks

All final required static commands exited 0:

- `pnpm --dir client build`: `✓ built in 12.08s` (existing chunk-size/plugin timing warnings retained).
- `pnpm --dir client lint`: `$ eslint .`, no diagnostics. An intermediate lint process ended 143; the final sequential rerun exited 0.
- `pnpm --dir client test:data`: `ℹ tests 302`, `ℹ pass 302`, `ℹ fail 0`, `ℹ duration_ms 484.116693`.
- `pnpm --dir client check:planning-contrast`: final line `ok   dark planning-border/planning-surface: 1.80:1 (min 1.3:1)`.
- All 18 changed scripts: `node --check`, exit 0. See `script-syntax.log`.
- Scoped `git diff --check`: exit 0.

The existing backend build was newer than its TypeScript sources; no backend rebuild was necessary.

## Part B: acceptance execution

Invoked from `client/` exactly three times, using only the authorized stack runner:

```sh
SUM_REDESIGN_API_PORT=3636 SUM_REDESIGN_ENGINE_PORT=3637 SUM_REDESIGN_WEB_PORT=5636 SUM_REDESIGN_EVIDENCE=/home/ubuntu/projects/SUM-reverse/evidence/local/planning-redesign-2026-11-10 node scripts/verify-planning-redesign-stack.mjs
```

Runner supports `SUM_REDESIGN_API_PORT`, `SUM_REDESIGN_ENGINE_PORT`, `SUM_REDESIGN_WEB_PORT`, and `SUM_REDESIGN_EVIDENCE`. Defaults remain 3436/3437/5436 and the previous evidence directory. Port validation/refusal, child environment allowlist, temporary draft directory and disabled LLM configuration remain. It now reports its own child exit states after cleanup.

Attempts:

1. 4/5 passed. Test selector failed because section identifiers contain quotes. Fixed using JSON-escaped CSS attribute value.
2. 6/7 passed. Test's menu accessible name matched both sidebar rail and header trigger. Fixed by targeting `data-slot=sidebar-trigger`.
3. **7/8 passed; exit 1**. Responsive loop reached 800px and selected the background Resumen link to Cursos while the sidebar Sheet was open. The overlay correctly intercepted it. Fixed after this run by scoping navigation discovery and clicking to `#planning-tour-nav`. This last selector correction was syntax checked, not browser rerun. No fourth attempt was made.

Final executed check results:

- PASS `light-default-catalog-checklist-and-header`
- PASS `theme-dark-and-light-persist`
- PASS `select-all-courses-and-preparation-table-layout`
- PASS `row-a-generation-and-result-facts`
- PASS `table-week-filters-selection-and-section-detail`
- PASS `assistant-minimum-close-returns-width-and-sheet`
- PASS `sidebar-collapse-and-mobile-keyboard-menu`
- FAIL `all-six-views-no-document-overflow`

`no-browser-exceptions-or-external-requests` was not reached as a standalone check. The recorded arrays are nevertheless `errors: []`, `external: []`; no browser exceptions or external requests were observed before termination.

Responsive coverage completed: all six views at 1440 and 1100px; Resumen at 800px. The mobile menu and keyboard navigation at 390px passed their separate check. Full six-view coverage at 800 and 390px remains unverified.

Exact final acceptance summary:

```text
7/8 passed; evidence: /home/ubuntu/projects/SUM-reverse/evidence/local/planning-redesign-2026-11-10
```

Exact final cleanup output:

```text
Own synthetic stack stopped: [{"pid":354773,"code":1,"signal":null},{"pid":354755,"code":143,"signal":null},{"pid":354747,"code":null,"signal":"SIGTERM"},{"pid":354720,"code":null,"signal":"SIGTERM"}]
```

The raw `acceptance.json` retains an inherited provenance sentence about an injected normative error. No normative transport-error scenario was actually run in this revised suite; requests/responses in the report show the real scope. The script's provenance text has been corrected for subsequent runs; raw outcomes were not changed.

## Retired checks and coverage changes

Obsolete assertions removed/replaced: Geist face/resource checks (Open Sans is now the product font); cold-start dark (default is light); >=40px header controls (spec mandates 32px); numbered/sidebar-group assumptions; in-panel Generar horarios (generation is Row A); Semana default (Tabla now defaults); duplicated per-view toolbars (one shared toolbar); table row Editar horario buttons and Acciones column (inspect section number, then edit in detail); expandable review/publication panel summaries (these are sections); old publication heading/disabled preapproval publish button (Decisión/Publicaciones, publish only after approval); Corregir on valid data and duplicate resource links. Existing identifiers/accessibility names are retained where supported.

The redesigned main suite covers the requested R5 path: catalog/checklist, select-all, real generation, strip facts, shared filters/selection, detail, assistant width/Sheet, themes with reload persistence, sidebar and responsive views. The former main script also exercised actual schedule mutation, explicit draft persistence, normative queries/errors, adviser recommendations, mobile agenda editing, system theme, font fallback, student isolation and 200% reflow. These are not removed product capabilities; they are **not claimed as verified in this run**. Relevant standalone academic/chat scripts were selector-migrated and syntax checked only, as requested. No assertions were relaxed in response to product failures; the three execution failures were selector errors.

## Process ownership and remaining work

Every stack run awaited its own child shutdown. The final run recorded tester, Vite, Nest and Python exit states above; final build/lint/syntax commands have also exited. No process not started by this worker was attached to, inspected, reconfigured, stopped or killed. No private snapshot variables or private data were accessed.

Remaining: browser-run the corrected navigation helper and final resource/code/header sizing; complete the six-view 800/390 matrix and terminal error check under separately authorized future execution. No additional runtime acceptance was attempted beyond the three-run cap. No claim of complete integrated acceptance or SUM-reference fidelity is made.
