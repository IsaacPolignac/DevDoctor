# PurePeptide — pub « manifeste » 60 s, 16:9 (FR)

Pub 1920×1080, 30 fps, 60,00 s, son inclus, dans l'esprit des spots de grandes marques (Nike / Apple) :
problème → retournement → preuve → **vrai test du site** → marque.
Livrable : [`renders/purepeptide-manifeste-60s.mp4`](renders/purepeptide-manifeste-60s.mp4).

## Le film
| Temps | Voix (Paul K) | Image |
| --- | --- | --- |
| 0–12 s | « Vous en avez marre, hein ? Marre des peptides vendus par de faux labos. Des analyses… que personne ne montre. Des fioles… sans aucune preuve. » | fioles poussiéreuses sans étiquette sous un néon qui grésille (image IA générique, aucune marque), mots géants qui claquent |
| 12–17 s | « Nous aussi. Alors on a fait autrement. » | noir et silence, puis montée : la fiole PurePeptide sort de l'ombre, **drop à 17 s** (flash + anneau) |
| 17–30 s | « Chaque lot part dans un laboratoire indépendant. On vérifie que c'est le bon produit. On mesure sa pureté. 99 %, minimum. Et surtout… ne nous croyez pas sur parole. » | fiole en lumière, badge « Indépendant », carte d'analyse, compteur 99 %, « SUR PAROLE. » |
| 30–44 s | « Testez ! Choisissez votre référence. Regardez sa pureté, vérifiée. Commandez : expédié sous 24 heures, vers 10 pays. » | **enregistrement réel de purepeptide.care** : vérification chercheur, catalogue, BPC-157 / TB-500, ligne « Vérifié · Pureté 99.0 % », ajout au panier, panier ; étapes 01→04 |
| 44–60 s | « Pas de promesses. Des preuves. PurePeptide. La pureté, prouvée. » | les 6 fioles, « PAS DE PROMESSES. DES PREUVES. », logo tapé, bouton « Testez vous-même → purepeptide.care », mention légale |

## Le test du site (réel)
`tools/record_site.cjs` pilote Chrome sur le vrai site (FR), image par image à 30 i/s : il coche les deux cases de
vérification, entre, ouvre le catalogue, choisit BPC-157 / TB-500, montre la ligne de pureté, ajoute au panier et
ouvre le panier. Masqué pendant l'enregistrement (conformité pub) : étiquettes de catégorie (« Récupération »…),
descriptions « étudié pour… », fiches BAC Water / Retatrutide / MT-2, encart « eau bactériostatique pour
reconstituer », message WooCommerce en anglais, boutons « Détails du compte ».

## Outils
ElevenLabs (voix v3 « Paul K — French Ad & Trailer », musique Music v2 remontée à 60 s, bruitages, Scribe,
image Seedream 5 Pro) · Chrome/Puppeteer (test du site) · Whisper large-v3 (minutage mot à mot) ·
HyperFrames + GSAP (5 scènes construites en parallèle) · Python (mixage −14 LUFS, true peak ≤ −1,5 dBTP).
Canevas ElevenLabs : https://elevenlabs.io/app/flows/WcZuJTUMXr2o5bZRrFRi

## À corriger sur le site / à valider avant diffusion
1. **Traductions** : catalogue « Détails du compte » au lieu de « Détails » ; panier « Subtotal: » et message
   « …has been added to your cart. » en anglais sur la version FR.
2. **Certificats** : la page `/coa/` affiche « Certificats à venir » alors que la fiche indique « Certificat
   d'analyse inclus ». La pub ne dit plus « publié en ligne », mais publiez les certificats.
3. **« faux labos »** reste générique (aucun nom) ; faites valider la formulation comparative par votre conseil.
4. **Seuil** : « 99 %, minimum » reprend « Pureté HPLC ≥ 99 % » (accueil) ; la page Qualité parle de 98 %.

## Refaire
```bash
python3 tools/build_vo.py && python3 tools/mix_audio.py
CHROME=/path/to/chrome node tools/record_site.cjs /tmp/frames   # puis ffmpeg -framerate 30 -i /tmp/frames/f_%05d.jpg … assets/site-test/site_test.mp4
npx hyperframes render --quality delivery -o renders/purepeptide-manifeste-60s.mp4
tools/verify_output.sh renders/purepeptide-manifeste-60s.mp4
```
