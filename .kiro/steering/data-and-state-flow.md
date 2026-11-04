---
inclusion: fileMatch
fileMatchPattern: '{src/composables/**,src/stores/**,src/types/**,backend/**}'
---

# Data & State Flow

Activated because a composable, store, type, or backend file is in context.
This is the domain logic of the app — read it before changing how selection,
aggregation, or the VESE proxy works.

## Selection model (single source of truth)

`mapStore.ts`'s `selectedSurfaces` (a `ref<SurfaceData[]>`, deduped by
`featureId`) is the **only** selection state that gets mutated directly. The
other store refs are plain context values set by `MapComponent.vue` and the
page (`clickCoords`, `selectedAddress`, `communeId`, `postalCode`, `noData`,
`loading`), not derived data. All totals are derived:

```
selectedSurfaces (ref, mutated)
  └─ aggregated (computed) ── aggregateSurfaces(selectedSurfaces, solarMode)
       └─ summary (computed) ── suitability + financial/heat summary for the banner
```

Never add a second place that stores totals or "the current selection" —
if a component needs a new derived value, add a `computed()` next to
`aggregated`/`summary` in `mapStore.ts`, or extend `aggregateSurfaces()`
itself. Duplicating derivation logic in a component is how the store and the
UI drift apart.

`selectionMode` (`'single'` | `'multi'`) controls *how* clicks mutate
`selectedSurfaces` (replace vs. accumulate) and whether a click that finds
nothing clears the previous result (single) or keeps it (multi). Besides
`MapComponent.vue`, it is only read for display: the toggle itself
(`SelectionModeToggle.vue`) and the "New selection" button on the map (multi
mode only). It is not part of the aggregation.
`solarMode` (`'roofs'` | `'facades'`) controls which swisstopo layer is
queried; switching it clears the selection (`setSolarMode()`) because
`featureId`s are not comparable across the two layers.

## Heat demand is a per-building value, not per-surface

`heatingDemand`/`hotWaterDemand` come back identical on every surface of the
same building (the swisstopo API repeats the building-level figure on each
roof pane). `aggregateSurfaces()` dedupes by building before summing
them — see the `seenBuildings` map and `buildingKey()`. A building is
identified by its GWR EGID (`gwr_egid`), because the demand comes from the GWR
and one GWR building can span several Sonnendach `building_id` (building
parts, e.g. Chalberzaunweg 11, Ringoldswil). Without an EGID (0 or missing),
the key falls back to `buildingId`. The same key gives `buildingCount`. If you add another building-level
(rather than surface-level) field, follow the same dedup pattern instead of
summing it per surface, or multi-surface selections will overcount it.

### Solar-thermal yields are not additive per building

The solar-thermal values of a surface (`heatYield`, `collectorArea`,
`storageVolume`) are sized as if that surface were the **only** solar-thermal
installation of its building, and `heatYield` counts the heat the building can
actually use (Sonnendach technical report, chapter 7.5). Unlike PV (surplus
electricity goes to the grid), they cannot be summed over several surfaces of
the same building: two installations share the same demand.

Decision (product): the **heat coverage %** (`summary.heatCoveragePercent`,
shown in the summary banner and the info panel) is only given when all
selected surfaces belong to **one building** (`buildingCount === 1`, same EGID) and is
**capped at 100%** (`heatCoverage()` in `mapStore.ts`). Several surfaces of the
same building keep a percentage (an upper bound, since each yield assumes it is
the building's only installation). Surfaces of several buildings, or an
unknown demand, give `null`: the info panel keeps its row and shows `-`; the
summary banner leaves out its heat sentence.
`aggregateSurfaces()` still sums `heatYield`, `collectorArea` and
`storageVolume` for display — read those totals as a sum of individual
potentials, not as what one combined installation would deliver. Changing this
is a product decision; raise it with the user rather than changing it silently.

## swisstopo API usage (`useSolarIdentify.ts`)

Two different identify strategies, used in different situations:

- **`identifySurface`** — small tolerance (2), used for a precise click:
  returns exactly the surface under the cursor.
- **`identifyBestRoof`** — larger tolerance (10 for roofs, 40 for facades),
  finds the `building_id` at a point and then calls `find` to fetch *all*
  surfaces of that building, picking the one with the highest
  irradiation/m² (`mstrahlung`), tie-broken by area (`pickBestRoof`). Used
  when a click doesn't precisely hit a surface, and for address search
  results (a search result gives a building, not a specific roof pane).

Both normalize the raw German-named swisstopo attributes
(`flaeche`, `stromertrag`, `gstrahlung`, `mstrahlung`, `ausrichtung`,
`neigung`, …) into `SurfaceData` via `toSurfaceData()`. Add any new field
mapping there, not ad hoc in a component.

`attrsOf()` exists because the same data can come back either as
`result.attributes` (from `identify`) or `result.properties` (from `find`
with `geometryFormat: geojson`) — always read through it rather than picking
one shape and assuming it's the only one in use.

## Coordinate system: EPSG:2056 (LV95) end-to-end

`useProjections.ts` registers `EPSG:2056` and `EPSG:21781` (LV03) via
`proj4` and tells OpenLayers about them (`register(proj4)`); this must run
before any WMTS/vector layer using those projections is created. All
map/API coordinates in this app are LV95 (`sr: '2056'` on every swisstopo
API call) — don't introduce WGS84 lat/lng anywhere in the identify/find
pipeline, since the swisstopo layers and the map view are natively LV95.

## VESE tariff proxy — why it exists and how it's split

The VESE PvTarif API requires a license key tied to a paid agreement. The
key must never reach the browser (see `coding-standards.md`'s secrets
section). The flow is split across three pieces that must stay in sync:

1. **`usePvTarif.ts`** (frontend) — calls `${VITE_PVTARIF_API_URL}/muni` then
   `/evu`, never attaches a key, and strips a BOM character VESE injects
   into its JSON. It reads the *proxy* URL from env, not VESE's own host.
2. **Dev proxy** (`vite.config.ts`'s `veseProxyPlugin`) — a Vite middleware
   that only runs in `npm run dev`. It reads `VITE_VESE_API_KEY` from
   `.env.local` (Node-side `loadEnv`, not the bundled `import.meta.env`) and
   appends `licenseKey` to the outgoing VESE request.
3. **Lambda proxy** (`backend/lambda_function.py`) — the production
   equivalent. Fetches the key from AWS Secrets Manager (cached across warm
   invocations), never logs the key or a raw exception (which could contain
   the key in the URL), and emits structured JSON log events in an `event`
   field (`secret_unavailable`, `vese_auth_rejected`, `vese_http_error`,
   `vese_unreachable`). Only the first two feed a CloudWatch metric filter
   (`VeseConfigErrors`) and its e-mail alarm; the other two are deliberately
   logged without an alarm (a VESE outage cannot be fixed on our side).
   Renaming any event requires checking `monitoring.tf` in both
   infrastructure repositories (dev and prod) — the filter matches the exact
   string.

Both proxies implement the **same two routes** (`/muni?idofs=`,
`/evu?evuId=&year=`) and the **same BOM-stripping** — if you change one
side's response shape, change the other, since `usePvTarif.ts` talks to
whichever one is configured for the current environment without knowing
which it is.

### EVU selection is "first provider only"

`fetchTarif()` only ever queries the tariff for the *first* EVU returned for
a municipality (`cleanEvus[0]`), even if several providers serve that
commune. This is a deliberate simplification, not a bug — if multi-provider
support is ever requested, it changes the UI contract (which tariff does
the summary banner show?), so raise it as a product question before
changing `fetchTarif()`'s loop.

The tariff is fetched by `InfoPanel.vue` when `store.communeId` changes. When
it becomes `null` (new search, or a building without GWR match) the previous
tariff is cleared, so a tariff is never shown for another building.

## Pinia store style

Both stores use the **setup-store** syntax (`defineStore('id', () => { ... })`
returning refs/computed/functions), not the options-store syntax. Keep new
stores consistent with this — mixing both styles in one app makes it harder
to predict whether `store.x` is reactive.
