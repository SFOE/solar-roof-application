# Requirements Document

Modes de sélection (as-built)

## Introduction

Ce document décrit le système de sélection de Sonnendach **tel qu'il est livré**. La refonte était prévue avec deux modes cumulatifs « Bâtiment » et « Toiture ». Ce design **n'a pas été retenu**. Le produit final propose deux modes de clic, **Unique** et **Multiple**, qui travaillent tous deux à l'échelle d'une surface (un pan de toit ou une façade) et partagent une sélection unique.

- **Unique** (défaut) : chaque clic remplace la sélection. C'est le mode d'exploration.
- **Multiple** : chaque clic ajoute ou retire une surface. Il sert à cumuler les surfaces d'un bâtiment ou d'un quartier.

Contexte technique : Vue 3 + TypeScript + Pinia + OpenLayers + vue-i18n (DE/FR/IT/EN).

## Décisions abandonnées

- **Pas de mode « Bâtiment »** : aucune fonction `identifyBuilding` ni `toggleBuilding`, aucune clé `mode_building` ni `mode_roof`. Sélectionner un bâtiment entier n'est pas possible en un clic. L'utilisateur passe en mode Multiple et clique sur chaque surface.
- **Pas de type `'building' | 'roof'`** : `SelectionMode = 'single' | 'multi'`.
- **Pas de plafonnement à 100 %** du taux de couverture de la chaleur : une valeur supérieure à 100 % signifie que la surface peut produire plus de chaleur que le bâtiment n'en consomme.
- **Orientation affichée avec un libellé cardinal** (« -13° (Sud) ») et non en degrés bruts.
- **Pas de watcher sur le mode de sélection** : changer de mode ne recharge rien.

## Glossary

- **Surface** : un pan de toit ou une façade renvoyé par l'API swisstopo, identifié par un `featureId` unique.
- **Bâtiment** : ensemble des surfaces qui partagent un même `building_id`.
- **Couche** (`SolarMode`) : `roofs` (toitures) ou `facades` (façades).
- **Mode de sélection** (`SelectionMode`) : `single` (Unique) ou `multi` (Multiple).
- **Sélection** : l'ensemble des surfaces sélectionnées (`selectedSurfaces`), unique par `featureId`.
- **Meilleur pan** : la surface d'un bâtiment dont l'irradiation par m² (`mstrahlung`) est la plus élevée. En cas d'égalité, celle de plus grande superficie (`flaeche`).

## Requirements

### Requirement 1: Deux modes de sélection

**User Story:** En tant qu'utilisateur, je veux choisir entre explorer une surface à la fois et cumuler plusieurs surfaces, afin d'adapter l'outil à mon besoin.

#### Acceptance Criteria

1. WHEN l'application se charge, THE système SHALL proposer exactement deux modes de sélection, « Unique » et « Multiple », dans le composant `SelectionModeToggle` sous le libellé « Mode de sélection »
2. WHEN l'application se charge, THE système SHALL activer le mode « Unique » par défaut
3. WHEN l'utilisateur clique sur un bouton de mode, THE système SHALL activer ce mode et déplacer l'indicateur glissant rouge. Le bouton actif est en blanc et en gras
4. THE système SHALL définir `SelectionMode = 'single' | 'multi'`
5. THE système SHALL NE PAS proposer de mode « Bâtiment »

### Requirement 2: Mode Unique (exploration)

**User Story:** En tant qu'utilisateur, je veux qu'un clic affiche immédiatement les données de la surface visée, afin d'explorer la carte.

#### Acceptance Criteria

1. WHEN l'utilisateur clique sur la carte en mode Unique, THE système SHALL remplacer la sélection par la surface identifiée (`selectSingle`)
2. WHEN la sélection est remplacée, THE système SHALL effacer les contours précédents, dessiner celui de la nouvelle surface et recentrer la vue sur elle
3. WHILE le mode Unique est actif, THE système SHALL NE PAS afficher le bouton « Nouvelle sélection »
4. WHEN l'utilisateur recommence à cliquer en mode Unique avec plusieurs surfaces déjà sélectionnées, THE système SHALL les remplacer toutes par la surface cliquée

### Requirement 3: Mode Multiple (cumul)

**User Story:** En tant qu'utilisateur, je veux ajouter plusieurs surfaces à ma sélection, afin d'évaluer le potentiel d'un bâtiment complet ou d'un quartier.

#### Acceptance Criteria

1. WHEN l'utilisateur clique sur une surface non sélectionnée en mode Multiple, THE système SHALL l'ajouter à la sélection (`toggleSurface` renvoie `added`), dessiner son contour et recentrer la vue
2. WHEN l'utilisateur clique sur une surface déjà sélectionnée, THE système SHALL la retirer de la sélection (`removed`) et supprimer son contour
3. WHEN la même surface est ajoutée plusieurs fois, THE système SHALL la compter une seule fois (déduplication par `featureId`)
4. WHEN la sélection change, THE système SHALL mettre à jour l'InfoPanel et la SummaryBanner

### Requirement 4: Identification de la surface au clic et à la recherche

**User Story:** En tant qu'utilisateur, je veux qu'un clic proche d'une surface ou une recherche d'adresse sélectionne la bonne surface, afin de ne pas devoir viser au pixel près.

#### Acceptance Criteria

1. WHEN l'utilisateur clique sur la carte, THE système SHALL appeler `identifySurface` (API `identify`, tolérance de 2 px, une seule surface, géométrie GeoJSON)
2. IF le clic ne touche aucune surface précise, THEN THE système SHALL appeler `identifyBestRoof` : un `identify` de tolérance 10 pour les toitures ou 40 pour les façades, puis un `find` de toutes les surfaces du bâtiment (`building_id`), puis le choix du meilleur pan
3. WHEN une recherche d'adresse aboutit, THE système SHALL toujours utiliser `identifyBestRoof`
4. WHERE le meilleur pan est requis, THE système SHALL retenir la surface au `mstrahlung` maximal et, en cas d'égalité, à la `flaeche` maximale (fonction interne `pickBestRoof`)
5. WHEN la surface est sélectionnée, THE système SHALL appeler `lookupAddressCommune` (GWR) pour obtenir l'adresse, la commune (`ggdenr`) et le code postal. La recherche passe d'abord par l'EGID, puis, à défaut, par le `building_id`
6. IF l'adresse vient de la recherche, THEN THE système SHALL la conserver plutôt que celle du GWR
7. IF aucune surface n'est trouvée et que la sélection est vide, THEN THE système SHALL positionner `noData` et afficher le panneau « pas de données »
8. IF aucune surface n'est trouvée et que la sélection n'est pas vide, THEN THE système SHALL conserver la sélection actuelle
9. WHILE l'identification est en cours, THE système SHALL positionner `loading` et afficher l'indicateur de chargement

### Requirement 5: Persistance de la sélection

**User Story:** En tant qu'utilisateur, je veux garder ma sélection quand je change de mode, afin de ne pas repartir de zéro.

#### Acceptance Criteria

1. WHEN l'utilisateur change de mode de sélection, THE système SHALL conserver la sélection, les contours et l'agrégation affichée (`setSelectionMode` ne vide rien)
2. WHEN l'utilisateur clique après un changement de mode, THE système SHALL appliquer le comportement du mode actif à la sélection existante
3. WHEN l'utilisateur change de couche (toitures et façades), THE système SHALL vider la sélection et les contours (`setSolarMode` appelle `clearSelection`), car les `featureId` diffèrent d'une couche à l'autre
4. WHEN la couche change, THE système SHALL remplacer la couche de tuiles solaires de la carte

### Requirement 6: Agrégation unifiée

**User Story:** En tant qu'utilisateur, je veux voir un seul total pour toutes mes surfaces sélectionnées, afin d'obtenir le potentiel global.

#### Acceptance Criteria

1. WHEN la sélection contient au moins une surface, THE système SHALL calculer une agrégation unique (`aggregated`) consommée par l'InfoPanel et la SummaryBanner
2. THE système SHALL sommer les grandeurs additives : surface, rendement électrique (annuel, été, hiver), rendement financier, rendement thermique, surface de capteurs, volume de stockage et irradiation totale
3. THE système SHALL calculer l'irradiation par m² comme moyenne pondérée par la surface
4. THE système SHALL calculer la classe d'aptitude à partir de cette moyenne, avec des seuils par couche : toitures 800, 1000, 1200 et 1400 kWh/m²/an ; façades 600, 800, 1000 et 1200 kWh/m²/an
5. THE système SHALL calculer la répartition par classe (1 à 5) en pourcentage de la surface
6. THE système SHALL dédupliquer les besoins de chaleur (chauffage et eau chaude) par `buildingId`, car ces valeurs sont celles du bâtiment et sont répétées sur chacune de ses surfaces
7. WHEN la sélection est vide, THE système SHALL ne rien afficher (`aggregated` vaut `null`)
8. THE fonction `aggregateSurfaces` SHALL être exportée par le store

### Requirement 7: Contour de sélection

**User Story:** En tant qu'utilisateur, je veux voir le contour des surfaces sélectionnées sans masquer leurs couleurs d'aptitude.

#### Acceptance Criteria

1. THE système SHALL tracer uniquement le contour de chaque surface sélectionnée, sans remplissage
2. THE système SHALL dessiner un trait blanc de 5 px sous un trait rouge `#d32f2f` de 2,5 px, pour le contraste
3. WHEN une surface est retirée en mode Multiple, THE système SHALL supprimer son contour (recherche par `featureId`)
4. WHEN la couche change, THE système SHALL effacer tous les contours
5. IF la géométrie d'une surface est illisible, THEN THE système SHALL afficher les données sans contour

### Requirement 8: Orientation et inclinaison

**User Story:** En tant qu'utilisateur qui analyse un pan de toit, je veux voir son orientation et son inclinaison.

#### Acceptance Criteria

1. WHEN la sélection contient exactement une surface, THE InfoPanel SHALL afficher l'orientation (`ausrichtung`) et l'inclinaison (`neigung`) dans la section « Données générales »
2. WHEN la sélection contient plusieurs surfaces, THE InfoPanel SHALL masquer ces deux lignes
3. THE InfoPanel SHALL afficher l'orientation en degrés **avec un libellé cardinal**, par exemple « -13° (Sud) », avec les clés `cardinal_n`, `cardinal_ne`, `cardinal_e`, `cardinal_se`, `cardinal_s`, `cardinal_sw`, `cardinal_w` et `cardinal_nw`
4. THE système SHALL suivre la convention Sonnendach : 0° = sud, valeurs négatives = est, valeurs positives = ouest, ±180° = nord. Les secteurs font 45° de large, centrés sur les points cardinaux
5. THE InfoPanel SHALL afficher l'inclinaison en degrés arrondis (« 30° »)
6. IF `ausrichtung` ou `neigung` est absent de la réponse, THEN THE InfoPanel SHALL afficher `-` sans erreur

### Requirement 9: Bannière de synthèse

**User Story:** En tant qu'utilisateur, je veux voir l'aptitude globale et le potentiel économique avant le détail, afin de comprendre tout de suite l'intérêt de l'installation.

#### Acceptance Criteria

1. WHEN la sélection n'est pas vide, THE système SHALL afficher la SummaryBanner entre la carte et l'InfoPanel
2. THE SummaryBanner SHALL afficher l'aptitude globale avec la couleur de la classe (1 `#4fc3f7`, 2 `#fdd835`, 3 `#ff8f00`, 4 `#e65100`, 5 `#b71c1c`) et un fond très clair de cette couleur
3. THE SummaryBanner SHALL afficher le potentiel photovoltaïque : « Jusqu'à X CHF/an de rendement financier grâce au photovoltaïque... », avec X = somme des rendements financiers (`finanzertrag`). Ce champ vaut exactement 0,10 CHF par kWh produit : l'OFEN applique 10 centimes par kWh à toute la production annuelle, en mélangeant l'autoconsommation (jusqu'à 20 centimes économisés par kWh) et l'injection (le plus souvent sous 10 centimes). Ce n'est donc ni une économie pure ni un revenu d'injection pur, et le texte n'emploie ni « économies » ni « revenus »
4. WHERE le taux de couverture est calculable, THE SummaryBanner SHALL ajouter « ou jusqu'à Y % des besoins de chaleur couverts par le solaire thermique »
5. THE système SHALL calculer Y comme `Σ waermeertrag / (Σ bedarf_heizung + Σ bedarf_warmwasser)`, arrondi, avec des besoins dédupliqués par bâtiment, **sans plafond à 100 %**
6. IF le dénominateur est nul, THEN THE SummaryBanner SHALL masquer le volet chaleur (`heatCoveragePercent = null`) et afficher uniquement le volet photovoltaïque
7. WHEN le taux de couverture n'est pas nul, THE InfoPanel SHALL aussi l'afficher dans la section thermique (« Couverture des besoins »)
8. THE SummaryBanner SHALL s'appliquer de la même façon aux toitures et aux façades

### Requirement 10: Réinitialisation

**User Story:** En tant qu'utilisateur, je veux vider ma sélection en un clic, afin de recommencer.

#### Acceptance Criteria

1. WHILE le mode Multiple est actif et que la sélection n'est pas vide, THE système SHALL afficher le bouton « Nouvelle sélection » (bordure rouge) en haut à droite de la carte
2. WHEN l'utilisateur clique dessus, THE système SHALL vider la sélection, supprimer tous les contours et vider l'InfoPanel et la SummaryBanner (`clearSelection` remet aussi `clickCoords` à `null` et `noData` à `false`)
3. WHILE la sélection est vide, OR WHILE le mode Unique est actif, THE système SHALL masquer le bouton

### Requirement 11: InfoPanel

**User Story:** En tant qu'utilisateur, je veux un panneau de détail cohérent pour une ou plusieurs surfaces.

#### Acceptance Criteria

1. THE InfoPanel SHALL lire `store.aggregated` et afficher le titre « Information » (`info_selection_title`)
2. WHEN la sélection contient plus d'une surface, THE InfoPanel SHALL ajouter le nombre de surfaces à côté du titre (« (3 Surfaces de toit) »)
3. WHEN une adresse est connue, THE InfoPanel SHALL l'ajouter au titre
4. THE InfoPanel SHALL afficher trois sections : Général (aptitude, répartition, surface, irradiation, orientation et inclinaison pour une surface), Photovoltaïque (rendements, rendement financier, tarif VESE, fournisseur) et Solaire thermique (rendement, besoins, couverture, capteurs, stockage)
5. THE InfoPanel SHALL colorer sa bordure et ses icônes selon la classe d'aptitude globale
6. THE InfoPanel SHALL proposer le lien vers le calculateur solaire de SuisseEnergie. Pour une seule surface de toiture, le lien est prérempli (code postal, coordonnées LV03, inclinaison, orientation, besoin d'eau chaude, identifiant du toit, surface)
7. WHILE `loading` est vrai, THE InfoPanel SHALL afficher « Laden » ; WHILE `noData` est vrai, THE InfoPanel SHALL afficher le panneau « pas de données » avec le lien vers la FAQ

### Requirement 12: Traductions

**User Story:** En tant qu'utilisateur d'une des quatre langues nationales, je veux une interface traduite.

#### Acceptance Criteria

1. THE système SHALL fournir dans `de`, `fr`, `it` et `en` les clés : `mode_selection_label`, `mode_single`, `mode_multi`, `mode_new_selection`, `info_selection_title`, `info_surfaces`, `info_orientation`, `info_inclination`, `info_heat_coverage`, `cardinal_*`, `summary_suitability`, `summary_pv` et `summary_heat`
2. THE système SHALL NE PAS conserver de clé liée à un mode « Bâtiment » ou « Toiture » de sélection. Les clés `mode_roofs` et `mode_facades` désignent la couche et restent
3. THE système SHALL utiliser le titre unique « Information » pour toute sélection, plutôt que des titres distincts pour une et plusieurs surfaces
4. THE système SHALL traduire aussi l'attribution de la carte (`map_attribution`), les fonds de carte (`basemap_satellite`, `basemap_grey`), le libellé d'effacement de la recherche (`search_clear`) et le libellé du sélecteur de langue (`language_label`)

### Requirement 13: Non-régression et tests

**User Story:** En tant que mainteneur, je veux que le système de sélection reste couvert par des tests.

#### Acceptance Criteria

1. THE système SHALL continuer à localiser et identifier un bâtiment après une recherche d'adresse, à obtenir l'adresse et la commune par le GWR, puis à récupérer le tarif VESE
2. THE fichier `cypress/e2e/selection-mode.cy.ts` SHALL vérifier : le toggle affiché avec « Einzeln » actif, le clic carte et l'InfoPanel, la SummaryBanner avec « CHF », l'absence du bouton d'effacement en mode Unique, le bouton « Neue Auswahl » en mode Multiple et l'effacement de la sélection
3. THE fichier `cypress/e2e/selection-logic.cy.ts` SHALL vérifier, sans ouvrir de page, `aggregateSurfaces` (sommes, irradiation pondérée, besoins de chaleur comptés une fois par bâtiment, seuils de classe par couche, répartition par classe, orientation pour une surface unique) et le store (unicité, toggle, mode Unique qui remplace, mode de sélection qui conserve et couche qui vide, taux de couverture non plafonné)
4. THE tests `mode-toggle.cy.ts` et `language.cy.ts` SHALL refléter les libellés livrés
5. THE système SHALL NE PAS conserver le type `Coordinates`, les alias `RoofData` et `FacadeData`, ni le champ `lastBuildingId` du store (supprimés comme code mort)

## Écarts connus

- Le mode Multiple n'est pas testé avec deux surfaces différentes, ni le retrait d'une surface par un second clic.
- `pickBestRoof` (interne au composable, qui importe axios et OpenLayers) et `fmtOrientation` (dans le composant `InfoPanel`) n'ont pas de test. Les fixtures n'ont ni `ausrichtung` ni `neigung`, donc l'affichage de l'orientation avec son libellé cardinal n'est pas testé.
- Le paragraphe 1 de `faq_a5` (4 langues) dit que l'estimation financière « correspond au tarif de rétribution pour l'énergie injectée » d'une installation de 10 kVA. C'est inexact : `finanzertrag` vaut 0,10 CHF par kWh produit, une hypothèse de l'OFEN qui mélange autoconsommation et injection. Le tarif de 10 kVA est celui du tarif VESE affiché dans l'InfoPanel. Le texte n'a pas été modifié.
- En mode Unique, si des surfaces sont restées sélectionnées depuis le mode Multiple, l'InfoPanel les agrège jusqu'au prochain clic.
