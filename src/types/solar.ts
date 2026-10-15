/**
 * Types pour les données solaires de l'API swisstopo.
 *
 * Ces interfaces correspondent aux champs retournés par l'API identify
 * de geo.admin.ch pour les couches :
 * - ch.bfe.solarenergie-eignung-daecher (toitures)
 * - ch.bfe.solarenergie-eignung-fassaden (façades)
 */

/** Mode d'affichage : toitures ou façades */
export type SolarMode = 'roofs' | 'facades'

/**
 * Comportement du clic de sélection :
 * - 'single' : chaque clic remplace la sélection (exploration)
 * - 'multi' : chaque clic ajoute/retire une surface (cumul pour un quartier)
 * Dans les deux cas, la sélection reste à l'échelle d'une surface de toit.
 */
export type SelectionMode = 'single' | 'multi'

/** Suitability distribution: percentage of area per class */
export interface SuitabilityDistribution {
  class1: number  // % gering
  class2: number  // % mittel
  class3: number  // % gut
  class4: number  // % sehr gut
  class5: number  // % hervorragend
}

/**
 * Surface individuelle normalisée — unité de base de la sélection.
 * Chaque surface a un featureId unique (clé de déduplication).
 * Correspond à un pan de toit ou une façade retourné par l'API swisstopo.
 */
export interface SurfaceData {
  featureId: number         // identifiant unique de la surface (clé de dédup)
  buildingId: number        // identifiant du bâtiment parent (regroupement besoins chaleur)
  area: number              // m²
  suitabilityClass: number  // 1..5
  // PV (électricité)
  electricityYield: number  // kWh/an
  electricityWinter: number // kWh (semestre hiver)
  electricitySummer: number // kWh (semestre été)
  financialReturn: number   // CHF/an
  // Thermique (chaleur)
  heatYield: number         // kWh/an
  heatingDemand: number     // kWh/an — valeur BÂTIMENT (identique sur toutes les surfaces du bâtiment)
  hotWaterDemand: number    // kWh/an — valeur BÂTIMENT
  collectorArea: number     // m²
  storageVolume: number     // litres
  // Irradiation
  irradiation: number       // kWh/an total surface (gstrahlung)
  irradiationPerM2: number  // kWh/m²/an (mstrahlung)
  // Géométrie de surface (mode Toiture, surface unique)
  orientation: number | null // ausrichtung, en degrés
  tilt: number | null        // neigung, en degrés
  // Identifiant GWR
  gwr_egid: number
}

/**
 * Données agrégées de la sélection courante — consommées par l'InfoPanel.
 * Regroupe toutes les surfaces sélectionnées (bâtiments + surfaces confondus).
 */
export interface AggregatedData {
  surfaceCount: number
  buildingCount: number
  area: number
  suitabilityClass: number
  suitabilityDistribution: SuitabilityDistribution
  // PV — sommes
  electricityYield: number
  electricityWinter: number
  electricitySummer: number
  financialReturn: number
  // Thermique — sommes (besoins dédupliqués par bâtiment)
  heatYield: number
  heatingDemand: number     // Σ besoins uniques par bâtiment
  hotWaterDemand: number    // Σ besoins uniques par bâtiment
  collectorArea: number
  storageVolume: number
  // Irradiation
  irradiation: number
  irradiationPerM2: number  // moyenne pondérée par surface
  gwr_egid: number
  // Champs surface unique (null si agrégat multi)
  isSingleSurface: boolean
  orientation: number | null
  tilt: number | null
}

/** Données de la bannière de synthèse (aptitude + potentiel économique). */
export interface SummaryData {
  suitabilityClass: number
  financialReturn: number             // CHF/an (potentiel PV)
  heatCoveragePercent: number | null  // % couverture besoins chaleur (null si indisponible)
}
