# Sonnendach — Solar Potential Viewer

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
- **Calculation model**: Meteotest AG model on behalf of SFOE
- **Building register**: GWR (Federal Statistical Office)

---

## License & Privacy

### Application license

This repository is by default under the MIT License in alignment with Swiss federal open source policy (Art. 9 LMET, Em002 series).

### Privacy

The application does not collect, store or process any personal data. All API calls are made directly from the user's browser to public Swiss government APIs (geo.admin.ch). No analytics or tracking is implemented.

---

## Usage

### Prerequisites

- Node.js ≥ 20.19.0 or ≥ 22.12.0
- npm

### Development

```bash
# Install dependencies
npm install

# Start development server (hot reload)
npm run dev

# Open http://localhost:5173
```

### Production build

```bash
# Build for production
npm run build-only

# Preview production build locally
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

- **Partial building selection**: In areas with row houses, a click may only select part of the visible building. This is due to how `building_id` is assigned in the source data (swissBUILDINGS3D), which does not always match the visual building footprint.
- **Missing addresses**: Some buildings (non-residential, annexes, agricultural) may not display an address, as the GWR register does not cover all structures or the EGID mapping may be incomplete.

---

## Project Structure

```
src/
├── main.ts               # App entry point, plugin registration
├── App.vue               # Root component
├── router/               # Vue Router configuration
├── views/
│   └── SonnendachView.vue    # Main page (assembles all components)
├── components/
│   ├── HeaderComponent.vue   # Swiss Confederation header
│   ├── FooterComponent.vue   # Swiss Confederation footer
│   ├── SearchBar.vue         # Address search with autocomplete
│   ├── ModeToggle.vue        # Roofs / Facades toggle
│   ├── MapComponent.vue      # Interactive map (OpenLayers + WMTS)
│   ├── InfoPanel.vue         # Solar data results panel
│   └── FaqSection.vue        # FAQ accordion
├── stores/
│   ├── mapStore.ts           # Shared state (solar data, mode, address)
│   └── languageStore.ts      # Active language state
├── composables/
│   └── useProjections.ts     # Swiss projections (EPSG:2056)
├── types/
│   └── solar.ts              # TypeScript interfaces
├── locales/
│   ├── de.json               # German translations
│   ├── fr.json               # French translations
│   ├── it.json               # Italian translations
│   └── en.json               # English translations
└── assets/                   # CSS, logos
```

---

## Contact

**Swiss Federal Office of Energy (SFOE)**
Geoinformation Service

- Website: [www.bfe.admin.ch](https://www.bfe.admin.ch)
- Email: geoinformation@bfe.admin.ch
- Application: [sonnendach.ch](https://www.uvek-gis.admin.ch/BFE/sonnendach/)
