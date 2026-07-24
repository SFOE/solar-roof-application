<!--
  ModeToggle.vue

  Toggle for solar layer: Roof / Facade.
  Displayed above the map. Features a sliding indicator behind the active button.
-->

<template>
  <div class="mode-toggle">
    <span class="slider" :style="{ transform: `translateX(${sliderOffset})` }"></span>
    <button
      :class="{ active: store.solarMode === 'roofs' }"
      @click="store.setSolarMode('roofs')"
    >
      {{ $t('mode_roofs') }}
    </button>
    <button
      :class="{ active: store.solarMode === 'facades' }"
      @click="store.setSolarMode('facades')"
    >
      {{ $t('mode_facades') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'

const store = useMapStore()

const sliderOffset = computed(() => {
  return store.solarMode === 'roofs' ? '0%' : '100%'
})
</script>

<style scoped>
.mode-toggle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 2px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  max-width: 260px;
  margin: 0.5rem auto;
}

.slider {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc((100% - 4px) / 2);
  background: #d32f2f;
  border-radius: 4px;
  transition: transform 0.3s ease;
  z-index: 0;
}

.mode-toggle button {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 6px 24px;
  font-size: 0.88rem;
  border: none;
  background: transparent;
  color: #555;
  cursor: pointer;
  transition: color 0.3s ease;
  text-align: center;
}

.mode-toggle button.active {
  color: #fff;
  font-weight: 600;
}

.mode-toggle button:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
}
</style>
