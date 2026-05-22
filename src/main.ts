import '@/assets/main.css'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import router from '@/router'

import App from '@/App.vue'

import de from '@/locales/de.json'
import fr from '@/locales/fr.json'
import it from '@/locales/it.json'
import en from '@/locales/en.json'

import {
  Map as OLMapPlugin,
  Layers as OLLayersPlugin,
  Sources as OLSourcesPlugin,
  MapControls as OLControlsPlugin,
} from 'vue3-openlayers'

const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'de',
  messages: { de, fr, it, en },
})

const app = createApp(App)

app.use(createPinia())
app.use(OLMapPlugin)
app.use(OLLayersPlugin)
app.use(OLSourcesPlugin)
app.use(OLControlsPlugin)
app.use(i18n)
app.use(router)

app.mount('#app')

watch(
  () => i18n.global.locale.value,
  () => {
    document.title = i18n.global.t('page_title')
  },
)
