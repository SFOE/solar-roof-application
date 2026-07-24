/**
 * mapStore.ts
 *
 * Central Pinia store for map state and solar data.
 * Shared between all components (MapComponent, InfoPanel, SearchBar, etc.)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RoofData, FacadeData, SolarMode, SelectionMode } from '@/types/solar'

export const useMapStore = defineStore('map', () => {
  // Current mode: roofs or facades
  const solarMode = ref<SolarMode>('roofs')

  // Selection granularity: building (aggregated) or single (individual surface)
  const selectionMode = ref<SelectionMode>('building')

  // Selected roof/facade data
  const roofData = ref<RoofData | null>(null)
  const facadeData = ref<FacadeData | null>(null)

  // Multi-selection: array of individual surface data objects
  const multiSelectedSurfaces = ref<RoofData[]>([])

  // Loading state (during API calls)
  const loading = ref(false)

  // Coordinates of the last map click
  const clickCoords = ref<[number, number] | null>(null)

  // Building ID of the last identified building
  const lastBuildingId = ref<number | null>(null)

  // Selected address (from search or GWR lookup)
  const selectedAddress = ref('')

  // Municipality number (from GWR lookup)
  const communeId = ref<number | null>(null)

  // Whether a click was made but no data was found
  const noData = ref(false)

  // Computed: do we have data to display?
  const hasData = computed(() =>
    solarMode.value === 'roofs' ? roofData.value !== null : facadeData.value !== null,
  )

  /** Switch between roofs/facades mode and clear data */
  function setSolarMode(mode: SolarMode) {
    solarMode.value = mode
    roofData.value = null
    facadeData.value = null
  }

  /** Switch between building/single/multi selection mode */
  function setSelectionMode(mode: SelectionMode) {
    const previousMode = selectionMode.value
    selectionMode.value = mode

    // When switching TO multi, keep current data and seed multi array from it
    if (mode === 'multi') {
      const currentData = solarMode.value === 'roofs' ? roofData.value : facadeData.value
      if (currentData && multiSelectedSurfaces.value.length === 0) {
        // Seed multi-selection with the currently displayed data
        multiSelectedSurfaces.value = [currentData]
      }
      return
    }

    // When leaving multi, clear multi array but keep roofData/facadeData intact
    if (previousMode === 'multi') {
      multiSelectedSurfaces.value = []
      return
    }

    // Switching between building and single: clear data to force re-identify
    roofData.value = null
    facadeData.value = null
    multiSelectedSurfaces.value = []
  }

  /** Clear all selected data */
  function clearSelection() {
    roofData.value = null
    facadeData.value = null
    multiSelectedSurfaces.value = []
    clickCoords.value = null
  }

  return {
    solarMode,
    selectionMode,
    roofData,
    facadeData,
    multiSelectedSurfaces,
    loading,
    clickCoords,
    lastBuildingId,
    selectedAddress,
    communeId,
    noData,
    hasData,
    setSolarMode,
    setSelectionMode,
    clearSelection,
  }
})
