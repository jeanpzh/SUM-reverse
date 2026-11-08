# Planning UI primitives

Use only inside `.planning-root` on `/local/programacion-academica`.
Follow `docs/design-direction.md`; student SUM components stay separate.
These shadcn default-style APIs use existing light/dark `--planning-*` tokens.
React 19 refs pass through component props. No icon dependency is required.

| Legacy | Replacement |
| --- | --- |
| `academic-scheduling__button` | `Button` |
| `academic-scheduling__button--secondary` | `Button variant="outline"` |
| Styled links | `Button asChild` wrapping the existing router Link |
| Inputs / textareas / labels | `Input`, `Textarea`, `Label htmlFor` |
| Native select | `NativeSelect` with options (still supports selectOption) |
| Checkbox | `Checkbox id` + `Label htmlFor`; use onCheckedChange |
| Status spans | `Badge` with explicit status text |
| Single bordered surface | `Card` and its header/content/footer; never nest cards |
| Raw table | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` |
| `<details>` / `<summary>` | `Collapsible`, `CollapsibleTrigger asChild` + Button, `CollapsibleContent` |
| Notices | `Alert`, `AlertTitle`, `AlertDescription` |
| Dividers / tabs | `Separator` / `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |

There is **no Tailwind preflight**. Set box sizing, border style, background
and font explicitly. Unlayered legacy CSS beats utility layers: remove the
conflicting screen rule during migration; never add `!important`.
Table/NativeSelect scoped CSS handles existing global element bridges.
Keep existing texts, ids, ARIA, route searches, handlers and API effects.
Use `min-w-0`, wrapping and an overflow container for wide tables.

**One primary Button per stage** (D7): take the primary action from
`view.primaryAction(stage)` in `planningSession.ts`; other actions use outline
or ghost. Success/status badges retain text; color alone is insufficient.
Alerts have no automatic live role: set `role="alert"` only for urgent content.
Portals use the existing Dialog/Sheet planning container and return-focus hook.
