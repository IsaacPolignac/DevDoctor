# Recherche 04 — Analyse image par image de 8 films premium (mesures)

*Complète les recherches 01 à 03. Ces dernières reposaient sur des sources écrites : YouTube étant bloqué, aucune vidéo n'avait pu être mesurée. Ici, **les fichiers vidéo ont été téléchargés depuis les serveurs officiels des marques** et chaque image a été analysée par programme, puis vérifiée à l'œil sur des planches contact.*
*Rédigé le 25/09/2026. Tous les outils, JSON et planches sont listés en annexe. Aucun fichier n'est commité.*

---

## 0. Corpus, méthode et limites

### 0.1 Films obtenus (fichiers réels, sources officielles)

| ID | Film | Durée | Cadence | Source (fichier) |
|---|---|---|---|---|
| A1 | **Apple — iPhone 18 Pro, film produit** (2026) | 172,4 s | 23,976 i/s | HLS officiel `apple.com/105/media/us/iphone-18-pro/2026/591df885-…/films/product/iphone-18-pro-product-tpl-us-2026_16x9.m3u8` (page apple.com/iphone-18-pro/) |
| A2 | **Apple — iPhone Air, film design** (2025, voix off de l'équipe design) | 144,7 s | 29,97 i/s | `…/iphone-air/2025/731189b1-…/films/product/iphone-air-product-tpl-us-2025_16x9.m3u8` |
| A3 | **Apple — MacBook Pro M5 Pro/Max, film produit** (2026) | 95,1 s | 23,976 i/s | `…/macbook-pro/2026/2a290130-…/films/product/macbook-pro-product-tpl-us-2026_16x9.m3u8` |
| A4 | **Apple — AirPods Pro 3, film produit** (2025) | 42,9 s | 30 i/s | `…/airpods-pro/2025/7acffb13-…/films/product/airpods-pro-product-tpl-us-2025_16x9.m3u8` |
| P1 | **Porsche × Hedley Studios — « The Porsche 550 Spyder: reimagined »** (14/09/2026). Produit seul, studio noir, aucune personne | 64,3 s | 25 i/s | Porsche NewsTV, `newstv.porsche.com/porschevideos/339619_en_3000000.mp4` |
| P2 | **Porsche — « HD Matrix Design »** (CG, phares, produit et lumière seuls) | 54,5 s | 25 i/s | `newstv.porsche.com/porschevideos/305642_en_3000000.mp4` |
| S1 | **Samsung — Galaxy S22 Ultra, spot TV** (Samsung UK, 2022) | 30,0 s | 25 i/s | Copie archive.org de l'upload officiel Samsung UK (`archive.org/details/youtube-l3RyWY_PXTw`) |
| B1 | **Bang & Olufsen — « Sound Elevated » 30 s** (nov. 2025), film de marque avec personnes | 30,0 s | 25 i/s | CDN officiel B&O (Contentful) : `videos.ctfassets.net/8cd2csgvqd3m/5x8gOCTYKsZp3X5w8VWd8/…/Sound_Elevated_Motion_30s_202511_16x9_.mp4` |
| N1 | **Nike — « Find Your Greatness »** (W+K, 2012). Compilation HD de 391,9 s ; le **manifeste « London » de 61 s (330,9 → 391,9 s)** a été analysé à part | 391,9 s | 23,976 i/s | archive.org `nikefindyourgreatnesshd` |

Les iPhone 17 Pro, Watch et Vision Pro ont été cherchés mais pas retenus : l'URL iPhone 17 Pro redirige vers /iphone/, les pages Watch n'ont pas de film produit et Vision Pro ne propose que des animations. Dyson, Samsung.com et Mercedes renvoient une erreur 403, le newsroom Samsung reste sans réponse et la page du newsroom Nike est générée en JS, sans fichier.

### 0.2 Chaîne de mesure (outils dans `/tmp/claude-0/refs/tools/`)

- **`analyze.py`** lit **chaque image** à la cadence native (≈ 26 000 images au total), ramenée à 320 px pour l'analyse. Pour chaque image, il calcule : la luminance moyenne et l'écart-type, la luminance des bords (pour déterminer le fond), la saturation, un histogramme HSV 16×4×8, l'écart absolu moyen (MAD) avec l'image précédente, le flux optique Farnebäck et un **modèle de similitude (translation, échelle, rotation) ajusté par moindres carrés robustes**. On en tire la vitesse de push-in en % d'échelle par seconde et le panoramique en % de largeur par seconde. Il relève aussi la densité de contours (centre et bas de l'image) et le **barycentre des hautes lumières** (pixels au-dessus du 99,5ᵉ centile), qui sert à mesurer les balayages de lumière.
- **`shots.py`** détecte trois choses. **Les cuts** : distance de Bhattacharyya entre histogrammes, supérieure à 2,5 × la médiane locale + 0,12, confirmée par le MAD. Un filtre élimine les faux cuts dus à un allumage de lumière : corrélation de structure > 0,88 avec un saut de luminance > 12. **Les fondus**, par un test de mélange : l'image du milieu est-elle ≈ (A+B)/2 ? **Les flashs et les noirs.**
- **`sheets.py` / `strip.py`** produisent les planches contact (première, milieu et dernière image de chaque plan) et des bandes image par image. Toutes ont été relues à l'œil.
- **`typetrack.py`** mesure l'entrée et la sortie des textes : fraction de pixels d'« encre » dans la zone du texte, image par image.
- **`audio.py` / `summary.py`** mesurent le flux spectral (onsets), le tempo, la sonie RMS par tranche de 100 ms, les silences et l'alignement cut/onset comparé à une base aléatoire (300 tirages). **Test de grille rythmique** : la phase des cuts est-elle concentrée sur une période donnée (vecteur de Rayleigh, comparé à une base nulle) ?
- **Voix off** : faster-whisper large-v3 avec horodatage au mot, recoupé avec les sous-titres WebVTT officiels d'Apple (téléchargés avec les HLS).

**Résolution** : 1 image vaut **41,7 ms** à 23,976 i/s, **40 ms** à 25 i/s et **33,3 ms** à 30 i/s. Tous les timecodes ci-dessous sont en ms depuis le début du fichier.

**Limites** (à lire avant les chiffres) :
1. **Précision de détection** : vérification visuelle de 3 films (A1, A4, P1) → ≈ 95 %. Deux types d'erreur subsistent. Des **faux cuts** sur des pulsations graphiques très rapides (A4 #3/#4). Des **cuts manqués** sur des « morphs » (enchaînements par déformation) volontairement invisibles d'Apple.
2. **Flux optique** : il mesure le mouvement de *l'image*, pas celui de la caméra. Quand un sujet bouge (danseuse, sportif), « parallax/orbit » signifie « mouvement interne ». Les vitesses de push-in ne sont fiables que sur les plans où le produit est immobile : c'est le cas de P1, P2, A2 et des inserts produit d'A1 et A3.
3. **Onsets** : le flux spectral détecte beaucoup d'événements (2 à 5 par seconde), si bien que « cut à ±1 image d'un onset » est souvent proche du hasard. Seuls les **onsets forts** (30 % les plus forts) et la **grille de tempo** sont discriminants.

---

## 1. Tableau de synthèse (mesuré)

| Film | Plans | Cuts/min | Durée de plan moy. / méd. (ms) | P10–P90 (ms) | % < 500 ms | % > 2 s | Plans « statiques » | Push-in méd. (%/s) | % d'images sombres (luma < 40) | Fondus | Grille rythmique des cuts |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 iPhone 18 Pro | 175 | 60,9 | 951 / **667** | 209–1868 | 34 % | 9 % | 42 % | 3,5 (P90 17,2) | 48 % | 10 | **aucune** (R = 0,15 < 0,22 nul) |
| A2 iPhone Air | 46 | 19,1 | 3132 / **2469** | 750–5873 | 7 % | 65 % | 57 % | 1,6 | 17 % | 3 + 2 noirs | aucune (0,38 < 0,43) |
| A3 MacBook Pro | 75 | 47,3 | 1267 / **959** | 433–2694 | 13 % | 21 % | 5 % | 4,5 (P90 28,5) | 16 % | 0 | limite (0,32 vs 0,31) |
| A4 AirPods Pro 3 | 24 | 33,6 | 1786 / **1250** | 343–4320 | 21 % | 33 % | 25 % | 4,7 | 0 % (monde blanc) | 1 | aucune |
| P1 Porsche 550 | 58 | 54,1 | 1070 / **760** | 228–2560 | 50 % | 17 % | 55 % | **1,0** (P90 1,7) | 58 % | 2 | **forte : grille de 428 ms = 140 BPM, 53 % des cuts à ±1 image (hasard 19 %)** |
| P2 Porsche HD Matrix | 7 | 7,7 | 3891 / 1440 | — | — | — | — | 2,8 | 94 % | 2 + 3 noirs | n/a |
| S1 Samsung S22 Ultra | 22 | 44,0 | 1134 / **900** | 160–2416 | 27 % | 23 % | 23 % | 2,7 | 47 % | 1 + 4 noirs | aucune |
| B1 B&O Sound Elevated | 27 | 54,0 | 1100 / **960** | 504–1920 | 11 % | 11 % | 19 % | 5,1 | 76 % | 1 | aucune |
| N1 Nike manifeste 61 s | 54 | 53,1 | 1129 / **980** | 430–1793 | — | — | — | 4,3 (compil.) | 2 % | 0 | aucune (VO + musique) |

**Lecture rapide** : il existe **deux registres Apple**. Le **film « design »** (A2) tient des plans de 2,5 s en médiane, 65 % d'entre eux dépassant 2 s. Le **film « tech/manifeste »** (A1, A3) monte à 0,67–0,96 s en médiane avec des rafales de 3 images. Le film produit pur de Porsche (P1) se situe entre les deux, **calé sur une grille musicale**. Apple, au contraire, **ne coupe pas sur une grille de tempo** : c'est le son qui est calé sur l'image (§ 3.8).

---

## 2. Fiches film par film

### 2.1 A1 — Apple iPhone 18 Pro (172,4 s, 175 plans)

**Structure mesurée** (voix off : 351 mots, **2,1 mots/s sur la durée parlée, 3,0 mots/s à l'intérieur des phrases**, 25 phrases de 3,7 s en médiane, **1,2 s de silence entre deux phrases**, voix présente 66 % du temps) :
- **0–9,0 s** : un seul plan de 9 009 ms (la Terre vue de la Lune) + VO « Once you've been to the moon… where do you go next? ». **L'ouverture la plus longue du film est son premier plan.**
- **9,0–11,5 s** : trois plans sombres (200–1 300 ms), puis **allumage d'un laboratoire blanc** en 4 plans : 250 → 167 → 250 ms. La lumière « s'allume » par cuts, comme on actionne des interrupteurs.
- **11,5–21 s** : vue éclatée des composants sur fond blanc (8 plans de 542 à 1 418 ms), puis **plans de puce dessinés en blueprint** (13 plans, médiane ≈ 420 ms) calés sur « You start with the chip… a new CPU core… GPU core ».
- **32,5–34,4 s** : **rafale des générations de puces A5 → A20 : 11 plans de 125–167 ms (3–4 images chacun)**, même cadrage, même lumière, seul le marquage change. C'est un « match-cut de série ». Il se termine sur A20 PRO tenu 1 043 ms.
- **38–47 s** : caméra thermique et chambre à vapeur (un plan de 3 003 ms), puis un **plan tenu de 7 883 ms** (carte-mère en lumière bleue, 47,5 s).
- **55–130 s** : preuves d'usage (personnes, extérieurs), inserts produit de 125 à 1 400 ms et quelques **longs plans d'ambiance de 2 à 3,6 s**.
- **160,6–170,0 s** : **la vue éclatée se réassemble** (3 plans de 1,7 à 2,6 s), le téléphone pivote, puis on passe au dos du téléphone de face sur un fond de bureau sombre. S'ensuit un **cycle des coloris en cuts secs sur un cadrage identique** : argent 667 ms → bleu 334 ms → orange 918 ms.
- **170,0–172,4 s** : **carton noir « iPhone 18 Pro »**, texte blanc de **4,0 % de la hauteur d'image** (≈ 18 % de la largeur), centré, avec les mentions légales en petit. Il apparaît en cut sec et reste **2 377 ms**. **Le nom du produit n'est jamais prononcé** : la VO finit sur « …and ask, "What's next?" » à 169,8 s, 0,2 s avant le carton.

**Mesures clés** : durée de plan médiane **521 ms** dans le premier tiers, **750 ms** dans les deux suivants. 34 % des plans font moins de 500 ms. Push-in médian 3,5 %/s, **P90 17 %/s** (inserts macro en rampe de vitesse, jusqu'à 31 %/s sur l'objectif, plan #89). 10 fondus enchaînés, tous courts. La musique est « Stampede » (Genesis Owusu) : sonie max P95 −14 dBFS, **pas de silence** dans le film, fin nette (dernière valeur audible à −45 dB à 172,25 s).

<details><summary>Table des plans (mesurée, 181 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→9009 | 9009 (216) | — | pull-out | -1.4 | mid/colour / 39 |  |
| 2 | 9009→9384 | 375 (9) | →noir | pull-out, roll | -1.5 | black / 6 |  |
| 3 | 9384→9551 | 167 (4) | cut | static | +0.1 | black / 7 |  |
| 4 | 9551→10844 | 1293 (31) | cut | static | +0.4 | black / 27 |  |
| 5 | 10844→11220 | 375 (9) | cut | static | -0.1 | mid/colour / 68 |  |
| 6 | 11220→11512 | 292 (7) | fondu 12 img | static | +0.1 | light / 126 |  |
| 7 | 11512→12095 | 584 (14) | cut | static | -0.0 | light / 159 |  |
| 8 | 12095→12638 | 542 (13) | cut | static | +0.0 | light / 136 |  |
| 9 | 12638→13597 | 959 (23) | cut | static | -0.0 | light / 142 |  |
| 10 | 13597→15015 | 1418 (34) | cut | pull-out, pan/track L, parallax/orbit | -3.3 | mid/colour / 129 |  |
| 11 | 15015→15974 | 959 (23) | cut | static | +0.0 | mid/colour / 171 |  |
| 12 | 15974→16183 | 209 (5) | cut | static | -0.1 | light / 194 |  |
| 13 | 16183→16808 | 626 (15) | cut | static | -0.0 | light / 194 |  |
| 14 | 16808→17059 | 250 (6) | cut | static | +0.0 | light / 195 |  |
| 15 | 17059→17643 | 584 (14) | cut | static | -0.0 | light / 190 |  |
| 16 | 17643→17935 | 292 (7) | cut | push-in, tilt/crane up, roll, parallax/orbit | +16.0 | light / 201 |  |
| 17 | 17935→18435 | 500 (12) | cut | static | -0.0 | light / 191 |  |
| 18 | 18435→18644 | 209 (5) | cut | static | -0.0 | mid/colour / 174 |  |
| 19 | 18644→19228 | 584 (14) | cut | static | -0.0 | mid/colour / 178 |  |
| 20 | 19228→21188 | 1960 (47) | cut | parallax/orbit | -0.0 | light / 185 |  |
| 21 | 21188→21522 | 334 (8) | cut | pull-out, tilt/crane down, roll, parallax/orbit | -3.7 | mid/colour / 122 |  |
| 22 | 21522→21939 | 417 (10) | cut | push-in, pan/track R, tilt/crane up, parallax/orbit | +9.3 | light / 198 |  |
| 23 | 21939→22147 | 209 (5) | cut | subtle drift | +0.1 | black / 13 |  |
| 24 | 22147→23857 | 1710 (41) | fondu 6 img | pull-out | -1.0 | black / 47 |  |
| 25 | 23857→24233 | 375 (9) | cut | push-in, parallax/orbit | +1.4 | black / 17 |  |
| 26 | 24233→24900 | 667 (16) | cut | pull-out, pan/track L, roll, parallax/orbit | -68.9 | mid/colour / 76 |  |
| 27 | 24900→25359 | 459 (11) | cut | pull-out, pan/track R, tilt/crane down, parallax/orbit | -77.7 | mid/colour / 64 |  |
| 28 | 25359→25859 | 500 (12) | cut | pull-out, pan/track L, tilt/crane down, roll, parallax/orbit | -50.8 | mid/colour / 40 |  |
| 29 | 25859→26818 | 959 (23) | cut | pull-out, roll, parallax/orbit | -1.6 | mid/colour / 27 |  |
| 30 | 26818→27653 | 834 (20) | cut | push-in | +2.3 | black / 31 |  |
| 31 | 27653→28862 | 1210 (29) | cut | static | +0.2 | black / 16 |  |
| 32 | 28862→30030 | 1168 (28) | cut | push-in, tilt/crane up, parallax/orbit | +27.2 | mid/colour / 100 |  |
| 33 | 30030→31490 | 1460 (35) | cut | push-in | +1.1 | mid/colour / 117 |  |
| 34 | 31490→32532 | 1043 (25) | cut | static | -0.2 | mid/colour / 83 |  |
| 35 | 32532→32699 | 167 (4) | cut | static | +0.1 | mid/colour / 71 |  |
| 36 | 32699→32824 | 125 (3) | cut | static | +0.0 | mid/colour / 50 |  |
| 37 | 32824→32950 | 125 (3) | cut | static | -0.0 | mid/colour / 77 |  |
| 38 | 32950→33075 | 125 (3) | cut | static | +0.1 | mid/colour / 81 |  |
| 39 | 33075→33200 | 125 (3) | cut | static | -0.1 | mid/colour / 48 |  |
| 40 | 33200→33408 | 209 (5) | cut | static | +0.1 | mid/colour / 90 |  |
| 41 | 33408→33575 | 167 (4) | cut | static | -0.1 | mid/colour / 71 |  |
| 42 | 33575→33700 | 125 (3) | cut | static | -0.1 | mid/colour / 55 |  |
| 43 | 33700→33867 | 167 (4) | cut | static | -0.2 | mid/colour / 80 |  |
| 44 | 33867→34034 | 167 (4) | cut | static | +0.2 | mid/colour / 84 |  |
| 45 | 34034→34368 | 334 (8) | cut | push-in | +2.8 | mid/colour / 110 |  |
| 46 | 34368→35410 | 1043 (25) | fondu 10 img | push-in | +3.5 | mid/colour / 115 |  |
| 47 | 35410→35744 | 334 (8) | cut | subtle drift | -0.7 | mid/colour / 63 |  |
| 48 | 35744→36411 | 667 (16) | cut | push-in | +6.2 | mid/colour / 84 |  |
| 49 | 36411→36620 | 209 (5) | cut | push-in | +4.6 | mid/colour / 127 |  |
| 50 | 36620→36954 | 334 (8) | fondu 10 img | push-in | +4.9 | mid/colour / 120 |  |
| 51 | 36954→37996 | 1043 (25) | cut | parallax/orbit | -0.7 | mid/colour / 100 |  |
| 52 | 37996→40999 | 3003 (72) | cut | push-in, tilt/crane down | +2.9 | mid/colour / 54 |  |
| 53 | 40999→41416 | 417 (10) | cut | push-in | +8.6 | light / 218 |  |
| 54 | 41416→41583 | 167 (4) | cut | push-in | +1.7 | light / 211 |  |
| 55 | 41583→42000 | 417 (10) | cut | push-in, roll | +9.3 | light / 220 |  |
| 56 | 42000→42584 | 584 (14) | cut | push-in, parallax/orbit | +2.2 | white / 221 |  |
| 57 | 42584→43377 | 792 (19) | cut | push-in | +1.3 | light / 159 |  |
| 58 | 43377→45379 | 2002 (48) | fondu 38 img | push-in, roll, parallax/orbit | +4.0 | mid/colour / 38 |  |
| 59 | 45379→46463 | 1084 (26) | cut | subtle drift | +0.3 | black / 17 |  |
| 60 | 46463→47506 | 1043 (25) | cut | pull-out, parallax/orbit | -2.9 | mid/colour / 79 |  |
| 61 | 47506→55389 | 7883 (189) | cut | pull-out | -2.6 | mid/colour / 56 |  |
| 62 | 55389→57307 | 1919 (46) | cut | static | -0.1 | mid/colour / 71 |  |
| 63 | 57307→58308 | 1001 (24) | cut | push-in, pan/track R, tilt/crane up, parallax/orbit | +1.1 | mid/colour / 58 |  |
| 64 | 58308→59184 | 876 (21) | cut | static | +0.1 | mid/colour / 64 |  |
| 65 | 59184→59810 | 626 (15) | cut | push-in | +3.6 | mid/colour / 71 |  |
| 66 | 59810→60560 | 751 (18) | cut | push-in | +1.6 | mid/colour / 82 |  |
| 67 | 60560→61311 | 751 (18) | fondu 33 img | push-in | +0.9 | mid/colour / 51 |  |
| 68 | 61311→62312 | 1001 (24) | cut | subtle drift | +0.7 | mid/colour / 79 |  |
| 69 | 62312→62771 | 459 (11) | cut | push-in, pan/track R, tilt/crane up, roll, parallax/orbit | +6.3 | mid/colour / 80 |  |
| 70 | 62771→62980 | 209 (5) | cut | push-in, tilt/crane down, roll, parallax/orbit | +4.7 | mid/colour / 109 |  |
| 71 | 62980→63188 | 209 (5) | cut | pull-out, tilt/crane up, roll, parallax/orbit | -3.1 | mid/colour / 92 |  |
| 72 | 63188→63564 | 375 (9) | cut | subtle drift | +0.5 | mid/colour / 90 |  |
| 73 | 63564→64106 | 542 (13) | cut | roll, parallax/orbit | +0.8 | mid/colour / 52 |  |
| 74 | 64106→64481 | 375 (9) | cut | push-in | +2.1 | mid/colour / 59 |  |
| 75 | 64481→65482 | 1001 (24) | cut | push-in, pan/track L, tilt/crane up, roll, parallax/orbit | +1.4 | mid/colour / 66 |  |
| 76 | 65482→66066 | 584 (14) | cut | push-in, roll, parallax/orbit | +3.1 | mid/colour / 137 |  |
| 77 | 66066→66483 | 417 (10) | cut | push-in, pan/track R | +7.8 | black / 44 |  |
| 78 | 66483→67317 | 834 (20) | cut | pull-out, parallax/orbit | -1.7 | mid/colour / 57 |  |
| 79 | 67317→68026 | 709 (17) | cut | push-in, tilt/crane down, parallax/orbit | +3.5 | mid/colour / 76 |  |
| 80 | 68026→68777 | 751 (18) | cut | static | -0.0 | mid/colour / 40 |  |
| 81 | 68777→69695 | 918 (22) | cut | parallax/orbit | +0.1 | mid/colour / 80 |  |
| 82 | 69695→72281 | 2586 (62) | cut | push-in | +1.4 | black / 15 |  |
| 83 | 72281→72447 | 167 (4) | cut | push-in, pan/track L, roll, parallax/orbit | +16.5 | light / 203 |  |
| 84 | 72447→72572 | 125 (3) | cut | pull-out, pan/track R, tilt/crane down, roll, parallax/orbit | -2.4 | mid/colour / 135 |  |
| 85 | 72572→72864 | 292 (7) | cut | push-in, parallax/orbit | +5.2 | mid/colour / 142 |  |
| 86 | 72864→73991 | 1126 (27) | cut | parallax/orbit | +0.2 | mid/colour / 122 |  |
| 87 | 73991→74825 | 834 (20) | cut | push-in, pan/track R, parallax/orbit | +6.6 | mid/colour / 140 |  |
| 88 | 74825→76618 | 1793 (43) | cut | static | -0.1 | black / 21 |  |
| 89 | 76618→78203 | 1585 (38) | cut | push-in, parallax/orbit | +30.9 | black / 28 |  |
| 90 | 78203→78537 | 334 (8) | cut | push-in, pan/track R, parallax/orbit | +13.2 | light / 182 |  |
| 91 | 78537→79121 | 584 (14) | cut | subtle drift | +0.0 | light / 206 |  |
| 92 | 79121→79454 | 334 (8) | cut | parallax/orbit | -0.4 | light / 176 |  |
| 93 | 79454→79746 | 292 (7) | cut | static | +0.0 | light / 163 |  |
| 94 | 79746→80455 | 709 (17) | cut | push-in, pan/track R, tilt/crane up, parallax/orbit | +39.7 | mid/colour / 74 |  |
| 95 | 80455→80706 | 250 (6) | cut | parallax/orbit | +0.4 | mid/colour / 127 |  |
| 96 | 80706→80831 | 125 (3) | cut | parallax/orbit | -0.1 | mid/colour / 124 |  |
| 97 | 80831→81081 | 250 (6) | cut | parallax/orbit | +0.2 | mid/colour / 109 |  |
| 98 | 81081→81456 | 375 (9) | cut | parallax/orbit | +0.1 | mid/colour / 120 |  |
| 99 | 81456→82958 | 1501 (36) | cut | parallax/orbit | +0.1 | black / 31 |  |
| 100 | 82958→84334 | 1376 (33) | cut | static | +0.3 | black / 25 |  |
| 101 | 84334→85294 | 959 (23) | cut | static | +0.1 | black / 16 |  |
| 102 | 85294→88088 | 2794 (67) | cut | static | +0.0 | black / 12 |  |
| 103 | 88088→91174 | 3086 (74) | cut | static | -0.0 | black / 31 |  |
| 104 | 91174→92134 | 959 (23) | cut | parallax/orbit | +0.5 | black / 14 |  |
| 105 | 92134→93635 | 1501 (36) | cut | static | -0.1 | black / 20 |  |
| 106 | 93635→95595 | 1960 (47) | cut | static | +0.0 | mid/colour / 34 |  |
| 107 | 95595→97973 | 2377 (57) | cut | subtle drift | +0.1 | black / 12 |  |
| 108 | 97973→101601 | 3629 (87) | cut | subtle drift | -0.2 | black / 27 |  |
| 109 | 101601→102227 | 626 (15) | cut | static | -0.0 | black / 29 |  |
| 110 | 102227→103520 | 1293 (31) | cut | static | -0.0 | black / 16 |  |
| 111 | 103520→104688 | 1168 (28) | cut | static | -0.0 | black / 12 |  |
| 112 | 104688→106106 | 1418 (34) | cut | static | -0.0 | black / 24 |  |
| 113 | 106106→107691 | 1585 (38) | cut | push-in | +4.0 | black / 36 |  |
| 114 | 107691→108984 | 1293 (31) | cut | pull-out, pan/track R, tilt/crane down, parallax/orbit | -27.0 | mid/colour / 92 |  |
| 115 | 108984→109735 | 751 (18) | cut | push-in, parallax/orbit | +4.0 | mid/colour / 118 |  |
| 116 | 109735→109901 | 167 (4) | cut | push-in, roll, parallax/orbit | +1.5 | mid/colour / 67 |  |
| 117 | 109901→110610 | 709 (17) | cut | subtle drift | -0.3 | mid/colour / 81 |  |
| 118 | 110610→113071 | 2461 (59) | cut | push-in, pan/track L, roll, parallax/orbit | +11.8 | mid/colour / 98 |  |
| 119 | 113071→113363 | 292 (7) | cut | static | -0.0 | mid/colour / 73 |  |
| 120 | 113363→113864 | 500 (12) | cut | static | +0.0 | mid/colour / 86 |  |
| 121 | 113864→114531 | 667 (16) | cut | static | -0.0 | mid/colour / 87 |  |
| 122 | 114531→115198 | 667 (16) | cut | push-in | +2.0 | mid/colour / 50 |  |
| 123 | 115198→117659 | 2461 (59) | cut | push-in, parallax/orbit | +5.1 | mid/colour / 66 |  |
| 124 | 117659→118660 | 1001 (24) | cut | push-in, tilt/crane down, parallax/orbit | +18.9 | mid/colour / 97 |  |
| 125 | 118660→118827 | 167 (4) | fondu 6 img | push-in, parallax/orbit | +3.6 | mid/colour / 46 |  |
| 126 | 118827→119703 | 876 (21) | cut | static | +0.1 | black / 17 |  |
| 127 | 119703→120662 | 959 (23) | cut | push-in, pan/track R | +2.3 | light / 134 |  |
| 128 | 120662→122122 | 1460 (35) | cut | push-in, pan/track R, parallax/orbit | +3.5 | light / 151 |  |
| 129 | 122122→122956 | 834 (20) | cut | pull-out, pan/track L, parallax/orbit | -6.2 | mid/colour / 75 |  |
| 130 | 122956→124499 | 1543 (37) | cut | static | +0.0 | black / 82 |  |
| 131 | 124499→126084 | 1585 (38) | cut | push-in, parallax/orbit | +4.6 | mid/colour / 126 |  |
| 132 | 126084→126752 | 667 (16) | cut | static | +0.0 | black / 35 |  |
| 133 | 126752→127794 | 1043 (25) | cut | static | +0.0 | black / 12 |  |
| 134 | 127794→128962 | 1168 (28) | cut | pull-out, tilt/crane up, parallax/orbit | -3.5 | black / 13 |  |
| 135 | 128962→131340 | 2377 (57) | cut | static | -0.0 | black / 4 |  |
| 136 | 131340→132049 | 709 (17) | cut | static | -0.0 | black / 16 |  |
| 137 | 132049→132549 | 500 (12) | cut | static | +0.0 | black / 12 |  |
| 138 | 132549→133175 | 626 (15) | cut | static | -0.0 | black / 60 |  |
| 139 | 133175→133550 | 375 (9) | cut | static | -0.0 | black / 46 |  |
| 140 | 133550→133842 | 292 (7) | cut | static | -0.0 | mid/colour / 60 |  |
| 141 | 133842→134217 | 375 (9) | cut | static | -0.0 | mid/colour / 59 |  |
| 142 | 134217→135177 | 959 (23) | cut | static | +0.2 | mid/colour / 40 |  |
| 143 | 135177→136887 | 1710 (41) | cut | static | +0.1 | mid/colour / 33 |  |
| 144 | 136887→137220 | 334 (8) | cut | static | +0.0 | black / 6 |  |
| 145 | 137220→138013 | 792 (19) | noir→ | static | +0.0 | black / 12 |  |
| 146 | 138013→139640 | 1627 (39) | cut | subtle drift | -0.2 | black / 15 |  |
| 147 | 139640→139890 | 250 (6) | cut | static | +0.0 | black / 22 |  |
| 148 | 139890→140807 | 918 (22) | cut | static | +0.0 | black / 23 |  |
| 149 | 140807→142309 | 1501 (36) | cut | push-in | +1.5 | black / 16 |  |
| 150 | 142309→144311 | 2002 (48) | cut | static | -0.0 | black / 45 |  |
| 151 | 144311→145228 | 918 (22) | cut | push-in, tilt/crane down, roll, parallax/orbit | +1.8 | black / 43 |  |
| 152 | 145228→145437 | 209 (5) | cut | static | +0.0 | black / 3 |  |
| 153 | 145437→145687 | 250 (6) | cut | static | -0.0 | black / 11 |  |
| 154 | 145687→146480 | 792 (19) | cut | static | -0.0 | black / 16 |  |
| 155 | 146480→147606 | 1126 (27) | cut | push-in, pan/track R, tilt/crane down, roll, parallax/orbit | +7.5 | mid/colour / 132 |  |
| 156 | 147606→148231 | 626 (15) | cut | push-in, tilt/crane down, roll, parallax/orbit | +13.2 | mid/colour / 119 |  |
| 157 | 148231→148357 | 125 (3) | cut | subtle drift | -0.6 | mid/colour / 82 |  |
| 158 | 148357→148982 | 626 (15) | cut | subtle drift | -0.5 | mid/colour / 50 |  |
| 159 | 148982→149524 | 542 (13) | cut | static | +0.1 | black / 34 |  |
| 160 | 149524→150150 | 626 (15) | cut | push-in | +1.1 | mid/colour / 40 |  |
| 161 | 150150→150484 | 334 (8) | cut | static | -0.0 | black / 35 |  |
| 162 | 150484→151109 | 626 (15) | cut | static | +0.0 | black / 25 |  |
| 163 | 151109→151777 | 667 (16) | cut | static | +0.0 | black / 10 |  |
| 164 | 151777→152069 | 292 (7) | cut | pull-out, parallax/orbit | -0.9 | mid/colour / 47 |  |
| 165 | 152069→152361 | 292 (7) | fondu 11 img | pull-out, pan/track R, parallax/orbit | -15.8 | mid/colour / 56 |  |
| 166 | 152361→152986 | 626 (15) | cut | static | -0.0 | black / 9 |  |
| 167 | 152986→153487 | 500 (12) | cut | subtle drift | +0.3 | mid/colour / 44 |  |
| 168 | 153487→153987 | 500 (12) | fondu 24 img | static | -0.0 | black / 12 |  |
| 169 | 153987→154196 | 209 (5) | →noir | static | +0.0 | black / 5 |  |
| 170 | 154196→154613 | 417 (10) | cut | static | +0.4 | mid/colour / 101 |  |
| 171 | 154613→155280 | 667 (16) | fondu 15 img | static | +0.6 | light / 169 |  |
| 172 | 155280→156656 | 1376 (33) | cut | parallax/orbit | +0.3 | mid/colour / 40 |  |
| 173 | 156656→157491 | 834 (20) | cut | subtle drift | -0.3 | light / 155 |  |
| 174 | 157491→159242 | 1752 (42) | cut | pull-out | -1.3 | mid/colour / 58 |  |
| 175 | 159242→161828 | 2586 (62) | cut | pull-out, roll | -1.3 | mid/colour / 40 |  |
| 176 | 161828→164039 | 2211 (53) | cut | pull-out, parallax/orbit | -3.6 | mid/colour / 41 |  |
| 177 | 164039→168085 | 4046 (97) | cut | pull-out, pan/track R, parallax/orbit | -4.8 | mid/colour / 32 |  |
| 178 | 168085→168752 | 667 (16) | cut | static | +0.0 | mid/colour / 28 |  |
| 179 | 168752→169086 | 334 (8) | cut | static | +0.0 | mid/colour / 34 |  |
| 180 | 169086→170003 | 918 (22) | cut | static | +0.0 | mid/colour / 23 |  |
| 181 | 170003→172381 | 2377 (57) | cut | static | +0.0 | black / 1 |  |

</details>

### 2.2 A2 — Apple iPhone Air, film design (144,7 s, 46 plans)

**Le modèle le plus proche d'un film produit sans figurant.** Fond blanc cassé et gris-bleu (luma moyenne 114, seulement 17 % d'images sombres). Voix off posée d'un designer (273 mots) : **2,0 mots/s sur la durée, 2,4 mots/s à l'intérieur des phrases**, phrases de 5,0 s en médiane, **1,2 s de musique seule entre deux phrases**.
- **Plans d'ouverture de 9 276 ms puis 5 873 ms** : le téléphone vu par la tranche sur fond blanc, presque immobile (échelle ±0,02 %/s, reflet stable à ±1 % du cadre). Un carton d'identité discret du designer s'affiche en bas à gauche.
- Autres plans produit tenus longtemps : 3 303 ms (lévitation au-dessus d'un bureau), **8 208 ms** (téléphone en rotation lente dans un espace vide, 29,6 s), **5 272 ms**, **4 104 ms** (plateau caméra, pull-out lent de −2,2 %/s), **5 873 ms** et **8 141 ms** (MagSafe).
- **Balayage de lumière** (plan #27, 72,6 s, 3 337 ms) : la haute lumière traverse **57 % du cadre en 3,3 s**, soit ≈ 17 %/s.
- **Seulement 7 % de plans de moins de 500 ms.** La séquence « selfie Center Stage » (87–91 s) est la seule rafale (100 à 734 ms).
- **Fin** : « This is iPhone Air. » est dit à 137,8–139,8 s. Pendant la phrase, le téléphone tenu par la tranche **devient le « I » d'un lockup typographique A‑I‑R** : des lettres fines en fil de fer apparaissent de part et d'autre (139,0 → 141,3 s, soit **2,3 s**). Puis **cut vers le logo Apple noir sur blanc chaud (luma 224)**, logo de **13,5 % de la hauteur d'image**, tenu **3 390 ms** (141,34 → 144,73 s). **Le dernier temps fort de la musique coïncide avec le cut vers le logo (141,45 s, à 0,1 s près)**, puis la musique s'éteint : **1,6 s de silence final**.

<details><summary>Table des plans (mesurée, 49 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→9276 | 9276 (278) | — | static | +0.0 | light / 184 |  |
| 2 | 9276→15148 | 5873 (176) | cut | static | +0.0 | light / 190 |  |
| 3 | 15148→17050 | 1902 (57) | cut | pan/track R, tilt/crane up | +0.6 | mid/colour / 141 |  |
| 4 | 17050→20354 | 3303 (99) | cut | static | -0.0 | mid/colour / 107 |  |
| 5 | 20354→23023 | 2669 (80) | cut | static | -0.0 | mid/colour / 126 |  |
| 6 | 23023→24658 | 1635 (49) | cut | subtle drift | -0.3 | light / 164 |  |
| 7 | 24658→27027 | 2369 (71) | cut | pull-out, pan/track R, parallax/orbit | -11.1 | mid/colour / 65 |  |
| 8 | 27027→27961 | 934 (28) | cut | static | -0.3 | mid/colour / 122 |  |
| 9 | 27961→28729 | 767 (23) | cut | static | +0.0 | mid/colour / 142 |  |
| 10 | 28729→29563 | 834 (25) | cut | parallax/orbit | +0.1 | mid/colour / 125 |  |
| 11 | 29563→37771 | 8208 (246) | cut | subtle drift | +0.8 | mid/colour / 151 |  |
| 12 | 37771→40274 | 2502 (75) | cut | static | +0.5 | mid/colour / 79 |  |
| 13 | 40274→42309 | 2035 (61) | cut | static | -0.0 | black / 38 |  |
| 14 | 42309→46046 | 3737 (112) | cut | static | -0.0 | mid/colour / 73 |  |
| 15 | 46046→51318 | 5272 (158) | cut | static | +0.1 | mid/colour / 140 |  |
| 16 | 51318→53754 | 2436 (73) | cut | push-in | +1.6 | black / 15 |  |
| 17 | 53754→54087 | 334 (10) | cut | static | -0.0 | black / 6 |  |
| 18 | 54087→54288 | 200 (6) | noir→ | pull-out, parallax/orbit | -2.8 | mid/colour / 14 |  |
| 19 | 54288→54421 | 133 (4) | cut | pull-out, tilt/crane down, roll, parallax/orbit | -7.2 | mid/colour / 31 |  |
| 20 | 54421→55589 | 1168 (35) | cut | pull-out, parallax/orbit | -2.4 | mid/colour / 81 |  |
| 21 | 55589→60560 | 4972 (149) | cut | subtle drift | +0.3 | mid/colour / 136 |  |
| 22 | 60560→61962 | 1401 (42) | cut | static | -0.1 | mid/colour / 70 |  |
| 23 | 61962→65899 | 3937 (118) | cut | subtle drift | -0.8 | mid/colour / 147 |  |
| 24 | 65899→68602 | 2703 (81) | cut | static | -0.3 | mid/colour / 104 |  |
| 25 | 68602→70470 | 1869 (56) | cut | static | +0.0 | mid/colour / 88 |  |
| 26 | 70470→72572 | 2102 (63) | cut | push-in, pan/track R, roll, parallax/orbit | +22.0 | mid/colour / 53 |  |
| 27 | 72572→75909 | 3337 (100) | cut | subtle drift | -0.0 | mid/colour / 86 |  |
| 28 | 75909→80013 | 4104 (123) | cut | pull-out, parallax/orbit | -2.2 | black / 21 |  |
| 29 | 80013→80180 | 167 (5) | fondu 41 img | pull-out | -0.9 | mid/colour / 44 |  |
| 30 | 80180→83183 | 3003 (90) | cut | static | +0.2 | black / 23 |  |
| 31 | 83183→83917 | 734 (22) | fondu 37 img | static | +0.4 | mid/colour / 50 |  |
| 32 | 83917→87220 | 3303 (99) | cut | push-in | +0.8 | mid/colour / 97 |  |
| 33 | 87220→87955 | 734 (22) | cut | static | -0.0 | black / 19 |  |
| 34 | 87955→88055 | 100 (3) | →noir | static | +0.0 | black / 4 |  |
| 35 | 88055→91024 | 2970 (89) | noir→ | static | -0.0 | black / 14 |  |
| 36 | 91024→91224 | 200 (6) | →noir | static | +0.0 | black / 6 |  |
| 37 | 91224→92592 | 1368 (41) | cut | static | -0.0 | black / 68 |  |
| 38 | 92592→94261 | 1668 (50) | cut | push-in, parallax/orbit | +0.8 | mid/colour / 119 |  |
| 39 | 94261→97264 | 3003 (90) | fondu 26 img | push-in, pan/track L, parallax/orbit | +9.9 | black / 66 |  |
| 40 | 97264→99933 | 2669 (80) | cut | static | -0.0 | black / 75 |  |
| 41 | 99933→102002 | 2069 (62) | cut | static | -0.0 | black / 52 |  |
| 42 | 102002→103670 | 1668 (50) | cut | static | -0.0 | black / 71 |  |
| 43 | 103670→105939 | 2269 (68) | cut | static | -0.0 | black / 24 |  |
| 44 | 105939→111812 | 5873 (176) | cut | static | +0.0 | black / 17 |  |
| 45 | 111812→119953 | 8141 (244) | cut | pull-out, pan/track R, parallax/orbit | -2.7 | mid/colour / 126 |  |
| 46 | 119953→123056 | 3103 (93) | cut | static | -0.3 | mid/colour / 120 |  |
| 47 | 123056→125192 | 2135 (64) | cut | static | +0.1 | mid/colour / 77 |  |
| 48 | 125192→130097 | 4905 (147) | cut | pull-out, parallax/orbit | -2.4 | mid/colour / 148 |  |
| 49 | 130097→144711 | 14615 (438) | cut | static | -0.0 | white / 216 |  |

</details>

### 2.3 A3 — Apple MacBook Pro (95,1 s, 75 plans)

- **Ouverture sur un curseur orange qui clignote sur fond blanc (2 586 ms), avec un métronome.** Silences réguliers de 0,3 à 6,2 s : la bande-son est **composée à partir des frappes clavier** (le sous-titre officiel indique « Keystroke-synchronized piano notes »). **C'est le son qui suit l'image**, pas l'inverse.
- **Accélération mesurée par tiers** : médiane de **1 752 ms → 834 ms → 709 ms**.
- **Typographie cinétique posée sur l'image** : « Introducing » en italique, puis « the new MacBook Pro » **mot par mot, avec des lettres qui tombent et se remettent en place**. La construction dure 48 images (2,0 s, de 21,65 à 23,65 s), le texte reste 0,5 s puis sort par un cut sec. Les chiffres (« Up to 2x faster SSD », « 128GB of unified memory », « Up to 8x faster AI ») apparaissent **mot par mot, dispersés dans le cadre, calés sur les frappes**.
- **Fin** : cut sur un plan large de la bibliothèque. « The new MacBook Pro » apparaît en cut (0 image de fondu). Le sous-titre « with M5 Pro and M5 Max » se construit en **2 étapes à 10 images d'écart**, puis tout reste **3 837 ms** à l'écran. **Silence de 1,5 s à la fin** (dernier son audible à 93,6 s).
- Push-in médian **4,5 %/s**, P90 28,5 %/s. **Seulement 5 % de plans statiques** : la caméra bouge presque toujours.

<details><summary>Table des plans (mesurée, 75 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→2586 | 2586 (62) | — | static | -0.0 | light / 209 |  |
| 2 | 2586→4129 | 1543 (37) | cut | push-in | +4.5 | mid/colour / 48 |  |
| 3 | 4129→6340 | 2211 (53) | cut | roll, parallax/orbit | +0.5 | mid/colour / 66 |  |
| 4 | 6340→8342 | 2002 (48) | cut | pull-out | -1.2 | mid/colour / 49 |  |
| 5 | 8342→10219 | 1877 (45) | cut | pull-out, parallax/orbit | -0.8 | mid/colour / 80 |  |
| 6 | 10219→11845 | 1627 (39) | cut | static | +0.0 | light / 208 |  |
| 7 | 11845→13055 | 1210 (29) | cut | push-in | +2.6 | mid/colour / 53 |  |
| 8 | 13055→13805 | 751 (18) | cut | parallax/orbit | -0.1 | mid/colour / 48 |  |
| 9 | 13805→14598 | 792 (19) | cut | static | -0.0 | light / 209 |  |
| 10 | 14598→15432 | 834 (20) | cut | pull-out, parallax/orbit | -7.5 | mid/colour / 56 |  |
| 11 | 15432→16475 | 1043 (25) | cut | push-in, pan/track R, parallax/orbit | +6.1 | mid/colour / 76 |  |
| 12 | 16475→18227 | 1752 (42) | cut | pull-out | -1.1 | mid/colour / 53 |  |
| 13 | 18227→20896 | 2669 (64) | cut | subtle drift | -0.1 | mid/colour / 52 |  |
| 14 | 20896→24149 | 3253 (78) | cut | pull-out, pan/track L, roll, parallax/orbit | -9.2 | mid/colour / 62 |  |
| 15 | 24149→27152 | 3003 (72) | cut | push-in, parallax/orbit | +1.8 | mid/colour / 64 |  |
| 16 | 27152→27611 | 459 (11) | cut | push-in, tilt/crane down, roll, parallax/orbit | +19.7 | black / 43 |  |
| 17 | 27611→30322 | 2711 (65) | cut | pull-out, pan/track L, roll, parallax/orbit | -5.7 | mid/colour / 55 |  |
| 18 | 30322→31281 | 959 (23) | cut | push-in, parallax/orbit | +4.1 | mid/colour / 38 |  |
| 19 | 31281→34201 | 2920 (70) | cut | pull-out | -5.2 | mid/colour / 40 |  |
| 20 | 34201→35202 | 1001 (24) | cut | push-in, pan/track L, parallax/orbit | +29.2 | mid/colour / 98 |  |
| 21 | 35202→37746 | 2544 (61) | cut | subtle drift | -0.2 | mid/colour / 49 |  |
| 22 | 37746→38330 | 584 (14) | cut | parallax/orbit | +0.8 | mid/colour / 63 |  |
| 23 | 38330→39164 | 834 (20) | cut | push-in | +14.2 | mid/colour / 121 |  |
| 24 | 39164→40123 | 959 (23) | cut | pan/track R | +0.3 | mid/colour / 140 |  |
| 25 | 40123→40540 | 417 (10) | cut | roll, parallax/orbit | -0.8 | mid/colour / 71 |  |
| 26 | 40540→41375 | 834 (20) | cut | push-in, roll, parallax/orbit | +5.3 | mid/colour / 94 |  |
| 27 | 41375→41917 | 542 (13) | cut | push-in, pan/track R, tilt/crane up, roll, parallax/orbit | +29.3 | mid/colour / 96 |  |
| 28 | 41917→42501 | 584 (14) | cut | push-in, pan/track R, roll, parallax/orbit | +6.5 | mid/colour / 30 |  |
| 29 | 42501→43126 | 626 (15) | cut | pull-out, roll, parallax/orbit | -4.7 | mid/colour / 39 |  |
| 30 | 43126→43710 | 584 (14) | cut | push-in, pan/track L, roll, parallax/orbit | +23.6 | mid/colour / 53 |  |
| 31 | 43710→44795 | 1084 (26) | cut | push-in | +1.7 | mid/colour / 32 |  |
| 32 | 44795→45212 | 417 (10) | cut | parallax/orbit | +0.0 | black / 21 |  |
| 33 | 45212→46213 | 1001 (24) | cut | push-in, roll, parallax/orbit | +4.5 | mid/colour / 36 |  |
| 34 | 46213→46421 | 209 (5) | cut | static | -0.0 | mid/colour / 27 |  |
| 35 | 46421→46838 | 417 (10) | cut | parallax/orbit | -0.2 | black / 20 |  |
| 36 | 46838→49883 | 3045 (73) | cut | push-in | +4.3 | mid/colour / 58 |  |
| 37 | 49883→51969 | 2085 (50) | cut | parallax/orbit | -0.1 | mid/colour / 60 |  |
| 38 | 51969→53011 | 1043 (25) | cut | push-in, pan/track R, roll | +12.6 | mid/colour / 37 |  |
| 39 | 53011→55764 | 2753 (66) | cut | push-in | +2.2 | black / 38 |  |
| 40 | 55764→56598 | 834 (20) | cut | push-in, roll, parallax/orbit | +1.5 | mid/colour / 58 |  |
| 41 | 56598→57391 | 792 (19) | cut | push-in, pan/track L, tilt/crane down, roll, parallax/orbit | +3.3 | mid/colour / 93 |  |
| 42 | 57391→58934 | 1543 (37) | cut | pull-out, parallax/orbit | -4.6 | black / 35 |  |
| 43 | 58934→60352 | 1418 (34) | cut | subtle drift | -0.1 | mid/colour / 42 |  |
| 44 | 60352→61853 | 1501 (36) | cut | tilt/crane up, roll, parallax/orbit | +0.5 | mid/colour / 52 |  |
| 45 | 61853→62896 | 1043 (25) | cut | push-in, pan/track L, parallax/orbit | +0.9 | mid/colour / 71 |  |
| 46 | 62896→63605 | 709 (17) | cut | push-in, parallax/orbit | +4.1 | mid/colour / 45 |  |
| 47 | 63605→64398 | 792 (19) | cut | pull-out, pan/track R, roll, parallax/orbit | -29.4 | mid/colour / 54 |  |
| 48 | 64398→66358 | 1960 (47) | cut | pull-out | -0.9 | mid/colour / 48 |  |
| 49 | 66358→67859 | 1501 (36) | cut | push-in | +2.3 | mid/colour / 61 |  |
| 50 | 67859→68443 | 584 (14) | cut | push-in, pan/track R, tilt/crane up, parallax/orbit | +1.5 | mid/colour / 43 |  |
| 51 | 68443→69611 | 1168 (28) | cut | push-in | +2.1 | mid/colour / 52 |  |
| 52 | 69611→70696 | 1084 (26) | cut | push-in, tilt/crane up, parallax/orbit | +13.9 | mid/colour / 61 |  |
| 53 | 70696→71446 | 751 (18) | cut | pan/track R, parallax/orbit | -0.7 | mid/colour / 64 |  |
| 54 | 71446→71989 | 542 (13) | cut | push-in, pan/track R, parallax/orbit | +10.6 | mid/colour / 48 |  |
| 55 | 71989→74157 | 2169 (52) | cut | pull-out | -1.9 | black / 28 |  |
| 56 | 74157→76076 | 1919 (46) | cut | pull-out | -5.5 | mid/colour / 47 |  |
| 57 | 76076→76285 | 209 (5) | cut | pull-out | -6.2 | mid/colour / 30 |  |
| 58 | 76285→76410 | 125 (3) | cut | pull-out | -14.2 | mid/colour / 112 |  |
| 59 | 76410→76660 | 250 (6) | cut | pull-out | -13.8 | mid/colour / 66 |  |
| 60 | 76660→77327 | 667 (16) | cut | pull-out, pan/track L, parallax/orbit | -19.5 | mid/colour / 49 |  |
| 61 | 77327→78036 | 709 (17) | cut | push-in, pan/track R, tilt/crane up, parallax/orbit | +28.5 | mid/colour / 54 |  |
| 62 | 78036→78578 | 542 (13) | cut | push-in, pan/track L, parallax/orbit | +41.4 | mid/colour / 113 |  |
| 63 | 78578→79288 | 709 (17) | cut | pull-out, pan/track L, tilt/crane up, parallax/orbit | -28.3 | mid/colour / 99 |  |
| 64 | 79288→79788 | 500 (12) | cut | subtle drift | -0.0 | mid/colour / 87 |  |
| 65 | 79788→80247 | 459 (11) | cut | push-in | +3.3 | mid/colour / 41 |  |
| 66 | 80247→81039 | 792 (19) | cut | pull-out, pan/track R, tilt/crane down, roll, parallax/orbit | -8.2 | mid/colour / 86 |  |
| 67 | 81039→81456 | 417 (10) | cut | push-in | +8.5 | black / 34 |  |
| 68 | 81456→81999 | 542 (13) | cut | push-in, pan/track L, roll, parallax/orbit | +6.1 | mid/colour / 44 |  |
| 69 | 81999→82582 | 584 (14) | cut | push-in | +1.4 | mid/colour / 52 |  |
| 70 | 82582→83083 | 500 (12) | cut | roll, parallax/orbit | -0.2 | mid/colour / 43 |  |
| 71 | 83083→83750 | 667 (16) | cut | pull-out, parallax/orbit | -1.5 | mid/colour / 50 |  |
| 72 | 83750→86962 | 3212 (77) | cut | push-in | +17.0 | mid/colour / 41 |  |
| 73 | 86962→89631 | 2669 (64) | cut | parallax/orbit | -0.1 | mid/colour / 61 |  |
| 74 | 89631→91258 | 1627 (39) | cut | subtle drift | -0.0 | mid/colour / 51 |  |
| 75 | 91258→95095 | 3837 (92) | cut | pull-out | -2.2 | mid/colour / 48 |  |

</details>

### 2.4 A4 — Apple AirPods Pro 3 (42,9 s, 24 plans)

- **Monde entièrement blanc** : luma moyenne 215, aucune image sombre. Silhouettes noires de danseurs, produit blanc sur blanc (le relief vient des ombres de contact et des reflets irisés).
- **Titre d'ouverture « AirPods Pro 3 »** : noir sur blanc, graisse moyenne, **8,5 % de la hauteur d'image, 37 % de la largeur**, centré, tenu 2,0 s. Il **sort par un smear chromatique (« glitch » RVB) de 9 images (300 ms)** qui sert de transition vers le plan suivant.
- **Textes de bénéfice** : petite taille (≈ 2–3 % de la hauteur par ligne), placés **à droite du produit, en face de la zone qu'ils décrivent** (« Heart rate sensing during workouts »), **ou dessous, construits mot par mot** (« A more … secure … fit for more ears » : 39 images de construction, soit 1,3 s). Temps d'écran : **2,6 à 4,3 s**. Une seule couleur d'accent : bleu pour « Hearing Aid feature », vert pour « 8 hours ».
- **Fin (37,97 → 42,87 s)** : les écouteurs volent vers le boîtier (1,6 s), le boîtier pivote jusqu'à une vue de dessus en forme de **pilule** (0,6 s), la pilule s'assombrit (0,5 s), puis **se transforme en logo Apple par un flash chromatique d'une image** (41,0 s). **Logo tenu 1,87 s**, avec un second micro-glitch synchronisé sur un coup sonore à 42,18 s. La musique ne s'arrête pas : le dernier coup tombe sur le logo.

<details><summary>Table des plans (mesurée, 24 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→2467 | 2467 (74) | — | subtle drift | +0.0 | white / 240 | titre « AirPods Pro 3 » noir sur blanc ; sortie par smear chromatique 9 img |
| 2 | 2467→4267 | 1800 (54) | cut | pull-out, tilt/crane down, parallax/orbit | -2.4 | white / 209 | danseuse + anneaux de verre (onde sonore) |
| 3 | 4267→5400 | 1133 (34) | cut | parallax/orbit | -0.4 | white / 229 | anneau ANC + texte |
| 4 | 5400→6700 | 1300 (39) | cut | subtle drift | -0.0 | white / 236 | (même carte, faux cut dû à la pulsation) |
| 5 | 6700→11567 | 4867 (146) | cut | parallax/orbit | -0.0 | white / 210 | CG liquide de verre irisé |
| 6 | 11567→11933 | 367 (11) | cut | pull-out, roll, parallax/orbit | -17.3 | mid/colour / 89 | macro embout noir |
| 7 | 11933→14367 | 2433 (73) | cut | subtle drift | +0.1 | white / 227 | écouteur + « Heart rate sensing » |
| 8 | 14367→15100 | 733 (22) | cut | push-in, parallax/orbit | +2.5 | white / 209 |  |
| 9 | 15100→15367 | 267 (8) | cut | push-in, parallax/orbit | +1.0 | white / 215 |  |
| 10 | 15367→16633 | 1267 (38) | cut | parallax/orbit | -0.1 | white / 220 |  |
| 11 | 16633→17733 | 1100 (33) | cut | push-in, parallax/orbit | +9.8 | light / 177 |  |
| 12 | 17733→18967 | 1233 (37) | cut | push-in, roll, parallax/orbit | +6.9 | white / 185 |  |
| 13 | 18967→19967 | 1000 (30) | cut | static | +0.1 | white / 240 | écouteur seul flottant, fond blanc |
| 14 | 19967→22367 | 2400 (72) | cut | static | -0.0 | white / 238 | embouts qui s’alignent + texte mot à mot |
| 15 | 22367→23200 | 833 (25) | cut | parallax/orbit | +0.5 | white / 218 |  |
| 16 | 23200→23567 | 367 (11) | cut | parallax/orbit | -0.0 | white / 218 |  |
| 17 | 23567→28167 | 4600 (138) | cut | static | +0.3 | light / 158 | profil silhouette + « Hearing Aid » bleu |
| 18 | 28167→29033 | 867 (26) | cut | pull-out, parallax/orbit | -1.4 | white / 220 | macro grille micro |
| 19 | 29033→32000 | 2967 (89) | cut | static | -0.0 | white / 234 | « Live Translation » + « Hola » |
| 20 | 32000→35667 | 3667 (110) | cut | parallax/orbit | -0.0 | white / 222 |  |
| 21 | 35667→36000 | 333 (10) | cut | subtle drift | +0.0 | white / 241 | paire flottante |
| 22 | 36000→36133 | 133 (4) | cut | static | -0.0 | white / 240 | boîtier |
| 23 | 36133→37967 | 1833 (55) | fondu 6 img | push-in | +1.1 | white / 205 | boîtier + éclair vert « 8 hours » |
| 24 | 37967→42867 | 4900 (147) | cut | static | -0.0 | white / 240 | **assemblage → boîtier → pilule → logo Apple (morph chromatique), logo 1,9 s** |

</details>

### 2.5 P1 — Porsche 550 Spyder × Hedley Studios (64,3 s, 58 plans) — **la référence « produit seul, studio noir »**

- **Palette** : noir chaud et bronze/sépia (luma moyenne 54, **58 % des images sous 40**), avec une seule source dure au-dessus ou de côté, un pool de lumière au sol et des spéculaires filés sur une peinture satinée. Le fond reste **noir, jamais uni coloré** : le décor n'existe que là où la lumière tombe.
- **Grille musicale** : les durées de plan tombent sur des multiples de **10–11 images (≈ 428 ms = 1 temps à 140 BPM)**, **32 images (1,28 s = 3 temps)** et **64 images (2,56 s = 6 temps)**. 37 plans sur 58 font exactement 10–11, 31–33 ou 63–65 images. **53 % des cuts tombent à ±1 image de la grille de 428 ms (19 % attendus au hasard)**, et **51 % à ±2 images d'un onset fort (8 % au hasard)**.
- **Architecture** : ouverture en « flash » (4 plans de 200 à 400 ms, macro floue). **Tension** : **les deux phares seuls dans le noir pendant 1 840 ms** (#5). **Révélation** : cut direct sur la voiture éclairée, plan large tenu 2 520 ms, statique (+0,6 %/s). Ensuite, **alternance plan large de 2,56 s / détail de 1,28 s / inserts de 0,40–0,44 s**. Le dernier tiers accélère (médiane **400 ms**, contre 1 280 ms au premier tiers) avec des inserts de 120 à 320 ms. **Descente** : deux plans de fumée sur le script « Spyder » (2 000 + 1 880 ms). **Cut sec vers un carton blanc « HEDLEY STUDIOS × PORSCHE »** (4,3 % de la hauteur, 58 % de la largeur) tenu **3 560 ms**, sans fondu, suivi de 0,6 s de silence.
- **Caméra** : **55 % de plans statiques**, push-in médian **1,0 %/s** (P90 1,7 %/s) et pull-out médian −0,95 %/s. **Aucun mouvement rapide** : l'énergie vient du montage et de la lumière.
- **Lumière** : **balayages mesurés à 18 %/s** (plan #15 : la lumière traverse l'avant en 2,6 s) **et 37 %/s** (#17 : grilles arrière, 1,28 s). Allumages de phares, light painting, fumée à contre-jour.

<details><summary>Table des plans (mesurée, 60 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→400 | 400 (10) | — | static | -0.0 | black / 32 | macro phare, flou de bougé (ouverture « flash ») |
| 2 | 400→600 | 200 (5) | cut | static | -0.0 | black / 51 | capot + phare, contre-jour chaud |
| 3 | 600→800 | 200 (5) | cut | static | +0.0 | mid/colour / 46 | aile arrière, spéculaire unique |
| 4 | 800→1000 | 200 (5) | cut | static | +0.0 | mid/colour / 88 | flanc, reflet de softbox |
| 5 | 1000→2840 | 1840 (46) | cut | static | +0.0 | black / 6 | **2 phares seuls dans le noir** (tension) |
| 6 | 2840→5360 | 2520 (63) | cut | static | +0.6 | mid/colour / 29 | **révélation plein cadre : cut vers la voiture éclairée** (pas de montée de lumière) |
| 7 | 5360→7920 | 2560 (64) | cut | static | -0.2 | mid/colour / 65 | bord de pare-brise, douche de lumière haute |
| 8 | 7920→9240 | 1320 (33) | cut | static | -0.0 | mid/colour / 39 | volant / compteurs |
| 9 | 9240→10480 | 1240 (31) | cut | push-in, roll | +1.0 | mid/colour / 51 | grilles moteur |
| 10 | 10480→11800 | 1320 (33) | cut | static | +0.1 | black / 40 | rétroviseur, filet spéculaire |
| 11 | 11800→12280 | 480 (12) | cut | pull-out, roll, parallax/orbit | -3.3 | mid/colour / 40 | macro grille (insert) |
| 12 | 12280→12680 | 400 (10) | cut | static | +0.0 | black / 32 | moyeu de volant, blason |
| 13 | 12680→13080 | 400 (10) | cut | static | +0.0 | black / 16 | noir presque total, un reflet apparaît |
| 14 | 13080→15640 | 2560 (64) | cut | pull-out | -0.9 | mid/colour / 31 | **plan large profil, pool de lumière** |
| 15 | 15640→18240 | 2600 (65) | cut | pull-out | -0.8 | mid/colour / 36 | **balayage de lumière arrière→avant (≈18 %/s)** |
| 16 | 18240→19520 | 1280 (32) | cut | pull-out, pan/track R | -4.1 | mid/colour / 67 | macro jante |
| 17 | 19520→20800 | 1280 (32) | cut | roll, parallax/orbit | +0.8 | mid/colour / 59 | grilles arrière, balayage (≈37 %/s) |
| 18 | 20800→22080 | 1280 (32) | cut | push-in | +0.9 | mid/colour / 61 | capot + logo PORSCHE |
| 19 | 22080→22520 | 440 (11) | cut | push-in | +1.7 | mid/colour / 47 |  |
| 20 | 22520→22960 | 440 (11) | cut | subtle drift | +0.4 | mid/colour / 65 |  |
| 21 | 22960→23400 | 440 (11) | cut | static | -0.1 | black / 19 |  |
| 22 | 23400→25960 | 2560 (64) | cut | static | +0.7 | mid/colour / 33 | large chaud |
| 23 | 25960→28520 | 2560 (64) | cut | static | -0.4 | mid/colour / 35 | avant, phares allumés |
| 24 | 28520→29800 | 1280 (32) | cut | pull-out | -1.3 | mid/colour / 90 | jante + script Spyder |
| 25 | 29800→31080 | 1280 (32) | cut | push-in | +1.3 | mid/colour / 35 |  |
| 26 | 31080→32400 | 1320 (33) | cut | static | +0.3 | mid/colour / 30 |  |
| 27 | 32400→32800 | 400 (10) | cut | static | +0.0 | black / 38 |  |
| 28 | 32800→33240 | 440 (11) | cut | pull-out, parallax/orbit | -1.8 | mid/colour / 55 |  |
| 29 | 33240→33680 | 440 (11) | cut | subtle drift | +0.5 | mid/colour / 61 |  |
| 30 | 33680→36200 | 2520 (63) | cut | pull-out | -0.9 | mid/colour / 45 |  |
| 31 | 36200→38800 | 2600 (65) | cut | static | +0.3 | mid/colour / 35 |  |
| 32 | 38800→40080 | 1280 (32) | cut | pull-out | -1.0 | black / 33 |  |
| 33 | 40080→41240 | 1160 (29) | cut | static | -0.1 | black / 18 |  |
| 34 | 41240→41640 | 400 (10) | fondu 10 img | static | -0.0 | black / 5 |  |
| 35 | 41640→42680 | 1040 (26) | cut | static | -0.0 | mid/colour / 30 |  |
| 36 | 42680→43080 | 400 (10) | cut | static | -0.0 | mid/colour / 72 | light painting abstrait |
| 37 | 43080→43520 | 440 (11) | cut | static | -0.0 | mid/colour / 83 |  |
| 38 | 43520→43920 | 400 (10) | cut | static | -0.0 | black / 13 |  |
| 39 | 43920→45280 | 1360 (34) | cut | push-in | +1.0 | mid/colour / 68 | fumée |
| 40 | 45280→46520 | 1240 (31) | cut | static | +0.0 | mid/colour / 38 | flare contre-jour |
| 41 | 46520→47840 | 1320 (33) | cut | static | +0.3 | black / 28 | face phares allumés |
| 42 | 47840→48120 | 280 (7) | cut | pull-out | -1.5 | mid/colour / 62 |  |
| 43 | 48120→48440 | 320 (8) | cut | pull-out | -0.8 | mid/colour / 84 |  |
| 44 | 48440→48680 | 240 (6) | cut | pull-out, tilt/crane down, roll, parallax/orbit | -4.2 | mid/colour / 68 |  |
| 45 | 48680→49080 | 400 (10) | cut | pull-out | -1.0 | mid/colour / 148 |  |
| 46 | 49080→50360 | 1280 (32) | cut | static | +0.8 | mid/colour / 39 |  |
| 47 | 50360→50720 | 360 (9) | cut | push-in | +1.0 | black / 25 |  |
| 48 | 50720→50840 | 120 (3) | cut | static | +0.0 | black / 8 |  |
| 49 | 50840→51000 | 160 (4) | cut | pull-out, parallax/orbit | -6.1 | mid/colour / 60 |  |
| 50 | 51000→51280 | 280 (7) | cut | static | -0.1 | black / 14 |  |
| 51 | 51280→51640 | 360 (9) | cut | pull-out | -1.4 | black / 31 |  |
| 52 | 51640→52920 | 1280 (32) | cut | static | +0.7 | mid/colour / 50 |  |
| 53 | 52920→53280 | 360 (9) | cut | pull-out | -1.6 | mid/colour / 66 |  |
| 54 | 53280→53640 | 360 (9) | cut | static | -0.3 | mid/colour / 65 |  |
| 55 | 53640→53840 | 200 (5) | cut | static | +0.0 | mid/colour / 75 |  |
| 56 | 53840→54240 | 400 (10) | cut | static | -0.5 | mid/colour / 27 |  |
| 57 | 54240→56880 | 2640 (66) | cut | subtle drift | -0.2 | mid/colour / 32 | dernier plan large |
| 58 | 56880→58880 | 2000 (50) | cut | static | -0.5 | mid/colour / 38 | fumée sur script Spyder |
| 59 | 58880→60760 | 1880 (47) | fondu 36 img | push-in | +2.0 | mid/colour / 59 | fumée sur script Spyder (suite) |
| 60 | 60760→64320 | 3560 (89) | cut | static | +0.0 | white / 252 | **carton blanc HEDLEY STUDIOS × PORSCHE, cut sec, fixe** |

</details>

### 2.6 P2 — Porsche « HD Matrix Design » (54,5 s, CG)

- **Noir intégral 94 % du temps.** Silence audio de 0 à 1,9 s, puis **une ligne spéculaire unique « dessine » la carrosserie** : le reflet d'une barre lumineuse parcourt la courbe de l'aile à **19–37 % de la largeur par seconde** (plans #2 à #5, 1,4 à 2,2 s chacun), avec des fondus au noir entre les passages.
- **13,4 s** : les LED Matrix s'allument dans un **plan continu de 21 s** où l'animation passe par la lumière, pas par le montage. Surexposition blanche, face avant, puis **blason Porsche sur noir pendant 19,4 s** : fondu d'entrée de 49 images (1,96 s), fondu de sortie de 19 images, 1,6 s de silence à la fin.
- C'est une variante « lumière pure », extrêmement lente (7,7 plans/min). **Très bien adaptée à un flacon en verre** : une seule ligne spéculaire qui dessine l'épaule du flacon.

<details><summary>Table des plans (mesurée, 11 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→2520 | 2520 (63) | — | static | +0.0 | black / 1 | noir total 2,5 s (silence 0–1,9 s) |
| 2 | 2520→3960 | 1440 (36) | noir→ | push-in | +2.8 | black / 14 | ligne spéculaire qui « dessine » le phare |
| 3 | 3960→5600 | 1640 (41) | fondu 19 img | subtle drift | +0.1 | black / 22 | la ligne parcourt la courbe d’aile |
| 4 | 5600→7360 | 1760 (44) | →noir | static | +0.0 | black / 1 | ligne en fuite hors cadre (37 %/s) |
| 5 | 7360→9600 | 2240 (56) | noir→ | pull-out, parallax/orbit | -2.0 | black / 12 | 2e passage de lumière (24 %/s) |
| 6 | 9600→13160 | 3560 (89) | →noir | static | +0.0 | black / 1 | fondu au noir |
| 7 | 13160→13280 | 120 (3) | cut | static | -0.1 | mid/colour / 14 |  |
| 8 | 13280→13400 | 120 (3) | cut | subtle drift | -0.7 | mid/colour / 25 |  |
| 9 | 13400→34400 | 21000 (525) | cut | pull-out | -2.5 | black / 33 | **allumage des LED Matrix (plan de 21 s, animation lumineuse)** |
| 10 | 34400→35080 | 680 (17) | fondu 49 img | static | -0.0 | light / 156 | surexposition blanche → face avant |
| 11 | 35080→54520 | 19440 (486) | →noir | static | -0.0 | black / 2 | **blason Porsche 19 s** (fondu 49 img) |

</details>

### 2.7 S1 — Samsung Galaxy S22 Ultra (30 s, 22 plans)

- **0–1,24 s** : le logo SAMSUNG est **révélé par un spot qui le balaie de gauche à droite** : seules les lettres éclairées existent (vitesse 17 % du cadre/s, 31 images). C'est la même idée de lumière révélatrice que P1 et P2, appliquée au logo.
- Carte-pilule « Welcome to Galaxy S22 » (7,6 % de la hauteur, 60 % de la largeur, rampe d'entrée de 25 images). Puis **4 plans produit sur fond noir de 120 à 400 ms** qui font pivoter le téléphone jusqu'au profil. **Le profil devient le « l » de « U|tra »** (typo géante de 58 % de la hauteur, 1 320 ms) : même idée que le lockup A‑I‑R d'Apple.
- Accroches centrées en blanc, graisse moyenne (« Break the rules of light / power ») : **9 images pour entrer, 27 images tenues, 24 images pour sortir**.
- **Fin** : fond blanc « Note‑worthy » écrit au stylet (1,64 s), packshot + titre (3,04 s), carton noir « Pre-order now / samsung.com » (**1,28 s**), puis **logo SAMSUNG seul (5,4 % de la hauteur, 20 % de la largeur) pendant 0,96 s**. Cuts secs. Musique « I'm unstoppable today » : c'est la seule « voix » (paroles), la sonie est basse (P95 −23 dBFS, l'upload est normalisé).

<details><summary>Table des plans (mesurée, 27 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→240 | 240 (6) | — | static | -0.0 | black / 3 | SAMSUNG révélé par un spot qui balaie G→D |
| 2 | 240→1120 | 880 (22) | noir→ | static | -0.0 | black / 20 | (suite du balayage, 17 %/s) |
| 3 | 1120→1240 | 120 (3) | fondu 16 img | static | -0.0 | black / 10 |  |
| 4 | 1240→3400 | 2160 (54) | →noir | static | -0.0 | black / 4 | pilule « Welcome to Galaxy S22 » |
| 5 | 3400→3560 | 160 (4) | noir→ | pull-out, parallax/orbit | -2.3 | black / 8 | tranche du téléphone, noir |
| 6 | 3560→3960 | 400 (10) | →noir | parallax/orbit | -0.6 | black / 11 | rotation, noir |
| 7 | 3960→4200 | 240 (6) | →noir | parallax/orbit | -0.0 | black / 4 | téléphone de profil = le « l » |
| 8 | 4200→5520 | 1320 (33) | cut | static | +0.0 | black / 58 | **« U|tra » : le téléphone devient la lettre** |
| 9 | 5520→6680 | 1160 (29) | cut | push-in, parallax/orbit | +2.3 | mid/colour / 47 | caméras 3/4 |
| 10 | 6680→7400 | 720 (18) | cut | parallax/orbit | +0.8 | mid/colour / 43 | macro objectifs |
| 11 | 7400→9840 | 2440 (61) | →noir | push-in, parallax/orbit | +2.7 | black / 19 | personne + « Break the rules of light » |
| 12 | 9840→10800 | 960 (24) | cut | tilt/crane down, roll, parallax/orbit | -0.0 | black / 18 |  |
| 13 | 10800→11440 | 640 (16) | cut | push-in, pan/track R, roll, parallax/orbit | +7.5 | black / 18 |  |
| 14 | 11440→11600 | 160 (4) | cut | parallax/orbit | -0.3 | black / 19 |  |
| 15 | 11600→12520 | 920 (23) | cut | pull-out, pan/track R, roll, parallax/orbit | -1.3 | mid/colour / 64 |  |
| 16 | 12520→14640 | 2120 (53) | cut | push-in, parallax/orbit | +7.5 | mid/colour / 54 |  |
| 17 | 14640→15320 | 680 (17) | cut | push-in, parallax/orbit | +0.9 | mid/colour / 48 |  |
| 18 | 15320→16200 | 880 (22) | cut | pull-out, roll, parallax/orbit | -24.9 | mid/colour / 112 | tunnel de lumière « Break the rules of power » |
| 19 | 16200→16320 | 120 (3) | cut | pull-out, parallax/orbit | -1.7 | mid/colour / 162 |  |
| 20 | 16320→19240 | 2920 (73) | cut | push-in, parallax/orbit | +2.0 | mid/colour / 137 | puce dans un halo |
| 21 | 19240→19400 | 160 (4) | cut | static | +0.2 | black / 1 |  |
| 22 | 19400→19760 | 360 (9) | cut | push-in | +2.1 | black / 10 |  |
| 23 | 19760→21960 | 2200 (55) | cut | push-in, parallax/orbit | +9.6 | black / 46 | S Pen macro, noir |
| 24 | 21960→23080 | 1120 (28) | cut | pull-out, pan/track R, parallax/orbit | -8.1 | light / 139 |  |
| 25 | 23080→24720 | 1640 (41) | cut | static | +0.0 | white / 235 | fond blanc « Note-worthy » écrit au stylet |
| 26 | 24720→27760 | 3040 (76) | cut | static | +0.0 | light / 182 | hero packshot + titre |
| 27 | 27760→30000 | 2240 (56) | cut | static | +0.0 | black / 2 | **Pre-order 1,28 s → logo SAMSUNG 0,96 s, cuts secs** |

</details>

### 2.8 B1 — Bang & Olufsen « Sound Elevated » 30 s (27 plans)

Film de marque avec personnes (hors cible « produit seul »). Il est utile pour la **retenue luxe** : **76 % d'images sombres**, bois, laiton et noir. Durées de plan très régulières (**P10–P90 = 504–1 920 ms, écart le plus faible du corpus**), push-in médian 5,1 %/s, aucun silence, fin sur un plan de couloir. Une seule taille de plan domine : plans moyens et larges composés symétriquement.

<details><summary>Table des plans (mesurée, 28 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 1 | 0→1160 | 1160 (29) | — | push-in | +7.3 | mid/colour / 18 |  |
| 2 | 1160→2640 | 1480 (37) | cut | push-in, tilt/crane up, roll, parallax/orbit | +27.5 | mid/colour / 39 |  |
| 3 | 2640→3360 | 720 (18) | cut | push-in, tilt/crane up, parallax/orbit | +1.0 | mid/colour / 50 |  |
| 4 | 3360→4880 | 1520 (38) | cut | subtle drift | +0.3 | mid/colour / 34 |  |
| 5 | 4880→7040 | 2160 (54) | cut | push-in, parallax/orbit | +4.1 | black / 26 |  |
| 6 | 7040→7560 | 520 (13) | cut | pull-out, parallax/orbit | -3.8 | mid/colour / 39 |  |
| 7 | 7560→8080 | 520 (13) | cut | pull-out, roll, parallax/orbit | -0.9 | mid/colour / 39 |  |
| 8 | 8080→9840 | 1760 (44) | cut | static | +0.1 | black / 27 |  |
| 9 | 9840→10960 | 1120 (28) | cut | static | +0.0 | black / 9 |  |
| 10 | 10960→12160 | 1200 (30) | cut | push-in, parallax/orbit | +14.1 | black / 19 |  |
| 11 | 12160→13080 | 920 (23) | cut | pull-out | -1.0 | mid/colour / 78 |  |
| 12 | 13080→14000 | 920 (23) | cut | static | +0.1 | black / 14 |  |
| 13 | 14000→14880 | 880 (22) | cut | push-in, pan/track L, parallax/orbit | +8.5 | mid/colour / 50 |  |
| 14 | 14880→15360 | 480 (12) | cut | push-in | +4.2 | mid/colour / 93 |  |
| 15 | 15360→16080 | 720 (18) | fondu 25 img | push-in | +4.4 | light / 147 |  |
| 16 | 16080→16520 | 440 (11) | cut | pull-out | -2.6 | mid/colour / 74 |  |
| 17 | 16520→17480 | 960 (24) | cut | parallax/orbit | +0.8 | black / 14 |  |
| 18 | 17480→17760 | 280 (7) | →noir | static | -0.0 | black / 4 |  |
| 19 | 17760→20000 | 2240 (56) | cut | push-in | +1.8 | black / 19 |  |
| 20 | 20000→21040 | 1040 (26) | cut | push-in, pan/track L | +3.2 | mid/colour / 40 |  |
| 21 | 21040→22160 | 1120 (28) | cut | push-in, pan/track R, roll, parallax/orbit | +5.9 | black / 12 |  |
| 22 | 22160→23120 | 960 (24) | cut | pull-out | -1.2 | black / 21 |  |
| 23 | 23120→24040 | 920 (23) | cut | static | -0.1 | mid/colour / 28 |  |
| 24 | 24040→24360 | 320 (8) | cut | pull-out, parallax/orbit | -7.5 | black / 33 |  |
| 25 | 24360→25040 | 680 (17) | cut | subtle drift | -0.5 | mid/colour / 44 |  |
| 26 | 25040→26240 | 1200 (30) | cut | push-in, parallax/orbit | +14.7 | black / 20 |  |
| 27 | 26240→27320 | 1080 (27) | cut | push-in, parallax/orbit | +0.9 | mid/colour / 34 |  |
| 28 | 27320→30000 | 2680 (67) | cut | static | +0.0 | mid/colour / 35 |  |

</details>

### 2.9 N1 — Nike « Find Your Greatness », manifeste « London » (61 s, 54 plans)

Le fichier est une compilation de 6 min 32 comprenant « Jogger », un **plan-séquence unique de 60 060 ms** et le spot le plus lent possible. Mesures sur le manifeste final (330,9 → 391,9 s) :
- Médiane **980 ms**. **1ʳᵉ moitié à 1 210 ms, 2ᵉ moitié à 855 ms**. Rafale de 5 plans de **125 à 334 ms** à 372,5 s (panneaux « London » : Fire Dept., Primary, tatouage, Ave), suivie d'une **descente sur des plans de 2,2 s, 2,2 s puis 3,5 s** (plongeoir → swoosh).
- Carton « FIND YOUR GREATNESS. » en capitales grasses condensées, blanches, centrées sur l'image (≈ 5 % de la hauteur, estimé sur planche). Swoosh final blanc sur l'image pendant 3,46 s, puis carton de 0,9 s.
- Pas de grille de tempo : le montage suit la **voix off**. Voix off (Whisper) : **82 mots entre 333,7 et 383,8 s**, soit **1,6 mot/s sur la durée et 2,0 à 3,6 mots/s à l'intérieur des phrases**. 9 phrases de **2,7 s** en médiane, séparées par **2,6 s** en médiane : c'est deux fois plus d'air que chez Apple. La rafale de panneaux « London » (372,5 s) tombe **dans le silence entre** « greatness is not in one special place » et « …not in one special person ». La dernière phrase se termine à 383,8 s. **Suivent 3,7 s d'images et de musique sans parole avant le swoosh (387,5 s)**, puis 0,8 s de silence final.

<details><summary>Table des plans (mesurée, 54 plans)</summary>

| # | début→fin (ms) | durée ms (img) | entrée | mouvement de l'image (flux optique) | échelle %/s | fond / lum. moy. | note |
|---|---|---|---|---|---|---|---|
| 63 | 330872→332666 | 1793 (43) | cut | pull-out | -0.8 | mid/colour / 129 |  |
| 64 | 332666→333375 | 709 (17) | cut | static | -0.1 | black / 75 |  |
| 65 | 333375→334626 | 1251 (30) | cut | pan/track L | -0.6 | mid/colour / 122 |  |
| 66 | 334626→336378 | 1752 (42) | cut | static | -0.0 | black / 88 |  |
| 67 | 336378→337295 | 918 (22) | cut | pull-out | -0.9 | mid/colour / 137 |  |
| 68 | 337295→338088 | 792 (19) | cut | push-in, pan/track R, roll, parallax/orbit | +11.7 | black / 56 |  |
| 69 | 338088→339381 | 1293 (31) | cut | static | +0.1 | mid/colour / 117 |  |
| 70 | 339381→340340 | 959 (23) | cut | pull-out, parallax/orbit | -1.1 | mid/colour / 111 |  |
| 71 | 340340→341508 | 1168 (28) | cut | static | +0.1 | mid/colour / 101 |  |
| 72 | 341508→342551 | 1043 (25) | cut | push-in, pan/track R, roll, parallax/orbit | +19.6 | mid/colour / 123 |  |
| 73 | 342551→343885 | 1335 (32) | cut | push-in, parallax/orbit | +3.2 | mid/colour / 147 |  |
| 74 | 343885→345470 | 1585 (38) | cut | pull-out, pan/track R, roll, parallax/orbit | -7.8 | mid/colour / 115 |  |
| 75 | 345470→346304 | 834 (20) | cut | pull-out, pan/track R, tilt/crane up, roll, parallax/orbit | -12.9 | mid/colour / 90 |  |
| 76 | 346304→347389 | 1084 (26) | cut | pan/track R | +0.5 | mid/colour / 130 |  |
| 77 | 347389→348640 | 1251 (30) | cut | push-in, pan/track L, parallax/orbit | +2.6 | mid/colour / 132 |  |
| 78 | 348640→350183 | 1543 (37) | cut | push-in, pan/track R, tilt/crane down, parallax/orbit | +2.8 | mid/colour / 82 |  |
| 79 | 350183→351268 | 1084 (26) | cut | pull-out, parallax/orbit | -1.6 | mid/colour / 87 |  |
| 80 | 351268→353853 | 2586 (62) | cut | pull-out, parallax/orbit | -5.8 | black / 71 |  |
| 81 | 353853→354646 | 792 (19) | cut | push-in, roll, parallax/orbit | +0.9 | mid/colour / 105 |  |
| 82 | 354646→356106 | 1460 (35) | cut | pull-out, pan/track R, tilt/crane up, roll, parallax/orbit | -19.5 | mid/colour / 107 |  |
| 83 | 356106→356648 | 542 (13) | cut | pan/track R, parallax/orbit | +0.5 | mid/colour / 78 |  |
| 84 | 356648→357607 | 959 (23) | cut | pull-out, pan/track R, roll, parallax/orbit | -11.2 | mid/colour / 93 |  |
| 85 | 357607→359359 | 1752 (42) | cut | push-in, roll, parallax/orbit | +4.8 | black / 82 |  |
| 86 | 359359→362362 | 3003 (72) | cut | pull-out, pan/track R, roll, parallax/orbit | -12.6 | mid/colour / 101 |  |
| 87 | 362362→363154 | 792 (19) | cut | static | -0.1 | black / 40 |  |
| 88 | 363154→364948 | 1793 (43) | cut | pull-out, roll, parallax/orbit | -1.6 | black / 54 |  |
| 89 | 364948→365574 | 626 (15) | cut | pan/track R, roll, parallax/orbit | +0.6 | black / 44 |  |
| 90 | 365574→366283 | 709 (17) | cut | push-in, tilt/crane up, roll, parallax/orbit | +12.4 | mid/colour / 80 |  |
| 91 | 366283→367367 | 1084 (26) | cut | subtle drift | +0.3 | mid/colour / 78 |  |
| 92 | 367367→368702 | 1335 (32) | cut | push-in, roll | +1.9 | black / 62 |  |
| 93 | 368702→369619 | 918 (22) | cut | pull-out, pan/track L, roll, parallax/orbit | -1.8 | mid/colour / 105 |  |
| 94 | 369619→370203 | 584 (14) | cut | roll, parallax/orbit | +0.3 | mid/colour / 122 |  |
| 95 | 370203→370954 | 751 (18) | cut | subtle drift | +0.1 | mid/colour / 96 |  |
| 96 | 370954→371955 | 1001 (24) | cut | static | -0.0 | mid/colour / 115 |  |
| 97 | 371955→372497 | 542 (13) | cut | pull-out, pan/track R, parallax/orbit | -2.9 | mid/colour / 100 |  |
| 98 | 372497→372622 | 125 (3) | cut | static | +0.0 | mid/colour / 103 |  |
| 99 | 372622→372789 | 167 (4) | cut | roll, parallax/orbit | -0.5 | mid/colour / 109 |  |
| 100 | 372789→373123 | 334 (8) | cut | subtle drift | +0.0 | black / 68 |  |
| 101 | 373123→373373 | 250 (6) | cut | push-in, tilt/crane down, roll | +2.5 | mid/colour / 103 |  |
| 102 | 373373→373707 | 334 (8) | cut | static | -0.0 | mid/colour / 146 |  |
| 103 | 373707→375083 | 1376 (33) | cut | push-in, tilt/crane down, parallax/orbit | +2.0 | mid/colour / 83 |  |
| 104 | 375083→375959 | 876 (21) | cut | push-in, pan/track L, parallax/orbit | +4.2 | mid/colour / 98 |  |
| 105 | 375959→377335 | 1376 (33) | cut | subtle drift | -0.2 | mid/colour / 128 |  |
| 106 | 377335→377794 | 459 (11) | cut | push-in, roll, parallax/orbit | +2.4 | mid/colour / 112 |  |
| 107 | 377794→378211 | 417 (10) | cut | pull-out, pan/track L, roll, parallax/orbit | -13.8 | mid/colour / 90 |  |
| 108 | 378211→378920 | 709 (17) | cut | pull-out, pan/track R, tilt/crane up, parallax/orbit | -6.9 | black / 81 |  |
| 109 | 378920→380171 | 1251 (30) | cut | subtle drift | -0.0 | black / 58 |  |
| 110 | 380171→381089 | 918 (22) | cut | pan/track R, tilt/crane down, parallax/orbit | +0.1 | mid/colour / 69 |  |
| 111 | 381089→381923 | 834 (20) | cut | push-in, pan/track L, roll, parallax/orbit | +5.7 | mid/colour / 109 |  |
| 112 | 381923→383008 | 1084 (26) | cut | push-in, pan/track L, roll, parallax/orbit | +1.3 | mid/colour / 123 |  |
| 113 | 383008→385302 | 2294 (55) | cut | pull-out | -2.0 | mid/colour / 133 |  |
| 114 | 385302→387470 | 2169 (52) | cut | subtle drift | -0.2 | mid/colour / 135 |  |
| 115 | 387470→390932 | 3462 (83) | cut | static | -0.0 | mid/colour / 144 |  |
| 116 | 390932→391850 | 918 (22) | cut | static | +0.0 | black / 0 |  |

</details>

---

## 3. La grammaire Apple / premium, mesurée

### 3.1 Durée des plans (ce qui fait « cher »)

| Registre | Durée médiane | Distribution typique | Exemple |
|---|---|---|---|
| **Produit hero / design** (le produit seul, contemplé) | **2,4–2,6 s** | 65 % des plans > 2 s ; plans « signature » de **5 à 9 s** (4–5 par film) | A2 : 9,3 s, 5,9 s, 8,2 s, 5,3 s, 5,9 s, 8,1 s |
| **Studio lumière, rythmé** | **0,76 s** (en réalité 3 valeurs : **0,43 / 1,28 / 2,56 s**) | 50 % < 500 ms mais 17 % > 2 s | P1 |
| **Démonstration tech / manifeste** | **0,67–0,98 s** | P10 ≈ 0,21–0,43 s, P90 ≈ 1,8–2,7 s | A1, A3, N1, S1, B1 |
| **Rafale de « série »** (même cadrage, un seul paramètre change) | **125–167 ms (3–4 images)** | 5 à 11 plans d'affilée, puis un plan tenu ≥ 1 s | A1 (A5→A20), N1 (panneaux London), P1 (inserts de fin) |
| **Plans d'ouverture et de clôture** | **2,5–9 s** | le 1ᵉʳ plan est souvent le plus long du film | A1 : 9,0 s ; A2 : 9,3 s ; A3 : 2,6 s ; A4 : 2,5 s ; P2 : 2,5 s de noir |

**Règle de progression** : on accélère par tiers (A3 : 1,75 → 0,83 → 0,71 s ; P1 : 1,28 → 1,16 → 0,40 s ; N1 : 1,21 → 0,86 s), puis on **décélère brutalement** sur les 4 à 8 dernières secondes (plans de 2 à 4 s avant la signature).

### 3.2 Mouvements de caméra

- **Push-in sur produit** : **1,0 %/s** (P1, studio luxe), **1,6 %/s** (A2 design), **2,7–4,7 %/s** (S1, A1, A3, A4). **Au-delà de 8 %/s**, on est dans l'insert en rampe de vitesse (P90 de A1 : 17 %/s ; A3 : 28 %/s ; pointe de 31 %/s sur l'objectif A1 #89). En pratique, un plan hero de 2,5 s à 1 %/s ne gagne que **2,5 % d'échelle**, ce qui reste imperceptible consciemment mais « vivant ».
- **Pull-out** : aussi fréquent que le push-in (P1 : 6 pull-outs contre 5 push-ins ; A3 : 18 contre 30), à des vitesses similaires (−1 à −5 %/s).
- **Panoramique ou travelling latéral** : 6 à 12 % de la largeur par seconde quand il existe. Il est rare sur le produit seul (P1 : 1 plan sur 58).
- **Part de plans statiques** : **55–57 %** sur les films les plus luxueux (P1, A2), contre 5–25 % sur les films énergiques (A3, A4, B1).
- **Rotation (roll)** : réservée aux inserts courts.

### 3.3 Durée de tenue du produit

- **Révélation hero** : 2,5 s statique (P1 #6), 5,9–9,3 s (A2), 4,9 s (A4 #24 final).
- **Détail ou macro** : 1,28 s (P1), 0,8–1,4 s (A1, A3).
- **Insert** : 0,40–0,44 s (P1), 0,125–0,33 s (rafales).
- **Tension avant révélation** : un fragment lumineux seul dans le noir pendant **1,8 s** (P1 : deux phares), ou **2,5 s de noir complet** (P2).

### 3.4 Typographie (mesurée)

| Élément | Taille (hauteur de ligne / hauteur d'image) | Entrée | Tenue | Sortie |
|---|---|---|---|---|
| Titre produit d'ouverture (A4) | **8,5 %**, largeur 37 %, centré, graisse moyenne, casse mixte | coupe franche (≤ 3 images) | 2,0 s | **smear chromatique de 9 images (300 ms)** |
| Carton nom final (A1) | **4,0 %**, largeur 18 %, blanc sur noir, centré | cut (0 image) | **2,4 s** | fin |
| Titre final sur image (A3) | titre ≈ 4 % + sous-titre ≈ 2 % (estimés sur planche) | cut, puis sous-titre en **2 étapes à 10 images d'écart** | **3,8 s** | fin |
| Textes de bénéfice (A4) | ≈ 2–3 %, **à côté du produit**, 1–2 lignes | 3 images, ou **construction mot par mot en 39–48 images (1,3–2,0 s)** | **2,6–4,3 s** | cut avec le plan |
| Typo cinétique (A3) | 3–5 %, mots dispersés dans le cadre | lettre par lettre, calée sur les frappes (sons) | 0,5–1 s après construction | cut |
| Lockup lettre = produit (A2 « A I R », S1 « U|tra ») | 58–87 % | apparition des lettres autour du produit (≈ 1 s) | 1,3–2,3 s | cut vers le logo |
| Logo final (A2, A4) | **13,5–15,6 %** de la hauteur (logo Apple), centré | cut ou morph d'une image | **1,9–3,4 s** | fin (+ 0–1,6 s de silence) |
| Carton final partenaires (P1) | 4,3 %, largeur 58 %, noir sur blanc | cut sec | **3,56 s** | fin |
| Samsung (S1) | accroches ≈ 4–5 %, logo 5,4 % | 9 images | 27 images | 24 images |

**Règles** : (1) Apple **n'utilise presque jamais de fondu enchaîné sur le texte**. Le texte arrive en cut, mot par mot, ou par un effet signature (smear RVB, lettres qui tombent), et **sort en cut avec le plan**. (2) **Une idée par carton**, 2 à 6 mots, **2,5 à 4 s d'écran**. (3) Le texte est **petit** (2 à 8,5 % de la hauteur) et **centré, ou placé contre le produit**. Les grands formats sont réservés au lockup « lettre = produit ». (4) Au plus une couleur d'accent par carton.

### 3.5 Comportements de la lumière

- **Balayage spéculaire** (le reflet d'une source étendue glisse sur la surface) : **14 à 37 % de la largeur du cadre par seconde**, médiane ≈ **19 %/s**. Il faut donc **2 à 4 s pour traverser le produit**. Mesures : P2 : 19, 14, 37, 24 %/s ; P1 : 18 et 37 %/s ; A2 : 17 %/s ; S1 (logo) : 17 %/s.
- **Allumage** : chez Apple et Porsche, on passe **du noir à la lumière par un cut** (A1 : labo allumé en 4 cuts de 125 à 250 ms ; P1 : phares seuls → voiture éclairée). Ce n'est jamais un fondu lent. Seules les LED de P2 s'allument progressivement (rampe de 360 ms).
- **Contre-jour + fumée + flare** : P1 les réserve au dernier tiers (fumée 2 × 2 s avant le logo).
- **Une seule source par plan**, dure et placée haut, **le noir tombe hors du pool**. En studio noir, P1 fait tenir 58 % de ses images sous luma 40, P2 94 %.

### 3.6 Couleur et fonds

- **Deux mondes possibles, jamais mélangés dans un même bloc** : **monde blanc** (A4 : luma 215 ; A2 : blanc cassé chaud 224 au logo) ou **monde noir** (P1 : bronze sur noir ; P2 : blanc froid sur noir ; A1 : bleu pétrole et noir ; S1 : noir + une teinte, le bordeaux « Burgundy » du produit).
- **La couleur d'accent vient du produit ou de l'étalonnage**, pas du fond. Samsung décline le bordeaux du téléphone dans le halo du logo ; P1 donne une dominante bronze à toute la palette.
- **Changement de monde = moment de récit** : le noir bascule vers un carton blanc au final (P1, S1 « Note-worthy »), le blanc vers le noir pour la démo (S1).

### 3.7 Transitions

- **Cut sec : 90 à 100 %** des transitions (A3 : 74 cuts sur 74 ; P1 : 57 sur 59 ; A1 : 167 cuts pour 10 fondus).
- **Match-cut sur la forme** : cycle de coloris A1 (cadrage identique), puces A5→A20, pilule → logo (A4), téléphone → lettre (A2, S1).
- **Morph ou smear chromatique** d'une image (A4) comme signature de marque.
- **Noir** : seulement en ouverture ou fermeture (P2), jamais en milieu de film chez Apple (A2 : 2 noirs).
- **Flashs blancs** : 0 à 2 par film. Ce n'est pas un outil premium.

### 3.8 Son et cuts

- **Apple ne coupe pas sur une grille de tempo.** Le test de concentration de phase est **non significatif** pour A1, A2 et A4 (R = 0,15 ; 0,38 ; 0,47, sous le seuil nul à 95 % : 0,22 ; 0,43 ; 0,55). Il est limite pour A3. Les cuts à ±1 image d'un onset fort : **20 % (A1), 7 % (A2), 13 % (A3, A4), soit ≈ le hasard** (17 %, 15 %, 12 %, 13 %).
- **Chez Apple, c'est le son qui est monté sur l'image** : frappes clavier → notes de piano (A3), bruitages « CLICK / THUD / HISSING / CAMERA SHUTTER » posés sur les actions (sous-titres officiels d'A1).
- **Porsche P1 fait l'inverse : l'image est montée sur la musique.** 53 % des cuts sont sur la grille de 428 ms (hasard : 19 %) et 51 % à ±2 images d'un onset fort (hasard : 8 %). **C'est le modèle à suivre pour un film sans voix off.**
- **Voix off Apple** : **2,0–2,1 mots/s sur la durée**, **2,4–3,0 mots/s à l'intérieur des phrases**. Phrases de **3,7–5,0 s**, **≈ 1,2 s de musique seule entre deux phrases**. Voix présente **66–76 %** du temps.
- **Nom du produit** : prononcé **une fois, à la fin** (A2 : « This is iPhone Air » à −7 s de la fin, 3,5 s avant le logo), ou **jamais prononcé** (A1 : seulement sur le carton final).
- **Films sans voix off** : 6 sur 9 (A3, A4, P1, P2, S1, B1), dont **tous les films produit purs** (A4, P1, P2). Le film produit seul est un film de **musique + bruitages**.

### 3.9 Structure de fin (mesurée)

| Film | Dernier plan produit ou image | Carton ou logo | Durée du logo ou carton | Son sur le logo | Silence final |
|---|---|---|---|---|---|
| A1 | cycle des coloris (0,33–0,92 s par coloris) | « iPhone 18 Pro » blanc sur noir | **2,38 s** | musique jusqu'au bout | 0,2 s |
| A2 | lockup A‑I‑R, 2,3 s | logo Apple sur blanc chaud | **3,39 s** | **dernier coup de musique = cut vers le logo (±0,1 s)**, puis extinction | **1,6 s** |
| A3 | plan large + titre | titre sur image | **3,84 s** | notes éparses | **1,5 s** |
| A4 | pilule → morph | logo Apple sur blanc | **1,87 s** | coup sonore sur un glitch du logo | 0,1 s |
| P1 | fumée 2 × 2 s | carton blanc partenaires | **3,56 s** | queue de réverbération | 0,6 s |
| P2 | face avant | blason sur noir, fondu de 49 images | **19,4 s** (film de salon) | nappe | 1,6 s |
| S1 | packshot 3 s | Pre-order 1,28 s → logo | **0,96 s** | tenue | 0,7 s |

**Règle de synthèse** : **dernier plan produit de 2 à 4 s**, puis **cut** (pas de fondu) vers un **logo ou nom seul, centré, sur fond uni, tenu 2 à 3,5 s**. **Le dernier temps fort musical tombe sur le cut vers le logo**, puis la musique s'éteint et laisse **0,5 à 1,6 s de silence** avant la fin du fichier.

---

## 4. Blueprint : film de marque de 60 s pour un flacon de peptide de recherche (produit seul, sans personne)

**Paramètres** : 16:9, **25 i/s** (1 image = 40 ms), musique à **120 BPM** (1 temps = 500 ms, 1 mesure = 2 s, soit 30 mesures). Cuts **sur les temps**, comme dans P1. **Monde noir** : fond noir chaud #0B0B0C, une seule source dure en hauteur, verre et étiquette mis en valeur par des lignes spéculaires. **Accent unique** : la couleur du bouchon (reprise dans l'étalonnage). **Pas de voix off.** Optionnel : ≤ 12 mots au total, 2 mots/s, avec 1,2 s d'air entre les phrases. **Textes** : 4 cartons maximum, 2 à 5 mots, 3–4 % de la hauteur, blanc cassé, graisse Regular/Medium, centrés, entrée en cut, 3 s d'écran. Dans l'esprit des recherches 01 à 03, pas d'allégation de santé et mention « For research use only » sur l'end card.

| Temps (s) | Mesure(s) | Plan / action | Caméra | Lumière | Son | Texte |
|---|---|---|---|---|---|---|
| 0,0–2,0 | 1 | **Noir complet** | — | — | silence 0–1,0 s, puis nappe grave | — |
| 2,0–4,0 | 2 | **Ligne spéculaire seule** qui dessine l'épaule du flacon (seul le reflet existe) | fixe | barre lumineuse, balayage **20 %/s** (traverse le flacon en ≈ 2,5 s) | note tenue | — |
| 4,0–6,0 | 3 | 2ᵉ passage : la ligne descend le long du corps du flacon | fixe | balayage 25 %/s | + pulsation au temps | — |
| 6,0–8,0 | 4 | Macro de la sertissure alu, un seul point spéculaire | push-in **1 %/s** | spot dur en hauteur | — | — |
| 8,0–10,0 | 5 | **Tension** : le bouchon seul, éclairé, le reste du flacon dans le noir (équivalent des phares de P1) | fixe | — | montée | — |
| 10,0–12,5 | 6–7 (5 temps) | **RÉVÉLATION** : cut sur le flacon entier éclairé, 3/4 face, pool de lumière au sol, reflet sur le sol noir | statique, push-in 0,8 %/s | 1 douche haute + découpe de contour | **1ᵉʳ coup fort sur le cut** | — |
| 12,5–14,5 | 7–8 | Carton 1 sur noir, **3,5 % de la hauteur** | — | — | — | nom de marque (2 mots), cut, tenu 2,0 s |
| 14,5–20,0 | 8–10 | Alternance **détail 1,0 s / insert 0,5 s** : étiquette (lot, mentions), ménisque de lyophilisat, arête du verre, sertissure. 6 plans : 1,0 / 0,5 / 1,0 / 0,5 / 1,5 / 1,0 | push-in ou pull-out 1–2 %/s | balayage 30 %/s sur l'étiquette | cuts sur les temps | — |
| 20,0–24,0 | 11–12 | **Plan signature tenu 4 s** : le flacon tourne lentement (≈ 15°/s) sur un plateau noir miroir | orbite lente | la ligne spéculaire reste fixe pendant que le verre tourne | respiration | — |
| 24,0–27,0 | 13–14 | Carton 2 posé **à droite du flacon**, qui s'est décalé à gauche du cadre | fixe | — | — | preuve de qualité en 3–5 mots (ex. « ≥ 99 % HPLC »), construite mot par mot en 1,0 s puis tenue 2 s |
| 27,0–33,0 | 14–17 | **Séquence certificat** : macro du QR ou du numéro de lot, puis des feuilles de CoA en gros plan (graphique, pas de personne) : 4 plans de 1,5 s | pull-out 2 %/s | lumière froide rasante | — | — |
| 33,0–36,0 | 17–18 | Carton 3 (≤ 4 mots), centré | — | — | — | 3,0 s |
| 36,0–38,0 | 19 | **Rafale de « série »** : **8 plans de 250 ms** (≈ 6 images, 2 plans par temps), même cadrage, **seuls la teinte du bouchon et l'étiquette changent** d'une référence à l'autre (match-cut façon puces A5→A20) | identique au pixel près | identique | pulsations en croches | — |
| 38,0–39,0 | 20 | Le dernier flacon de la rafale **tenu 1,0 s** | — | — | coup | — |
| 39,0–46,0 | 20–23 | **Accélération** : 4 inserts de 1,0 s, puis 4 de 0,5 s, puis 4 de 0,25 s (durées divisées par 2 à chaque groupe). Gouttes de condensation, arête, reflet, bouchon, lettres de l'étiquette | micro push-in à 8–15 %/s (rampes) | flares, contre-jour | crescendo | — |
| 46,0–50,0 | 24–25 | **Décélération** : gamme complète des flacons alignés en plan large, pool de lumière. **Tenu 4 s** | pull-out 1 %/s | balayage final 20 %/s sur la rangée | tenue | — |
| 50,0–53,0 | 26–27 | Fumée ou brume à contre-jour autour d'un flacon unique (équivalent de P1) | fixe | contre-jour | redescente | — |
| 53,0–56,5 | 27–29 | **Carton final** : logo seul, centré, **≈ 12–14 % de la hauteur** (symbole) ou 4 % (logotype), sur noir. Ligne légale 1,5 % en bas : « For research use only. Not for human consumption. » | cut sec vers le logo | le logo lui-même balayé une fois par la lumière (comme SAMSUNG en ouverture de S1), 1,2 s | **dernier coup fort EXACTEMENT sur le cut vers le logo** | logo 3,5 s |
| 56,5–58,5 | 29 | Logo fixe | — | — | queue de réverbération | — |
| 58,5–60,0 | 30 | Logo fixe **ou** noir | — | — | **1,5 s de silence** | — |

**Contrôles chiffrés du blueprint** : 44 plans ; médiane 1,0 s (P1 : 0,76 s ; A3 : 0,96 s) ; 29 % de plans de 2 s ou plus, dont 3 plans de 4 s ou plus ; 41 % de plans à 0,5 s ou moins (P1 : 50 %) ; 100 % de cuts (seul fondu : l'ouverture) ; push-in hero ≤ 1 %/s ; balayages spéculaires de 20 à 30 %/s ; texte à l'écran 8 s sur 60 (hors logo) ; logo tenu 3,5 s + 1,5 s de silence.

---

## 5. Annexes — fichiers

- **Shot-lists JSON** (tous les plans, avec timecodes, mouvement, fond, couleurs dominantes, flashs, noirs, changements de lumière) : `frames/json/<film>.shots.json` ; synthèse : `frames/json/summary.json` ; audio (onsets, sonie par seconde, silences) : `frames/json/<film>.audio.json` ; typographie : `frames/json/type_timing.json` ; voix off (Whisper, horodatage au mot) : `frames/json/<film>.asr.json`.
- **Planches contact** : `frames/<film>_overview_N.jpg` (image du milieu de chaque plan, avec n° et timecode) et `frames/<film>_detail_N.jpg` (entrée, milieu et sortie de chaque plan).
- **Bandes image par image des moments clés** : `frames/strips/` (sortie du titre AirPods en smear, fin AirPods pilule → logo, révélation et fin de P1, balayage de lumière de P1 #15, fin iPhone Air A‑I‑R → logo, fin iPhone 18 Pro, typo cinétique MacBook, ouverture SAMSUNG balayée, fin Samsung).
- **Outils** (non copiés dans le dépôt) : `/tmp/claude-0/refs/tools/{analyze,shots,sheets,strip,typetrack,audio,summary,vo,mdtable}.py`. Vidéos sources : `/tmp/claude-0/refs/vid/`.
