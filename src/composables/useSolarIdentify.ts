/**
 * useSolarIdentify.ts
 *
 * Encapsulates all swisstopo geo.admin.ch API calls used for solar identification.
 * Returns normalized `SurfaceData` objects and GeoJSON geometries for highlighting.
 *
 * Layers:
 * - ch.bfe.solarenergie-eignung-daecher (roofs)
 * - ch.bfe.solarenergie-eignung-fassaden (facades)
 */

import axios from 'axios'
import GeoJSON from 'ol/format/GeoJSON'
import type Feature from 'ol/Feature'
import type { SurfaceData } from '@/types/solar'

const API_BASE = 'https://api3.geo.admin.ch/rest/services/api/MapServer'
const LAYER_GWR = 'ch.bfs.gebaeude_wohnungs_register'

const geoJsonFormat = new GeoJSON()

/** Builds a normalized SurfaceData object from raw swisstopo attributes. */
function toSurfaceData(featureId: number, attrs: Record<string, any>, buildingId: number): SurfaceData {
  return {
    featureId,
    buildingId,
    area: attrs.flaeche || 0,
    suitabilityClass: attrs.klasse || 1,
    electricityYield: attrs.stromertrag || 0,
    electricityWinter: attrs.stromertrag_winterhalbjahr || 0,
    electricitySummer: attrs.stromertrag_sommerhalbjahr || 0,
    financialReturn: attrs.finanzertrag || 0,
    heatYield: attrs.waermeertrag || 0,
    heatingDemand: attrs.bedarf_heizung || 0,
    hotWaterDemand: attrs.bedarf_warmwasser || 0,
    collectorArea: attrs.flaeche_kollektoren || 0,
    storageVolume: attrs.volumen_speicher || 0,
    irradiation: attrs.gstrahlung || 0,
    irradiationPerM2: attrs.mstrahlung || 0,
    orientation: attrs.ausrichtung !== undefined && attrs.ausrichtung !== null ? attrs.ausrichtung : null,
    tilt: attrs.neigung !== undefined && attrs.neigung !== null ? attrs.neigung : null,
    gwr_egid: attrs.gwr_egid,
  }
}

/**
 * Safely reads a GeoJSON feature from a swisstopo API result.
 * Returns null on any failure (geometry is optional for highlighting).
 * Sets the given properties on the resulting feature for later lookup.
 */
function safeReadFeature(result: any, props: Record<string, any>): Feature | null {
  try {
    const parsed = geoJsonFormat.readFeature(result)
    const feature = Array.isArray(parsed) ? parsed[0] : parsed
    if (!feature || typeof (feature as Feature).getGeometry !== 'function') return null
    if (!(feature as Feature).getGeometry()) return null
    for (const [k, v] of Object.entries(props)) (feature as Feature).set(k, v)
    return feature as Feature
  } catch {
    return null
  }
}

/**
 * Returns the attributes of an API result, whether it comes from `identify`
 * (result.attributes) or `find` with geojson format (result.properties).
 */
function attrsOf(result: any): Record<string, any> {
  return result?.attributes || result?.properties || {}
}

/** Picks the "best" roof surface: highest irradiation/m² (mstrahlung), tie-break largest area. */
function pickBestRoof(surfaces: any[]): any {
  return surfaces.reduce((best, s) => {
    const m = attrsOf(s).mstrahlung || 0
    const bm = attrsOf(best).mstrahlung || 0
    if (m > bm) return s
    if (m === bm && (attrsOf(s).flaeche || 0) > (attrsOf(best).flaeche || 0)) return s
    return best
  })
}

export function useSolarIdentify() {
  /**
   * Identifies a single precise surface at the click point (small tolerance).
   * Returns the surface data + its GeoJSON geometry feature for highlighting.
   */
  async function identifySurface(
    coords: [number, number],
    layerName: string,
  ): Promise<{ surface: SurfaceData; geometry: Feature | null } | null> {
    const [e, n] = coords
    const params = {
      geometryType: 'esriGeometryPoint',
      geometry: `${e},${n}`,
      sr: '2056',
      layers: `all:${layerName}`,
      tolerance: 2,
      returnGeometry: true,
      geometryFormat: 'geojson',
      limit: 1,
      imageDisplay: '500,500,96',
      mapExtent: `${e - 50},${n - 50},${e + 50},${n + 50}`,
    }
    const resp = await axios.get(`${API_BASE}/identify`, { params })
    const hit = resp.data.results?.find((r: any) => Number(r.featureId) > 0)
    if (!hit) return null

    const a = attrsOf(hit)
    const buildingId = a.building_id
    const surface = toSurfaceData(hit.featureId, a, buildingId)
    const geometry = safeReadFeature(hit, { featureId: hit.featureId })
    return { surface, geometry }
  }

  /**
   * Identifies the building at the click point, then picks its best roof surface.
   * Used in roof mode when the click does not hit a precise surface, and on address search.
   */
  async function identifyBestRoof(
    coords: [number, number],
    layerName: string,
  ): Promise<{ surface: SurfaceData; geometry: Feature | null; buildingId: number } | null> {
    const [e, n] = coords
    // First, find the building_id at the click point (larger tolerance for reliability)
    const isFacades = layerName.includes('fassaden')
    const identifyParams = {
      geometryType: 'esriGeometryPoint',
      geometry: `${e},${n}`,
      sr: '2056',
      layers: `all:${layerName}`,
      tolerance: isFacades ? 40 : 10,
      returnGeometry: false,
      limit: 1,
      imageDisplay: '500,500,96',
      mapExtent: `${e - 50},${n - 50},${e + 50},${n + 50}`,
    }
    const identifyResp = await axios.get(`${API_BASE}/identify`, { params: identifyParams })
    const firstHit = identifyResp.data.results?.find((r: any) => Number(r.featureId) > 0)
    if (!firstHit) return null

    const buildingId = firstHit.attributes.building_id

    // Fetch all surfaces of the building with geometry, then pick the best one
    const findResp = await axios.get(`${API_BASE}/find`, {
      params: {
        layer: layerName,
        searchText: buildingId,
        searchField: 'building_id',
        contains: false,
        returnGeometry: true,
        geometryFormat: 'geojson',
        sr: '2056',
      },
    })
    const allSurfaces = findResp.data.results?.filter((r: any) => Number(r.featureId) > 0) || []
    if (allSurfaces.length === 0) return null

    const best = pickBestRoof(allSurfaces)
    const surface = toSurfaceData(best.featureId, attrsOf(best), buildingId)
    const geometry = safeReadFeature(best, { featureId: best.featureId })
    return { surface, geometry, buildingId }
  }

  /**
   * Looks up building address and municipality via GWR.
   * Tries EGID first; falls back to building_id → solar layer → EGID.
   */
  async function lookupAddressCommune(
    egid: number | undefined,
    buildingId: number | null,
    layerName: string,
  ): Promise<{ address: string; communeId: number | null; postalCode: number | null } | null> {
    async function fromEgid(
      e: number,
    ): Promise<{ address: string; communeId: number | null; postalCode: number | null } | null> {
      const addrResp = await axios.get(`${API_BASE}/find`, {
        params: {
          layer: LAYER_GWR,
          searchText: e,
          searchField: 'egid',
          contains: false,
          returnGeometry: false,
          limit: 1,
        },
      })
      const addrHit = addrResp.data.results?.find(
        (r: any) => String(r.attributes.egid) === String(e),
      )
      if (!addrHit) return null
      const a = addrHit.attributes
      return {
        address: `${a.strname_deinr}, ${a.dplz4} ${a.dplzname}`,
        communeId: a.ggdenr ? parseInt(a.ggdenr) : null,
        postalCode: a.dplz4 ? parseInt(a.dplz4) : null,
      }
    }

    try {
      if (egid) {
        const res = await fromEgid(egid)
        if (res) return res
      }
      if (buildingId) {
        const findResp = await axios.get(`${API_BASE}/find`, {
          params: {
            layer: layerName,
            searchText: buildingId,
            searchField: 'building_id',
            contains: false,
            returnGeometry: false,
            sr: '2056',
            limit: 1,
          },
        })
        const firstSurface = findResp.data.results?.find((r: any) => r.featureId > 0)
        const fallbackEgid = firstSurface?.attributes?.gwr_egid
        if (fallbackEgid) return await fromEgid(fallbackEgid)
      }
    } catch {
      /* non-critical */
    }
    return null
  }

  return { identifySurface, identifyBestRoof, lookupAddressCommune }
}
