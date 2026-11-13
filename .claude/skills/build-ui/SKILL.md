---
name: build-ui
description: Use when building or changing any UI — pages, components, layouts, styling, or a small visual tweak such as one color, the radius or calmer area colors. Keeps the work inside DESIGN.md. For a rebrand (new palette, fonts, a theme export) use setup-brand.
metadata:
  fuutu-source: repo
  fuutu-category: design
---

# Build UI on the design system

This skill uses the design that exists. Deriving a new one (more than one coordinated token, new fonts, an imported theme) is `setup-brand`.

## Read first

- `DESIGN.md` at the repo root is the contract: Colors, Typography, Components, Do's and Don'ts, Iteration Guide. Values live there and in `packages/config/brand.css`; never copy them into code.
- `/design` in the SaaS app shows every `@fuutu/ui` export with its states, live tokens and measured contrast; build from it.

## Roles, not colors

- Name the role: `bg-primary`, `text-muted-foreground`, `border-input`. No Tailwind palette colors, no hex, no `oklch()` in app UI.
- Status is a fill: `bg-warning text-warning-foreground`, `bg-info text-info-foreground`, `bg-success text-success-foreground`. Never `text-warning` or `text-info` on a surface.
- Body text stays on `foreground` or `muted-foreground` over `background`, `card` or `popover`.
- Never convey state by color alone; add an icon or label.

## Areas

- Four product areas: `users` (auth, members, orgs), `billing`, `ai`, `api` (keys, webhooks, MCP). An area color says where you are, never how something is doing.
- Use `bg-area-<a>` with `text-area-<a>-foreground`; the ink alone works as text on background and card.
- No opacity on area text (`/60` drops it below 4.5:1). No area colors in the sidebar.

## Page anatomy

- Every page opens with `PageHeader`. SaaS app pages use `variant="compact"` (the breadcrumb names the page; actions sit in its right-aligned row). Only the dashboard greeting and `/design` show a visible title.
- Content sits on `Card` surfaces; cards have no borders. A table goes inside `Card className="overflow-hidden py-0"`.
- Facts on dashboards and landing pages are `AreaTile`s; a row of tiles passes `aligned`.
- One column on phones, grids from `md`.

## Components

- Use the `@fuutu/ui` component instead of re-assembling its classes; shape, height and padding live in the component.
- Variants by intent: `default` for the one primary action per view, `secondary` / `outline` for the rest, `ghost` in toolbars, `destructive` only for irreversible actions behind an alert dialog.
- Lucide icons, `size-4` inside controls; icon-only buttons get an `aria-label` from the translations.
- Motion only through the utilities the components already carry, and it must respect `prefers-reduced-motion`.
- Every label, title and placeholder is a translation key in every locale; no literal strings in JSX.

## Adding a component

1. In `packages/ui`: `pnpm dlx shadcn@4.21.4 add <name>`. Never write a shadcn component by hand.
2. Export it from `packages/ui/src/index.ts`.
3. Render it with its states on `/design` (`apps/saas/src/modules/app/design-system/`), with keys in `design-system.json` for every locale. `design-page-coverage-guard` fails otherwise.
4. The CLI may append CSS variables to `brand.css`. Keep only what the component needs, inside the shadcn set, and mirror any value change in `DESIGN.md`.

## Small design changes

One knob at a time, each with `DESIGN.md` updated in the same change (frontmatter values plus the prose that names them):

- **One token**: change it in `brand.css` in both `:root` and `.dark` if it has a dark value.
- **Radius**: `--radius` re-shapes the whole product; it is a brand decision, not a per-component fix.
- **Calm areas**: follow "Make it calm" in the `DESIGN.md` Iteration Guide.
- **One area hue**: follow "Retuning an area hue" there; change hue (and ink chroma) only.
- **Light-palette colors** also feed emails: update `MAIL_COLORS` in `packages/mail/src/templates/colors.ts`; the sync test names the key that drifted.

Anything beyond one knob goes to `setup-brand`.

## Don't

- Edit `packages/config/theme.css` (kit-owned) or add tokens outside the shadcn set and the kit status and area blocks.
- Restyle a component with one-off call-site classes.
- Remove the focus ring or shrink targets below the `sm` control height.

## Checks

- `pnpm -F @fuutu/ui test`: contrast-audit, design-md-sync, theme-files, mail-colors-sync.
- `pnpm -F @fuutu/test-utils test`: semantic-colors, page-header, design-page-coverage, font-setup guards.
- `check-in-browser`: `/design` plus every touched route, light and dark, 375 and 1280 px, console clean.
- Visual baselines: report the diffs; never auto-update them.
