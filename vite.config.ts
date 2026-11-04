import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Dev-only plugin that proxies /api/pvtarif/* requests to the VESE API,
 * injecting the license key server-side so it never reaches the browser.
 */
function veseProxyPlugin(): Plugin {
  let apiKey = ''

  return {
    name: 'vese-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      apiKey = env.VITE_VESE_API_KEY || ''
    },
    configureServer(server) {
      // Proxy: /api/pvtarif/muni?idofs=4551 → VESE API with key
      server.middlewares.use('/api/pvtarif', async (req, res) => {
        if (!apiKey) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'VITE_VESE_API_KEY not set in .env.local' }))
          return
        }

        const url = new URL(req.url || '/', 'http://localhost')
        const pathname = url.pathname // e.g. "/muni" or "/evu"
        const params = url.searchParams

        // Append the license key
        params.set('licenseKey', apiKey)

        const veseUrl = `https://opendata.vese.ch/pvtarif/api/getData${pathname}?${params.toString()}`

        try {
          const response = await fetch(veseUrl, { signal: AbortSignal.timeout(10000) })
          let data = await response.text()

          // Strip BOM characters that VESE API injects into JSON responses
          data = data.replace(/\uFEFF/g, '')

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = response.status
          res.end(data)
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: `VESE API unreachable: ${e instanceof Error ? e.message : String(e)}` }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // Dev-only: avoids bundling the devtools client (and its hookable/birpc/
    // @vue/devtools-shared deps) into the production build.
    mode === 'development' ? vueDevTools() : undefined,
    veseProxyPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        // OpenLayers rarely changes between deploys of this app's own code, so
        // splitting it into its own chunk lets browsers reuse the cached chunk
        // across app updates instead of re-downloading it with every change.
        codeSplitting: {
          groups: [
            {
              name: 'ol',
              test: /node_modules\/ol/,
            },
          ],
        },
      },
    },
  },
}))
