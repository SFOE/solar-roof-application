# Project Overview — Solar Roof Application

Interactive Vue 3 web application for the Swiss Federal Office of Energy
(SFOE) that visualizes the solar (PV + thermal) potential of Swiss building
roofs and facades. Users search an address or click the map and get the
estimated electricity/heat yield, financial return, and PV feed-in tariff for
that building.

The project template is based on [drill-frontend](https://github.com/SFOE/drill-frontend)
(DrillCheck) — a sibling SFOE application. When in doubt about a convention
that isn't documented here, that repo is the closest reference.

## Architecture at a glance

This is a standard Vue 3 SPA, not a plugin/extension architecture — there is
no custom component registry or templating indirection to worry about. The
things that *are* specific to this app:

1. **Selection-centric state.** `useMapStore` (Pinia) holds a single array of
   selected surfaces (`selectedSurfaces`, deduped by `featureId`). Everything
   else — totals, suitability class, the summary banner — is a `computed()`
   derived from that array. There is no separate "aggregated state" to keep
   in sync by hand; see `data-and-state-flow.md`.

2. **No backend of its own, except one proxy.** The app talks directly to
   public swisstopo/geo.admin.ch APIs from the browser. The one exception is
   the VESE PV-tariff API, which requires a license key — that call is always
   routed through a proxy (Vite dev middleware locally, an AWS Lambda in
   deployed environments) so the key never reaches the browser bundle.

3. **Swiss coordinate system (EPSG:2056 / LV95).** All map and API
   interaction happens in LV95; see `useProjections.ts` and
   `data-and-state-flow.md`.

## Repository structure

```
src/
  components/      ← Vue SFCs (Map, SearchBar, InfoPanel, SummaryBanner, ModeToggle,
                       SelectionModeToggle, FaqSection, Header, Footer, LanguageSwitcher)
  composables/      ← useProjections, useSolarIdentify, usePvTarif — all swisstopo/VESE API logic
  stores/           ← Pinia stores: mapStore (selection + derived data), languageStore
  types/            ← solar.ts — the shared data model (SurfaceData, AggregatedData, SummaryData)
  locales/          ← de.json (default), fr.json, it.json, en.json
  views/            ← SonnendachView.vue (the single page)
  router/           ← single route, "/"
  assets/           ← CSS, logo
  main.ts           ← app entry point (i18n + pinia + router wiring)
backend/
  lambda_function.py  ← AWS Lambda: VESE tariff proxy (see data-and-state-flow.md)
cypress/
  e2e/              ← end-to-end specs (one file per feature area)
  fixtures/         ← mocked API responses used by the e2e specs
  support/          ← custom commands, global intercepts
.github/workflows/  ← CI (lint/test/build), backend check, frontend deploy, backend package, dependabot
```

There is only one route/view (`SonnendachView.vue`); this is not a
multi-page app, so "page-level" concerns (layout, FAQ, header/footer) live as
components composed into that single view rather than as separate routed
views.

## Key technology choices

| Concern              | Choice                         | Why                                                      |
| --------------------- | ------------------------------- | --------------------------------------------------------- |
| UI framework          | Vue 3 (Composition API, `<script setup>`) | Matches the drill-frontend template this app is based on |
| State management      | Pinia (setup-store syntax)      | Official Vue state library; composable-style stores       |
| Map rendering         | OpenLayers (`ol`)               | Full WMTS + vector support, EPSG:2056 via `proj4`         |
| Coordinate projection | `proj4` registered into OpenLayers | swisstopo data is natively in EPSG:2056 (LV95)          |
| i18n                  | `vue-i18n`                      | 4 languages (de/fr/it/en), query-param and UI switching    |
| HTTP client           | Axios                           | Used for all swisstopo/VESE calls                          |
| Build tool            | Vite                            | Dev server + production build; also hosts the dev-only VESE proxy middleware |
| Linting               | oxlint + ESLint (`lint-check` = oxlint + eslint) | oxlint for fast correctness checks, ESLint for Vue/TS rules |
| E2E / component tests | Cypress                         | `cypress/e2e` against a built app; component tests under `src/**/__tests__` |

## Data sources

- **Building geometries & solar suitability**: swissBUILDINGS3D 2.0 +
  satellite-based irradiation data (2011–2020, MeteoSwiss), calculation model
  by Meteotest AG on behalf of SFOE. Served live via the
  [geo.admin.ch SearchServer / MapServer `identify`/`find` APIs](https://api3.geo.admin.ch/rest/services/api/MapServer)
  on layers `ch.bfe.solarenergie-eignung-daecher` (roofs) and
  `ch.bfe.solarenergie-eignung-fassaden` (facades).
- **Building register (GWR)**: layer `ch.bfs.gebaeude_wohnungs_register`, used
  to resolve an address and municipality from a building.
- **PV feed-in tariffs**: [VESE PvTarif API](https://www.vese.ch/pvtarif/),
  reached only through the dev proxy / Lambda proxy — see
  `data-and-state-flow.md` for why and how.

## Specifications

Structured spec work for this project lives under `.kiro/specs/<feature>/`
(`requirements.md`, `design.md`, `tasks.md`), created via Kiro's spec
workflow. There are no specs yet at the time this steering set was added —
when a non-trivial feature is built, prefer going through spec mode so the
decision record survives the chat session. See the `spec-mode-awareness`
hook, which reminds the agent to check `.kiro/specs/` at the start of a chat
session.

## Key reference links

- Live data layer docs: https://opendata.swiss/en/dataset/eignung-von-hausdachern-fur-die-nutzung-von-sonnenenergie
- geo.admin.ch REST API: https://api3.geo.admin.ch/services/sdiservices.html
- VESE PvTarif data docs: https://www.vese.ch/wp-content/uploads/data-store/pvtarif/app/appPvMapExpert/pvtarif-map-expert-data-de.html
- OpenLayers docs: https://openlayers.org/en/latest/apidoc/
- vue-i18n docs: https://vue-i18n.intlify.dev/
- Template/reference app: https://github.com/SFOE/drill-frontend
