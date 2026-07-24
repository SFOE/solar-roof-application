<!--
  MapComponent.vue

  Interactive map with:
  - SWISSIMAGE background (aerial photos)
  - Solar layer (roofs OR facades depending on mode)
  - Click on map → identify API call → data in store
-->

<template>
  <div class="map-container">
    <div ref="mapContainer" class="map-wrapper"></div>
    <!-- Clear selection button (visible only in multi mode with selections) -->
    <button
      v-if="store.selectionMode === 'multi' && store.multiSelectedSurfaces.length > 0"
      class="clear-selection-btn"
      @click="clearMultiSelection"
    >{{ $t('mode_new_selection') }}</button>
    <!-- Attribution bar -->
    <div class="map-attribution">© Données: OFEN, swisstopo</div>
    <!-- Basemap switcher: shows the alternative option -->
    <div class="basemap-switcher">
      <template v-for="bm in basemaps" :key="bm.id">
        <button
          v-if="bm.id !== activeBasemap"
          class="basemap-thumb"
          @click="switchBasemap(bm.id)"
          :title="bm.label"
        >
          <img :src="bm.thumbnail" :alt="bm.label" />
          <span class="basemap-label">{{ bm.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useProjections } from '@/composables/useProjections'
import { useMapStore } from '@/stores/mapStore'
import axios from 'axios'

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import WMTS from 'ol/source/WMTS'
import WMTSTileGrid from 'ol/tilegrid/WMTS'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style } from 'ol/style'
import { getCenter } from 'ol/extent'
import { ScaleLine } from 'ol/control'
import type { MapBrowserEvent } from 'ol'

const mapContainer = ref<HTMLDivElement>()
const mapInstance = ref<Map>()
const store = useMapStore()
const { projection, swissCenter } = useProjections()

// Swisstopo layer names
const LAYER_ROOFS = 'ch.bfe.solarenergie-eignung-daecher'
const LAYER_FACADES = 'ch.bfe.solarenergie-eignung-fassaden'

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
  { id: 'satellite', label: 'Satellite', layer: 'ch.swisstopo.swissimage', format: 'jpeg', thumbnail: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/17/6/4.jpeg' },
  { id: 'grey', label: 'Carte N\u0026B', layer: 'ch.swisstopo.pixelkarte-grau', format: 'jpeg', thumbnail: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/2056/17/6/4.jpeg' },
]
const activeBasemap = ref('satellite')
let basemapLayer: TileLayer | null = null

/** Switches the basemap layer */
function switchBasemap(id: string) {
  activeBasemap.value = id
  const bm = basemaps.find(b => b.id === id)
  if (bm && basemapLayer) {
    basemapLayer.setSource(createSwissWmtsSource(bm.layer, bm.format))
  }
}

// Reference to the solar layer (to swap its source)
let solarLayer: TileLayer | null = null

// Vector layer for building outline highlight
// Double style: thick white border underneath + red on top = "glow" effect
const outlineSource = new VectorSource()
const outlineLayer = new VectorLayer({
  source: outlineSource,
  style: [
    new Style({ stroke: new Stroke({ color: '#ffffff', width: 6 }) }),
    new Style({
      fill: new Fill({ color: 'rgba(211, 47, 47, 0.25)' }),
      stroke: new Stroke({ color: '#d32f2f', width: 3 }),
    }),
  ],
})

const geoJsonFormat = new GeoJSON()

/**
 * Fetches all geometries for a building via the find API,
 * draws them on the map, and returns the building center.
 */
async function highlightBuilding(buildingId: number, layerName: string): Promise<[number, number] | null> {
  outlineSource.clear()

  try {
    const resp = await axios.get(
      'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
      {
        params: {
          layer: layerName,
          searchText: buildingId,
          searchField: 'building_id',
          contains: false,
          returnGeometry: true,
          geometryFormat: 'geojson',
          sr: '2056',
        },
      },
    )

    const features = resp.data.results?.filter((r: any) => r.featureId > 0) || []
    if (features.length === 0) return null

    let combinedExtent: number[] | null = null

    for (const f of features) {
      const olFeature = geoJsonFormat.readFeature(f)
      outlineSource.addFeature(olFeature)
      const ext = olFeature.getGeometry()!.getExtent()
      if (!combinedExtent) {
        combinedExtent = [...ext]
      } else {
        combinedExtent[0] = Math.min(combinedExtent[0], ext[0])
        combinedExtent[1] = Math.min(combinedExtent[1], ext[1])
        combinedExtent[2] = Math.max(combinedExtent[2], ext[2])
        combinedExtent[3] = Math.max(combinedExtent[3], ext[3])
      }
    }

    return combinedExtent ? getCenter(combinedExtent) as [number, number] : null
  } catch {
    return null
  }
}

/** Switches the solar tile layer source (roofs ↔ facades) */
function updateSolarLayer() {
  if (!solarLayer) return
  const layerName = store.solarMode === 'roofs' ? LAYER_ROOFS : LAYER_FACADES
  solarLayer.setSource(createSwissWmtsSource(layerName, 'png'))
}

/**
 * Computes the suitability class from irradiation data.
 * Formula: sum(mstrahlung * flaeche) / sum(flaeche) = weighted avg irradiation per m²
 * Then mapped to class using official thresholds:
 *
 * Roofs:
 *   1 = gering (< 800), 2 = mittel (800-999), 3 = gut (1000-1199),
 *   4 = sehr gut (1200-1399), 5 = hervorragend (≥ 1400)
 *
 * Facades:
 *   1 = gering (< 600), 2 = mittel (600-799), 3 = gut (800-999),
 *   4 = sehr gut (1000-1199), 5 = hervorragend (≥ 1200)
 */
function computeSuitabilityClass(allSurfaces: any[], mode: 'roofs' | 'facades'): number {
  let totalArea = 0
  let weightedIrradiation = 0

  for (const s of allSurfaces) {
    const area = s.attributes.flaeche || 0
    const mstrahlung = s.attributes.mstrahlung || 0
    totalArea += area
    weightedIrradiation += mstrahlung * area
  }

  const avgIrradiationM2 = totalArea > 0 ? weightedIrradiation / totalArea : 0

  if (mode === 'roofs') {
    if (avgIrradiationM2 >= 1400) return 5
    if (avgIrradiationM2 >= 1200) return 4
    if (avgIrradiationM2 >= 1000) return 3
    if (avgIrradiationM2 >= 800) return 2
    return 1
  } else {
    if (avgIrradiationM2 >= 1200) return 5
    if (avgIrradiationM2 >= 1000) return 4
    if (avgIrradiationM2 >= 800) return 3
    if (avgIrradiationM2 >= 600) return 2
    return 1
  }
}

/**
 * Aggregates all surfaces into a single data object.
 * Used by both identifyAt and the mode-switch watcher.
 */
function aggregateSurfaces(allSurfaces: any[], firstHitFeatureId: number, buildingId: number, mode: 'roofs' | 'facades') {
  const first = allSurfaces[0].attributes
  let totalArea = 0, totalElectricity = 0, totalElectricityWinter = 0, totalElectricitySummer = 0
  let totalFinancial = 0, totalHeatYield = 0, totalCollectorArea = 0
  let totalIrradiation = 0, totalStorageVolume = 0, weightedIrradiationM2 = 0

  for (const s of allSurfaces) {
    const a = s.attributes
    const area = a.flaeche || 0
    totalArea += area
    totalElectricity += a.stromertrag || 0
    totalElectricityWinter += a.stromertrag_winterhalbjahr || 0
    totalElectricitySummer += a.stromertrag_sommerhalbjahr || 0
    totalFinancial += a.finanzertrag || 0
    totalHeatYield += a.waermeertrag || 0
    totalCollectorArea += a.flaeche_kollektoren || 0
    totalIrradiation += a.gstrahlung || 0
    totalStorageVolume += a.volumen_speicher || 0
    weightedIrradiationM2 += (a.mstrahlung || 0) * area
  }

  // Compute suitability distribution (% of area per class)
  const classAreas = [0, 0, 0, 0, 0] // index 0=class1, ..., 4=class5
  for (const s of allSurfaces) {
    const area = s.attributes.flaeche || 0
    const cls = s.attributes.klasse || 1
    if (cls >= 1 && cls <= 5) {
      classAreas[cls - 1] += area
    }
  }
  const suitabilityDistribution = {
    class1: totalArea > 0 ? Math.round((classAreas[0] / totalArea) * 100) : 0,
    class2: totalArea > 0 ? Math.round((classAreas[1] / totalArea) * 100) : 0,
    class3: totalArea > 0 ? Math.round((classAreas[2] / totalArea) * 100) : 0,
    class4: totalArea > 0 ? Math.round((classAreas[3] / totalArea) * 100) : 0,
    class5: totalArea > 0 ? Math.round((classAreas[4] / totalArea) * 100) : 0,
  }

  return {
    featureId: firstHitFeatureId,
    buildingId,
    surfaceCount: allSurfaces.length,
    area: totalArea,
    suitabilityClass: computeSuitabilityClass(allSurfaces, mode),
    suitabilityDistribution,
    electricityYield: totalElectricity,
    electricityWinter: totalElectricityWinter,
    electricitySummer: totalElectricitySummer,
    financialReturn: totalFinancial,
    heatYield: totalHeatYield,
    heatingDemand: first.bedarf_heizung,
    hotWaterDemand: first.bedarf_warmwasser,
    collectorArea: totalCollectorArea,
    storageVolume: totalStorageVolume,
    irradiation: totalIrradiation,
    irradiationPerM2: totalArea > 0 ? weightedIrradiationM2 / totalArea : 0,
    gwr_egid: first.gwr_egid,
  }
}

// When mode changes, update the layer and reload data for the current building
watch(() => store.solarMode, async () => {
  updateSolarLayer()
  if (!store.lastBuildingId || !store.clickCoords) return

  // In single mode, re-identify at the same coords to get the individual surface
  if (store.selectionMode === 'single') {
    await identifyAt(store.clickCoords)
    return
  }

  const layerName = store.solarMode === 'roofs' ? LAYER_ROOFS : LAYER_FACADES
  const buildingId = store.lastBuildingId

  store.loading = true
  store.roofData = null
  store.facadeData = null
  store.noData = false
  const addressFromSearch = store.selectedAddress

  try {
    highlightBuilding(buildingId, layerName)

    const findResp = await axios.get(
      'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
      {
        params: {
          layer: layerName, searchText: buildingId, searchField: 'building_id',
          contains: false, returnGeometry: false, sr: '2056',
        },
      },
    )

    const allSurfaces = findResp.data.results?.filter((r: any) => r.featureId > 0) || []
    if (allSurfaces.length === 0) {
      store.noData = true
      return
    }

    const data = aggregateSurfaces(allSurfaces, 0, buildingId, store.solarMode)

    if (store.solarMode === 'roofs') {
      store.roofData = data
    } else {
      store.facadeData = data
    }
  } catch (error) {
    console.error('Mode switch error:', error)
    store.noData = true
  } finally {
    store.selectedAddress = addressFromSearch
    store.loading = false
  }
})

// When selection mode changes, reload data for the current location
watch(() => store.selectionMode, async () => {
  // When entering multi mode, keep existing highlights
  if (store.selectionMode === 'multi') {
    return
  }
  // Clear multi-selection highlights when leaving multi mode
  store.multiSelectedSurfaces = []
  outlineSource.clear()
  if (!store.clickCoords) return
  await identifyAt(store.clickCoords)
})

/**
 * Main identify function: finds the building at click coordinates,
 * fetches all its surfaces, aggregates data, and updates the store.
 */
async function identifyAt(coords: [number, number]) {
  store.clickCoords = coords
  store.loading = true
  store.roofData = null
  store.facadeData = null
  store.noData = false
  store.communeId = null

  // Preserve address if it came from the search bar
  const addressFromSearch = store.selectedAddress

  const layerName = store.solarMode === 'roofs' ? LAYER_ROOFS : LAYER_FACADES
  if (store.selectionMode !== 'multi') {
    outlineSource.clear()
  }

  try {
    // Step 1: Identify to find the building_id at click point
    // Both roofs and facades need some tolerance for reliable detection
    const isFacades = layerName === LAYER_FACADES
    // In single/multi mode, use minimal tolerance for precise surface selection
    const isDetailMode = store.selectionMode === 'single' || store.selectionMode === 'multi'
    const tolerance = isDetailMode ? 2 : (isFacades ? 40 : 10)
    const identifyParams: Record<string, any> = {
      geometryType: 'esriGeometryPoint',
      geometry: `${coords[0]},${coords[1]}`,
      sr: '2056',
      layers: `all:${layerName}`,
      tolerance,
      returnGeometry: false,
      limit: 1,
    }
    // imageDisplay and mapExtent are required when tolerance > 0
    identifyParams.imageDisplay = '500,500,96'
    identifyParams.mapExtent = `${coords[0] - 50},${coords[1] - 50},${coords[0] + 50},${coords[1] + 50}`
    const identifyResp = await axios.get(
      'https://api3.geo.admin.ch/rest/services/api/MapServer/identify',
      { params: identifyParams },
    )

    const firstHit = identifyResp.data.results?.find((r: any) => r.featureId > 0)
    if (!firstHit) {
      store.noData = true
      return
    }

    const buildingId = firstHit.attributes.building_id
    store.lastBuildingId = buildingId

    // In single mode: display only the clicked surface, no aggregation
    if (store.selectionMode === 'single') {
      // Re-call identify with returnGeometry=true to get the surface geometry for highlighting
      outlineSource.clear()
      try {
        const geomIdentify = await axios.get(
          'https://api3.geo.admin.ch/rest/services/api/MapServer/identify',
          {
            params: {
              geometryType: 'esriGeometryPoint',
              geometry: `${coords[0]},${coords[1]}`,
              sr: '2056',
              layers: `all:${layerName}`,
              tolerance,
              returnGeometry: true,
              geometryFormat: 'geojson',
              limit: 1,
              imageDisplay: '500,500,96',
              mapExtent: `${coords[0] - 50},${coords[1] - 50},${coords[0] + 50},${coords[1] + 50}`,
            },
          },
        )
        const geomHit = geomIdentify.data.results?.find((r: any) => r.featureId > 0)
        if (geomHit) {
          const olFeature = geoJsonFormat.readFeature(geomHit)
          outlineSource.addFeature(olFeature)
          const ext = olFeature.getGeometry()!.getExtent()
          const center = getCenter(ext) as [number, number]
          mapInstance.value?.getView().animate({ center, duration: 500 })
        }
      } catch { /* non-critical — data still displays, just no highlight */ }

      // Build single surface data directly from identify attributes
      const a = firstHit.attributes
      const singleData = {
        featureId: firstHit.featureId,
        buildingId,
        surfaceCount: 1,
        area: a.flaeche || 0,
        suitabilityClass: a.klasse || 1,
        suitabilityDistribution: {
          class1: a.klasse === 1 ? 100 : 0,
          class2: a.klasse === 2 ? 100 : 0,
          class3: a.klasse === 3 ? 100 : 0,
          class4: a.klasse === 4 ? 100 : 0,
          class5: a.klasse === 5 ? 100 : 0,
        },
        electricityYield: a.stromertrag || 0,
        electricityWinter: a.stromertrag_winterhalbjahr || 0,
        electricitySummer: a.stromertrag_sommerhalbjahr || 0,
        financialReturn: a.finanzertrag || 0,
        heatYield: a.waermeertrag || 0,
        heatingDemand: a.bedarf_heizung,
        hotWaterDemand: a.bedarf_warmwasser,
        collectorArea: a.flaeche_kollektoren || 0,
        storageVolume: a.volumen_speicher || 0,
        irradiation: a.gstrahlung || 0,
        irradiationPerM2: a.mstrahlung || 0,
        gwr_egid: a.gwr_egid,
      }

      if (store.solarMode === 'roofs') {
        store.roofData = singleData
      } else {
        store.facadeData = singleData
      }
      return
    }

    // Multi mode: add/remove surfaces from selection, no clear between clicks
    if (store.selectionMode === 'multi') {
      const featureId = firstHit.featureId

      // Check if this surface is already selected (toggle off)
      const existingIndex = store.multiSelectedSurfaces.findIndex(s => s.featureId === featureId)
      if (existingIndex >= 0) {
        // Remove from selection
        store.multiSelectedSurfaces.splice(existingIndex, 1)
        // Remove its geometry from the outline layer
        const features = outlineSource.getFeatures()
        const toRemove = features.find(f => f.get('featureId') === featureId)
        if (toRemove) outlineSource.removeFeature(toRemove)
      } else {
        // Add to selection: get geometry via identify with returnGeometry
        try {
          const geomIdentify = await axios.get(
            'https://api3.geo.admin.ch/rest/services/api/MapServer/identify',
            {
              params: {
                geometryType: 'esriGeometryPoint',
                geometry: `${coords[0]},${coords[1]}`,
                sr: '2056',
                layers: `all:${layerName}`,
                tolerance,
                returnGeometry: true,
                geometryFormat: 'geojson',
                limit: 1,
                imageDisplay: '500,500,96',
                mapExtent: `${coords[0] - 50},${coords[1] - 50},${coords[0] + 50},${coords[1] + 50}`,
              },
            },
          )
          const geomHit = geomIdentify.data.results?.find((r: any) => r.featureId > 0)
          if (geomHit) {
            const olFeature = geoJsonFormat.readFeature(geomHit)
            olFeature.set('featureId', featureId)
            outlineSource.addFeature(olFeature)
          }
        } catch { /* highlight failure is non-critical */ }

        // Build surface data and add to array
        const a = firstHit.attributes
        store.multiSelectedSurfaces.push({
          featureId,
          buildingId,
          surfaceCount: 1,
          area: a.flaeche || 0,
          suitabilityClass: a.klasse || 1,
          suitabilityDistribution: {
            class1: a.klasse === 1 ? 100 : 0,
            class2: a.klasse === 2 ? 100 : 0,
            class3: a.klasse === 3 ? 100 : 0,
            class4: a.klasse === 4 ? 100 : 0,
            class5: a.klasse === 5 ? 100 : 0,
          },
          electricityYield: a.stromertrag || 0,
          electricityWinter: a.stromertrag_winterhalbjahr || 0,
          electricitySummer: a.stromertrag_sommerhalbjahr || 0,
          financialReturn: a.finanzertrag || 0,
          heatYield: a.waermeertrag || 0,
          heatingDemand: a.bedarf_heizung,
          hotWaterDemand: a.bedarf_warmwasser,
          collectorArea: a.flaeche_kollektoren || 0,
          storageVolume: a.volumen_speicher || 0,
          irradiation: a.gstrahlung || 0,
          irradiationPerM2: a.mstrahlung || 0,
          gwr_egid: a.gwr_egid,
        })
      }

      // Aggregate multi-selection into roofData/facadeData for display
      if (store.multiSelectedSurfaces.length === 0) {
        store.roofData = null
        store.facadeData = null
        store.noData = false
      } else {
        const surfaces = store.multiSelectedSurfaces
        let totalArea = 0, totalElectricity = 0, totalElectricityWinter = 0, totalElectricitySummer = 0
        let totalFinancial = 0, totalHeatYield = 0, totalCollectorArea = 0
        let totalIrradiation = 0, totalStorageVolume = 0, weightedIrradiationM2 = 0

        for (const s of surfaces) {
          totalArea += s.area
          totalElectricity += s.electricityYield
          totalElectricityWinter += s.electricityWinter
          totalElectricitySummer += s.electricitySummer
          totalFinancial += s.financialReturn
          totalHeatYield += s.heatYield
          totalCollectorArea += s.collectorArea
          totalStorageVolume += s.storageVolume
          totalIrradiation += s.irradiation
          weightedIrradiationM2 += s.irradiationPerM2 * s.area
        }

        const classAreas = [0, 0, 0, 0, 0]
        for (const s of surfaces) {
          if (s.suitabilityClass >= 1 && s.suitabilityClass <= 5) {
            classAreas[s.suitabilityClass - 1] += s.area
          }
        }

        const avgIrradiationM2 = totalArea > 0 ? weightedIrradiationM2 / totalArea : 0
        const mode = store.solarMode
        let suitClass: number
        if (mode === 'roofs') {
          suitClass = avgIrradiationM2 >= 1400 ? 5 : avgIrradiationM2 >= 1200 ? 4 : avgIrradiationM2 >= 1000 ? 3 : avgIrradiationM2 >= 800 ? 2 : 1
        } else {
          suitClass = avgIrradiationM2 >= 1200 ? 5 : avgIrradiationM2 >= 1000 ? 4 : avgIrradiationM2 >= 800 ? 3 : avgIrradiationM2 >= 600 ? 2 : 1
        }

        const multiData = {
          featureId: 0,
          buildingId: 0,
          surfaceCount: surfaces.length,
          area: totalArea,
          suitabilityClass: suitClass,
          suitabilityDistribution: {
            class1: totalArea > 0 ? Math.round((classAreas[0] / totalArea) * 100) : 0,
            class2: totalArea > 0 ? Math.round((classAreas[1] / totalArea) * 100) : 0,
            class3: totalArea > 0 ? Math.round((classAreas[2] / totalArea) * 100) : 0,
            class4: totalArea > 0 ? Math.round((classAreas[3] / totalArea) * 100) : 0,
            class5: totalArea > 0 ? Math.round((classAreas[4] / totalArea) * 100) : 0,
          },
          electricityYield: totalElectricity,
          electricityWinter: totalElectricityWinter,
          electricitySummer: totalElectricitySummer,
          financialReturn: totalFinancial,
          heatYield: totalHeatYield,
          heatingDemand: surfaces[0].heatingDemand,
          hotWaterDemand: surfaces[0].hotWaterDemand,
          collectorArea: totalCollectorArea,
          storageVolume: totalStorageVolume,
          irradiation: totalIrradiation,
          irradiationPerM2: avgIrradiationM2,
          gwr_egid: surfaces[0].gwr_egid,
        }

        if (store.solarMode === 'roofs') {
          store.roofData = multiData
        } else {
          store.facadeData = multiData
        }
      }
      return
    }

    // Building mode: draw full building outline and center map
    const buildingCenter = await highlightBuilding(buildingId, layerName)
    if (buildingCenter) {
      const view = mapInstance.value?.getView()
      view?.animate({ center: buildingCenter, duration: 500 })
    }

    // Step 2: Find all surfaces for this building
    const findResp = await axios.get(
      'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
      {
        params: {
          layer: layerName, searchText: buildingId, searchField: 'building_id',
          contains: false, returnGeometry: false, sr: '2056',
        },
      },
    )

    const allSurfaces = findResp.data.results?.filter((r: any) => r.featureId > 0) || []
    if (allSurfaces.length === 0) return

    // Aggregate and store
    const data = aggregateSurfaces(allSurfaces, firstHit.featureId, buildingId, store.solarMode)

    if (store.solarMode === 'roofs') {
      store.roofData = data
    } else {
      store.facadeData = data
    }
  } catch (error) {
    console.error('Identify error:', error)
  } finally {
    // Look up the building address and commune via GWR using EGID or building_id
    const egid = store.roofData?.gwr_egid || store.facadeData?.gwr_egid
    const buildingIdForLookup = store.lastBuildingId
    if (egid) {
      try {
        const addrResp = await axios.get(
          'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
          {
            params: {
              layer: 'ch.bfs.gebaeude_wohnungs_register',
              searchText: egid, searchField: 'egid',
              contains: false, returnGeometry: false, limit: 1,
            },
          },
        )
        const addrHit = addrResp.data.results?.find(
          (r: any) => String(r.attributes.egid) === String(egid),
        )
        if (addrHit) {
          const a = addrHit.attributes
          if (!addressFromSearch) {
            store.selectedAddress = `${a.strname_deinr}, ${a.dplz4} ${a.dplzname}`
          }
          store.communeId = a.ggdenr ? parseInt(a.ggdenr) : null
        }
      } catch { /* non-critical */ }
    } else if (buildingIdForLookup) {
      // Fallback: use building_id to find EGID via the solar layer, then lookup GWR
      try {
        const layerForLookup = store.solarMode === 'roofs' ? LAYER_ROOFS : LAYER_FACADES
        const findResp = await axios.get(
          'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
          {
            params: {
              layer: layerForLookup, searchText: buildingIdForLookup,
              searchField: 'building_id', contains: false,
              returnGeometry: false, sr: '2056', limit: 1,
            },
          },
        )
        const firstSurface = findResp.data.results?.find((r: any) => r.featureId > 0)
        const fallbackEgid = firstSurface?.attributes?.gwr_egid
        if (fallbackEgid) {
          const addrResp = await axios.get(
            'https://api3.geo.admin.ch/rest/services/api/MapServer/find',
            {
              params: {
                layer: 'ch.bfs.gebaeude_wohnungs_register',
                searchText: fallbackEgid, searchField: 'egid',
                contains: false, returnGeometry: false, limit: 1,
              },
            },
          )
          const addrHit = addrResp.data.results?.find(
            (r: any) => String(r.attributes.egid) === String(fallbackEgid),
          )
          if (addrHit) {
            const a = addrHit.attributes
            if (!addressFromSearch) {
              store.selectedAddress = `${a.strname_deinr}, ${a.dplz4} ${a.dplzname}`
            }
            store.communeId = a.ggdenr ? parseInt(a.ggdenr) : null
          }
        }
      } catch { /* non-critical */ }
    }
    if (addressFromSearch) {
      store.selectedAddress = addressFromSearch
    }
    store.loading = false
  }
}

/** Called on map click */
async function onMapClick(evt: MapBrowserEvent<UIEvent>) {
  store.selectedAddress = ''
  await identifyAt(evt.coordinate as [number, number])
}

/** Animates the map to the given LV95 coordinates */
function zoomTo(center: [number, number], zoomResolution = 0.1) {
  const view = mapInstance.value?.getView()
  if (!view) return
  view.animate({ center, resolution: zoomResolution, duration: 1000 })
}

/** Clears multi-selection (outlines + stored surfaces) */
function clearMultiSelection() {
  outlineSource.clear()
  store.multiSelectedSurfaces = []
  store.roofData = null
  store.facadeData = null
}

defineExpose({ zoomTo, identifyAt })

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
    layers: [
      basemapLayer,
      solarLayer,
      outlineLayer,
    ],
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

  // Add scale bar
  map.addControl(new ScaleLine({ units: 'metric' }))

  mapInstance.value = map
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
  border: none;
  background: rgba(255, 255, 255, 0.8);
  color: #666;
  font-size: 0.7rem;
  font-weight: 400;
  cursor: pointer;
  z-index: 10;
  transition: color 0.2s, background 0.2s;
}

.clear-selection-btn:hover {
  background: rgba(255, 255, 255, 0.95);
  color: #d32f2f;
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
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  transition: border-color 0.2s;
}

.basemap-thumb.active {
  border-color: #d32f2f;
}

.basemap-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-attribution {
  position: absolute;
  bottom: 4px;
  right: 12px;
  background: rgba(255, 255, 255, 0.85);
  color: #333;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 3px;
  z-index: 10;
}

.basemap-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 0.65rem;
  text-align: center;
  padding: 2px 1px;
  line-height: 1.1;
  white-space: pre-line;
}
</style>
