# Coding Standards

## TypeScript conventions

- **Strict TypeScript**, Vue 3 Composition API with `<script setup lang="ts">`
  exclusively — no Options API, no class components.
- Type the shared domain model in `src/types/solar.ts`
  (`SurfaceData`, `AggregatedData`, `SummaryData`, `SolarMode`,
  `SelectionMode`) rather than inlining ad-hoc shapes in components or
  composables. If you add a new field coming from a swisstopo/GWR/VESE
  response, add it there first.
- `@typescript-eslint/no-explicit-any` is only a **warning**, not an error,
  specifically for code that normalizes the untyped JSON returned by the
  swisstopo and VESE APIs (see the `app/external-json-any` rule in
  `eslint.config.ts`). Don't rely on that leniency for project-internal code
  — type it properly.
- Use the `@/` alias (`src/`) for project-internal imports, matching
  `vite.config.ts`'s `resolve.alias`.

## Formatting & linting

- Prettier config (`.prettierrc.json`): **no semicolons**, **single quotes**,
  100-char print width. Run `npm run format` (formats `src/` only).
- Linting runs two tools in sequence:
  - `oxlint` (fast, correctness-focused — `.oxlintrc.json` sets
    `categories.correctness: "error"`)
  - `eslint` (Vue + TypeScript rules, `eslint-plugin-oxlint` disables ESLint
    rules oxlint already covers, to avoid duplicate reports)
- `npm run lint-check` — check only, no auto-fix (what CI runs).
- `npm run lint` — runs both tools with `--fix`.
- Always run `npm run lint-check` and `npm run type-check` before considering
  a change complete; CI (`lint-test-build.yml`) runs lint, type-check, build,
  and E2E tests on every PR and on every push to `main`.

## Vue component conventions

Observed consistently across `src/components/*.vue` — follow them for new
components:

- A short HTML comment block at the top of the `<template>` naming the
  component and summarizing its responsibility in 2-4 lines (see
  `MapComponent.vue`, `InfoPanel.vue`, `SelectionModeToggle.vue` for the
  pattern). This is the de-facto doc-comment convention for this codebase —
  there are no JSDoc blocks on components.
- `<script setup lang="ts">` imports composables/stores and exposes only
  what the template needs via plain `const` bindings — no explicit
  `defineExpose`/`defineProps` unless the component genuinely takes
  props (most don't; they read directly from `useMapStore()`).
  See `component-development.md` for the store-as-shared-state pattern.
- Scoped `<style scoped>` blocks per component; no CSS framework, no
  CSS-in-JS. Shared tokens live in `src/assets/base.css` / `main.css`.
- All user-facing text goes through `vue-i18n` (`$t('key')` in templates,
  `useI18n()` in script) — never hardcode UI strings, even for a quick
  prototype, since this app ships in 4 languages from day one.

## Comment language

Most files are commented in English. `src/types/solar.ts` currently has its
file-level doc comment and some field comments in French — this is pre-existing
and not a convention to copy forward. Write new comments in English unless
you're editing a block that is already in French and keeping consistency
with the immediate surrounding text matters more than switching languages
mid-file.

## Security: no secrets in frontend code

**Never read a secret from frontend (`src/`) code.** Any `VITE_*` environment
variable referenced anywhere under `src/` is inlined into the public
JavaScript bundle by Vite and becomes readable by anyone opening devtools.
This project has exactly one secret-shaped variable, `VITE_VESE_API_KEY`,
and it is deliberately read **only** in `vite.config.ts` (a dev-only proxy
plugin that runs on the Node side, never shipped to the browser) — not from
any file under `src/`. `VITE_PVTARIF_API_URL` (the proxy/Lambda URL) is safe
to reference from `src/` because it is public by design.

The Cypress spec `cypress/e2e/vese-tarif.cy.ts` is a regression test for
this: it asserts browser tariff requests never carry a `licenseKey` and
never hit the VESE host directly. Keep it passing — it's the only thing
standing between a refactor and a leaked license key in production.

## Testing

- Cypress E2E specs live in `cypress/e2e/`, one file per feature area
  (`search.cy.ts`, `map-click.cy.ts`, `selection-mode.cy.ts`, etc.), run
  against a production build (`npm run build-only && npm run test:e2e`).
- **Pure logic also gets tested as a "no browser page" Cypress spec**, not as
  a true component test: `cypress/e2e/selection-logic.cy.ts` imports
  `aggregateSurfaces`/`useMapStore` directly (with `setActivePinia`) and
  asserts on aggregation, dedup, and classification without calling
  `cy.visit()`. It's still picked up by the e2e `specPattern`, so it runs in
  `npm run test:e2e`, not via a separate command. Follow this pattern for new
  store/composable logic that doesn't need a rendered page, rather than
  reaching for a component test or a new runner.
- A real Cypress **component test** (mounting a `.vue` file) would go under
  `src/**/__tests__/*.cy.ts` per the `cypress.config.ts` component spec
  pattern — but none exist yet; the logic-test pattern above has covered
  that need so far.
- Fixtures for mocked API responses live in `cypress/fixtures/`
  (`identify-roofs.json`, `gwr-lookup.json`, `vese-muni.json`, etc.) — reuse
  an existing fixture shape rather than inventing a new mock format when
  testing a flow that already has coverage.
- There's no unit test runner (Vitest etc.) configured and **no coverage
  threshold is enforced** — unlike some sibling SFOE projects, this repo
  doesn't gate CI on a coverage percentage. If you want coverage reporting
  or a hard threshold, raise it with the user before adding a new test
  runner or a coverage tool, rather than assuming Vitest.

## No hardcoded environment URLs in application logic

The Lambda proxy URL differs between dev and prod and is supplied via
`VITE_PVTARIF_API_URL` (`.env.production` / `.env.prod`, selected by Vite
`--mode`), not hardcoded in `usePvTarif.ts`. Keep following this pattern for
any new environment-specific endpoint.

## DRY: colors and shared logic

- All brand/UI colors used in a component's `<style>` block must reference
  the CSS custom properties defined in `src/assets/base.css`
  (`--color-primary`, `--color-accent`, `--color-link`, `--color-text`,
  `--color-muted`, `--color-border`, `--color-border-light`) — don't repeat
  a raw hex value in a component's `<style>` block.
- The suitability-class (1–5) color scale lives in two places that must stay
  in sync: the `--suitability-1..5` CSS custom properties in `base.css` for
  styling in templates/CSS, and `SUITABILITY_COLORS`/`suitabilityColor()` in
  `src/composables/useSuitabilityColor.ts` for JS-driven styling (inline
  `:style` bindings, computed colors). Import the composable instead of
  redefining a local color map in a component.
- Code that cannot read CSS custom properties (e.g. OpenLayers `Style`
  objects, which are plain JS, not DOM-rendered) may duplicate a hex value,
  but must document which CSS variable it mirrors in a comment next to it
  (see the selection outline color in `MapComponent.vue`).
- Extract logic used by more than one component into `src/composables/`
  rather than duplicating it (e.g. `useSuitabilityColor`, `useProjections`,
  `useSolarIdentify`, `usePvTarif`).
- Import static assets (`import logo from '@/assets/logo.png'`) and bind
  them (`:src`, `:srcset`) instead of referencing a path as a string in the
  template — a plain string in most template attributes is not rewritten by
  Vite's asset-URL transform (it only covers a known attribute list, e.g.
  `img[src]`) and will 404 in production. This previously broke the
  responsive logo `<picture>`/`<source>` markup in `HeaderComponent.vue`.
- Pair resource-acquiring `onMounted` logic with a matching `onUnmounted`
  cleanup (e.g. releasing an OpenLayers map's render target) so component
  teardown and HMR reloads during development don't leak instances.
- Never bind untrusted or remote API data with `v-html` without sanitizing
  it first. If a response may legitimately contain a small whitelist of
  formatting tags (e.g. `<b>` highlighting from a search API), escape all
  HTML first, then selectively re-allow only that whitelist — see
  `sanitizeLabel()` in `SearchBar.vue`.
- Interactive disclosure widgets (e.g. the FAQ accordion) need
  `aria-controls`/`aria-labelledby` linking the trigger and the region it
  reveals, and decorative glyphs made of text (like `+`/`−` icons) need
  `aria-hidden="true"`.
