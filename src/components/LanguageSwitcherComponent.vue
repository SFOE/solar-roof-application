<template>
  <div class="language-switcher">
    <select v-model="languageStore.currentLocale" aria-label="Language">
      <option v-for="(label, locale) in locales" :key="locale" :value="locale">
        {{ label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useLanguageStore } from '@/stores/languageStore'

const languageStore = useLanguageStore()

const locales: Record<string, string> = {
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  en: 'EN',
}
</script>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
  font-size: 14px;
}
.language-switcher select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding: 6px 36px 6px 12px;
  background-color: transparent;
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}
.language-switcher select:focus {
  outline: 2px solid #fff;
}
.language-switcher option {
  color: #fff;
  background-color: #6c757d;
}
</style>
