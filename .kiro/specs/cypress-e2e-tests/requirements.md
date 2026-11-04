# Requirements Document

## Introduction

Ce document décrit, tel que livré, la suite de tests end-to-end (E2E) Cypress de l'application Sonnendach. L'application affiche le potentiel solaire des bâtiments suisses : recherche d'adresses, clic sur la carte, sélection de surfaces (toitures ou façades), données photovoltaïques et thermiques, tarif de rachat VESE, changement de langue et FAQ.

La suite compte **8 fichiers de tests et 40 tests** : 31 tests d'interface et 9 tests de logique pure (store de sélection), qui n'ouvrent aucune page. Elle s'appuie sur l'interception réseau de Cypress (`cy.intercept()`) pour les API externes (geo.admin.ch, VESE), de sorte que les tests sont rapides et déterministes. Elle s'exécute à chaque push et à chaque pull request, dans le workflow `lint-test-build.yml`.

## Glossary

- **Test_Suite**: L'ensemble des fichiers de tests Cypress E2E du répertoire `cypress/e2e/`
- **Cypress_Runner**: Le framework Cypress (v15+) configuré dans `cypress.config.ts`
- **API_Intercept**: Le mécanisme `cy.intercept()` qui remplace un appel réseau par une fixture
- **SearchBar**: Le composant de recherche d'adresses (API swisstopo SearchServer)
- **InfoPanel**: Le panneau de détail (classe `.info-panel`) qui affiche les données agrégées de la sélection
- **SummaryBanner**: La bannière de synthèse (classe `.summary-banner`) entre la carte et l'InfoPanel
- **ModeToggle**: Le basculement de couche Toitures / Façades (classe `.mode-toggle`)
- **SelectionModeToggle**: Le basculement du mode de sélection Unique / Multiple (classe `.selection-toggle`)
- **LanguageSwitcher**: Le sélecteur de langue (DE/FR/IT/EN)
- **FaqSection**: La section FAQ avec accordéon
- **Fixture**: Un fichier JSON de réponse API simulée dans `cypress/fixtures/`
- **Proxy_VESE**: Le Lambda (proxy en dev via Vite) qui appelle l'API VESE avec la clé stockée dans AWS Secrets Manager. Le navigateur ne connaît jamais cette clé.
- **Preview_Server**: Le serveur `vite preview` sur `http://localhost:4173`, cible des tests

## Requirements

### Requirement 1: Structure et exécution de la suite

**User Story:** En tant que développeur, je veux une suite Cypress qui s'exécute d'une seule commande, afin de la lancer de façon fiable en local et en CI.

#### Acceptance Criteria

1. THE Test_Suite SHALL contenir les répertoires `cypress/e2e/` (un fichier par fonctionnalité), `cypress/fixtures/` et `cypress/support/` (`commands.ts`, `intercepts.ts`, `e2e.ts`)
2. WHEN `npm run test:e2e` est exécuté, THE Cypress_Runner SHALL démarrer le Preview_Server, attendre `http://localhost:4173` et exécuter tous les tests sans intervention (via `start-server-and-test`)
3. THE Cypress_Runner SHALL utiliser le `baseUrl` `http://localhost:4173` et le pattern `cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}`
4. THE Test_Suite SHALL fixer le viewport à 1280x720 pour tous les tests (hook global dans `e2e.ts`)
5. THE Test_Suite SHALL comporter 8 fichiers : `faq`, `language`, `map-click`, `mode-toggle`, `search`, `selection-logic`, `selection-mode`, `vese-tarif`

### Requirement 2: Tests de la recherche d'adresses

**User Story:** En tant que développeur, je veux des tests E2E de la recherche d'adresses, afin de vérifier le flux recherche, sélection et identification.

#### Acceptance Criteria

1. WHEN un utilisateur tape au moins 2 caractères, THE Test_Suite SHALL vérifier que SearchServer est appelé avec `searchText`, `type=locations`, `sr=2056` et `limit=5`
2. WHEN l'API retourne des résultats, THE Test_Suite SHALL vérifier que la liste affiche les 5 adresses de la fixture
3. WHEN un utilisateur sélectionne une adresse, THE Test_Suite SHALL vérifier que l'identification (`MapServer/identify`) est déclenchée
4. WHEN un utilisateur sélectionne une adresse, THE Test_Suite SHALL vérifier que l'InfoPanel affiche les données solaires et le badge de classe 5
5. IF SearchServer retourne une erreur 500, THEN THE Test_Suite SHALL vérifier que l'application ne plante pas et que la liste reste vide

### Requirement 3: Tests du clic carte et de l'affichage des données

**User Story:** En tant que développeur, je veux des tests E2E du clic sur la carte, afin de vérifier l'identification et l'affichage des données.

#### Acceptance Criteria

1. WHEN un utilisateur clique sur la carte, THE Test_Suite SHALL vérifier que l'API `MapServer/identify` de geo.admin.ch est appelée
2. WHEN l'identification retourne des données, THE Test_Suite SHALL vérifier que l'InfoPanel affiche trois sections (Allgemein, Photovoltaik, Solarthermie) avec des valeurs en `kWh` et `m²`
3. WHEN la classe d'aptitude est 5, THE Test_Suite SHALL vérifier que le badge porte la classe CSS `badge-5`
4. WHEN la réponse est retardée, THE Test_Suite SHALL vérifier que l'indicateur de chargement (`.info-panel.loading`, texte « Laden ») est visible, puis disparaît
5. IF l'identification ne retourne aucune donnée, THEN THE Test_Suite SHALL vérifier que le panneau « pas de données » (`.info-panel.no-data`, « Keine Daten verfügbar ») est affiché

### Requirement 4: Tests du basculement de couche (Toitures / Façades)

**User Story:** En tant que développeur, je veux des tests E2E du basculement de couche, afin de vérifier que la carte et les données suivent la couche choisie.

#### Acceptance Criteria

1. THE Test_Suite SHALL vérifier que la couche « Dach » (toitures) est active par défaut
2. WHEN un utilisateur clique sur « Fassade », THE Test_Suite SHALL vérifier que « Fassade » devient actif et « Dach » inactif
3. WHEN la couche Façades est active et qu'une surface est identifiée (fixture `identify-facades.json`), THE Test_Suite SHALL vérifier que l'InfoPanel affiche les données de façade
4. WHEN un utilisateur change de couche avec une sélection active, THE Test_Suite SHALL vérifier que la sélection est effacée : l'InfoPanel détaillé et le bouton « Nouvelle sélection » disparaissent. L'InfoPanel affichait avant le basculement le titre « Information »

### Requirement 5: Tests du mode de sélection (Unique / Multiple)

**User Story:** En tant que développeur, je veux des tests E2E du mode de sélection, afin de vérifier le comportement des deux modes livrés.

#### Acceptance Criteria

1. THE Test_Suite SHALL vérifier que le SelectionModeToggle est affiché avec « Einzeln » (unique) actif par défaut et « Mehrfach » (multiple) inactif
2. WHEN un utilisateur clique sur la carte en mode Unique, THE Test_Suite SHALL vérifier que l'InfoPanel affiche le titre « Information » et des valeurs en `kWh`
3. WHEN une surface est sélectionnée, THE Test_Suite SHALL vérifier que la SummaryBanner est visible et contient « CHF »
4. WHILE le mode Unique est actif, THE Test_Suite SHALL vérifier que le bouton « Nouvelle sélection » (`.clear-selection-btn`) n'existe pas
5. WHEN un utilisateur passe en mode Multiple et sélectionne une surface, THE Test_Suite SHALL vérifier que le bouton « Neue Auswahl » est visible. Un clic dessus doit supprimer l'InfoPanel détaillé et la SummaryBanner

### Requirement 6: Tests du changement de langue

**User Story:** En tant que développeur, je veux des tests E2E du changement de langue, afin de vérifier la traduction de l'interface.

#### Acceptance Criteria

1. THE Test_Suite SHALL vérifier que l'allemand est la langue par défaut (titre, placeholder « Adresse suchen... », sélecteur sur `de`)
2. WHEN un utilisateur choisit le français, THE Test_Suite SHALL vérifier la traduction du titre (avec l'espace avant le `?`), du placeholder « Rechercher une adresse... » et des boutons « Toiture » et « Façade »
3. WHEN la langue change alors que des données sont affichées, THE Test_Suite SHALL vérifier que les libellés de l'InfoPanel sont traduits et que les valeurs numériques restent identiques
4. WHEN l'URL contient `?lang=fr`, THE Test_Suite SHALL vérifier que l'application se charge en français, sélecteur sur `fr`

### Requirement 7: Tests de la FAQ

**User Story:** En tant que développeur, je veux des tests E2E de la FAQ, afin de vérifier l'accordéon et son accessibilité.

#### Acceptance Criteria

1. THE Test_Suite SHALL vérifier que les 9 questions sont visibles au chargement et qu'aucune réponse n'est dans le DOM
2. WHEN un utilisateur clique sur une question, THE Test_Suite SHALL vérifier que la réponse apparaît et que l'icône passe de `+` à `−`
3. WHEN un utilisateur clique à nouveau, THE Test_Suite SHALL vérifier que la réponse disparaît et que l'icône revient à `+`
4. THE Test_Suite SHALL vérifier que `aria-expanded` vaut `true` pour la question ouverte et `false` pour toutes les autres

### Requirement 8: Tests du tarif VESE

**User Story:** En tant que développeur, je veux des tests E2E du tarif VESE, afin de vérifier son affichage et la protection de la clé API.

#### Acceptance Criteria

1. WHEN une surface est identifiée et que le lookup GWR retourne la commune, THE Test_Suite SHALL vérifier que l'appel `/muni` contient `idofs=351`
2. WHEN le Proxy_VESE retourne un tarif, THE Test_Suite SHALL vérifier que l'InfoPanel affiche le fournisseur « BKW Energie AG » et le tarif « 8.95 » en `cts/kWh` (énergie 8.45 plus écologique 0.50)
3. IF le Proxy_VESE retourne une erreur 503, THEN THE Test_Suite SHALL vérifier que le tarif et le fournisseur valent « - » et que les autres données restent affichées
4. THE Test_Suite SHALL vérifier qu'aucune requête de tarif du navigateur ne contient `licenseKey` et qu'aucune n'appelle directement `opendata.vese.ch`
5. WHERE le test de sécurité enregistre toutes les requêtes avec un intercepteur `**`, THE Test_Suite SHALL définir cet intercepteur **après** les stubs VESE, car Cypress appelle les gestionnaires dans l'ordre inverse de leur définition

### Requirement 9: Fixtures et interception réseau

**User Story:** En tant que développeur, je veux des fixtures et une stratégie d'interception, afin que les tests soient rapides et indépendants des API externes.

#### Acceptance Criteria

1. THE Test_Suite SHALL intercepter tous les appels à `api3.geo.admin.ch` (`SearchServer`, `MapServer/identify`, `MapServer/find`) et les remplacer par des fixtures
2. THE Test_Suite SHALL intercepter les appels VESE par les expressions `/\/muni\?/` et `/\/evu\?/`, qui couvrent le proxy Vite en dev et l'URL du Lambda en production
3. THE Test_Suite SHALL intercepter les tuiles WMTS (`**/wmts/**`) dans le hook global, pour éviter le bruit réseau
4. THE Test_Suite SHALL fournir 7 fixtures, toutes utilisées par au moins un test : `search-results`, `identify-roofs`, `identify-facades`, `identify-empty`, `gwr-lookup`, `vese-muni`, `vese-evu`
5. THE Test_Suite SHALL utiliser les noms de champs réels de l'API swisstopo, en allemand (`flaeche`, `klasse`, `mstrahlung`, `stromertrag`, `building_id`, `gwr_egid`, ...)
6. WHEN les fixtures sont utilisées, THE Cypress_Runner SHALL exécuter la suite complète en moins de 60 secondes (environ 50 s mesurées en local)

### Requirement 10: Intégration CI/CD

**User Story:** En tant que développeur, je veux que les tests s'exécutent à chaque push, afin de voir les problèmes et corrections en amont du déploiement.

#### Acceptance Criteria

1. WHEN une pull request est ouverte, THE workflow `lint-test-build.yml` (« Lint, Test & Build ») SHALL s'exécuter seul, dans l'ordre : `npm ci`, `lint-check`, `type-check`, `build-only`, `test:e2e`
2. WHEN un push est fait sur `main`, THE workflow de déploiement du frontend (`package-and-deploy-frontend.yml`) SHALL appeler `lint-test-build.yml` en premier (`workflow_call`) et SHALL NE PAS construire ni déployer si ce workflow échoue. Les tests ne sont ainsi définis qu'une fois et s'exécutent une seule fois par push
3. THE Test_Suite SHALL s'exécuter en mode headless (`cypress run --e2e`)
4. IF un test échoue en CI, THEN THE workflow SHALL publier `cypress/screenshots/` et `cypress/videos/` comme artefact `cypress-artifacts` (rétention 3 jours)
5. THE workflow SHALL utiliser le cache npm de `actions/setup-node`
6. THE workflow SHALL lancer le lint en vérification seule (`lint-check`, sans `--fix`)

### Requirement 11: Qualité du code des tests

**User Story:** En tant que mainteneur, je veux que les tests respectent le lint et le type-check du projet, afin que la CI reste verte.

#### Acceptance Criteria

1. THE Test_Suite SHALL respecter la règle `cypress/unsafe-to-chain-command` : `.clear()` et `.type()` ne sont pas chaînés
2. THE Test_Suite SHALL typer les commandes personnalisées avec `Chainable<void>`
3. THE projet SHALL fournir `tsconfig.cypress-ct.json` avec `"types": ["cypress"]`, faute de quoi le type-check échoue (303 erreurs avant ce correctif)
4. THE Test_Suite SHALL privilégier des assertions sur les classes CSS et les attributs (`badge-5`, `active`, `aria-expanded`) plutôt que sur les styles calculés

### Requirement 12: Tests de la logique de sélection

**User Story:** En tant que développeur, je veux tester les règles de calcul de la sélection sans ouvrir de page, afin de les vérifier vite et précisément.

#### Acceptance Criteria

1. THE fichier `cypress/e2e/selection-logic.cy.ts` SHALL importer directement `aggregateSurfaces` et `useMapStore` (sans `cy.visit`, avec un Pinia neuf avant chaque test du store) et contenir 9 tests
2. THE Test_Suite SHALL vérifier la somme des grandeurs additives et l'irradiation moyenne pondérée par la surface
3. THE Test_Suite SHALL vérifier que le besoin de chaleur d'un bâtiment n'est compté qu'une fois, quel que soit le nombre de ses surfaces sélectionnées
4. THE Test_Suite SHALL vérifier les seuils de classe de chaque couche : toitures 800, 1000, 1200 et 1400 ; façades 600, 800, 1000 et 1200 (valeurs limites incluses)
5. THE Test_Suite SHALL vérifier la répartition de la surface par classe, et que l'orientation et l'inclinaison ne sont conservées que pour une surface unique
6. THE Test_Suite SHALL vérifier qu'une surface n'est jamais présente deux fois, que `toggleSurface` renvoie `added` puis `removed`, et que `selectSingle` remplace toute la sélection
7. THE Test_Suite SHALL vérifier que changer de mode de sélection conserve la sélection et que changer de couche la vide
8. THE Test_Suite SHALL vérifier que le taux de couverture de la chaleur n'est pas plafonné (200 % dans le test) et vaut `null` sans besoin

## Écarts connus

- Les tests de l'interface tournent en allemand (langue par défaut). Seuls les tests de langue vérifient le français. Italien et anglais ne sont pas testés.
- Le clic carte vise un pixel fixe du canvas (`clickMap(400, 300)`). Les tuiles sont interceptées, donc la position ne correspond à aucun bâtiment réel : c'est le stub `identify` qui décide du résultat.
- La sélection multi-surfaces (deux clics sur des surfaces différentes) n'est pas couverte dans l'interface. Seul le cycle « sélectionner puis effacer » l'est. Le cumul est testé au niveau du store (`selection-logic.cy.ts`).
- Les contours sur la carte (couche OpenLayers) ne sont pas vérifiés.
- Les liens externes ne sont plus contrôlés automatiquement (le script `check-urls.mjs`, le workflow `check-links.yml` et les commandes `test:urls` ont été retirés).
- `pickBestRoof` (choix du meilleur pan) et `fmtOrientation` (libellé cardinal) ne sont pas testés : le premier est interne au composable, le second est dans le composant `InfoPanel`.
- Les scripts `test:unit` et `test:unit:dev` (tests de composants Cypress) ne peuvent pas fonctionner en l'état : `cypress/support/component.ts` et `component-index.html` n'existent pas. Aucun test de composant n'existe. Je n'ai pas lancé ces scripts pour le confirmer.
