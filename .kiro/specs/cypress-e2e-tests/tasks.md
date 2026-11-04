# Implementation Plan: Cypress E2E Tests

## Overview

Suite Cypress E2E de Sonnendach, livrée : 8 fichiers de tests (40 tests, dont 9 de logique pure), 7 fixtures et 3 fichiers de support. Toutes les API externes (geo.admin.ch, VESE, tuiles WMTS) sont interceptées avec `cy.intercept()`. La suite tourne à chaque push et pull request dans `lint-test-build.yml`.

Toutes les tâches 1 à 14 sont **terminées**. Les tâches 15 et 16 sont des améliorations optionnelles, non commencées.

## Tasks

- [x] 1. Mettre en place le support Cypress
  - [x] 1.1 Créer `cypress/support/e2e.ts`, `commands.ts` et `intercepts.ts`
    - `e2e.ts` : importe `commands.ts`, fixe le viewport 1280x720 et intercepte `**/wmts/**` dans un `beforeEach` global
    - `commands.ts` : commandes `interceptGeoAdmin`, `interceptVese`, `searchAndSelect` (`input.search-input`, clear puis type séparés) et `clickMap`, typées `Chainable<void>`
    - `intercepts.ts` : `setupSearchIntercept`, `setupIdentifyIntercept`, `setupFindIntercept` (find = surfaces du bâtiment et GWR) et `setupVeseIntercept` (regex `/\/muni\?/` et `/\/evu\?/`)
    - _Requirements: 1.1, 1.4, 9.1, 9.2, 9.3_

  - [x] 1.2 Créer les 7 fixtures dans `cypress/fixtures/`
    - `search-results.json` (5 adresses de Bahnhofstrasse, 3011 Bern)
    - `identify-roofs.json` (3 surfaces, `featureId` 90001 à 90003, classe 5) et `identify-facades.json` (2 surfaces, `featureId` 80001 et 80002)
    - `identify-empty.json` (`{ "results": [] }`)
    - `gwr-lookup.json` (EGID 12345, `ggdenr` 351)
    - `vese-muni.json` et `vese-evu.json`
    - Champs allemands réels : `flaeche`, `klasse`, `mstrahlung`, `stromertrag`, `building_id`, `gwr_egid`, ...
    - _Requirements: 9.4, 9.5_

- [x] 2. Tests de la recherche d'adresses
  - [x] 2.1 Créer `cypress/e2e/search.cy.ts` (5 tests)
    - Paramètres SearchServer (`searchText`, `type=locations`, `sr=2056`, `limit=5`)
    - Liste de 5 suggestions issues de la fixture
    - Sélection d'une adresse : appel `MapServer/identify`
    - InfoPanel avec données solaires et badge `badge-5`
    - Erreur 500 : pas de crash, liste vide
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Tests du clic carte
  - [x] 3.1 Créer `cypress/e2e/map-click.cy.ts` (5 tests)
    - Le clic appelle `MapServer/identify`
    - Trois sections (Allgemein, Photovoltaik, Solarthermie) avec `kWh` et `m²`
    - Badge `badge-5`
    - Indicateur de chargement avec réponse retardée de 1000 ms
    - Panneau « Keine Daten verfügbar » avec `identify-empty.json`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Point de contrôle : tests de base
  - Lancer `npm run test:e2e` et vérifier qu'ils passent

- [x] 5. Tests du basculement de couche
  - [x] 5.1 Créer `cypress/e2e/mode-toggle.cy.ts` (4 tests)
    - « Dach » actif par défaut
    - Clic sur « Fassade » : actif, « Dach » inactif
    - Données de façade avec `identify-facades.json` (identify et find)
    - Changement de couche : le titre « Information » et `.info-grid` existaient, puis `.info-grid` et `.clear-selection-btn` disparaissent
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Tests du mode de sélection
  - [x] 6.1 Créer `cypress/e2e/selection-mode.cy.ts` (5 tests)
    - Toggle affiché, « Einzeln » actif par défaut, « Mehrfach » inactif
    - Clic carte : InfoPanel avec le titre « Information » et `kWh`
    - SummaryBanner visible avec « CHF »
    - Pas de `.clear-selection-btn` en mode Unique
    - Mode Multiple : « Neue Auswahl » visible, un clic efface l'InfoPanel détaillé et la SummaryBanner
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Tests du changement de langue
  - [x] 7.1 Créer `cypress/e2e/language.cy.ts` (4 tests)
    - Allemand par défaut (titre, placeholder, sélecteur `de`)
    - Passage en français : titre avec espace avant `?`, placeholder, boutons « Toiture » et « Façade »
    - Libellés de l'InfoPanel traduits, chiffres identiques
    - `?lang=fr`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Tests de la FAQ
  - [x] 8.1 Créer `cypress/e2e/faq.cy.ts` (4 tests)
    - 9 questions visibles, aucune réponse dans le DOM
    - Ouverture : réponse visible, icône `−`
    - Fermeture : réponse retirée, icône `+`
    - `aria-expanded` `true` pour la question ouverte et `false` pour les 8 autres
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. Tests du tarif VESE
  - [x] 9.1 Créer `cypress/e2e/vese-tarif.cy.ts` (4 tests)
    - Remplacer le stub `find` : `gwr-lookup.json` si l'URL contient `gebaeude_wohnungs_register`, `identify-roofs.json` sinon
    - Appel `/muni` avec `idofs=351` (attendre `@identifyRequest`, deux `@findRequest`, puis `@veseMuniRequest`)
    - Fournisseur « BKW Energie AG » et tarif « 8.95 » en `cts/kWh`
    - Erreur 503 : `-` pour le tarif et le fournisseur, `kWh` toujours affiché
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.2 Ajouter le garde de sécurité de la clé VESE
    - Enregistrer toutes les requêtes avec un intercepteur `**` défini **après** `cy.interceptVese()`
    - Vérifier qu'au moins un appel de tarif existe, qu'aucun ne contient `licenseKey` et qu'aucun ne cible `opendata.vese.ch`
    - _Requirements: 8.4, 8.5_

- [x] 10. Point de contrôle : suite complète
  - 31/31 tests d'interface passent en local en environ 50 s

- [x] 11. Intégration CI
  - [x] 11.1 Créer `.github/workflows/lint-test-build.yml` (« Lint, Test & Build »)
    - Déclencheurs : pull request, et `workflow_call` (appelé par le déploiement du frontend à chaque push sur `main`)
    - Étapes : `npm ci`, `lint-check` (sans `--fix`), `type-check`, `build-only`, `test:e2e`
    - Artefact `cypress-artifacts` (`screenshots/` et `videos/`, 3 jours) si échec
    - Cache npm via `actions/setup-node`
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_

  - [x] 11.2 Conditionner le déploiement du frontend aux tests
    - `package-and-deploy-frontend.yml` (ancien `package-and-deploy.yml`) se déclenche à chaque push sur `main` et appelle d'abord `lint-test-build.yml` (job `checks`). Les jobs `build`, `archive` et `deploy` en dépendent. Il ne contient pas de copie des tests
    - _Requirements: 10.1, 10.2_

- [x] 12. Corrections de qualité
  - [x] 12.1 Rendre la suite conforme au lint et au type-check
    - Séparer les chaînes `.clear().type()` (`cypress/unsafe-to-chain-command`)
    - Ajouter `"types": ["cypress"]` à `tsconfig.cypress-ct.json`
    - Typer les commandes avec `Chainable<void>`
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 12.2 Réparer le test de sécurité VESE
    - L'intercepteur global doit être défini après les stubs, sinon il ne voit jamais les appels de tarif
    - _Requirements: 8.4, 8.5_

  - [x] 12.3 Aligner les assertions sur l'interface livrée
    - `mode-toggle.cy.ts` attend le titre « Information »
    - `language.cy.ts` attend un espace avant le `?` dans les titres français
    - Réécrire `selection-mode.cy.ts` pour les modes Unique et Multiple
    - _Requirements: 4.4, 5.1, 6.2_

- [x] 13. Supprimer les fixtures inutilisées
  - Supprimer `search-empty.json` et `error-500.json`, référencées par aucun test (les tests d'erreur définissent leur réponse en ligne)
  - _Requirements: 9.4_

- [x] 14. Ajouter les tests de logique de sélection
  - Créer `cypress/e2e/selection-logic.cy.ts` (9 tests, sans `cy.visit`) : import direct de `aggregateSurfaces` et `useMapStore`, Pinia neuf avant chaque test du store
  - Agrégation : sommes et irradiation pondérée, besoin de chaleur compté une fois par bâtiment, seuils de classe par couche (valeurs limites), répartition par classe, orientation et inclinaison pour une surface unique
  - Store : pas de doublon et toggle, mode Unique qui remplace, mode de sélection qui conserve la sélection et couche qui la vide, taux de couverture non plafonné et `null` sans besoin
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [ ]* 15. Couvrir les cas manquants (optionnel)
  - Sélection de deux surfaces différentes en mode Multiple dans l'interface (cumul, puis retrait par un second clic)
  - Langues italienne et anglaise
  - _Requirements: 5.5, 6.2_

- [ ]* 16. Vérifier les contours de sélection (optionnel)
  - Contrôler la présence d'une feature dans la couche de contours après un clic (couche OpenLayers, hors DOM)
  - _Requirements: 5.2_

## Notes

- Pas de test de propriété : la suite est basée sur des exemples et le design n'a pas de section Correctness Properties
- `selection-logic.cy.ts` s'exécute avec `cypress run --e2e` comme les autres. Les scripts `test:unit` (tests de composants) ne peuvent pas fonctionner en l'état, faute de fichiers de support
- Cypress appelle les gestionnaires `cy.intercept` dans l'ordre inverse de leur définition. Un intercepteur global se définit **après** les stubs
- Lint : `cypress/unsafe-to-chain-command` interdit de chaîner `.clear()` et `.type()`
- Les tests tournent en allemand (langue par défaut)
- `npm` s'exécute en local avec `npm.cmd` dans PowerShell (la politique d'exécution bloque `npm.ps1`)
- Le contrôle automatique des liens a été retiré (script `check-urls.mjs`, workflow `check-links.yml` et commandes `test:urls`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 2, "tasks": ["9.1", "9.2"] },
    { "id": 3, "tasks": ["11.1", "11.2"] },
    { "id": 4, "tasks": ["12.1", "12.2", "12.3", "13", "14"] }
  ]
}
```
