# Planning UI primitives

Use only inside `.planning-root` on `/local/programacion-academica`.
Follow `docs/design-direction.md`; student SUM components stay separate.
These shadcn default-style APIs use existing light/dark `--planning-*` tokens.

| Legacy | Replacement |
| --- | --- |
| `academic-scheduling__button` | `Button` (only the stage's primary action) |
| `academic-scheduling__button--secondary` | `Button variant="outline"` (or `ghost` for low emphasis) |
| Styled links | `Button asChild` wrapping the existing router Link |
| Inputs / textareas / labels | `Input`, `Textarea`, `Label htmlFor` |
| Native select | `NativeSelect` with options (still supports selectOption) |
| Checkbox | `Checkbox id` + `Label htmlFor`; use onCheckedChange |
| Status spans | `Badge` with explicit status text |
| Single bordered surface | `Card` and its parts; never nest cards |
| Raw table | `Table` and its parts; add `stickyHeader` for long tables |
| `<details>` / `<summary>` | `Collapsible`, `CollapsibleTrigger asChild` + Button, `CollapsibleContent` |
| Notices | `Alert`, `AlertTitle`, `AlertDescription` |
| `window.confirm(...)` | `const [confirmElement, confirm] = useConfirm()`, render `confirmElement`, `if (!(await confirm({ title, description, confirmLabel, destructive }))) return` |
| Transient "done"/"failed" messages | `toast.success(text)` / `toast.error(text)` from `ui/Sonner` |
| Dividers / tabs | `Separator` / `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |

**Feedback.** Toasts only report a completed action (saved, generated, request
failed). Keep inline: loading and blocking states, field validation, disabled-gate
reasons, and anything the user must read before acting. Never toast and render the
same message inline. `ConfirmDialog` (AlertDialog) is for explicit confirmation only.

**Shell.** There is no rail: `PlanningShellControls` (theme, back link) render in the
scope header. `Toaster` and the portal container are mounted by `PlanningShell`.

**Tour.** `Tour` (Dice UI) with `TourPortal`, `TourSpotlight`, `TourSpotlightRing`,
`TourStep target="#id"`, `TourHeader/Title/Description`, `TourFooter`, `TourPrev`,
`TourNext`, `TourSkip`, `TourStepCounter`. Controlled with `open`/`onOpenChange`;
target existing stable ids; never open it automatically more than once.

There is **no Tailwind preflight**. Set box sizing, border style, background
and font explicitly. Unlayered legacy CSS beats utility layers: remove the
conflicting screen rule during migration; never add `!important`.
Keep existing texts, ids, ARIA, route searches, handlers and API effects.
Use `min-w-0`, wrapping and an overflow container for wide tables.

**One primary Button per stage** (D7): take the primary action from
`view.primaryAction(stage)` in `planningSession.ts`; other actions use outline
or ghost. Status badges retain text; color alone is insufficient.
Alerts have no automatic live role: set `role="alert"` only for urgent content.
