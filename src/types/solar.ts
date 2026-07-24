/**
 * Types pour les données solaires de l'API swisstopo.
 *
 * Ces interfaces correspondent aux champs retournés par l'API identify
 * de geo.admin.ch pour les couches :
 * - ch.bfe.solarenergie-eignung-daecher (toitures)
 * - ch.bfe.solarenergie-eignung-fassaden (façades)
 */

export interface Coordinates {
  east: number
  north: number
}

/** Mode d'affichage : toitures ou façades */
export type SolarMode = 'roofs' | 'facades'

/** Granularité de sélection : bâtiment entier, surface individuelle, ou multi-sélection */
export type SelectionMode = 'building' | 'single' | 'multi'

/** Suitability distribution: percentage of area per class */
export interface SuitabilityDistribution {
  class1: number  // % gering
  class2: number  // % mittel
  class3: number  // % gut
  class4: number  // % sehr gut
  class5: number  // % hervorragend
}

/** Données solaires d'une surface de toit */
export interface RoofData {
  featureId: number
  buildingId: number
  surfaceCount: number
  area: number
  suitabilityClass: number
  suitabilityDistribution: SuitabilityDistribution
  // PV (électricité) — sommes
  electricityYield: number  // kWh/an
  electricityWinter: number // kWh (semestre hiver)
  electricitySummer: number // kWh (semestre été)
  financialReturn: number   // CHF/an
  // Thermique (chaleur) — sommes
  heatYield: number         // kWh/an
  heatingDemand: number     // kWh/an (valeur bâtiment)
  hotWaterDemand: number    // kWh/an (valeur bâtiment)
  collectorArea: number     // m² (somme)
  storageVolume: number     // litres (somme)
  // Irradiation
  irradiation: number       // kWh/an total (somme)
  irradiationPerM2: number  // kWh/m²/an (moyenne pondérée)
  // Identifiant GWR
  gwr_egid: number
}

/** Données solaires d'une façade */
export interface FacadeData {
  featureId: number
  buildingId: number
  surfaceCount: number
  area: number
  suitabilityClass: number
  suitabilityDistribution: SuitabilityDistribution
  electricityYield: number
  electricityWinter: number
  electricitySummer: number
  financialReturn: number
  heatYield: number
  heatingDemand: number
  hotWaterDemand: number
  collectorArea: number
  storageVolume: number
  irradiation: number
  irradiationPerM2: number
  gwr_egid: number
}
