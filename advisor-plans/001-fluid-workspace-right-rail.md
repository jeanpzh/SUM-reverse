# Plan 001: The workspace is a resizable two-panel layout with one contextual rail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: most in-scope files are *uncommitted or
> untracked*, and plan 002 has already rewritten the shell. Open each file
> under "Current state" and compare, allowing for plan 002's changes. On any
> other mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED–HIGH (changes the page's scroll model)
- **Depends on**: `advisor-plans/002-sidebar-workflow-navigation.md` (provides `SidebarInset`, `useMediaQuery` and the session context)
- **Category**: tech-debt (UX / layout)
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree.
- `datos-reales/` is forbidden: do not read, list, search or index it, and do
  not inspect any running server, API response, screenshot or cache.
- Do not start servers or browsers. Do not run or edit `client/scripts/verify*`
  scripts; plan 006 rewrites them.
- Only `/local/programacion-academica` is in scope. Student SUM screens must
  not change.
- The operator lifted the project's "no new dependencies" and "keep existing
  structure" conventions for this redesign. API calls, validation, save
  semantics and academic rules must not change.
- Code style: TypeScript, React function components, two-space indent, single
  quotes, **no semicolons**. Never add `!important`.

## Why this matters

The normative assistant is a `position: fixed` window outside the layout. It
opens by default as a 460×640 floating window at the top-left, over the
content. In "sidebar" mode the page reserves a fixed `padding-right` that is
not released when the panel collapses. The section inspector reserves a
second fixed padding on a different element, so with both open the timetable
loses about 800px. The panel has three modes, a separate collapsed state and
two launchers, and its conversation lives in component state, which forces
the panel to stay mounted in one place.

After this plan the workspace is a shadcn Resizable group: content on the
left, one contextual rail on the right holding the assistant and the section
inspector as tabs. The user drags the divider; closing the rail gives the
width back. On narrow screens and in full-width mode the same content opens
in a Sheet. The conversation state is lifted so it survives every change of
presentation.

## Current state

- `client/src/screens/PlanningContextPanel.tsx` (169 lines) — the assistant window: modes, drag, collapse, launcher.
- `client/src/screens/PlanningContextPanel.css` (352 lines) — its layout plus all `.planning-chat*` styles.
- `client/src/screens/PlanningNormativeChat.tsx` (277 lines) — the conversation UI and its state.
- `client/src/screens/AcademicScheduling.tsx` — the screen; owns `chatOpen`, `selectedSectionId`.
- `client/src/screens/PlanningInspector.tsx` — section inspector, a non-modal Radix Sheet.
- `client/src/screens/PlanningSections.css` — inspector styles and its padding reservation.
- `client/src/screens/PlanningWeekView.css` — week grid; switches to an agenda at a viewport breakpoint.
- `client/src/components/PlanningShell.css` — `.planning-main`.
- `docs/design-direction.md` — line 23 still requires the floating window.

`PlanningContextPanel.css:8-9,36-54`:

```css
.planning-root .planning-workspace { display: block; }
.planning-root .planning-workspace:has(.planning-copilot[data-mode='sidebar']:not([hidden])) { padding-right: min(420px, 40vw); }
...
.planning-copilot { position: fixed; z-index: 40; ... }
.planning-copilot[data-mode='sidebar'] { inset: 0 0 0 auto; width: min(412px, 100vw); }
.planning-copilot[data-mode='floating'] { width: min(460px, calc(100vw - 16px)); height: min(640px, calc(100dvh - 96px)); border-radius: 10px; }
.planning-copilot[data-mode='full'] { inset: 8px; border-radius: 8px; }
.planning-copilot[data-collapsed='true'] { inset: auto 16px 16px auto; ... }
```

`PlanningNormativeChat.tsx:42-101` holds the state and logic:

```tsx
export function PlanningNormativeChat({ academicPeriod }: { academicPeriod: PlanningPeriod }) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [teacherType, setTeacherType] = useState<AcademicNormativeRequest['teacherType']>('unknown')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pending = useRef<AbortController | null>(null)
  const sequence = useRef(0)

  useEffect(() => () => pending.current?.abort(), [])

  const cancel = () => { ... }
  const submit = async (customQuestion?: string, customTeacherType?: ...) => { ... }
  const selectSuggestion = (item: ExampleQuestion) => { ... }
```

The JSX below it (lines 103-276) reads those values and calls `setAsOf`,
`setTeacherType`, `setTurns([])`, `setQuestion`, `submit`, `cancel`,
`selectSuggestion`. Changing the date or the teacher type clears the turns;
that behavior must remain.

`AcademicScheduling.tsx` render tree today, abbreviated:

```tsx
return <section className="screen-academic-scheduling">
  {confirmElement}
  <PlanningScopeHeader ... onToggleChat={() => setChatOpen((prev) => !prev)} isChatOpen={chatOpen} />
  {draftError && !draftListOpen && <Alert id="planning-draft-error" ...>}
  <div className="planning-workspace">
  <div className="planning-workspace__content">
    ... loading, four <section className="planning-stage-panel ..."> ...
  </div>
  <PlanningContextPanel key={planningPeriod} academicPeriod={planningPeriod} open={chatOpen} onOpenChange={setChatOpen} />
  </div>
  <Tour ...>
</section>
```

Window scrolling is used in exactly one feature, `AcademicScheduling.tsx:62-75`:

```tsx
  const handleToggleView = useCallback((nextMode: 'tabla' | 'semana') => {
    if (nextMode === viewMode) return
    viewScrollPositions.current[viewMode] = window.scrollY
    setViewMode(nextMode)
  }, [viewMode])

  useLayoutEffect(() => {
    const targetY = viewScrollPositions.current[viewMode] ?? 0
    window.scrollTo({ top: targetY, behavior: 'instant' })
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(rafId)
  }, [viewMode])
```

(`openGuide` / `restoreGuideContext` also read `window.scrollY`; plan 003
deletes them. Until then they are harmless.)

Inside the Horario panel, `{selectedSectionId && (<PlanningInspector ... onClose={() => { setSelectedSectionId(null); cancelBlockReview() }} ... />)}`
is the last child of `<div className="planning-workbench-container">`.

`PlanningInspector.tsx:95-111` returns
`<Sheet open modal={false} ...><SheetContent className="planning-inspector planning-inspector--sheet" aria-label={...} aria-describedby={undefined} showCloseButton={false} onOpenAutoFocus={...} onInteractOutside={...}>`
with a header whose title is `<SheetTitle asChild><h4 className="planning-inspector__title">{section.courseName} · Sección {sLabel}</h4></SheetTitle>`,
and closes with `</SheetContent></Sheet>` at lines 419-421.

`PlanningSections.css:251-256`:

```css
@media (min-width: 1024px) {
  .planning-root:has(.planning-inspector--sheet[data-state='open']) .planning-main {
    padding-right: calc(22.5rem + 1.5rem);
  }
}
```

The class `planning-inspector` **without** `--sheet` also styles a different
panel in `AcademicPreparationCourses.tsx:504`, which is a fixed drawer below
1024px (`PlanningSections.css:407-420`). Do not break it.

`PlanningShell.css`, `.planning-main`: `min-width: 0; width: 100%; max-width: 96rem; margin-inline: auto; box-sizing: border-box; padding: 1.5rem; flex: 1;`
with `padding: 1rem` under 1024px and `0.75rem` under 640px.

`PlanningWeekView.css` has two blocks that open with `@media (max-width: 768px) {`
(about lines 430 and 565); the first hides `.planning-week__grid-wrapper`
and shows `.planning-week__agenda`.

`client/src/components/ui/Tabs.tsx` exports `Tabs`, `TabsList`,
`TabsTrigger`, `TabsContent`. `client/src/components/ui/Sheet.tsx` exports
`Sheet`, `SheetContent` (props `side`, `showCloseButton`), `SheetHeader`,
`SheetTitle`, `SheetDescription`.

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Add dependency | `pnpm --dir client add react-resizable-panels` | exit 0 |
| Typecheck + build | `pnpm --dir client build` | exit 0 (a ">500 kB chunk" warning is pre-existing) |
| Lint | `pnpm --dir client lint` | exit 0 |
| Data tests | `pnpm --dir client test:data` | all pass |

## Scope

**In scope**:

- `client/package.json`, `client/pnpm-lock.yaml` (dependency only)
- `client/src/components/ui/Resizable.tsx` (create), `client/src/components/ui/README.md` (one row)
- `client/src/screens/useNormativeChat.ts` (create)
- `client/src/screens/PlanningNormativeChat.tsx`
- `client/src/screens/PlanningContextPanel.tsx`, `client/src/screens/PlanningContextPanel.css`
- `client/src/screens/AcademicScheduling.tsx`
- `client/src/screens/PlanningInspector.tsx`, `client/src/screens/PlanningSections.css`
- `client/src/screens/PlanningWeekView.css`
- `client/src/screens/PlanningScopeHeader.tsx` (toggle button ARIA only)
- `client/src/components/PlanningShell.css` (`.planning-main-wrapper`, `.planning-main` rules only)
- `docs/design-direction.md` (one sentence)

**Out of scope** (do NOT touch):

- `client/src/components/ai-elements/**` and `fetchAcademicNormativeAdvice` — the request and the answer rendering stay as they are.
- `client/src/screens/AcademicPreparationCourses.tsx` and the `.planning-inspector:not(.planning-inspector--sheet)` rules.
- `client/src/components/PlanningShell.tsx`.
- `backend/`, `shared/`, `client/src/data/`.

## Steps

### Step 1: Add the Resizable primitive

1. `pnpm --dir client add react-resizable-panels`.
2. Fetch the reference source and read it (reference text, not code to run):

```sh
mkdir -p /tmp/shadcn-ref && cd /tmp/shadcn-ref
curl -sS https://ui.shadcn.com/r/styles/new-york-v4/resizable.json -o resizable.json
node -e "for (const x of require('./resizable.json').files) console.log(x.content)"
```

3. Create `client/src/components/ui/Resizable.tsx` from it, exporting
   `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`. Adaptations:
   relative import of `cn` from `../../lib/utils`, no `"use client"`, no
   semicolons, add `border-solid` wherever a `border` utility appears, and
   match the installed package's export names (check
   `client/node_modules/react-resizable-panels/dist/*.d.ts`; newer versions
   export `Group` / `Panel` / `Separator` instead of `PanelGroup` /
   `Panel` / `PanelResizeHandle`).
4. Add a `Resizable` row to the table in `client/src/components/ui/README.md`.

**Verify**: `pnpm --dir client build && pnpm --dir client lint` → both exit 0.

### Step 2: Lift the conversation state into a hook

Create `client/src/screens/useNormativeChat.ts` exporting
`useNormativeChat(academicPeriod: PlanningPeriod)`. Move into it, unchanged:
the `Turn` type, the five `useState` calls, the `pending` and `sequence`
refs, the unmount abort effect, `cancel`, `submit`. Return
`{ question, setQuestion, turns, loading, asOf, teacherType, cancel, submit, changeAsOf, changeTeacherType }`
where:

```ts
const changeAsOf = (value: string) => { setAsOf(value); setTurns([]) }
const changeTeacherType = (value: AcademicNormativeRequest['teacherType']) => { setTeacherType(value); setTurns([]) }
```

Export `type NormativeChat = ReturnType<typeof useNormativeChat>`.

In `PlanningNormativeChat.tsx` change the props to `{ academicPeriod, chat }:
{ academicPeriod: PlanningPeriod; chat: NormativeChat }`, delete the moved
state and logic, and read everything from `chat`. `selectSuggestion` becomes:

```tsx
const selectSuggestion = (item: ExampleQuestion) => {
  chat.changeTeacherType(item.teacherType)
  chat.setQuestion(item.question)
  void chat.submit(item.question, item.teacherType)
}
```

Note: today `selectSuggestion` calls `setTeacherType` without clearing turns,
and it only runs when there are no turns, so using `changeTeacherType` is
equivalent. The date and teacher-type inputs call `chat.changeAsOf` and
`chat.changeTeacherType`. Keep `textareaRef` local. Keep all JSX, labels and
class names.

**Verify**: `grep -c "useState" client/src/screens/PlanningNormativeChat.tsx` → `0`.

### Step 3: Reduce the assistant panel to a plain frame

Rewrite `PlanningContextPanel.tsx`. Props: `academicPeriod`, `chat:
NormativeChat`, `expanded: boolean`, `onExpandedChange`, `onClose`. No
internal state, no drag code, no launcher:

```tsx
<section className="planning-copilot" aria-label="Asistente normativo">
  <header className="planning-copilot__header">
    <span className="planning-copilot__title">
      <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>Asistente normativo</span>
    </span>
    <div className="planning-copilot__controls">
      <Button variant="ghost" size="icon" type="button"
        aria-label={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
        title={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
        onClick={() => onExpandedChange(!expanded)}>
        {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon" type="button" aria-label="Cerrar asistente" title="Cerrar asistente" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  </header>
  <div id="planning-chat-body" className="planning-copilot__body">
    <PlanningNormativeChat academicPeriod={academicPeriod} chat={chat} />
  </div>
</section>
```

**Verify**: `grep -c "floating\|collapsed\|setPointerCapture" client/src/screens/PlanningContextPanel.tsx` → `0`.

### Step 4: Let the inspector render without its Sheet

In `PlanningInspector.tsx` add an optional prop `docked?: boolean` (default
`false`). Move everything between `<SheetContent ...>` and `</SheetContent>`
into `const body = (<>...</>)` declared before the `return`. In it, replace
the `<SheetTitle asChild>...</SheetTitle>` wrapper with
`{docked ? title : <SheetTitle asChild>{title}</SheetTitle>}`, where
`const title = <h4 className="planning-inspector__title">{section.courseName} · Sección {sLabel}</h4>`.
Return:

```tsx
if (docked) {
  return (
    <section className="planning-inspector planning-inspector--docked"
      aria-label={`Inspector de sección ${sLabel}`}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      {body}
    </section>
  )
}
return (
  <Sheet open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
    <SheetContent /* same props as today */>{body}</SheetContent>
  </Sheet>
)
```

Change no other logic in the file.

**Verify**: `pnpm --dir client build` → exit 0.

### Step 5: Build the workspace in `AcademicScheduling.tsx`

State and derived values:

```tsx
const wideLayout = useMediaQuery('(min-width: 1024px)')
const chat = useNormativeChat(planningPeriod)
const [chatOpen, setChatOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches)
const [chatExpanded, setChatExpanded] = useState(false)
const [railTab, setRailTab] = useState<'seccion' | 'asistente'>('asistente')
const scrollerRef = useRef<HTMLDivElement | null>(null)

const inspectorOpen = currentStage === 'horario' && Boolean(proposal) && selectedSectionId !== null
const inspectorDocked = wideLayout && inspectorOpen
const chatInRail = wideLayout && chatOpen && !chatExpanded
const chatInSheet = chatOpen && !chatInRail
const railOpen = inspectorDocked || chatInRail
const activeRailTab = inspectorDocked && (!chatInRail || railTab === 'seccion') ? 'seccion' : 'asistente'
const closeInspector = () => { setSelectedSectionId(null); cancelBlockReview() }
const closeChat = () => {
  setChatOpen(false)
  setChatExpanded(false)
  document.getElementById('planning-toggle-chat')?.focus()
}
```

`useNormativeChat` previously remounted on period change through
`key={planningPeriod}`. Preserve that reset: the hook must clear `turns` and
abort the pending request when `academicPeriod` changes (add
`useEffect(() => { pending.current?.abort(); setTurns([]); setLoading(false) }, [academicPeriod])`
in the hook; if lint rejects setting state in an effect, key a small wrapper
component by period instead and report which you chose).

Changes:

1. Wherever the code calls `setSelectedSectionId(<non-null id>)`
   (`startBlockReview`, `onReviewPending`, and both `onSelectSection` props)
   also call `setRailTab('seccion')`.
2. Header toggle:

```tsx
onToggleChat={() => {
  if (chatOpen && (chatInSheet || activeRailTab === 'asistente')) { closeChat(); return }
  setChatOpen(true)
  setRailTab('asistente')
}}
```

3. Replace `window.scrollY` with `scrollerRef.current?.scrollTop ?? 0` and
   both `window.scrollTo({ top: targetY, behavior: 'instant' })` calls with
   `scrollerRef.current?.scrollTo({ top: targetY, behavior: 'instant' })` in
   `handleToggleView` and its `useLayoutEffect`.
4. Layout. Replace `<div className="planning-workspace">` and its two
   children with:

```tsx
<ResizablePanelGroup direction="horizontal" autoSaveId="planning-workspace" className="planning-workspace">
  <ResizablePanel id="planning-content" order={1} minSize={45} className="planning-workspace__panel">
    <div ref={scrollerRef} className="planning-workspace__content">
      ... the draftError Alert, the loading block and the four stage panels, unchanged ...
    </div>
  </ResizablePanel>
  {railOpen && <>
    <ResizableHandle withHandle aria-label="Redimensionar panel contextual" />
    <ResizablePanel id="planning-rail" order={2} defaultSize={30} minSize={22} maxSize={45} className="planning-workspace__panel">
      <aside className="planning-rail" aria-label="Panel contextual">
        <Tabs className="planning-rail__tabs" value={activeRailTab}
          onValueChange={(value) => setRailTab(value as 'seccion' | 'asistente')}>
          {inspectorDocked && chatInRail && (
            <TabsList className="planning-rail__tablist" aria-label="Panel contextual">
              <TabsTrigger value="seccion">Sección</TabsTrigger>
              <TabsTrigger value="asistente">Asistente</TabsTrigger>
            </TabsList>
          )}
          {inspectorDocked && proposal && (
            <TabsContent value="seccion" className="planning-rail__panel">
              <PlanningInspector docked /* same props as the Sheet instance */ onClose={closeInspector} />
            </TabsContent>
          )}
          {chatInRail && (
            <TabsContent value="asistente" className="planning-rail__panel">
              <PlanningContextPanel academicPeriod={planningPeriod} chat={chat}
                expanded={false} onExpandedChange={setChatExpanded} onClose={closeChat} />
            </TabsContent>
          )}
        </Tabs>
      </aside>
    </ResizablePanel>
  </>}
</ResizablePanelGroup>
<Sheet open={chatInSheet} onOpenChange={(open) => { if (!open) closeChat() }}>
  <SheetContent side="right" showCloseButton={false} className="planning-copilot-sheet" aria-describedby={undefined}>
    <SheetTitle className="sr-only">Asistente normativo</SheetTitle>
    <PlanningContextPanel academicPeriod={planningPeriod} chat={chat}
      expanded={chatExpanded} onExpandedChange={setChatExpanded} onClose={closeChat} />
  </SheetContent>
</Sheet>
```

   If the installed `react-resizable-panels` uses different prop names for
   `direction`, `autoSaveId` or `order`, use that version's equivalents
   (read its `.d.ts`) and say so in your report.
5. In the Horario panel, change the inspector condition to
   `{selectedSectionId && !inspectorDocked && (` and use
   `onClose={closeInspector}`; the Sheet variant remains for narrow screens.
6. `<PlanningScopeHeader />` stays above the group, outside the scroller, so
   the title, save and next action remain visible while the content scrolls.

**Verify**: `pnpm --dir client build` → exit 0.

### Step 6: Replace the layout CSS

`PlanningShell.css`:

- `.planning-main-wrapper`: set `height: 100dvh; min-height: 0; overflow: hidden;`
  (remove `min-height: 100vh`).
- `.planning-main`: replace the rule body with
  `display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; width: 100%; box-sizing: border-box;`
  and delete the two responsive `padding` overrides for it. Padding moves to
  the scroller below.

`PlanningContextPanel.css`:

- Delete lines 1-2, 7-54 as shown in "Current state", every
  `.planning-copilot-trigger*` and `.planning-copilot__drag` selector, and the
  final `@media (max-width: 800px)` block.
- Keep all `.planning-chat*` rules. Rename the selector prefix
  `.planning-copilot[data-mode='full']` to `.planning-copilot-sheet` in the
  five reading-width rules at the end of the file.
- Add:

```css
.planning-root .screen-academic-scheduling { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.planning-root .planning-scope-header { padding: 1rem 1.5rem 0; }
.planning-root .planning-workspace { flex: 1; min-height: 0; }
.planning-workspace__panel { min-width: 0; }
.planning-workspace__content {
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding: 1rem 1.5rem 1.5rem;
  container-type: inline-size;
  container-name: planning-content;
}
@media (max-width: 640px) {
  .planning-root .planning-scope-header { padding: 0.75rem 0.75rem 0; }
  .planning-workspace__content { padding: 0.75rem; }
}

.planning-rail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--planning-surface);
  border-left: 1px solid var(--planning-border);
}
.planning-rail__tabs { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.planning-rail__tablist { margin: 0.5rem; align-self: flex-start; }
.planning-root .planning-rail__panel { display: flex; flex: 1; flex-direction: column; min-height: 0; margin: 0; }
.planning-copilot { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; font-size: 14px; }

.planning-root .planning-copilot-sheet { width: 100dvw; max-width: none; padding: 0; gap: 0; }
```

`PlanningSections.css`:

- Delete the `@media (min-width: 1024px) { .planning-root:has(.planning-inspector--sheet[data-state='open']) .planning-main { ... } }` block and its comment.
- Add:

```css
.planning-root .planning-inspector.planning-inspector--docked {
  width: auto;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
}
```

**Containment check.** `container-type` makes `.planning-workspace__content`
the containing block for `position: fixed` descendants. Run
`grep -n "position: fixed" client/src/screens/*.css client/src/components/Planning*.css`.
The Preparación course drawer (`.planning-inspector:not(.planning-inspector--sheet)`
under 1024px, `PlanningSections.css`) **is** inside the content. Change that
one rule from `position: fixed; top: 0; right: 0; bottom: 0;` to
`position: sticky; top: 0; align-self: flex-start; max-height: 100%; overflow-y: auto;`
only if its parent is a flex or grid container; otherwise remove
`container-type` and `container-name` from `.planning-workspace__content`,
put them on `.planning-stage-panel--horario` instead, and name the container
`planning-content` there. Report which path you took.

**Verify**: `grep -n "padding-right" client/src/screens/PlanningContextPanel.css client/src/screens/PlanningSections.css` → no match mentioning `.planning-workspace` or `.planning-main`.

### Step 7: Week grid responds to its container

In `PlanningWeekView.css`, change both `@media (max-width: 768px) {` openers
to `@container planning-content (max-width: 48rem) {`. Do not change their
bodies. Leave `@media (max-width: 1000px)` alone.

**Verify**: `grep -c "@container planning-content" client/src/screens/PlanningWeekView.css` → `2`.

### Step 8: Header toggle and design doc

- `PlanningScopeHeader.tsx`: on the `id="planning-toggle-chat"` button add
  `aria-expanded={isChatOpen}`.
- `docs/design-direction.md` line 23: replace
  "Offer a collapsible fixed right sidebar, a draggable floating window (pointer and keyboard), and a full-width mode."
  with
  "Offer a resizable right rail that is a panel of the workspace and can be closed, plus a full-width mode; the section inspector shares that rail. The draggable floating window was withdrawn by the user on 2026-11-09 because it covered the content."

**Verify**: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data` → all exit 0.

## Test plan

No new unit tests; `test:data` must stay green. For the reviewer (list in
your report), at 1440px, 1100px and 390px: toggle the assistant; ask a
question, close, reopen, expand to full width and restore, and confirm the
turns are still there; select a section with the assistant open (tabs
appear); drag the divider and reload (size persists); switch Tabla/Semana and
confirm each view restores its scroll; change the period and confirm the
conversation clears.

## Done criteria

- [ ] `pnpm --dir client build`, `lint` and `test:data` exit 0
- [ ] `grep -rn "planning-copilot-trigger\|data-collapsed\|data-mode=" client/src` returns no matches
- [ ] `grep -rn "window.scrollTo\|window.scrollY" client/src/screens/AcademicScheduling.tsx` matches only inside `openGuide` / `restoreGuideContext`, or nothing if plan 003 already ran
- [ ] `grep -c "max-width: 96rem" client/src/components/PlanningShell.css` prints `0`
- [ ] `grep -c "@container planning-content" client/src/screens/PlanningWeekView.css` prints `2`
- [ ] `grep -c "ResizablePanelGroup" client/src/screens/AcademicScheduling.tsx` prints at least `2`
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match beyond plan 002's changes.
- Plan 002 has not landed (`client/src/lib/useMediaQuery.ts` is missing).
- The registry download fails, or the Resizable API of the installed version cannot express a conditionally rendered second panel.
- After step 6 the page would need `position: fixed` inside the scroller for anything other than the course drawer.
- Moving chat state into the hook would change what is sent to `fetchAcademicNormativeAdvice`.

## Maintenance notes

- The page no longer scrolls the window; `.planning-workspace__content` does.
  Any new "scroll to" code must target that element. `Tour.tsx` scrolls the
  window toward its targets; plan 003 keeps all guide targets in the header
  and sidebar, which never scroll.
- The rail has two occupants. A third becomes another tab, not another fixed
  panel.
- Plan 004 replaces the literal `font-size` values in `PlanningContextPanel.css`.
- Reviewer: check the inspector's edit form submits when docked, sticky table
  and calendar headers still stick inside the new scroller, and the
  Preparación course drawer still works below 1024px.
