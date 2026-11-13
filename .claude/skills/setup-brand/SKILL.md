---
name: setup-brand
description: Use when the user wants to rebrand the app or change its look — colors, fonts, radius, density — e.g. "use our brand colors", "make it warmer", "apply this tweakcn theme".
metadata:
  fuutu-source: mcp
  fuutu-category: design
---

# Set up the brand

The full, step-by-step guide is served by the **Fuutu MCP** server (MCP Plus).

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "setup-brand" }` and follow the returned instructions. Without an MCP Plus key it returns an upgrade notice — then continue with step 2.
2. Otherwise follow the minimal path below.

## Minimal path (without MCP)

1. Edit `packages/config/brand.css`, or paste a tweakcn / `/create` export (`:root` + `.dark` block) over it. Keep the kit status block and the kit area block (`--area-users`, `-billing`, `-ai`, `-api`, each with a `-foreground` ink); never edit `theme.css`.
2. Fonts: change the three `next/font/google` families in `apps/{saas,marketing,docs}/src/app/fonts.ts` (keep the files identical) and match `--font-sans`, `--font-heading` and `--font-mono` in `brand.css`.
3. Mirror the new values in the `DESIGN.md` frontmatter and its Colors section.
4. `pnpm -F @fuutu/ui test` — the contrast audit (area pairs included) and `DESIGN.md` sync must pass.
5. Email and OG colors are hex literals: update `packages/mail/src/templates/colors.ts`, re-render `packages/config/assets/og-image.html` (then `pnpm assets:sync`) and the blog `opengraph-image.tsx`.
6. Open `/design` in light and dark at 375 and 1280 px; fix anything the page flags.
