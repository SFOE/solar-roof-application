<!--
  SelectionModeToggle.vue

  Toggle for selection granularity: Individual / Building / Multiple.
  Displayed below the map. Features a sliding indicator behind the active button.
-->

<template>
  <div class="selection-toggle-wrapper">
    <span class="selection-label">{{ $t('mode_selection_label') }}</span>
    <div class="selection-toggle">
      <span class="slider" :style="{ transform: `translateX(${sliderOffset})` }"></span>
      <button
        :class="{ active: store.selectionMode === 'single' }"
        @click="store.setSelectionMode('single')"
      >
        {{ $t('mode_single') }}
      </button>
      <button
        :class="{ active: store.selectionMode === 'building' }"
        @click="store.setSelectionMode('building')"
      >
        {{ $t('mode_building') }}
      </button>
      <button
        :class="{ active: store.selectionMode === 'multi' }"
        @click="store.setSelectionMode('multi')"
      >
        {{ $t('mode_multi') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'

const store = useMapStore()

const sliderOffset = computed(() => {
  switch (store.selectionMode) {
    case 'single': return '0%'
    case 'building': return '100%'
    case 'multi': return '200%'
    default: return '100%'
  }
})
</script>

<style scoped>
.selection-toggle-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0.25rem 0 0.5rem;
}

.selection-label {
  font-size: 0.7rem;
  color: #999;
  margin-bottom: 3px;
}

.selection-toggle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border: 2px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.slider {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc((100% - 4px) / 3);
  background: #d32f2f;
  border-radius: 4px;
  transition: transform 0.3s ease;
  z-index: 0;
}

.selection-toggle button {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 4px 16px;
  font-size: 0.78rem;
  border: none;
  background: transparent;
  color: #555;
  cursor: pointer;
  transition: color 0.3s ease;
  white-space: nowrap;
  text-align: center;
}

.selection-toggle button.active {
  color: #fff;
  font-weight: 600;
}

.selection-toggle button:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
}
</style>
