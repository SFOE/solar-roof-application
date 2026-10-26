---
inclusion: fileMatch
fileMatchPattern: '{src/components/**,src/views/**}'
---

# Vue Component Development

Activated because a component or view file is in context.

## Where things live

- Reusable UI pieces: `src/components/*.vue` (flat, no subfolders — the app
  is small enough that a nested component tree hasn't been needed).
- The single page: `src/views/SonnendachView.vue`, which composes the
  components together. Adding a genuinely new page would need a new entry in
  `src/router/index.ts` as well — but check with the user first, since this
  app has been a deliberate single-page experience so far.

## State access pattern

Components do **not** receive the selection/map state via props. They call
`useMapStore()` directly and read/write its refs and computed properties.
This mirrors `SelectionModeToggle.vue`:

```ts
<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'

const store = useMapStore()
const sliderOffset = computed(() => (store.selectionMode === 'single' ? '0%' : '100%'))
</script>
```

Only reach for `defineProps`/`defineEmits` when a component is a generic,
reusable piece that should not know about `mapStore` at all. Most existing
components are intentionally coupled to the store because they are
one-of-a-kind, page-specific UI (`InfoPanel`, `SummaryBanner`,
`SelectionModeToggle`), not a reusable widget library.

## Template conventions

- Start every component with an HTML comment summarizing its purpose (see
  `coding-standards.md`).
- Use `$t('key')` for all visible text; add the key to **all four**
  `src/locales/*.json` files in the same change — a missing key falls back
  to showing the raw key string to the user, which is an easy regression to
  miss if you only update `de.json`.
- Conditional class bindings use the `:class="{ active: condition }"` object
  form or string concatenation (`'badge badge-' + agg.suitabilityClass`) —
  both patterns appear in the codebase; prefer the object form for toggles
  and the string form for computed variant classes (matches existing usage
  in `InfoPanel.vue`).

## Map-related components

Only `MapComponent.vue` touches OpenLayers directly. If a new component
needs to react to map state (selection, click coordinates, mode), go through
`useMapStore()` rather than reaching into the `Map`/`View` instance from
another component — `mapInstance` is a local `ref` inside
`MapComponent.vue`, not exposed to siblings.

When adding a new overlay/layer to the map, follow the existing WMTS setup
in `MapComponent.vue` (`createSwissWmtsSource`, the hand-built
`resolutions`/`matrixIds` arrays for the swisstopo `2056` TileMatrixSet) —
don't introduce a different projection or tiling scheme; see
`data-and-state-flow.md` for why EPSG:2056 is mandatory here.

## Adding a new field to the info/summary panels

The data a component displays almost always comes from `AggregatedData`
(`src/types/solar.ts`), computed in `mapStore.ts`'s `aggregateSurfaces()`.
To surface a new field end-to-end:

1. Add the raw field to `SurfaceData` and map it from the swisstopo
   attribute in `useSolarIdentify.ts`'s `toSurfaceData()`.
2. Add the aggregation logic (sum, average, or dedup-by-building — see the
   heat-demand dedup pattern in `aggregateSurfaces()`) and the field to
   `AggregatedData`.
3. Render it in the relevant component, behind an i18n key added to all four
   locale files.

Don't shortcut this by reading a raw swisstopo attribute name directly in a
component — keeping the normalization in `useSolarIdentify.ts`/`mapStore.ts`
is what lets the rest of the app stay ignorant of the upstream API's German
field names (`flaeche`, `gstrahlung`, `mstrahlung`, etc.).
