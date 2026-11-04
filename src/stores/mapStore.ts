/**
 * mapStore.ts
 *
 * Central Pinia store for map state and solar data.
 * Shared between all components (MapComponent, InfoPanel, SearchBar, etc.)
 *
 * Selection model:
 * - `selectedSurfaces` is the single source of truth (unique by featureId).
 * - Both selection modes ('single' / 'multi') write into this array.
 * - `aggregated` and `summary` are derived (computed) from `selectedSurfaces`.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SurfaceData,
  AggregatedData,
  SummaryData,
  SolarMode,
  SelectionMode,
} from '@/types/solar'

/** Maps weighted average irradiation (kWh/m²/year) to a suitability class (1..5). */
function classifyIrradiation(avg: number, mode: SolarMode): number {
  if (mode === 'roofs') {
    if (avg >= 1400) return 5
    if (avg >= 1200) return 4
    if (avg >= 1000) return 3
    if (avg >= 800) return 2
    return 1
  }
  if (avg >= 1200) return 5
  if (avg >= 1000) return 4
  if (avg >= 800) return 3
  if (avg >= 600) return 2
  return 1
}

/** Maximum heat coverage: a building cannot use more heat than its demand. */
const MAX_HEAT_COVERAGE_PERCENT = 100

/**
 * Share of the building's heat demand (heating + hot water) covered by the solar-thermal yield,
 * in %, or null when it cannot be stated (shown as "-").
 *
 * - Only for surfaces of a single building: a coverage is a ratio to one building's demand, and
 *   the thermal values cannot be shared between buildings. Several surfaces of the same
 *   building are allowed (their yields are summed against that building's demand).
 * - Capped at 100%: the yield counts useful heat, and a building cannot use more than it needs.
 *   Each surface's yield is sized as if it were the building's only installation (Sonnendach
 *   report, chapter 7.5), so for several surfaces of one building the figure is an upper bound.
 * - Null without a known demand.
 */
function heatCoverage(agg: AggregatedData, demand: number): number | null {
  if (agg.buildingCount !== 1 || demand <= 0) return null
  return Math.min(MAX_HEAT_COVERAGE_PERCENT, Math.round((agg.heatYield / demand) * 100))
}

/** Percentage of `part` over `total`, rounded, 0 if total is 0. */
function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** Building identity for heat demand: GWR EGID when known, else the Sonnendach building_id. */
function buildingKey(s: SurfaceData): string {
  const egid = Number(s.gwr_egid)
  return egid > 0 ? `egid:${egid}` : `bid:${s.buildingId}`
}

/**
 * Aggregates a set of surfaces into a single data object for display.
 * Additive quantities are summed; irradiation/m² is area-weighted.
 * Heat demand is deduplicated by building (EGID, fallback buildingId): counted once per building.
 */
export function aggregateSurfaces(surfaces: SurfaceData[], mode: SolarMode): AggregatedData {
  let area = 0
  let elec = 0
  let elecW = 0
  let elecS = 0
  let fin = 0
  let heat = 0
  let collector = 0
  let storage = 0
  let irr = 0
  let weightedIrrM2 = 0
  const classAreas = [0, 0, 0, 0, 0]

  for (const s of surfaces) {
    area += s.area
    elec += s.electricityYield
    elecW += s.electricityWinter
    elecS += s.electricitySummer
    fin += s.financialReturn
    heat += s.heatYield
    collector += s.collectorArea
    storage += s.storageVolume
    irr += s.irradiation
    weightedIrrM2 += s.irradiationPerM2 * s.area
    if (s.suitabilityClass >= 1 && s.suitabilityClass <= 5) {
      classAreas[s.suitabilityClass - 1] += s.area
    }
  }

  // Heat demand deduplicated by building (demand is a per-building value repeated on each surface).
  // The demand comes from the GWR, so a building is identified by its EGID: one GWR building can
  // span several Sonnendach building_id (building parts). Fallback to building_id without EGID.
  const seenBuildings = new Map<string, { heating: number; water: number }>()
  for (const s of surfaces) {
    const key = buildingKey(s)
    if (!seenBuildings.has(key)) {
      seenBuildings.set(key, {
        heating: s.heatingDemand || 0,
        water: s.hotWaterDemand || 0,
      })
    }
  }
  let heatingDemand = 0
  let hotWaterDemand = 0
  for (const b of seenBuildings.values()) {
    heatingDemand += b.heating
    hotWaterDemand += b.water
  }

  const avgIrrM2 = area > 0 ? weightedIrrM2 / area : 0
  const isSingleSurface = surfaces.length === 1

  return {
    surfaceCount: surfaces.length,
    buildingCount: seenBuildings.size,
    area,
    suitabilityClass: classifyIrradiation(avgIrrM2, mode),
    suitabilityDistribution: {
      class1: pct(classAreas[0], area),
      class2: pct(classAreas[1], area),
      class3: pct(classAreas[2], area),
      class4: pct(classAreas[3], area),
      class5: pct(classAreas[4], area),
    },
    electricityYield: elec,
    electricityWinter: elecW,
    electricitySummer: elecS,
    financialReturn: fin,
    heatYield: heat,
    heatingDemand,
    hotWaterDemand,
    collectorArea: collector,
    storageVolume: storage,
    irradiation: irr,
    irradiationPerM2: avgIrrM2,
    gwr_egid: surfaces[0].gwr_egid,
    isSingleSurface,
    orientation: isSingleSurface ? surfaces[0].orientation : null,
    tilt: isSingleSurface ? surfaces[0].tilt : null,
  }
}

export const useMapStore = defineStore('map', () => {
  // Current layer: roofs or facades
  const solarMode = ref<SolarMode>('roofs')

  // Click behavior: 'single' replaces the selection (explore), 'multi' accumulates.
  // Default: 'single' (exploration).
  const selectionMode = ref<SelectionMode>('single')

  // Single source of truth: all currently selected surfaces (unique by featureId).
  // In 'multi' mode users can build up a quarter-wide estimate by picking panes.
  const selectedSurfaces = ref<SurfaceData[]>([])

  // Loading state (during API calls)
  const loading = ref(false)

  // Coordinates of the last map click
  const clickCoords = ref<[number, number] | null>(null)

  // Selected address (from search or GWR lookup)
  const selectedAddress = ref('')

  // Municipality number (from GWR lookup)
  const communeId = ref<number | null>(null)

  // Postal code (from GWR lookup) — used for the Solarrechner deep link
  const postalCode = ref<number | null>(null)

  // Whether a click was made but no data was found
  const noData = ref(false)

  // Aggregated view of the current selection (null when empty)
  const aggregated = computed<AggregatedData | null>(() => {
    if (selectedSurfaces.value.length === 0) return null
    return aggregateSurfaces(selectedSurfaces.value, solarMode.value)
  })

  // Summary banner data (aptitude + economic potential)
  const summary = computed<SummaryData | null>(() => {
    const agg = aggregated.value
    if (!agg) return null
    const denom = agg.heatingDemand + agg.hotWaterDemand
    return {
      suitabilityClass: agg.suitabilityClass,
      financialReturn: agg.financialReturn,
      heatCoveragePercent: heatCoverage(agg, denom),
    }
  })

  // Do we have any selection to display?
  const hasData = computed(() => selectedSurfaces.value.length > 0)

  /** Switch between roofs/facades layer. Clears selection (featureIds differ across layers). */
  function setSolarMode(mode: SolarMode) {
    solarMode.value = mode
    clearSelection()
  }

  /** Switch click behavior. Keeps the current selection (so single→multi can continue). */
  function setSelectionMode(mode: SelectionMode) {
    selectionMode.value = mode
  }

  /** Adds a surface if not already selected (dedup by featureId). */
  function addSurface(s: SurfaceData) {
    if (!selectedSurfaces.value.some((x) => x.featureId === s.featureId)) {
      selectedSurfaces.value = [...selectedSurfaces.value, s]
    }
  }

  /** Replaces the whole selection with a single surface (single/explore mode). */
  function selectSingle(s: SurfaceData) {
    selectedSurfaces.value = [s]
  }

  /** Removes a surface by featureId. */
  function removeSurface(featureId: number) {
    selectedSurfaces.value = selectedSurfaces.value.filter((x) => x.featureId !== featureId)
  }

  /** Toggles a single surface. Returns whether it was added or removed. */
  function toggleSurface(s: SurfaceData): 'added' | 'removed' {
    const exists = selectedSurfaces.value.some((x) => x.featureId === s.featureId)
    if (exists) {
      removeSurface(s.featureId)
      return 'removed'
    }
    addSurface(s)
    return 'added'
  }

  /** Clears the entire selection. */
  function clearSelection() {
    selectedSurfaces.value = []
    clickCoords.value = null
    noData.value = false
  }

  return {
    solarMode,
    selectionMode,
    selectedSurfaces,
    loading,
    clickCoords,
    selectedAddress,
    communeId,
    postalCode,
    noData,
    aggregated,
    summary,
    hasData,
    setSolarMode,
    setSelectionMode,
    addSurface,
    removeSurface,
    toggleSurface,
    selectSingle,
    clearSelection,
  }
})
