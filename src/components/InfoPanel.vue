<!--
  InfoPanel.vue

  Panneau d'information qui s'affiche sous la carte quand l'utilisateur
  clique sur un toit ou une façade. La couleur du panneau correspond
  au statut d'aptitude du bâtiment (même code couleur que la carte).
-->

<template>
  <!-- Chargement -->
  <div v-if="store.loading" class="info-panel loading">
    <p>{{ $t('loading') }}</p>
  </div>

  <!-- Pas de données -->
  <div v-else-if="store.noData" class="info-panel no-data">
    <h3>{{ $t('no_data_title') }}</h3>
    <p class="no-data-text">{{ $t('no_data_message') }}</p>
    <p class="faq-link">
      {{ $t('info_faq_text') }} <a href="#faq">{{ $t('info_faq_link') }}</a>
    </p>
  </div>

  <!-- Données toiture -->
  <div v-else-if="store.solarMode === 'roofs' && store.roofData" class="info-panel"
       :style="{ borderColor: suitabilityColor(store.roofData.suitabilityClass) }">
    <h3 :style="{ borderBottomColor: suitabilityColor(store.roofData.suitabilityClass) }">
      {{ $t('info_roof_title') }}<span v-if="store.selectedAddress" class="title-address"> — {{ store.selectedAddress }}</span>
    </h3>

    <div class="info-grid">
      <div class="info-section">
        <h4>{{ $t('info_general') }}</h4>
        <div class="info-row no-border">
          <span class="info-label">{{ $t('info_suitability') }}</span>
          <span class="info-value">
            <span :class="'badge badge-' + store.roofData.suitabilityClass">
              {{ suitabilityLabel(store.roofData.suitabilityClass) }}
            </span>
          </span>
        </div>
        <!-- Suitability distribution -->
        <div class="distribution">
          <span class="dist-title">{{ $t('info_distribution') }}</span>
          <div v-if="store.roofData.suitabilityDistribution.class5 > 0" class="dist-row">
            <span class="dist-square badge-5"></span>
            <span class="dist-label">{{ $t('suitability_5') }}</span>
            <span class="dist-value">{{ store.roofData.suitabilityDistribution.class5 }}%</span>
          </div>
          <div v-if="store.roofData.suitabilityDistribution.class4 > 0" class="dist-row">
            <span class="dist-square badge-4"></span>
            <span class="dist-label">{{ $t('suitability_4') }}</span>
            <span class="dist-value">{{ store.roofData.suitabilityDistribution.class4 }}%</span>
          </div>
          <div v-if="store.roofData.suitabilityDistribution.class3 > 0" class="dist-row">
            <span class="dist-square badge-3"></span>
            <span class="dist-label">{{ $t('suitability_3') }}</span>
            <span class="dist-value">{{ store.roofData.suitabilityDistribution.class3 }}%</span>
          </div>
          <div v-if="store.roofData.suitabilityDistribution.class2 > 0" class="dist-row">
            <span class="dist-square badge-2"></span>
            <span class="dist-label">{{ $t('suitability_2') }}</span>
            <span class="dist-value">{{ store.roofData.suitabilityDistribution.class2 }}%</span>
          </div>
          <div v-if="store.roofData.suitabilityDistribution.class1 > 0" class="dist-row">
            <span class="dist-square badge-1"></span>
            <span class="dist-label">{{ $t('suitability_1') }}</span>
            <span class="dist-value">{{ store.roofData.suitabilityDistribution.class1 }}%</span>
          </div>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_area') }}</span>
          <span class="info-value">{{ fmt(store.roofData.area) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_irradiation') }}</span>
          <span class="info-value">{{ fmt(store.roofData.irradiationPerM2) }} kWh/m²/{{ $t('info_year') }}</span>
        </div>
      </div>

      <div class="info-section">
        <h4>{{ $t('info_pv_title') }}</h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_electricity_yield') }}</span>
          <span class="info-value">{{ fmt(store.roofData.electricityYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_summer') }}</span>
          <span class="info-value">{{ fmt(store.roofData.electricitySummer) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_winter') }}</span>
          <span class="info-value">{{ fmt(store.roofData.electricityWinter) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_financial') }}</span>
          <span class="info-value">{{ fmt(store.roofData.financialReturn) }} CHF/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_tarif') }} (<a href="https://www.vese.ch/pvtarif/" target="_blank" rel="noopener" class="inline-link">VESE</a>)</span>
          <span class="info-value">{{ tarifValue }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_provider') }}</span>
          <span class="info-value">{{ tarifProviderName }}</span>
        </div>
      </div>

      <div class="info-section">
        <h4>{{ $t('info_thermal_title') }}</h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heat_yield') }}</span>
          <span class="info-value">{{ fmt(store.roofData.heatYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heating_demand') }}</span>
          <span class="info-value">{{ fmt(store.roofData.heatingDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_hot_water_demand') }}</span>
          <span class="info-value">{{ fmt(store.roofData.hotWaterDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_collector_area') }}</span>
          <span class="info-value">{{ fmt(store.roofData.collectorArea) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_storage') }}</span>
          <span class="info-value">{{ fmt(store.roofData.storageVolume) }} L</span>
        </div>
      </div>
    </div>

    <p class="map-link">
      {{ $t('info_individual_link') }}
      <a :href="geoAdminUrl('roofs')" target="_blank" rel="noopener">map.geo.admin.ch ↗</a>
    </p>
    <p class="map-link">
      {{ $t('info_solar_calculator_text') }}
      <a :href="$t('info_solar_calculator_url')" target="_blank" rel="noopener">{{ $t('info_solar_calculator_link') }} ↗</a>
    </p>
    <p class="faq-link">
      {{ $t('info_faq_text') }} <a href="#faq">{{ $t('info_faq_link') }}</a>
    </p>
  </div>

  <!-- Données façade -->
  <div v-else-if="store.solarMode === 'facades' && store.facadeData" class="info-panel"
       :style="{ borderColor: suitabilityColor(store.facadeData.suitabilityClass) }">
    <h3 :style="{ borderBottomColor: suitabilityColor(store.facadeData.suitabilityClass) }">
      {{ $t('info_facade_title') }}<span v-if="store.selectedAddress" class="title-address"> — {{ store.selectedAddress }}</span>
    </h3>
    <div class="info-grid">
      <div class="info-section">
        <h4>{{ $t('info_general') }}</h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_suitability') }}</span>
          <span class="info-value">
            <span :class="'badge badge-' + store.facadeData.suitabilityClass">
              {{ suitabilityLabel(store.facadeData.suitabilityClass) }}
            </span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_area') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.area) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_irradiation') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.irradiationPerM2) }} kWh/m²/{{ $t('info_year') }}</span>
        </div>
      </div>

      <div class="info-section">
        <h4>{{ $t('info_pv_title') }}</h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_electricity_yield') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.electricityYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_summer') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.electricitySummer) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_winter') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.electricityWinter) }} kWh</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_financial') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.financialReturn) }} CHF/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_tarif') }} (<a href="https://www.vese.ch/pvtarif/" target="_blank" rel="noopener" class="inline-link">VESE</a>)</span>
          <span class="info-value">{{ tarifValue }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_provider') }}</span>
          <span class="info-value">{{ tarifProviderName }}</span>
        </div>
      </div>

      <div class="info-section">
        <h4>{{ $t('info_thermal_title') }}</h4>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heat_yield') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.heatYield) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_heating_demand') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.heatingDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_hot_water_demand') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.hotWaterDemand) }} kWh/{{ $t('info_year') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_collector_area') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.collectorArea) }} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('info_storage') }}</span>
          <span class="info-value">{{ fmt(store.facadeData.storageVolume) }} L</span>
        </div>
      </div>
    </div>

    <p class="map-link">
      {{ $t('info_individual_link') }}
      <a :href="geoAdminUrl('facades')" target="_blank" rel="noopener">map.geo.admin.ch ↗</a>.
    </p>
    <p class="faq-link">
      {{ $t('info_faq_text') }} <a href="#faq">{{ $t('info_faq_link') }}</a>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { useI18n } from 'vue-i18n'
import { watch, computed } from 'vue'
import { usePvTarif } from '@/composables/usePvTarif'

const store = useMapStore()
const { t, locale } = useI18n()
const { tarifData, loading: tarifLoading, fetchTarif } = usePvTarif()

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
watch(() => store.communeId, (newId) => {
  console.log('[VESE] communeId changed:', newId)
  if (newId) {
    fetchTarif(newId)
  }
}, { immediate: true })

/** Construit l'URL map.geo.admin.ch centrée sur le bâtiment avec la couche solaire */
function geoAdminUrl(mode: 'roofs' | 'facades'): string {
  const coords = store.clickCoords
  if (!coords) return 'https://map.geo.admin.ch'

  const layer = mode === 'roofs'
    ? 'ch.bfe.solarenergie-eignung-daecher'
    : 'ch.bfe.solarenergie-eignung-fassaden'

  return `https://map.geo.admin.ch/?lang=${locale.value}&layers=${layer}&E=${coords[0].toFixed(0)}&N=${coords[1].toFixed(0)}&zoom=10&sr=2056`
}

function fmt(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  return Math.round(value).toLocaleString('de-CH')
}

function suitabilityLabel(classNum: number): string {
  return t(`suitability_${classNum}`)
}

/** Returns the color matching the suitability class (same as map tiles) */
function suitabilityColor(classNum: number): string {
  const colors: Record<number, string> = {
    1: '#4fc3f7',  // gering - light blue
    2: '#fdd835',  // mittel - yellow
    3: '#ff8f00',  // gut - orange
    4: '#e65100',  // sehr gut - dark orange
    5: '#b71c1c',  // hervorragend - dark red
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
</style>
