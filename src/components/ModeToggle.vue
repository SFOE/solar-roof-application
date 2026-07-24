<!--
  ModeToggle.vue

  Two rows of toggle buttons:
  1. Solar layer: Roofs / Facades (which data layer to display)
  2. Selection granularity: Building / Individual (aggregate or single surface)
-->

<template>
  <div class="mode-toggles">
    <!-- Row 1: Layer toggle (Roofs / Facades) -->
    <div class="mode-toggle">
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

    <!-- Row 2: Selection mode toggle (Building / Individual) -->
    <div class="mode-toggle">
      <button
        :class="{ active: store.selectionMode === 'building' }"
        @click="store.setSelectionMode('building')"
      >
        {{ $t('mode_building') }}
      </button>
      <button
        :class="{ active: store.selectionMode === 'single' }"
        @click="store.setSelectionMode('single')"
      >
        {{ $t('mode_single') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
const store = useMapStore()
</script>

<style scoped>
.mode-toggles {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 0;
}

.mode-toggle {
  display: flex;
  justify-content: center;
  gap: 0;
}

.mode-toggle button {
  padding: 5px 24px;
  font-size: 0.85rem;
  border: 2px solid #ccc;
  background: #fff;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle button:first-child {
  border-radius: 6px 0 0 6px;
  border-right: 1px solid #ccc;
}

.mode-toggle button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: 1px solid #ccc;
}

.mode-toggle button.active {
  background: #d32f2f;
  border-color: #d32f2f;
  color: #fff;
  font-weight: 600;
}

.mode-toggle button:hover:not(.active) {
  background: #f5f5f5;
}
</style>
