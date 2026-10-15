![Repo Owner](https://img.shields.io/badge/Repo_Owner-Geoinformation-blue)
![Repo Custodian](https://img.shields.io/badge/Repo_Custodian-Geoinformation-blue)
![Section](https://img.shields.io/badge/Section-GO-blue)
![Status](https://img.shields.io/badge/Status-in--development-yellow)

# Solar Roof Application

## Description & Purpose

Interactive web application to visualize the solar energy potential of Swiss buildings (roofs and facades). The application allows users to search for any address in Switzerland and instantly see the estimated photovoltaic and solar thermal production potential of the building.

This project is built on behalf of the Swiss Federal Office of Energy (SFOE). The application template is based on [drill-frontend](https://github.com/SFOE/drill-frontend) (DrillCheck).

### Key features

- Interactive map with solar suitability overlay (WMTS from swisstopo)
- Basemap switcher (satellite / grey map)
- Address search with autocomplete via the [geo.admin.ch SearchServer API](https://api3.geo.admin.ch/rest/services/api/SearchServer)
- Outline highlighting of the selected surfaces
- **Single selection mode** (default) — each click shows the data of one roof or facade surface
- **Multiple selection mode** — click multiple surfaces to see aggregated totals across your selection
- PV and solar thermal production estimates based on the [solar suitability dataset](https://opendata.swiss/en/dataset/eignung-von-hausdachern-fur-die-nutzung-von-sonnenenergie)
- Suitability distribution visualization (% of area per class)
- PV feed-in tariff display per municipality via the [VESE PvTarif API](https://www.vese.ch/pvtarif/) (Lambda proxy in production)
- GWR address and commune lookup after building identification
- Toggle between roofs and facades (layer selection)
- Summary banner with the overall suitability and the economic potential of the selection
- Multilingual (DE, FR, IT, EN) — switchable via UI or `?lang=xx` query parameter
- Responsive design
- FAQ section with links to official resources

### Data sources

- **Building geometries**: swissBUILDINGS3D 2.0 (swisstopo)
- **Solar irradiation**: Satellite-based data 2011–2020 (MeteoSwiss)
- **Calculation model**: Meteotest AG on behalf of SFOE
- **Building register**: GWR (Federal Statistical Office)
- **PV feed-in tariffs**: [VESE PvTarif API](https://www.vese.ch/pvtarif/) — tariff data per energy provider and municipality

### Backend (VESE Proxy)

A lightweight AWS Lambda function (`solar-roof-dev-vese-proxy`) acts as a proxy to the VESE PvTarif API. This keeps the API license key server-side and avoids exposing it in the browser. In production the key is stored in **AWS Secrets Manager** and fetched by the Lambda at runtime (never committed to git, never a plaintext Lambda env var). In development, a Vite middleware plugin proxies `/api/pvtarif/*` requests locally with the key from `.env.local`.

> **Note:** Access to the VESE PvTarif API requires a license agreement with VESE. See [PvTarif data documentation](https://www.vese.ch/wp-content/uploads/data-store/pvtarif/app/appPvMapExpert/pvtarif-map-expert-data-de.html) for details and contact VESE to obtain a license key.

> **Security — the license key must never reach the browser.** The VESE key is injected only server-side: by the Vite dev proxy in development, and by the Lambda in production. **Do not read `VITE_VESE_API_KEY` (or any secret) from frontend code** — any `VITE_*` variable referenced in `src/` is inlined into the public JavaScript bundle and becomes readable by anyone inspecting the page. Frontend code only ever calls the proxy/Lambda (`/api/pvtarif/*` in dev, the Lambda URL in prod). A Cypress regression test (`cypress/e2e/vese-tarif.cy.ts`) asserts that browser tariff requests never carry a `licenseKey` and never hit the VESE host directly.

## License & Privacy

This repository is under the [MIT License](LICENSE).

The application does not collect, store or process any personal data. All API calls are made directly from the user's browser to public Swiss government APIs (geo.admin.ch), except for the VESE tariff requests which pass through a Lambda proxy. No analytics or tracking is implemented.

## Installation & Setup

### Prerequisites

- Node.js ≥ 20.19.0 or ≥ 22.12.0
- npm

### Setup

```bash
npm install
```

### Environment variables

Create a `.env.local` file for development:

```
VITE_VESE_API_KEY=<your-vese-license-key>
```

In production, the Lambda proxy URL is configured in `.env.production`:

```
VITE_PVTARIF_API_URL=https://<api-gateway-id>.execute-api.eu-central-1.amazonaws.com
```

## Usage

```bash
# Start development server (hot reload)
npm run dev
# Open http://localhost:5173

# Build for production
npm run build-only

# Preview production build
npm run preview

# Type check
npm run type-check

# Lint (check only, as in CI)
npm run lint-check

# Lint and auto-fix
npm run lint

# End-to-end tests (needs a production build first)
npm run build-only && npm run test:e2e
```

### Tech stack

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool (with custom VESE proxy plugin for dev)
- [Pinia](https://pinia.vuejs.org/) — state management
- [OpenLayers](https://openlayers.org/) — map rendering
- [vue-i18n](https://vue-i18n.intlify.dev/) — internationalization
- [Axios](https://axios-http.com/) — HTTP client
- [proj4](http://proj4js.org/) — coordinate projections (Swiss LV95 / LV03)
- [Cypress](https://www.cypress.io/) — E2E and component testing
- [oxlint](https://oxc-project.github.io/docs/guide/usage/linter.html) + [ESLint](https://eslint.org/) — linting

### Known limitations

- **Partial building selection**: In areas with row houses, a click may only select part of the visible building due to how `building_id` is assigned in the source data. (See FAQ in the app)
- **Missing addresses**: Some buildings (non-residential, annexes, agricultural) may not display an address, as the GWR register does not cover all structures. (See FAQ in the app)

## Folder Structure

```
├── src/
│   ├── components/       ← Vue components (Map, SearchBar, InfoPanel, SummaryBanner, ModeToggle, SelectionModeToggle, FAQ, Header, Footer, LanguageSwitcher)
│   ├── composables/      ← Reusable logic (useProjections, useSolarIdentify, usePvTarif)
│   ├── locales/          ← i18n translations (de, fr, it, en)
│   ├── stores/           ← Pinia stores (mapStore, languageStore)
│   ├── types/            ← TypeScript interfaces (solar.ts)
│   ├── views/            ← Page-level components (SonnendachView)
│   ├── assets/           ← CSS, logos
│   └── main.ts           ← App entry point
├── backend/              ← Lambda function for VESE API proxy
├── cypress/              ← E2E and component test specs
├── .github/              ← CI/CD workflows, Dependabot config, auto-merge
├── package.json          ← Dependencies and scripts
├── vite.config.ts        ← Vite configuration + VESE dev proxy plugin
├── cypress.config.ts     ← Cypress test configuration
├── tsconfig.json         ← TypeScript configuration
└── README.md             ← This file
```

## CI/CD

- **Lint, Test & Build** (`lint-test-build.yml`): runs on every push and pull request: lint, type-check, build, and E2E tests. Surfaces problems and fixes early, upstream of deployment.
- **Package and Deploy Frontend** (`package-and-deploy-frontend.yml`): on release / manual dispatch. Builds the site, archives a versioned artifact to S3, then deploys it (S3 sync + CloudFront invalidation). No tests here (they run in `lint-test-build.yml`).
- **Package and Push Backend** (`package-and-push-backend.yml`): on release / manual dispatch. Packages the VESE proxy Lambda (zip) and pushes the versioned zip (`solar-roof-vese-proxy-<tag>.zip`) to the backend artefact store. It does not deploy: the infrastructure repo deploys a chosen version via `source_code_version` in `deploy.auto.tfvars.json` (damquake-style).
- **Dependabot**: monthly dependency updates with auto-merge for patch/minor versions

### GitHub secrets required

| Secret | Description |
|--------|-------------|
| `SFOE_SOLAR_ROOF_PIPELINE_ROLE_DEV` | AWS IAM role ARN (OIDC) for the dev account — artifact push + deploy |
| `SFOE_SOLAR_ROOF_PIPELINE_ROLE_PROD` | AWS IAM role ARN (OIDC) for the prod account |
| `CLOUDFRONT_DISTRIBUTION_ID_DEV` | CloudFront distribution ID (dev) for cache invalidation |
| `CLOUDFRONT_DISTRIBUTION_ID_PROD` | CloudFront distribution ID (prod) for cache invalidation |

The `package-and-deploy-frontend.yml` and `package-and-push-backend.yml` workflows take an `environment` input (`dev`/`prod`) and select the matching role/bucket/distribution automatically.

> **Note:** The VESE API key (stored in AWS Secrets Manager) is **not** a GitHub secret and is **not** used by the application. The infrastructure repo references the secret by name. The frontend only ever uses the public API Gateway URL (`VITE_PVTARIF_API_URL`).

## Contact

geoinformation@bfe.admin.ch
