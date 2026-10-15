/**
 * Logic tests of the selection (no browser page needed).
 *
 * They import the store directly and check the rules that the UI tests cannot see:
 * aggregation, per-building heat demand, class thresholds per layer, selection actions
 * and the heat coverage of the summary banner.
 */

import { createPinia, setActivePinia } from 'pinia'
import { aggregateSurfaces, useMapStore } from '../../src/stores/mapStore'
import type { SurfaceData } from '../../src/types/solar'

/** A surface with neutral values; each test overrides what it checks. */
function surface(overrides: Partial<SurfaceData> = {}): SurfaceData {
  return {
    featureId: 1,
    buildingId: 100,
    area: 10,
    suitabilityClass: 3,
    electricityYield: 0,
    electricityWinter: 0,
    electricitySummer: 0,
    financialReturn: 0,
    heatYield: 0,
    heatingDemand: 0,
    hotWaterDemand: 0,
    collectorArea: 0,
    storageVolume: 0,
    irradiation: 0,
    irradiationPerM2: 1000,
    orientation: null,
    tilt: null,
    gwr_egid: 1,
    ...overrides,
  }
}

describe('Selection logic: aggregation', () => {
  it('sums the additive values and weights the irradiation by area', () => {
    const agg = aggregateSurfaces(
      [
        surface({ featureId: 1, area: 30, electricityYield: 3000, financialReturn: 300, irradiationPerM2: 1000 }),
        surface({ featureId: 2, area: 10, electricityYield: 2000, financialReturn: 200, irradiationPerM2: 1400 }),
      ],
      'roofs',
    )

    expect(agg.surfaceCount).to.equal(2)
    expect(agg.area).to.equal(40)
    expect(agg.electricityYield).to.equal(5000)
    expect(agg.financialReturn).to.equal(500)
    // (1000 * 30 + 1400 * 10) / 40 = 1100
    expect(agg.irradiationPerM2).to.equal(1100)
  })

  it('counts the heat demand of a building once, however many of its surfaces are selected', () => {
    const agg = aggregateSurfaces(
      [
        surface({ featureId: 1, buildingId: 100, heatingDemand: 18000, hotWaterDemand: 3500 }),
        surface({ featureId: 2, buildingId: 100, heatingDemand: 18000, hotWaterDemand: 3500 }),
        surface({ featureId: 3, buildingId: 200, heatingDemand: 10000, hotWaterDemand: 2000 }),
      ],
      'roofs',
    )

    expect(agg.buildingCount).to.equal(2)
    expect(agg.heatingDemand).to.equal(28000)
    expect(agg.hotWaterDemand).to.equal(5500)
  })

  it('classifies the average irradiation with the thresholds of each layer', () => {
    const classOf = (irradiationPerM2: number, mode: 'roofs' | 'facades') =>
      aggregateSurfaces([surface({ irradiationPerM2 })], mode).suitabilityClass

    // Roofs: 800 / 1000 / 1200 / 1400
    expect([799, 800, 1000, 1200, 1400].map((v) => classOf(v, 'roofs'))).to.deep.equal([1, 2, 3, 4, 5])
    // Facades: 600 / 800 / 1000 / 1200
    expect([599, 600, 800, 1000, 1200].map((v) => classOf(v, 'facades'))).to.deep.equal([1, 2, 3, 4, 5])
  })

  it('splits the area by suitability class', () => {
    const agg = aggregateSurfaces(
      [
        surface({ featureId: 1, area: 50, suitabilityClass: 5 }),
        surface({ featureId: 2, area: 50, suitabilityClass: 3 }),
      ],
      'roofs',
    )

    expect(agg.suitabilityDistribution).to.deep.equal({
      class1: 0,
      class2: 0,
      class3: 50,
      class4: 0,
      class5: 50,
    })
  })

  it('keeps orientation and tilt for a single surface only', () => {
    const one = aggregateSurfaces([surface({ featureId: 1, orientation: -13, tilt: 30 })], 'roofs')
    expect(one.isSingleSurface).to.equal(true)
    expect(one.orientation).to.equal(-13)
    expect(one.tilt).to.equal(30)

    const two = aggregateSurfaces(
      [
        surface({ featureId: 1, orientation: -13, tilt: 30 }),
        surface({ featureId: 2, orientation: 20, tilt: 25 }),
      ],
      'roofs',
    )
    expect(two.isSingleSurface).to.equal(false)
    expect(two.orientation).to.equal(null)
    expect(two.tilt).to.equal(null)
  })
})

describe('Selection logic: store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('never holds the same surface twice and toggles it on and off', () => {
    const store = useMapStore()
    const s = surface({ featureId: 7 })

    store.addSurface(s)
    store.addSurface(s)
    expect(store.selectedSurfaces).to.have.length(1)

    expect(store.toggleSurface(s)).to.equal('removed')
    expect(store.selectedSurfaces).to.have.length(0)
    expect(store.toggleSurface(s)).to.equal('added')
    expect(store.selectedSurfaces).to.have.length(1)
  })

  it('single mode replaces the selection', () => {
    const store = useMapStore()
    store.addSurface(surface({ featureId: 1 }))
    store.addSurface(surface({ featureId: 2 }))

    store.selectSingle(surface({ featureId: 3 }))

    expect(store.selectedSurfaces.map((x) => x.featureId)).to.deep.equal([3])
  })

  it('changing the selection mode keeps the selection, changing the layer clears it', () => {
    const store = useMapStore()
    expect(store.selectionMode).to.equal('single')
    store.addSurface(surface({ featureId: 1 }))

    store.setSelectionMode('multi')
    expect(store.selectionMode).to.equal('multi')
    expect(store.selectedSurfaces).to.have.length(1)

    store.setSolarMode('facades')
    expect(store.selectedSurfaces).to.have.length(0)
    expect(store.aggregated).to.equal(null)
  })

  it('heat coverage is not capped at 100% and is null without demand', () => {
    const store = useMapStore()

    store.addSurface(surface({ featureId: 1, heatYield: 30000, heatingDemand: 10000, hotWaterDemand: 5000 }))
    // 30000 / 15000 = 200%
    expect(store.summary?.heatCoveragePercent).to.equal(200)

    store.clearSelection()
    store.addSurface(surface({ featureId: 2, heatYield: 30000 }))
    expect(store.summary?.heatCoveragePercent).to.equal(null)
  })
})
