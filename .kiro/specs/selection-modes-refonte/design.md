# Design — Modes de sélection (as-built)

## Overview

Ce document décrit la sélection de Sonnendach telle que livrée. Le design initial prévoyait deux modes cumulatifs « Bâtiment » et « Toiture ». Il a été remplacé par **deux modes de clic, `single` et `multi`**, qui sélectionnent toujours **une surface** (un pan de toit ou une façade). Ils partagent **une sélection unique**.

| Mode | Valeur | Effet d'un clic |
|------|--------|-----------------|
| Unique (défaut) | `'single'` | Remplace la sélection par la surface cliquée. Efface les contours, dessine le nouveau, recentre la vue |
| Multiple | `'multi'` | Ajoute la surface si elle est absente, la retire si elle est présente (toggle). Dessine ou supprime son contour |

**Ce qui n'existe pas** : `identifyBuilding`, `toggleBuilding`, un mode « Bâtiment », les clés `mode_roof` et `mode_building`. Voir « Décisions abandonnées » dans les requirements.

### Principe architectural

L'état de sélection est centralisé dans `mapStore`. `MapComponent` identifie la surface au clic (via le composable), délègue l'ajout ou le retrait au store, dessine les contours et lance le lookup GWR. `InfoPanel` et `SummaryBanner` ne lisent que des valeurs calculées du store.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ SonnendachView.vue                                            │
│   SearchBar ──select──▶ zoomTo + identifyAt (meilleur pan)    │
│   ModeToggle            (couche : Toitures / Façades)         │
│   MapComponent          (clic, contours, bouton d'effacement) │
│   SelectionModeToggle   (Unique / Multiple)                   │
│   SummaryBanner         (aptitude + potentiel économique)     │
│   InfoPanel             (détail de la sélection agrégée)      │
│   FaqSection                                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ mapStore (Pinia)                                              │
│   solarMode: 'roofs' | 'facades'     (défaut 'roofs')         │
│   selectionMode: 'single' | 'multi'  (défaut 'single')        │
│   selectedSurfaces: SurfaceData[]    (unique par featureId)   │
│   loading, clickCoords, selectedAddress, communeId,           │
│   postalCode, noData                                          │
│   aggregated, summary, hasData       (computed)               │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ SurfaceData + Feature (contour)
┌──────────────────────────────────────────────────────────────┐
│ composables/useSolarIdentify.ts                               │
│   identifySurface · identifyBestRoof · lookupAddressCommune   │
│   (pickBestRoof, toSurfaceData, safeReadFeature : internes)   │
└──────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Types (`src/types/solar.ts`)

```typescript
export type SolarMode = 'roofs' | 'facades'
export type SelectionMode = 'single' | 'multi'

export interface SuitabilityDistribution {
  class1: number; class2: number; class3: number; class4: number; class5: number  // % de la surface
}

/** Surface individuelle normalisée, unité de base de la sélection. */
export interface SurfaceData {
  featureId: number         // clé de déduplication
  buildingId: number        // regroupe les besoins de chaleur
  area: number              // m²
  suitabilityClass: number  // 1..5
  electricityYield: number; electricityWinter: number; electricitySummer: number  // kWh
  financialReturn: number   // CHF/an
  heatYield: number         // kWh/an
  heatingDemand: number     // valeur du BÂTIMENT, répétée sur chaque surface
  hotWaterDemand: number    // valeur du BÂTIMENT
  collectorArea: number     // m²
  storageVolume: number     // litres
  irradiation: number       // gstrahlung, kWh/an
  irradiationPerM2: number  // mstrahlung, kWh/m²/an
  orientation: number | null  // ausrichtung, degrés
  tilt: number | null         // neigung, degrés
  gwr_egid: number
}

/** Agrégation consommée par InfoPanel. */
export interface AggregatedData {
  surfaceCount: number; buildingCount: number
  area: number; suitabilityClass: number; suitabilityDistribution: SuitabilityDistribution
  electricityYield: number; electricityWinter: number; electricitySummer: number; financialReturn: number
  heatYield: number; heatingDemand: number; hotWaterDemand: number  // besoins dédupliqués par bâtiment
  collectorArea: number; storageVolume: number
  irradiation: number; irradiationPerM2: number  // moyenne pondérée par la surface
  gwr_egid: number
  isSingleSurface: boolean
  orientation: number | null  // null si plusieurs surfaces
  tilt: number | null
}

/** Consommée par SummaryBanner. */
export interface SummaryData {
  suitabilityClass: number
  financialReturn: number             // CHF/an
  heatCoveragePercent: number | null  // null si les besoins sont inconnus
}
```

`Coordinates`, `RoofData` et `FacadeData` ont été supprimés (code mort).

### 2. Store (`src/stores/mapStore.ts`)

**État** : `solarMode`, `selectionMode`, `selectedSurfaces`, `loading`, `clickCoords`, `selectedAddress`, `communeId`, `postalCode`, `noData`.

**Computeds :**

```typescript
const aggregated = computed<AggregatedData | null>(() =>
  selectedSurfaces.value.length === 0 ? null : aggregateSurfaces(selectedSurfaces.value, solarMode.value))

const summary = computed<SummaryData | null>(() => {
  const agg = aggregated.value
  if (!agg) return null
  const denom = agg.heatingDemand + agg.hotWaterDemand
  return {
    suitabilityClass: agg.suitabilityClass,
    financialReturn: agg.financialReturn,
    // Pas de plafond : > 100 % signifie que la surface peut produire plus de chaleur
    // que le bâtiment n'en consomme.
    heatCoveragePercent: denom > 0 ? Math.round((agg.heatYield / denom) * 100) : null,
  }
})

const hasData = computed(() => selectedSurfaces.value.length > 0)
```

**Actions :**

| Action | Effet |
|--------|-------|
| `setSolarMode(mode)` | Change la couche et **vide** la sélection (`featureId` différents entre couches) |
| `setSelectionMode(mode)` | Change le mode et **conserve** la sélection |
| `addSurface(s)` | Ajoute si le `featureId` est absent |
| `selectSingle(s)` | Remplace toute la sélection par `[s]` |
| `removeSurface(featureId)` | Retire par `featureId` |
| `toggleSurface(s)` | Ajoute ou retire, renvoie `'added'` ou `'removed'` |
| `clearSelection()` | Vide `selectedSurfaces`, remet `clickCoords` à `null` et `noData` à `false` |

**`aggregateSurfaces(surfaces, mode)`** est **exportée** par le store. Elle :
- somme les grandeurs additives ;
- pondère l'irradiation par m² avec la surface ;
- répartit la surface par classe (1 à 5), en pourcentage arrondi ;
- déduplique les besoins de chaleur par `buildingId` (première occurrence) ;
- ne renseigne `orientation` et `tilt` que si `surfaces.length === 1`.

**Seuils de classe** (`classifyIrradiation`, irradiation moyenne en kWh/m²/an) :

| Classe | Toitures | Façades |
|--------|----------|---------|
| 5 | ≥ 1400 | ≥ 1200 |
| 4 | ≥ 1200 | ≥ 1000 |
| 3 | ≥ 1000 | ≥ 800 |
| 2 | ≥ 800 | ≥ 600 |
| 1 | sinon | sinon |

### 3. Composable (`src/composables/useSolarIdentify.ts`)

Il regroupe les appels à `https://api3.geo.admin.ch/rest/services/api/MapServer`.

```typescript
export function useSolarIdentify() {
  // identify, tolérance 2, limit 1, geometryFormat geojson
  identifySurface(coords, layerName): Promise<{ surface: SurfaceData; geometry: Feature | null } | null>

  // 1) identify (tolérance 10 toitures, 40 façades, sans géométrie) -> building_id
  // 2) find de toutes les surfaces du bâtiment (searchField building_id, avec géométrie)
  // 3) pickBestRoof
  identifyBestRoof(coords, layerName): Promise<{ surface; geometry; buildingId } | null>

  // GWR (ch.bfs.gebaeude_wohnungs_register) : EGID d'abord, puis building_id -> EGID
  lookupAddressCommune(egid, buildingId, layerName):
    Promise<{ address: string; communeId: number | null; postalCode: number | null } | null>
}
```

`toSurfaceData` convertit les attributs allemands de l'API (`flaeche`, `klasse`, `stromertrag`, ...) et met `orientation` et `tilt` à `null` s'ils sont absents. `pickBestRoof` retient le `mstrahlung` maximal, puis la `flaeche` maximale. Les résultats de `identify` portent leurs champs dans `attributes` et ceux de `find` (GeoJSON) dans `properties`. Un helper `attrsOf` couvre les deux cas.

### 4. MapComponent (`src/components/MapComponent.vue`)

**Flux de clic** (`identifyAt(coords, preferBestRoof)`) :

```
store.clickCoords = coords ; loading = true ; noData = false ; communeId = null
si preferBestRoof (recherche d'adresse) :
    picked = identifyBestRoof
sinon :
    picked = identifySurface
    si null : picked = identifyBestRoof          # le clic ne touche pas une surface précise
si null :
    si la sélection est vide : noData = true ; retour
si selectionMode == 'single' :
    effacer les contours ; selectSingle ; dessiner le contour ; recentrer
sinon :                                         # 'multi'
    action = toggleSurface
    si 'added'   : dessiner le contour ; recentrer
    si 'removed' : supprimer le contour (par featureId)
GWR : runGwrLookup(egid, buildingId, adresseDeLaRecherche)
loading = false
```

- `onMapClick` vide `selectedAddress` puis appelle `identifyAt(coords)`.
- L'adresse issue de la recherche prime sur celle du GWR (`runGwrLookup`).
- Le recentrage (`centerOnFeature`) anime la vue sur le centre de la géométrie, en zoomant jusqu'à la résolution 0,5 si la vue est plus éloignée.
- `defineExpose({ zoomTo, identifyAt })` : l'`identifyAt` exposé est `identifyFromSearch`, qui force `preferBestRoof = true`.

**Contour (sans remplissage)** :

```typescript
const outlineLayer = new VectorLayer({
  source: outlineSource,
  style: [
    new Style({ stroke: new Stroke({ color: '#ffffff', width: 5 }) }),     // halo clair
    new Style({ stroke: new Stroke({ color: '#d32f2f', width: 2.5 }) }),   // contour rouge
  ],
})
```

Chaque feature porte la propriété `featureId`, ce qui permet de retirer un contour précis (`removeOutlineByFeatureId`).

**Bouton « Nouvelle sélection »** : `v-if="store.selectionMode === 'multi' && store.selectedSurfaces.length > 0"`. Le clic appelle `clearAll()` : `outlineSource.clear()` puis `store.clearSelection()`.

**Watcher** : seul `store.solarMode` est observé. Il remplace la couche de tuiles solaires et efface les contours. Il n'existe **aucun watcher sur `selectionMode`**.

**Fonds de carte** : `satellite` (swissimage) et `grey` (pixelkarte-grau). Les libellés passent par i18n (`basemap_satellite`, `basemap_grey`) et l'attribution par `map_attribution`.

### 5. SelectionModeToggle (`src/components/SelectionModeToggle.vue`)

Deux boutons sous le libellé `mode_selection_label` : `mode_single` et `mode_multi`. Grille à 2 colonnes, indicateur glissant rouge qui passe de `0%` à `100%`.

```typescript
const sliderOffset = computed(() => (store.selectionMode === 'single' ? '0%' : '100%'))
```

Classes testées : `.selection-toggle button`, `.active`.

### 6. SummaryBanner (`src/components/SummaryBanner.vue`)

Affichée si `store.summary` n'est pas `null`. Contenu :
- ligne d'aptitude : icône soleil, `summary_suitability` et la classe (`suitability_N`), colorées ;
- ligne de potentiel : `summary_pv` avec `{amount}` (arrondi, format `de-CH`), puis `summary_heat` avec `{percent}` si `heatCoveragePercent !== null`.

Les deux textes contiennent du HTML (`<strong>`) et passent par `v-html`. Les chaînes viennent des fichiers de langue, pas de l'utilisateur. Bordure et fond (opacité 0,08) dérivent de la couleur de la classe.

### 7. InfoPanel (`src/components/InfoPanel.vue`)

Trois états : chargement (`store.loading`), pas de données (`store.noData`), puis données agrégées (`store.aggregated`).

- Titre : `info_selection_title` ; plus `(N Surfaces de toit)` si plus d'une surface ; plus l'adresse.
- **Orientation** : `fmtOrientation` normalise l'angle dans [-180, 180] et choisit le libellé cardinal.

| Angle absolu | Libellé |
|--------------|---------|
| ≤ 22,5° | Sud |
| entre 22,5° et 67,5° | Sud-Est (négatif) ou Sud-Ouest (positif) |
| entre 67,5° et 112,5° (exclu) | Est (négatif) ou Ouest (positif) |
| entre 112,5° et 157,5° (exclu) | Nord-Est (négatif) ou Nord-Ouest (positif) |
| ≥ 157,5° | Nord |

  Exemple : `-13` donne « -13° (Sud) ». **Inclinaison** : `fmtDeg` arrondit et ajoute « ° ». Les deux affichent `-` si la valeur est `null`.
- **Tarif VESE** : `usePvTarif().fetchTarif(communeId)` est déclenché par un watcher sur `store.communeId`. Le tarif et le fournisseur valent `-` en cas d'absence ou d'erreur.
- **Lien du calculateur solaire** : par défaut `info_solar_calculator_url`. Pour une seule surface en mode toitures avec des coordonnées de clic, un lien prérempli (`SYSTEM`, `TECHNOLOGIE`, `POSTLEITZAHL`, `X`, `Y` en LV03, `NEIGUNG`, `AUSRICHTUNG`, `BEDARF_WARMWASSER`, `DACH_ID`, `FLAECHE`).
- Couleur de la bordure et des icônes : classe d'aptitude globale.

## Data Models

Champs de l'API swisstopo (couches `ch.bfe.solarenergie-eignung-daecher` et `ch.bfe.solarenergie-eignung-fassaden`) :

| Champ API | `SurfaceData` | Usage |
|-----------|--------------|-------|
| `building_id` | `buildingId` | Regroupement des besoins de chaleur, recherche du meilleur pan |
| `flaeche` | `area` | m², pondération, départage du meilleur pan |
| `klasse` | `suitabilityClass` | Répartition par classe |
| `mstrahlung` | `irradiationPerM2` | Classe globale, critère du meilleur pan |
| `gstrahlung` | `irradiation` | Irradiation totale |
| `stromertrag`, `_sommerhalbjahr`, `_winterhalbjahr` | `electricity*` | Rendement PV |
| `finanzertrag` | `financialReturn` | Bannière : CHF/an |
| `waermeertrag` | `heatYield` | Numérateur du taux de couverture |
| `bedarf_heizung`, `bedarf_warmwasser` | `heatingDemand`, `hotWaterDemand` | Dénominateur, dédupliqué par bâtiment |
| `flaeche_kollektoren`, `volumen_speicher` | `collectorArea`, `storageVolume` | Section thermique |
| `ausrichtung`, `neigung` | `orientation`, `tilt` | Surface unique |
| `gwr_egid` | `gwr_egid` | Lookup GWR |

## Error Handling

| Cas | Comportement |
|-----|--------------|
| Aucune surface trouvée, sélection vide | `noData = true`, panneau « pas de données » |
| Aucune surface trouvée, sélection non vide | La sélection reste inchangée |
| Géométrie illisible | `safeReadFeature` renvoie `null` : données affichées sans contour |
| Exception réseau pendant l'identification | `console.error('Identify error:', error)`, puis `loading = false` dans `finally` |
| GWR indisponible | `lookupAddressCommune` renvoie `null` (erreurs avalées) : adresse vide, commune `null`, tarif `-` |
| Dénominateur de chaleur nul | `heatCoveragePercent = null` : volet thermique masqué dans la bannière et la ligne de couverture absente |
| `ausrichtung` ou `neigung` absents | `-` |

## Correctness Properties

Propriétés de la logique de sélection. Les propriétés 1 à 10 sont vérifiées **sur des exemples** (pas sur des entrées aléatoires) par `cypress/e2e/selection-logic.cy.ts`. Les propriétés 11 et 12 n'ont pas de test : `pickBestRoof` est interne au composable et `fmtOrientation` est dans le composant `InfoPanel`.

### Property 1: Unicité de la sélection

Pour toute suite d'appels à `addSurface` et `toggleSurface`, `selectedSurfaces` ne contient jamais deux surfaces de même `featureId`.

**Validates: Requirements 3.3**

### Property 2: Le mode Unique remplace

Pour toute sélection initiale et toute surface `s`, après `selectSingle(s)`, `selectedSurfaces` vaut exactement `[s]`.

**Validates: Requirements 2.1, 2.4**

### Property 3: Le toggle est une involution

Pour toute surface `s`, appeler `toggleSurface(s)` deux fois de suite rend le même ensemble de `featureId` qu'au départ (l'ordre peut changer), et les deux retours valent `'added'` puis `'removed'` (ou l'inverse si `s` était déjà présente).

**Validates: Requirements 3.1, 3.2**

### Property 4: Le changement de mode garde la sélection, le changement de couche la vide

Pour toute sélection `S`, `setSelectionMode(m)` laisse `selectedSurfaces` égal à `S`, et `setSolarMode(m)` la laisse vide.

**Validates: Requirements 5.1, 5.3**

### Property 5: Additivité de l'agrégation

Pour toute sélection non vide, l'aire, les rendements électriques, le rendement financier, le rendement thermique, la surface de capteurs, le volume de stockage et l'irradiation totale de `aggregated` sont les sommes des champs correspondants des surfaces.

**Validates: Requirements 6.2**

### Property 6: Les besoins de chaleur comptent une fois par bâtiment

Pour toute sélection, `aggregated.heatingDemand` est la somme, sur les `buildingId` distincts, du besoin de la première surface de chaque bâtiment, et `buildingCount` est le nombre de `buildingId` distincts.

**Validates: Requirements 6.6**

### Property 7: Classe d'aptitude monotone et dépendante de la couche

Pour toute irradiation moyenne `x` en kWh/m²/an, `classifyIrradiation(x, 'roofs')` vaut 5, 4, 3, 2 ou 1 selon que `x` atteint 1400, 1200, 1000, 800 ou rien ; pour `'facades'` les seuils sont 1200, 1000, 800 et 600. La classe ne diminue jamais quand `x` augmente.

**Validates: Requirements 6.4**

### Property 8: Répartition par classe

Pour toute sélection, `suitabilityDistribution` contient cinq pourcentages entre 0 et 100, et leur somme vaut 100 à l'arrondi près quand toutes les surfaces ont une classe entre 1 et 5.

**Validates: Requirements 6.5**

### Property 9: Orientation et inclinaison réservées à la surface unique

Pour toute sélection, `aggregated.orientation` et `aggregated.tilt` valent `null` dès que `surfaceCount > 1`, et valent ceux de la surface quand `surfaceCount === 1`.

**Validates: Requirements 8.1, 8.2**

### Property 10: Taux de couverture non plafonné

Pour toute sélection dont les besoins `d = heatingDemand + hotWaterDemand` sont strictement positifs, `summary.heatCoveragePercent = round(heatYield / d × 100)`, sans plafond. Si `d = 0`, la valeur est `null`.

**Validates: Requirements 9.5, 9.6**

### Property 11: Meilleur pan

Pour tout ensemble non vide de surfaces d'un bâtiment, `pickBestRoof` renvoie une surface dont le `mstrahlung` est maximal, et, parmi celles-ci, dont la `flaeche` est maximale.

**Validates: Requirements 4.4**

### Property 12: Libellé cardinal de l'orientation

Pour tout angle `a`, `fmtOrientation(a)` renvoie le libellé du secteur de 45° centré sur le point cardinal le plus proche, avec 0° = sud, négatif = est et positif = ouest, après normalisation de `a` dans [-180, 180].

**Validates: Requirements 8.3, 8.4**

## Testing Strategy

Les tests tournent en local (`npm.cmd run test:e2e`) et en CI (`lint-test-build.yml`).

**Couvert** (`cypress/e2e/selection-mode.cy.ts`, 5 tests, en allemand) :
- toggle affiché, « Einzeln » actif, « Mehrfach » inactif ;
- clic carte : InfoPanel avec le titre « Information » et `kWh` ;
- SummaryBanner visible avec « CHF » ;
- pas de `.clear-selection-btn` en mode Unique ;
- mode Multiple : « Neue Auswahl » visible, puis effacement de l'InfoPanel et de la bannière.

**Aussi concernés** : `mode-toggle.cy.ts` (titre « Information », sélection effacée au changement de couche), `language.cy.ts`, `vese-tarif.cy.ts`.

**Logique, sans navigateur** (`cypress/e2e/selection-logic.cy.ts`, 9 tests) : le fichier importe `aggregateSurfaces` et `useMapStore` par chemin relatif et crée un Pinia neuf avant chaque test du store. Il vérifie les sommes, l'irradiation pondérée, les besoins de chaleur comptés une fois par bâtiment, les seuils de classe par couche (valeurs limites), la répartition par classe, l'orientation réservée à une surface unique, l'unicité et le toggle, le remplacement en mode Unique, la conservation de la sélection au changement de mode, son effacement au changement de couche et le taux de couverture non plafonné.

**Non couvert** : cumul de deux surfaces et retrait par second clic **dans l'interface**, contours, `pickBestRoof`, libellé cardinal de l'orientation (les fixtures n'ont ni `ausrichtung` ni `neigung`).

## Historique de la mise en œuvre

1. Types : `SelectionMode`, `SurfaceData`, `AggregatedData`, `SummaryData`.
2. Store : `selectedSurfaces`, `aggregateSurfaces`, computeds et actions.
3. Composable `useSolarIdentify`.
4. `MapComponent` : clic simplifié, contour sans remplissage, bouton d'effacement.
5. `SelectionModeToggle` : deux boutons Unique / Multiple.
6. `SummaryBanner`, insérée dans `SonnendachView`.
7. `InfoPanel` : agrégation, orientation avec libellé cardinal, lien du calculateur.
8. Locales : clés des modes, de la bannière et des points cardinaux, dans les 4 langues.
9. Tests Cypress.
10. Nettoyage : suppression de `lastBuildingId`, de `Coordinates`, de `RoofData` et `FacadeData`, de `useDevice.ts` et de `vue3-openlayers` ; passage en i18n de l'attribution, des fonds de carte, du bouton d'effacement de la recherche et du libellé de langue.
