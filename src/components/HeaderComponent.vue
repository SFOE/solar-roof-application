<template>
  <header class="app-header">
    <div class="top-header-box">
      <div class="app-container top-header-inner">
        <LanguageSwitcherComponent />
      </div>
    </div>

    <div class="bottom-header-box">
      <div class="app-container bottom-header-inner">
        <div class="logo-title-group">
          <picture>
            <source media="(max-width: 768px)" :srcset="swissMobileLogo" />
            <img class="logo" :src="confederationLogo" alt="Swiss Confederation Logo" />
          </picture>
          <div class="divider"></div>
          <h1 class="title">{{ $t('header_title') }}</h1>
        </div>
      </div>
    </div>

    <div class="header-line"></div>
  </header>
</template>

<script setup lang="ts">
import LanguageSwitcherComponent from './LanguageSwitcherComponent.vue'
// Explicit imports (rather than string paths in the template) so Vite always
// resolves and bundles both assets — the <source srcset> attribute is not in
// Vite/Vue's default template asset-URL transform list, so a plain string
// path there is not rewritten and would 404 in production.
import confederationLogo from '@/assets/logo.png'
import swissMobileLogo from '@/assets/swiss_mobile.svg'
</script>

<style scoped>
.app-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.top-header-box {
  width: 100%;
  height: 50px;
  background-color: var(--color-primary);
  display: flex;
  align-items: center;
}

.top-header-inner {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0;
}

.bottom-header-box {
  width: 100%;
  background-color: #fff;
}

.bottom-header-inner {
  display: flex;
  align-items: flex-start;
  padding: 1rem 0 1.75rem 1rem;
}

.logo-title-group {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.logo {
  display: block;
  height: 68px;
  width: auto;
  flex-shrink: 0;
}

.title {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
}

.divider {
  width: 1px;
  background-color: #dcdcdc;
}

.header-line {
  width: 100%;
  height: 1px;
  background-color: #dcdcdc;
}

/* Sur mobile : logo compact (croix suisse seule), chargé via la balise <source> du <picture> */
@media (max-width: 768px) {
  .logo {
    height: 20px;
    padding-left: 10px;
  }

  .bottom-header-inner {
    max-height: 50px;
    vertical-align: center;
  }

  .logo-title-group {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .divider {
    display: none;
  }

  .title {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 12px;
  }
}
</style>
