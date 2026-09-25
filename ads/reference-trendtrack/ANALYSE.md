# Analyse image par image — vidéo de référence « Trendtrack Q4 mode »

Source : `optimized_1f49b50…mp4` — 3840×2160 (16:9), HEVC, **30 fps**, **68,03 s = 2 041 images**, AAC stéréo 48 kHz.
Méthode : les 2 041 images extraites et comparées une à une (écart moyen image → image), planches à 3 img/s sur
toute la durée + planches à **chaque image (33 ms)** sur les 7 transitions signatures, transcription Whisper de la
voix, détection des attaques audio. Précision réelle : 1 image = 33,3 ms (il n'existe pas d'information plus fine
dans la vidéo).

## 1. ADN visuel

| Élément | Mesure |
| --- | --- |
| Fond | noir quasi pur (luminance moyenne 12–35/255), **halo vert néon en bas de l'écran** en permanence (« lumière de scène » elliptique) |
| Couleur d'accent | vert/jaune néon **~#8CFF2E → #D6FF3A** (lime), une seule couleur d'accent sur 68 s |
| Typo | sans-serif géométrique grasse (type Satoshi/General Sans), blanc + **mot-clé en vert** dans chaque phrase |
| UI | vraies captures du produit en **mode sombre**, cartes arrondies, bordure 1 px, **liseré lumineux vert** sur le bord supérieur/gauche |
| Profondeur | cartes en 3D légère (perspective, rotation Y 10–25°), flou de profondeur sur les éléments d'arrière-plan |
| Voix | voix off anglaise, **une phrase ≈ un plan**, phrases calées sur des blocs de 2 s ou 3 s exactement (0.21, 2.21, 4.21, 6.21, 9.21…) |
| Rythme | coupes/événements toutes les **0,33 à 1 s** ; 3 « flashs » plein écran seulement (6,4 s · 49,3 s · 59,0 s) |

## 2. Timeline plan par plan (voix → image)

| t (s) | Voix | Image |
| --- | --- | --- |
| 0.00–1.17 | « Q4 is coming. » | « Q4 » gris métal apparaît **en fondu + blur→net** (f2→f15, 0,07→0,5 s), se rapproche lentement (scale ~0,9→1) |
| **1.17–1.30** | | **Zoom-traversée** : « Q4 » grossit ×8 en 4 images (f34→f38) et on passe *à travers* le « O » → révèle le plan suivant (transition « lettre-masque ») |
| 1.30–4.2 | « Nobody knows… » | « Q4 is coming » (mots qui arrivent un par un, décalés en hauteur) + **compte à rebours à volets** 010:09:59:49 qui décompte en temps réel, globe 3D filaire en bas |
| 4.2–6.2 | « Until now. » | Compteur qui **défile à toute vitesse** (volets flous) → 000:00:00:00, globe s'allume en vert, mot géant « UNTIL NOW » en fond (transparent 10 %) |
| **6.30–6.80** | « Welcome to… » | Zoom sur les zéros (f190→f191, ×2), **coupe sur logo « T »**, puis **anneau vert** qui jaillit du logo et s'étend hors cadre en **8 images** (f193→f201 = 270 ms) |
| 7.03–7.75 | « Trendtrack's Q4 mode » | Wordmark **tapé lettre par lettre** (1 lettre ≈ 1 image, f211→f225), un **reflet vert balaye** les lettres pendant la frappe, pastille « Q4 » qui pop à la fin |
| 8.6–9.9 | | Le wordmark se dissout, seule la pastille « Q4 » reste et **pulse** (glow ×2) |
| **9.90–10.07** | | La pastille « Q4 » s'agrandit en **carte UI** (morph : le coin haut-gauche de la carte part de la pastille, f294→f302 = 270 ms) |
| 10.1–13.0 | « See what was winning last Black Friday… » | Barre d'onglets du produit ; **curseur** qui clique « Black Friday » (surbrillance verte 1 image avant le clic), puis « Cyber Monday », « Christmas » **sur chaque mot prononcé** |
| 13.0–18.0 | « …what brands are testing right now. Because the data never stops updating » | Tableau de données en 3D qui **s'incline et défile en continu** ; texte « data / never stops / updating. » mot à mot à gauche (mot vert au centre) |
| **17.87–18.20** | « It starts with the Q4 page » | **Rideau lumineux** : une ligne verticale verte balaie l'écran de droite à gauche (f537→f541), révèle la page Q4 cadrée par un **néon en L** |
| 18.2–20.0 | | La page se construit **bloc par bloc de haut en bas** (en-tête → tableau → visuels), 1 bloc toutes les ~3 images |
| 20.2–22.4 | « Our picks of the season… » | Zoom sur 3 visuels + titre « Trendtrack **picks** » ; curseur qui survole, la carte survolée se soulève |
| 22.4–25.2 | « …the biggest brands » | Titre « The **biggest brands** » mot à mot au-dessus d'une rangée de cartes marques |
| 25.2–29.2 | « How many ads, emails, and products… » | Carte « Gymshark » isolée, zoom ; **barre de surbrillance verte** qui descend de ligne en ligne (Ads → Emails → Products) sur chaque mot prononcé |
| 29.3–34.0 | « Go deeper. New filters… Built for the past » | Filtres (« Status », « Ad countries », « Media types »…) qui **apparaissent un par un en pop**, puis on sélectionne « Ad creation date » : un **éclair vert** traverse le bouton (f940), le calendrier s'ouvre, dates tapées |
| 34.2–36.4 | « How many live ads did that brand run during » | Texte seul, **mot à mot synchronisé à la voix** (1 mot = 1 apparition), mots-clés en vert |
| **36.43** | « Q4? » | Coupe dure sur « Q4? » géant vert, **reflet blanc qui traverse les lettres** (f1102→f1109), mur de « Q4? » répétés en fond qui défile |
| 37.5–39.1 | « Pick any shop. » | Barre de recherche : texte tapé, résultat « IM8 Health » surligné, curseur qui clique |
| 39.1–46.8 | « Their whole Q4 day by day… » | Graphique en barres : **une barre (pic du Black Friday) pousse d'abord seule**, puis toutes les autres, zoom arrière, puis pan vers décembre où les barres « se taisent » |
| 46.8–49.2 | « And every ad they ran broken down. » | 3 cartes pub côte à côte, la centrale se **soulève** |
| **49.20–49.70** | « Not just the creative » | **Flash néon** : la carte centrale devient un rectangle vert plein (f1476→f1480), **anneau lumineux** qui s'étend (f1481→f1489), éclatement en « système solaire » d'éléments flottants (vignettes, globe, citation) |
| 50.8–59.0 | « The offer / the audience / the hook / the script… » | Pour chaque mot : la caméra **vole jusqu'à un élément**, titre « **the offer** behind it » etc. (partie verte d'abord), cartes UI avec contour néon, globe 3D qui tourne, curseur sur les réglages ; **ligne pointillée** qui relie l'étiquette « The hook » à la ligne du texte |
| **58.93** | | 2ᵉ flash néon (même mécanique : carte → rectangle vert → anneau → retour au calme) |
| 59.2–62.2 | « Take any ad and read the whole strategy inside » | La pub + son panneau d'analyse s'ouvrent côte à côte |
| **62.23–62.9** | « Find what's winning… » | Coupe au noir + halo ; « Find » seul, puis **le wordmark « Trendtrack » tombe du haut** en très grand et se pose en petit (f1880→f1890, 330 ms, ease-out fort) |
| 63.0–65.4 | « …in e-com anytime » | Phrase mot à mot ; « **in 2025** » qui **roule comme un compteur** (2025 → 2024 → 2023… floutés) puis se fige sur « **anytime** » |
| 64.7–68.0 | | Bouton CTA « trendtrack.io » qui pop, **curseur qui clique** (pulse de glow), plan final tenu 3 s (pas de fondu) |

## 3. Les 7 recettes de motion (timings mesurés)

1. **Texte mot à mot synchronisé à la voix** — chaque mot apparaît *au moment où il est dit* (fondu 2–3 images + légère montée ~8 px + petit flou), le mot-clé en vert ; la phrase ne se déplace pas. C'est ~60 % de la vidéo.
2. **Zoom-traversée dans une lettre** (1,17 s) — 4 images seulement, accélération exponentielle, le plan suivant apparaît dans le contre-poinçon.
3. **Flash + anneau néon** (6,4 · 49,3 · 59,0 s) — élément → aplat vert plein (4 images) → anneau qui s'étend du centre hors cadre (8 images, ease-out) → retour au noir. Réservé aux 3 grands moments.
4. **Pastille → carte (morph)** — un petit élément grandit en conteneur UI en ~8 images (≈270 ms), liseré vert sur le bord.
5. **Curseur réel** — flèche blanche qui glisse (ease-in-out ~0,3 s), l'élément cible s'allume en vert **1 image avant** le clic, léger « press » ; chaque clic tombe sur un mot de la voix.
6. **Barre de surbrillance qui parcourt une liste** — un dégradé vert glisse de ligne en ligne sur les mots prononcés.
7. **Wordmark tapé + reflet** et **compteur qui roule** (chiffres/années qui défilent en flou vertical puis se figent).

Transversal : caméra toujours en mouvement lent (push-in ou dérive latérale), UI en 3D légère, halo vert en bas de
chaque plan, flou de profondeur sur l'arrière-plan, **aucun fondu au noir** entre les scènes (coupes franches ou
transitions « objet »).

## 4. Son

- Voix off anglaise continue, niveau stable (≈ −14 dB RMS), phrases alignées sur une grille de 1 s (débuts à x,21 s).
- Musique + effets en dessous : attaques nettes aux moments clés (0,93 · 6,56 · 7,02 · 9,62 · 17,03 · 18,06 · 36,28 ·
  37,51 · 48,94–49,49 · 58,9…), tempo mesuré ≈ 86 BPM (172 en double-temps).
- Fin : le son s'éteint à 67,0 s, la dernière seconde est silencieuse.

## 5. Transposition PurePeptide (proposition)

Garder la mécanique, changer la peau : fond clair ou sombre au choix, accent = dégradé de marque
(#123A78 → #2A9AC2 → #16A48F) à la place du vert néon, votre voix Hugo, votre site en action.
Exemples : « Qu'y a-t-il vraiment dans votre fiole ? » → zoom-traversée dans le « O » de fiole ; clic curseur sur
« Vérifié · Pureté HPLC 99.0 % » ; barre de surbrillance qui descend les lignes du certificat ; flash + anneau sur le
QR code ; wordmark PUREPEPTIDE qui tombe en fin avec « La pureté, prouvée. » ; compteur qui roule jusqu'à « ≥ 99 % ».
