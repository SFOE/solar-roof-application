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

// Scroller vers l'infobox quand les données sont chargées (recherche ou clic manuel)
watch(
  () => store.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading) {
      setTimeout(() => {
        mapSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    <ModeToggle />
    <div ref="mapSection">
      <MapComponent ref="mapRef" />
    </div>
    <div ref="infoPanelSection" style="padding-bottom: 1rem;">
      <InfoPanel />
    </div>

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
</style>
