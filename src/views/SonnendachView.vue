<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { watch } from 'vue'
import { useLanguageStore } from '@/stores/languageStore'
import { useMapStore } from '@/stores/mapStore'

import HeaderComponent from '@/components/HeaderComponent.vue'
import FooterComponent from '@/components/FooterComponent.vue'
import MapComponent from '@/components/MapComponent.vue'
import SearchBar from '@/components/SearchBar.vue'
import ModeToggle from '@/components/ModeToggle.vue'
import SelectionModeToggle from '@/components/SelectionModeToggle.vue'
import SummaryBanner from '@/components/SummaryBanner.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import FaqSection from '@/components/FaqSection.vue'

const route = useRoute()
const languageStore = useLanguageStore()
const store = useMapStore()
const mapRef = ref<InstanceType<typeof MapComponent>>()
const infoPanelSection = ref<HTMLDivElement>()
const mapSection = ref<HTMLDivElement>()

if (typeof route.query.lang === 'string') {
  languageStore.currentLocale = route.query.lang
}

watch(
  () => route.query.lang,
  (newLang) => {
    if (typeof newLang === 'string') {
      languageStore.currentLocale = newLang
    }
  },
)

async function onAddressSelect(coords: { east: number; north: number; label: string }) {
  const target: [number, number] = [coords.east, coords.north]
  store.selectedAddress = coords.label
  mapRef.value?.zoomTo(target, 0.1)
  setTimeout(() => {
    mapRef.value?.identifyAt(target)
  }, 1100)
}

// Scroller vers la carte quand les données sont chargées (recherche ou clic manuel)
// On cadre sur la carte + le mini-encadré de synthèse (SummaryBanner) juste en dessous,
// plutôt que sur l'InfoPanel détaillé.
watch(
  () => store.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading) {
      setTimeout(() => {
        if (!mapSection.value) return
        const mapTop = mapSection.value.getBoundingClientRect().top + window.scrollY
        // Marge au-dessus pour laisser visible le bouton Toiture/Façade
        const offset = mapTop - 30
        window.scrollTo({ top: offset, behavior: 'smooth' })
      }, 100)
    }
  },
)
</script>

<template>
  <HeaderComponent />
  <div class="app-container">
    <h2 class="page-title">{{ $t('main_title') }}</h2>
    <SearchBar @select="onAddressSelect" />
    <div ref="mapSection">
      <ModeToggle />
      <MapComponent ref="mapRef" />
    </div>
    <SelectionModeToggle />
    <SummaryBanner />
    <div ref="infoPanelSection" style="padding-bottom: 1rem;">
      <InfoPanel />
    </div>

    <p class="app-description" v-html="$t('app_description')"></p>

    <FaqSection />
  </div>
  <FooterComponent />
</template>

<style scoped>
.page-title {
  text-align: center;
  margin: 1rem 0 0.75rem;
  font-size: 1.4rem;
  color: #333;
}

.app-description {
  font-size: 0.85rem;
  color: #555;
  line-height: 1.6;
  text-align: justify;
  margin: 1rem auto;
  padding: 0.75rem 0;
  max-width: 1000px;
}

.app-description :deep(a) {
  color: #1565c0;
  text-decoration: none;
  font-weight: 600;
}

.app-description :deep(a:hover) {
  text-decoration: underline;
}
</style>