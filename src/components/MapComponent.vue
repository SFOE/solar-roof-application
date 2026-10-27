<!--
  MapComponent.vue

  Interactive map with:
  - SWISSIMAGE / grey background (switchable)
  - Solar layer (roofs OR facades depending on mode)
  - Click on map → identify (via useSolarIdentify) → toggle selection in store
  - Outline highlight (contour only, no fill) for each selected element
-->

<template>
  <div class="map-container">
    <div ref="mapContainer" class="map-wrapper"></div>
    <!-- Clear selection button (only in multi mode with an active selection) -->
    <button
      v-if="store.selectionMode === 'multi' && store.selectedSurfaces.length > 0"
      class="clear-selection-btn"
      @click="clearAll"
    >{{ $t('mode_new_selection') }}</button>
    <!-- Attribution bar -->
    <div class="map-attribution">{{ $t('map_attribution') }}</div>
    <!-- Basemap switcher: shows the alternative option -->
    <div class="basemap-switcher">
      <template v-for="bm in basemaps" :key="bm.id">
        <button
          v-if="bm.id !== activeBasemap"
          class="basemap-thumb"
          @click="switchBasemap(bm.id)"
          :title="$t(bm.labelKey)"
        >
          <img :src="bm.thumbnail" :alt="$t(bm.labelKey)" />
          <span class="basemap-label">{{ $t(bm.labelKey) }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useProjections } from '@/composables/useProjections'
import { useMapStore } from '@/stores/mapStore'
import { useSolarIdentify } from '@/composables/useSolarIdentify'

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import WMTS from 'ol/source/WMTS'
import WMTSTileGrid from 'ol/tilegrid/WMTS'
import type Feature from 'ol/Feature'
import { Stroke, Style } from 'ol/style'
import { getCenter } from 'ol/extent'
import { ScaleLine } from 'ol/control'
import type { MapBrowserEvent } from 'ol'

const mapContainer = ref<HTMLDivElement>()
const mapInstance = ref<Map>()
const store = useMapStore()
const { projection, swissCenter } = useProjections()
const { identifySurface, identifyBestRoof, lookupAddressCommune } = useSolarIdentify()

// Swisstopo layer names
const LAYER_ROOFS = 'ch.bfe.solarenergie-eignung-daecher'
const LAYER_FACADES = 'ch.bfe.solarenergie-eignung-fassaden'

function currentLayer(): string {
  return store.solarMode === 'roofs' ? LAYER_ROOFS : LAYER_FACADES
}

// --- Swisstopo EPSG:2056 TileGrid ---
const resolutions = [
  4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
  1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25,
]
const matrixIds = resolutions.map((_, i) => String(i))

const tileGrid = new WMTSTileGrid({
  origin: [2420000, 1350000],
  resolutions,
  matrixIds,
})

function createSwissWmtsSource(layerName: string, format: string): WMTS {
  return new WMTS({
    url: `https://wmts.geo.admin.ch/1.0.0/${layerName}/default/current/2056/{TileMatrix}/{TileCol}/{TileRow}.${format}`,
    layer: layerName,
    matrixSet: '2056',
    format: `image/${format}`,
    style: 'default',
    tileGrid,
    projection,
    requestEncoding: 'REST',
    crossOrigin: 'anonymous',
  })
}

// Basemap configuration
const basemaps = [
  { id: 'satellite', labelKey: 'basemap_satellite', layer: 'ch.swisstopo.swissimage', format: 'jpeg', thumbnail: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/17/6/4.jpeg' },
  { id: 'grey', labelKey: 'basemap_grey', layer: 'ch.swisstopo.pixelkarte-grau', format: 'jpeg', thumbnail: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/2056/17/6/4.jpeg' },
]
const activeBasemap = ref('satellite')
let basemapLayer: TileLayer | null = null

/** Switches the basemap layer */
function switchBasemap(id: string) {
  activeBasemap.value = id
  const bm = basemaps.find((b) => b.id === id)
  if (bm && basemapLayer) {
    basemapLayer.setSource(createSwissWmtsSource(bm.layer, bm.format))
  }
}

// Reference to the solar layer (to swap its source)
let solarLayer: TileLayer | null = null

// Vector layer for selection highlight — CONTOUR ONLY (no fill), to preserve suitability colors.
// Double stroke: light halo underneath + colored outline on top for contrast.
// '#d32f2f' mirrors --color-accent in src/assets/base.css. OpenLayers styles are plain JS and
// can't read CSS custom properties directly, so this value is duplicated — keep both in sync.
const outlineSource = new VectorSource()
const outlineLayer = new VectorLayer({
  source: outlineSource,
  style: [
    new Style({ stroke: new Stroke({ color: '#ffffff', width: 5 }) }),
    new Style({ stroke: new Stroke({ color: '#d32f2f', width: 2.5 }) }),
  ],
})

/** Switches the solar tile layer source (roofs ↔ facades) */
function updateSolarLayer() {
  if (!solarLayer) return
  solarLayer.setSource(createSwissWmtsSource(currentLayer(), 'png'))
}

/** Adds one or more geometry features to the outline layer. */
function addOutlines(geometries: (Feature | null)[]) {
  for (const g of geometries) {
    if (g) outlineSource.addFeature(g)
  }
}

/** Removes outline features matching a given featureId. */
function removeOutlineByFeatureId(featureId: number) {
  const f = outlineSource.getFeatures().find((x) => x.get('featureId') === featureId)
  if (f) outlineSource.removeFeature(f)
}

// Zoom resolution used when focusing on a selection.
// Chosen to frame a whole building (and its immediate surroundings),
// not a single roof pane which would be too tight.
const BUILDING_ZOOM_RESOLUTION = 0.5

/** Centers and zooms the view to building scale around a feature. */
function centerOnFeature(feature: Feature | null) {
  if (!feature) return
  const geom = feature.getGeometry()
  if (!geom) return
  const view = mapInstance.value?.getView()
  if (!view) return
  const center = getCenter(geom.getExtent()) as [number, number]
  // Only zoom in if we're currently more zoomed out than building scale,
  // so exploring nearby roofs at building scale doesn't keep re-zooming.
  const targetResolution =
    (view.getResolution() ?? BUILDING_ZOOM_RESOLUTION) > BUILDING_ZOOM_RESOLUTION
      ? BUILDING_ZOOM_RESOLUTION
      : view.getResolution()
  view.animate({ center, resolution: targetResolution, duration: 500 })
}

/** Runs GWR lookup for address + commune, preserving a search-provided address. */
async function runGwrLookup(egid: number | undefined, buildingId: number | null, addressFromSearch: string) {
  const res = await lookupAddressCommune(egid, buildingId, currentLayer())
  if (res) {
    if (!addressFromSearch) store.selectedAddress = res.address
    store.communeId = res.communeId
    store.postalCode = res.postalCode
  }
  if (addressFromSearch) store.selectedAddress = addressFromSearch
}

/**
 * Main entry point for a selection action at given coordinates.
 * Always selects an individual roof surface (cumulative multi-select).
 * `preferBestRoof` is used for address search to show the building's best pan.
 */
async function identifyAt(coords: [number, number], preferBestRoof = false) {
  store.clickCoords = coords
  store.loading = true
  store.noData = false
  store.communeId = null
  const addressFromSearch = store.selectedAddress

  try {
    let picked: { surface: import('@/types/solar').SurfaceData; geometry: Feature | null; buildingId?: number } | null =
      null
    if (preferBestRoof) {
      picked = await identifyBestRoof(coords, currentLayer())
    } else {
      picked = await identifySurface(coords, currentLayer())
      if (!picked) {
        // Click did not hit a precise surface → fall back to best roof of the building
        picked = await identifyBestRoof(coords, currentLayer())
      }
    }
    if (!picked) {
      if (store.selectedSurfaces.length === 0) store.noData = true
      return
    }
    if (store.selectionMode === 'single') {
      // Explore mode: replace the selection with the clicked surface
      outlineSource.clear()
      store.selectSingle(picked.surface)
      addOutlines([picked.geometry])
      centerOnFeature(picked.geometry)
    } else {
      // Multi mode: add/remove the surface (cumulative)
      const action = store.toggleSurface(picked.surface)
      if (action === 'added') {
        addOutlines([picked.geometry])
        centerOnFeature(picked.geometry)
      } else {
        removeOutlineByFeatureId(picked.surface.featureId)
      }
    }
    await runGwrLookup(picked.surface.gwr_egid, picked.surface.buildingId, addressFromSearch)
  } catch (error) {
    console.error('Identify error:', error)
  } finally {
    store.loading = false
  }
}

/** Called on map click */
async function onMapClick(evt: MapBrowserEvent) {
  store.selectedAddress = ''
  await identifyAt(evt.coordinate as [number, number])
}

/** Animates the map to the given LV95 coordinates */
function zoomTo(center: [number, number], zoomResolution = 0.1) {
  const view = mapInstance.value?.getView()
  if (!view) return
  view.animate({ center, resolution: zoomResolution, duration: 1000 })
}

/** Clears the whole selection (outlines + store). */
function clearAll() {
  outlineSource.clear()
  store.clearSelection()
}

/** Public wrapper for address search: always select the building's best pan. */
function identifyFromSearch(coords: [number, number]) {
  return identifyAt(coords, true)
}

// Changing the solar layer (roofs ↔ facades) clears the selection (featureIds differ)
watch(
  () => store.solarMode,
  () => {
    updateSolarLayer()
    outlineSource.clear()
    // store.setSolarMode already clears selection when called via the toggle;
    // ensure outlines are cleared here too in case solarMode is mutated directly.
  },
)

defineExpose({ zoomTo, identifyAt: identifyFromSearch })

onMounted(() => {
  if (!mapContainer.value) return

  solarLayer = new TileLayer({
    opacity: 0.75,
    source: createSwissWmtsSource(LAYER_ROOFS, 'png'),
  })

  basemapLayer = new TileLayer({
    source: createSwissWmtsSource('ch.swisstopo.swissimage', 'jpeg'),
  })

  const map = new Map({
    target: mapContainer.value,
    layers: [basemapLayer, solarLayer, outlineLayer],
    view: new View({
      projection,
      center: swissCenter,
      extent: [2420000, 1030000, 2900000, 1350000],
      resolution: 1500,
      minResolution: 0.05,
      maxResolution: 4000,
    }),
  })

  map.on('singleclick', onMapClick)
  map.on('pointermove', (evt) => {
    map.getTargetElement().style.cursor = evt.dragging ? 'grabbing' : 'pointer'
  })

  map.addControl(new ScaleLine({ units: 'metric' }))

  mapInstance.value = map
})

// Release the map's DOM/canvas and rendering context. There is only one route
// in this app so this rarely runs today, but it's the documented OpenLayers
// cleanup step and keeps HMR component reloads during development from
// accumulating detached map instances.
onUnmounted(() => {
  mapInstance.value?.setTarget(undefined)
  mapInstance.value = undefined
})
</script>

<style scoped>
.map-container {
  position: relative;
}

.map-wrapper {
  width: 100%;
  height: 300px;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
}

.map-attribution {
  position: absolute;
  bottom: 6px;
  left: 8px;
  font-size: 0.65rem;
  color: #333;
  background: rgba(255, 255, 255, 0.7);
  padding: 1px 6px;
  border-radius: 3px;
  z-index: 10;
}

.basemap-switcher {
  position: absolute;
  bottom: 30px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.clear-selection-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-accent);
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-accent);
  font-size: 0.7rem;
  font-weight: 400;
  cursor: pointer;
  z-index: 10;
  transition: color 0.2s, background 0.2s;
}

.clear-selection-btn:hover {
  background: var(--color-accent);
  color: #fff;
}

.basemap-thumb {
  width: 70px;
  height: 50px;
  border: 2px solid #fff;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  position: relative;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: border-color 0.2s;
}

.basemap-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.basemap-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 0.6rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  text-align: center;
  padding: 1px 0;
}
</style>
