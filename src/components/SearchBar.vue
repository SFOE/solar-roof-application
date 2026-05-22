<!--
  SearchBar.vue

  Barre de recherche d'adresses avec autocomplétion via l'API swisstopo.

  L'API : https://api3.geo.admin.ch/rest/services/api/SearchServer
  - searchText : le texte tapé
  - type=locations : on cherche des adresses
  - sr=2056 : coordonnées en EPSG:2056 (LV95)
  - limit=5 : max 5 résultats

  "Debounce" : on attend 300ms après la dernière frappe avant d'appeler l'API.
  Ça évite de bombarder le serveur à chaque lettre tapée.
-->

<template>
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        v-model="query"
        type="text"
        :placeholder="$t('search_placeholder')"
        class="search-input"
        @input="onInput"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrev"
        @keydown.enter.prevent="selectHighlighted"
        @focus="showResults = results.length > 0"
        @blur="onBlur"
        autocomplete="off"
      />
      <button
        v-if="query"
        class="search-clear"
        @mousedown.prevent="clearSearch"
        aria-label="Clear search"
      >✕</button>
    </div>

    <!-- Liste déroulante des suggestions -->
    <ul v-if="showResults && results.length > 0" class="search-results">
      <li
        v-for="(result, index) in results"
        :key="result.id"
        :class="{ highlighted: index === highlightedIndex }"
        @mousedown.prevent="selectResult(result)"
        @mouseenter="highlightedIndex = index"
      >
        <!-- v-html car l'API retourne du HTML (mots en <b>gras</b>) -->
        <span v-html="result.label"></span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

/**
 * Interface pour un résultat de recherche swisstopo.
 * L'API retourne y = coordonnée Est (E) et x = coordonnée Nord (N) en LV95.
 * Oui c'est inversé par rapport à ce qu'on attendrait — c'est une convention swisstopo.
 */
interface SearchResult {
  id: number
  label: string
  east: number   // y dans l'API = coordonnée Est en LV95
  north: number  // x dans l'API = coordonnée Nord en LV95
}

// Événement émis quand l'utilisateur sélectionne une adresse
const emit = defineEmits<{
  select: [coords: { east: number; north: number; label: string }]
}>()

const query = ref('')
const results = ref<SearchResult[]>([])
const showResults = ref(false)
const highlightedIndex = ref(-1)

// Timer pour le debounce
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Appelé à chaque frappe dans l'input.
 * Attend 300ms avant de lancer la recherche (debounce).
 */
function onInput() {
  highlightedIndex.value = -1

  if (debounceTimer) clearTimeout(debounceTimer)

  if (query.value.length < 2) {
    results.value = []
    showResults.value = false
    return
  }

  debounceTimer = setTimeout(() => search(query.value), 300)
}

/**
 * Appelle l'API swisstopo SearchServer.
 */
async function search(text: string) {
  try {
    const response = await axios.get(
      'https://api3.geo.admin.ch/rest/services/api/SearchServer',
      {
        params: {
          searchText: text,
          type: 'locations',
          sr: '2056',
          limit: 5,
        },
      },
    )

    results.value = response.data.results.map((r: any) => ({
      id: r.id,
      label: r.attrs.label,
      east: r.attrs.y,   // y = Est en LV95 (convention swisstopo)
      north: r.attrs.x,  // x = Nord en LV95
    }))

    showResults.value = results.value.length > 0
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
  }
}

/** Sélectionne un résultat et émet l'événement vers le parent */
function selectResult(result: SearchResult) {
  const label = result.label.replace(/<[^>]*>/g, '')
  showResults.value = false
  emit('select', { east: result.east, north: result.north, label })
  // Vider la barre après sélection
  query.value = ''
}

/** Navigation clavier : flèche bas */
function highlightNext() {
  if (highlightedIndex.value < results.value.length - 1) {
    highlightedIndex.value++
  }
}

/** Navigation clavier : flèche haut */
function highlightPrev() {
  if (highlightedIndex.value > 0) {
    highlightedIndex.value--
  }
}

/** Entrée : sélectionne l'élément surligné */
function selectHighlighted() {
  if (highlightedIndex.value >= 0 && highlightedIndex.value < results.value.length) {
    selectResult(results.value[highlightedIndex.value])
  }
}

/** Efface la recherche */
function clearSearch() {
  query.value = ''
  results.value = []
  showResults.value = false
}

/** Ferme la liste quand on clique ailleurs (avec un petit délai pour le mousedown) */
function onBlur() {
  setTimeout(() => {
    showResults.value = false
  }, 200)
}
</script>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto 1rem;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: #666;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 36px 10px 40px;
  font-size: 0.95rem;
  border: 2px solid #ccc;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #d32f2f;
}

.search-input::placeholder {
  color: #999;
}

.search-clear {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  font-size: 1rem;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.search-clear:hover {
  color: #333;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.search-results li {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.9rem;
  border-bottom: 1px solid #eee;
}

.search-results li:last-child {
  border-bottom: none;
}

.search-results li:hover,
.search-results li.highlighted {
  background-color: #f0f0f0;
}
</style>
