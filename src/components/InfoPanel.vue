<!--
  InfoPanel.vue

  Detailed information panel shown below the map when the user has a selection.
  Consumes the unified aggregation from the store (store.aggregated), which
  combines all selected surfaces (buildings + individual surfaces) into one total.
  The panel border color matches the global suitability class (same as the map).
-->

<template>
  <!-- Loading -->
  <div v-if="store.loading" class="info-panel loading">
    <p>{{ $t('loading') }}</p>
  </div>

  <!-- No data -->
  <div v-else-if="store.noData" class="info-panel no-data">
    <h3>{{ $t('no_data_title') }}</h3>
    <p class="no-data-text">{{ $t('no_data_message') }}</p>
    <p class="faq-link">
      {{ $t('info_faq_text') }} <a href="#faq">{{ $t('info_faq_link') }}</a>
    </p>
  </div>

  <!-- Aggregated selection data -->
  <div
    v-else-if="agg"
    class="info-panel"
    :style="{ borderColor: suitabilityColor(agg.suitabilityClass) }"
  >
    <h3 :style="{ borderBottomColor: suitabilityColor(agg.suitabilityClass) }">
      {{ $t('info_selection_title') }}
      <span v-if="store.selectedSurfaces.length > 1" class="title-count">
        ({{ agg.surfaceCount }} {{ $t('info_surfaces') }})
      </span>
      <span v-if="store.selectedAddress" class="title-address"> — {{ store.selectedAddress }}</span>
    </h3>

    <div class="info-grid">
      <!-- General -->
      <div class="info-section">
        <h4>{{ $t('info_general') }}</h4>
        <div class="info-row no-border">
          <span class="info-label">{{ $t('info_suitability') }}</span>
          <span class="info-value">
            <span :class="'badge badge-' + agg.suitabilityClass">
              {{ suitabilityLabel(agg.suitabilityClass) }}
            </span>
          </span>
        </div>
        <!-- Suitability distribution -->
        <div class="distribution">
          <span class="dist-title">{{ $t('info_distribution') }}</span>
          <div v-for="c in [5, 4, 3, 2, 1]" :key="c">
            <div v-if="distributionValue(c) > 0" class="dist-row">
              <span class="dist-square" :class="'badge-' + c"></span>
              <span class="dist-label">{{ $t('suitability_' + c) }}</span>
              <span class="dist-value">{{ distributionValue(c) }}%</span>
            </div>
          </div>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_area') }}</span>
          <span class="info-value">{{ fmt(agg.area) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_irradiation') }}</span>
          <span class="info-value">{{ fmt(agg.irradiationPerM2) }} kWh/m²/{{ $t('info_year') }}</span>
        </div>
        <!-- Orientation & tilt: only for a single individual surface (roof mode) -->
        <template v-if="agg.isSingleSurface">
          <div class="info-row">
            <span class="info-label">{{ $t('info_orientation') }}</span>
            <span class="info-value">{{ fmtOrientation(agg.orientation) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ $t('info_inclination') }}</span>
            <span class="info-value">{{ fmtDeg(agg.tilt) }}</span>
          </div>
        </template>
      </div>

      <!-- Photovoltaics -->
      <div class="info-section">
        <h4>
          <svg class="section-icon" :style="{ color: suitabilityColor(agg.suitabilityClass) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2h2"/><path d="m14.28 14-4.56 8"/><path d="m21 22-1.558-4H4.558"/><path d="M3 10v2"/><path d="M6.245 15.04A2 2 0 0 1 8 14h12a1 1 0 0 1 .864 1.505l-3.11 5.457A2 2 0 0 1 16 22H4a1 1 0 0 1-.863-1.506z"/><path d="M7 2a4 4 0 0 1-4 4"/><path d="m8.66 7.66 1.41 1.41"/></svg>{{ $t('info_pv_title') }}
        </h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_electricity_yield') }}</span>
          <span class="info-value">{{ fmt(agg.electricityYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_summer') }}</span>
          <span class="info-value">{{ fmt(agg.electricitySummer) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_winter') }}</span>
          <span class="info-value">{{ fmt(agg.electricityWinter) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_financial') }}</span>
          <span class="info-value">{{ fmt(agg.financialReturn) }} CHF/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_tarif') }} (<a href="https://www.vese.ch/pvtarif/" target="_blank" rel="noopener" class="inline-link">VESE ↗</a>)</span>
          <span class="info-value">{{ tarifValue }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_provider') }}</span>
          <span class="info-value">{{ tarifProviderName }}</span>
        </div>
      </div>

      <!-- Solar thermal -->
      <div class="info-section">
        <h4>
          <svg class="section-icon" :style="{ color: suitabilityColor(agg.suitabilityClass) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 8a4 4 0 0 0-1.645 7.647"/><path d="M2 12h2"/><path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="m4.93 4.93 1.41 1.41"/><path d="m6.34 17.66-1.41 1.41"/></svg>{{ $t('info_thermal_title') }}
        </h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heat_yield') }}</span>
          <span class="info-value">{{ fmt(agg.heatYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heating_demand') }}</span>
          <span class="info-value">{{ fmt(agg.heatingDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_hot_water_demand') }}</span>
          <span class="info-value">{{ fmt(agg.hotWaterDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div v-if="store.summary && store.summary.heatCoveragePercent !== null" class="info-row">
          <span class="info-label">{{ $t('info_heat_coverage') }}</span>
          <span class="info-value">{{ store.summary.heatCoveragePercent }}%</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_collector_area') }}</span>
          <span class="info-value">{{ fmt(agg.collectorArea) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_storage') }}</span>
          <span class="info-value">{{ fmt(agg.storageVolume) }} L</span>
        </div>
      </div>
    </div>

    <p class="faq-link">
      {{ $t('info_faq_text') }} <a href="#faq">{{ $t('info_faq_link') }}</a>
    </p>
    <p class="map-link">
      {{ $t('info_solar_calculator_text') }}
      <a :href="solarCalculatorUrl" target="_blank" rel="noopener">{{ $t('info_solar_calculator_link') }} ↗</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { useI18n } from 'vue-i18n'
import { watch, computed } from 'vue'
import { usePvTarif } from '@/composables/usePvTarif'
import type { SuitabilityDistribution } from '@/types/solar'

const store = useMapStore()
const { t } = useI18n()
const { tarifData, loading: tarifLoading, fetchTarif } = usePvTarif()

const agg = computed(() => store.aggregated)

/** Formatted tariff display: provider name and tariff value */
const tarifProviderName = computed(() => {
  if (tarifLoading.value) return '...'
  if (tarifData.value.length === 0) return '-'
  return tarifData.value[0].name
})

const tarifValue = computed(() => {
  if (tarifLoading.value) return '...'
  if (tarifData.value.length === 0 || tarifData.value[0].energy1 === null) return '-'
  return `${tarifData.value[0].energy1} cts/kWh`
})

// Fetch tariff when commune changes
watch(
  () => store.communeId,
  (newId) => {
    if (newId) fetchTarif(newId)
  },
  { immediate: true },
)

/** Returns the distribution percentage for a given class (1..5). */
function distributionValue(c: number): number {
  const dist = agg.value?.suitabilityDistribution
  if (!dist) return 0
  return dist[`class${c}` as keyof SuitabilityDistribution] || 0
}

/**
 * Solar calculator (Solarrechner) link.
 * For a single selected surface, builds a deep link with prefilled parameters
 * (roof geometry, area, demand, postal code, LV03 coordinates, roof id).
 * Otherwise falls back to the plain calculator URL.
 */
const solarCalculatorUrl = computed(() => {
  const base = t('info_solar_calculator_url')
  const surfaces = store.selectedSurfaces
  const coords = store.clickCoords
  // Deep link only makes sense for a single roof surface
  if (surfaces.length !== 1 || store.solarMode !== 'roofs' || !coords) return base

  const s = surfaces[0]
  // LV95 → LV03: Est_LV03 = E − 2'000'000, Nord_LV03 = N − 1'000'000
  const yLv03 = Math.round(coords[0] - 2_000_000) // Est (Y in the calculator)
  const xLv03 = Math.round(coords[1] - 1_000_000) // Nord (X in the calculator)

  const params = new URLSearchParams()
  params.set('SYSTEM', '2')
  params.set('TECHNOLOGIE', '2')
  if (store.postalCode) params.set('POSTLEITZAHL', String(store.postalCode))
  params.set('X', String(xLv03))
  params.set('Y', String(yLv03))
  if (s.tilt !== null) params.set('NEIGUNG', String(Math.round(s.tilt)))
  if (s.orientation !== null) params.set('AUSRICHTUNG', String(Math.round(s.orientation)))
  if (s.hotWaterDemand) params.set('BEDARF_WARMWASSER', String(Math.round(s.hotWaterDemand)))
  params.set('DACH_ID', String(s.featureId))
  if (s.area) params.set('FLAECHE', String(Math.round(s.area)))

  return `${base}?${params.toString()}`
})

function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  return Math.round(value).toLocaleString('de-CH')
}

/** Formats a degree value, or '-' when unavailable. */
function fmtDeg(value: number | null): string {
  if (value === undefined || value === null) return '-'
  return `${Math.round(value)}°`
}

/**
 * Formats orientation with cardinal direction.
 * Sonnendach convention: 0° = South, negative → East, positive → West, ±180° = North.
 * e.g. -13° → "-13° (S)"
 */
function fmtOrientation(value: number | null): string {
  if (value === undefined || value === null) return '-'
  const deg = Math.round(value)
  // Normalize to [-180, 180]
  const a = ((deg + 180) % 360 + 360) % 360 - 180
  const abs = Math.abs(a)
  let cardinalKey: string
  if (abs <= 22.5) cardinalKey = 'cardinal_s'
  else if (abs >= 157.5) cardinalKey = 'cardinal_n'
  else if (abs <= 67.5) cardinalKey = a < 0 ? 'cardinal_se' : 'cardinal_sw'
  else if (abs < 112.5) cardinalKey = a < 0 ? 'cardinal_e' : 'cardinal_w'
  else cardinalKey = a < 0 ? 'cardinal_ne' : 'cardinal_nw'
  return `${deg}° (${t(cardinalKey)})`
}

function suitabilityLabel(classNum: number): string {
  return t(`suitability_${classNum}`)
}

/** Returns the color matching the suitability class (same as map tiles) */
function suitabilityColor(classNum: number): string {
  const colors: Record<number, string> = {
    1: '#4fc3f7',
    2: '#fdd835',
    3: '#ff8f00',
    4: '#e65100',
    5: '#b71c1c',
  }
  return colors[classNum] || '#999'
}
</script>

<style scoped>
.info-panel {
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 6px;
  padding: 1rem 1.25rem;
  margin: 0.5rem 0;
  overflow-y: auto;
}

.info-panel.loading {
  text-align: center;
  color: #666;
}

.info-panel.no-data {
  border-color: #999;
}

.info-panel.no-data h3 {
  border-bottom-color: #999;
}

.no-data-text {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}

.info-panel h3 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  color: #333;
  border-bottom: 2px solid #ddd;
  padding-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.section-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 0.88rem;
  border-bottom: 1px solid #f0f0f0;
}

.info-label {
  color: #666;
}

.info-label .inline-link {
  color: #1565c0;
  text-decoration: none;
  font-weight: 600;
}

.info-label .inline-link:hover {
  text-decoration: underline;
}

.info-value {
  font-weight: 600;
  color: #333;
  text-align: right;
}

.badge {
  display: inline-block;
  padding: 3px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
}
.badge-1 { background: #4fc3f7; color: #333; }
.badge-2 { background: #fdd835; color: #333; }
.badge-3 { background: #ff8f00; }
.badge-4 { background: #e65100; }
.badge-5 { background: #b71c1c; }

.distribution {
  margin-top: 0;
  margin-bottom: 0;
  padding: 0;
  padding-left: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #f0f0f0;
}

.info-row.no-border {
  border-bottom: none;
  padding: 3px 0;
}

.dist-title {
  display: block;
  padding: 3px 0;
  font-size: 0.78rem;
  color: #888;
  font-style: italic;
}

.dist-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 3px 0;
  font-size: 0.82rem;
}

.dist-square {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.dist-square.badge-1 { background: #4fc3f7; }
.dist-square.badge-2 { background: #fdd835; }
.dist-square.badge-3 { background: #ff8f00; }
.dist-square.badge-4 { background: #e65100; }
.dist-square.badge-5 { background: #b71c1c; }

.dist-label {
  flex: 1;
  color: #666;
}

.dist-value {
  font-weight: 600;
  color: #333;
}

.map-link {
  margin: 0.15rem 0 0;
  padding-top: 0.35rem;
  border-top: 1px solid #eee;
  font-size: 0.85rem;
  color: #666;
}

.map-link:first-of-type {
  margin-top: 1.25rem;
}

.map-link a {
  color: #1565c0;
  text-decoration: none;
  font-weight: 600;
}

.map-link a:hover {
  text-decoration: underline;
}

.faq-link {
  margin: 0.15rem 0 0;
  margin-top: 1.25rem;
  padding-top: 0.35rem;
  border-top: 1px solid #eee;
  font-size: 0.85rem;
  color: #666;
}

.faq-link a {
  color: #1565c0;
  text-decoration: none;
  font-weight: 600;
}

.faq-link a:hover {
  text-decoration: underline;
}

.title-address {
  font-weight: 400;
  font-size: 0.95rem;
  color: #555;
}

.title-count {
  font-weight: 400;
  font-size: 0.9rem;
  color: #777;
}
</style>
