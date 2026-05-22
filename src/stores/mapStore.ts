/**
 * mapStore.ts
 *
 * Central Pinia store for map state and solar data.
 * Shared between all components (MapComponent, InfoPanel, SearchBar, etc.)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RoofData, FacadeData, SolarMode } from '@/types/solar'

export const useMapStore = defineStore('map', () => {
  // Current mode: roofs or facades
  const solarMode = ref<SolarMode>('roofs')

  // Selected roof/facade data
  const roofData = ref<RoofData | null>(null)
  const facadeData = ref<FacadeData | null>(null)

  // Loading state (during API calls)
  const loading = ref(false)

  // Coordinates of the last map click
  const clickCoords = ref<[number, number] | null>(null)

  // Building ID of the last identified building
  const lastBuildingId = ref<number | null>(null)

  // Selected address (from search or GWR lookup)
  const selectedAddress = ref('')

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

  /** Clear all selected data */
  function clearSelection() {
    roofData.value = null
    facadeData.value = null
    clickCoords.value = null
  }

  return {
    solarMode,
    roofData,
    facadeData,
    loading,
    clickCoords,
    lastBuildingId,
    selectedAddress,
    noData,
    hasData,
    setSolarMode,
    clearSelection,
  }
})
