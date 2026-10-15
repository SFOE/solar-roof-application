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

const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'de',
  messages: { de, fr, it, en },
})

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

app.mount('#app')

// Keep the browser tab title and the <html lang> attribute in sync with the UI language.
watch(
  () => i18n.global.locale.value,
  (locale) => {
    document.title = i18n.global.t('page_title')
    document.documentElement.lang = locale
  },
  { immediate: true },
)
