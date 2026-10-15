/**
 * usePvTarif.ts
 *
 * Fetches PV feed-in tariff data from the VESE API for a given municipality.
 * Two-step process:
 * 1. Get list of energy providers (EVUs) in the municipality
 * 2. Get tariff details for the first EVU
 *
 * The API license key is NEVER handled in the browser. It lives only
 * server-side:
 *   - in development, the Vite dev proxy (see vite.config.ts) injects it
 *   - in production, the Lambda proxy injects it
 * The frontend only ever talks to the proxy/Lambda, never to VESE directly.
 */

import axios from 'axios'
import { ref } from 'vue'

export interface EvuTarif {
  name: string            // EVU name
  nrElcom: string         // ElCom number
  energy1: number | null  // Feed-in tariff Rp/kWh (first power category, ≤10 kVA)
  eco1: number | null     // HKN tariff Rp/kWh
  communeName: string
  communeId: string
  year: number
}

// Public proxy/Lambda URL (safe to expose). The VESE license key is NOT read
// here: reading VITE_VESE_API_KEY in frontend code would inline it into the
// browser bundle and leak it. The key is injected only server-side.
const PVTARIF_PROXY_URL = import.meta.env.VITE_PVTARIF_API_URL || ''

/**
 * In dev: use the Vite proxy at /api/pvtarif (key injected by the dev server).
 * In prod: use the Lambda proxy URL from the env var (key injected by Lambda).
 */
function getBaseUrl(): string {
  if (PVTARIF_PROXY_URL) return PVTARIF_PROXY_URL
  return '/api/pvtarif'
}

export function usePvTarif() {
  const tarifData = ref<EvuTarif[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetches tariff data for a municipality.
   * Step 1: Get EVUs in the commune
   * Step 2: Get tariff for each EVU (current year)
   */
  async function fetchTarif(communeId: number) {
    loading.value = true
    error.value = null
    tarifData.value = []

    const baseUrl = getBaseUrl()
    const currentYear = new Date().getFullYear().toString().slice(-2) // "26" for 2026

    try {
      // Step 1: Get EVUs in this municipality
      const muniUrl = `${baseUrl}/muni?idofs=${communeId}`
      const muniResp = await axios.get(muniUrl)
      const muniData = muniResp.data

      // Strip BOM from property keys (VESE API bug)
      const cleanEvus = (muniData.evus || []).map((evu: any) => {
        const cleaned: any = {}
        for (const key of Object.keys(evu)) {
          cleaned[key.replace(/\uFEFF/g, '')] = evu[key]
        }
        return cleaned
      })

      // valid can be boolean true or string "true"
      const isValid = muniData.valid === true || muniData.valid === 'true'
      if (!isValid || cleanEvus.length === 0) {
        error.value = 'No energy provider found for this municipality'
        console.warn('[VESE] No EVUs found or invalid response')
        return
      }

      // Step 2: Get tariff for the first EVU (main provider)
      const results: EvuTarif[] = []
      const evu = cleanEvus[0]

      try {
        const evuUrl = `${baseUrl}/evu?evuId=${evu.nrElcom}&year=${currentYear}`
        const evuResp = await axios.get(evuUrl)
        const evuData = evuResp.data

        // Clean BOM from EVU response keys too
        const cleanEvuData: any = {}
        for (const key of Object.keys(evuData)) {
          cleanEvuData[key.replace(/\uFEFF/g, '')] = evuData[key]
        }

        const evuValid = cleanEvuData.valid === true || cleanEvuData.valid === 'true'
        if (evuValid) {
          const energyRate = cleanEvuData.energy1 ? parseFloat(cleanEvuData.energy1) : null
          const ecoRate = cleanEvuData.eco1 ? parseFloat(cleanEvuData.eco1) : null
          const ecoIncluded = cleanEvuData.ecoIncl === 'y'

          // Total tariff = energy + HKN (unless HKN is already included in energy)
          let totalRate = energyRate
          if (energyRate !== null && ecoRate !== null && !ecoIncluded) {
            totalRate = Math.round((energyRate + ecoRate) * 100) / 100
          }

          results.push({
            name: cleanEvuData.nomEw || evu.Name,
            nrElcom: evu.nrElcom,
            energy1: totalRate,
            eco1: ecoRate,
            communeName: evu.Gemeinde,
            communeId: evu.idofs,
            year: 2000 + parseInt(currentYear),
          })
        }
      } catch (evuErr) {
        console.warn('[VESE] Failed to fetch EVU tariff:', evu.nrElcom, evuErr)
      }

      tarifData.value = results
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tariff data'
      console.error('[VESE] Error:', e)
    } finally {
      loading.value = false
    }
  }

  return { tarifData, loading, error, fetchTarif }
}
