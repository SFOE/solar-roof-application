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
- Address search with autocomplete via the [geo.admin.ch SearchServer API](https://api3.geo.admin.ch/rest/services/api/SearchServer)
- Automatic aggregation of all roof surfaces per building
- PV and solar thermal production estimates based on the [solar suitability dataset](https://opendata.swiss/en/dataset/eignung-von-hausdachern-fur-die-nutzung-von-sonnenenergie)
- Toggle between roofs and facades
- Multilingual (DE, FR, IT, EN)
- FAQ section with links to official resources

### Data sources

- **Building geometries**: swissBUILDINGS3D 2.0 (swisstopo)
- **Solar irradiation**: Satellite-based data 2011–2020 (MeteoSwiss)
- **Calculation model**: Meteotest AG on behalf of SFOE
- **Building register**: GWR (Federal Statistical Office)

## License & Privacy

This repository is under the [MIT License](LICENSE).

The application does not collect, store or process any personal data. All API calls are made directly from the user's browser to public Swiss government APIs (geo.admin.ch). No analytics or tracking is implemented.

## Installation & Setup

### Prerequisites

- Node.js ≥ 20.19.0 or ≥ 22.12.0
- npm

### Setup

```bash
npm install
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

# Lint
npm run lint
```

### Tech stack

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool
- [Pinia](https://pinia.vuejs.org/) — state management
- [OpenLayers](https://openlayers.org/) — map rendering
- [vue-i18n](https://vue-i18n.intlify.dev/) — internationalization
- [Axios](https://axios-http.com/) — HTTP client
- [proj4](http://proj4js.org/) — coordinate projections

### Known limitations

- **Partial building selection**: In areas with row houses, a click may only select part of the visible building due to how `building_id` is assigned in the source data.
- **Missing addresses**: Some buildings (non-residential, annexes, agricultural) may not display an address, as the GWR register does not cover all structures.

## Folder Structure

```
├── src/
│   ├── components/       ← Vue components (Map, SearchBar, InfoPanel, etc.)
│   ├── composables/      ← Reusable logic (projections)
│   ├── locales/          ← i18n translations (de, fr, it, en)
│   ├── stores/           ← Pinia stores (map state, language)
│   ├── types/            ← TypeScript interfaces
│   ├── views/            ← Page-level components
│   ├── assets/           ← CSS, logos
│   └── main.ts           ← App entry point
├── .github/              ← GitHub configuration (workflows, Dependabot)
├── package.json          ← Dependencies and scripts
├── vite.config.ts        ← Vite configuration
├── tsconfig.json         ← TypeScript configuration
└── README.md             ← This file
```

## Contributing

- Use feature branches for all changes
- Submit pull requests for review before merging
- Write meaningful commit messages
- Code was developed with AI assistance (ai-generated level — Kiro)

## Contact

geoinformation@bfe.admin.ch
