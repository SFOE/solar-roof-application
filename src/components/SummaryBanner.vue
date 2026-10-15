<!--
  SummaryBanner.vue

  Synthesis banner shown between the map and the detailed InfoPanel.
  Highlights the global suitability and the economic potential of the selection:
  - PV: financial return in CHF/year (up to ...)
  - Thermal: heat coverage % of the building(s) demand (up to ...)
-->

<template>
  <div
    v-if="store.summary"
    class="summary-banner"
    :style="{ borderColor: color, background: tint }"
  >
    <p class="summary-line summary-suitability">
      <svg class="summary-icon" :style="{ color }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </svg>
      {{ $t('summary_suitability') }} :
      <strong :style="{ color }">{{ suitabilityLabel }}</strong>
    </p>

    <p class="summary-line summary-potential">
      <span v-html="pvText"></span>
      <template v-if="store.summary.heatCoveragePercent !== null">
        {{ ' ' }}<span v-html="heatText"></span>
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { useI18n } from 'vue-i18n'

const store = useMapStore()
const { t } = useI18n()

const SUITABILITY_COLORS: Record<number, string> = {
  1: '#4fc3f7',
  2: '#fdd835',
  3: '#ff8f00',
  4: '#e65100',
  5: '#b71c1c',
}

const color = computed(() => SUITABILITY_COLORS[store.summary?.suitabilityClass ?? 0] || '#999')

/** Very light tint of the class color for the banner background. */
const tint = computed(() => {
  const c = color.value
  // Convert hex to a light rgba
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.08)`
})

const suitabilityLabel = computed(() =>
  store.summary ? t(`suitability_${store.summary.suitabilityClass}`) : '',
)

function fmt(value: number): string {
  return Math.round(value).toLocaleString('de-CH')
}

const pvText = computed(() => {
  if (!store.summary) return ''
  return t('summary_pv', { amount: fmt(store.summary.financialReturn) })
})

const heatText = computed(() => {
  if (!store.summary || store.summary.heatCoveragePercent === null) return ''
  return t('summary_heat', { percent: store.summary.heatCoveragePercent })
})
</script>

<style scoped>
.summary-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.35rem;
  max-width: 1000px;
  margin: 0.75rem auto;
  padding: 1.5rem 1.75rem;
  border: 2px solid #ddd;
  border-radius: 8px;
}

.summary-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  vertical-align: -6px;
  margin-right: 0.4rem;
}

.summary-line {
  margin: 0;
  line-height: 1.5;
  color: #333;
}

.summary-suitability {
  font-size: 1.25rem;
}

.summary-potential {
  font-size: 1.05rem;
}

.summary-line :deep(strong) {
  font-weight: 700;
}
</style>
