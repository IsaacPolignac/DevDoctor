# PurePeptide — pub « SaaS » 30 s, en français

Composition HyperFrames (HTML + GSAP), 1080×1920, 30 fps, 30,00 s, son inclus.
Livrable : [`renders/purepeptide-30s-saas-fr.mp4`](renders/purepeptide-30s-saas-fr.mp4).

## Ce qui est utilisé

| Élément | Source |
| --- | --- |
| Logo (wordmark + symbole) | fichiers officiels du site : `brand-wordmark.svg`, `brand-symbol.svg` |
| Fioles | rendus officiels du site (`assets/vials/`) : BPC-157/TB-500, GHK-Cu, CJC-1295/Ipamorelin, Selank, Semax, IGF-1 LR3 + fiole générique |
| Site « en action » | captures mobiles et ordinateur de purepeptide.care en français (`assets/site/`), faites le 24/09/2026 |
| Chiffres et textes | uniquement ce qu'affiche le site : pureté HPLC 99.0 % (fiche BPC-157/TB-500), ≥ 99 %, Janoshik Analytical, 10 pays, expédition sous 24 h, « La pureté, prouvée. » |
| Voix off | votre prise ElevenLabs (voix « Hugo », modèle v3), découpée en 7 répliques |
| Musique | ElevenLabs Music (généré pour cette pub, instrumental, 120 BPM) |
| Bruitages | synthétisés (`tools/mix_audio.py`), aucun échantillon tiers |

Masqués dans les captures, pour respecter le brief (aucune allégation d'effet) : les étiquettes de catégorie
(« Récupération », « Croissance »…), les descriptions « étudié pour… », et les produits MT-2 et Retatrutide.

## Rendre la vidéo

```bash
npm install
npx hyperframes browser ensure
python3 tools/mix_audio.py           # régénère assets/audio/mix.wav (voix + musique + bruitages, -14 LUFS)
npx hyperframes check
npx hyperframes render --quality delivery -o renders/purepeptide-30s-saas-fr.mp4
tools/verify_output.sh renders/purepeptide-30s-saas-fr.mp4
```

## Structure

| Fichier | Rôle |
| --- | --- |
| `SCENES.md` | contrat de production : timings voix/musique, table des bruitages, raccords |
| `js/vo.js` | les 7 répliques : découpe dans la prise, placement, minutage mot à mot |
| `js/config.js` | faits et textes (tous issus du site) |
| `js/lib.js` | téléphone, loupe, curseur tactile, titres synchronisés à la voix |
| `js/scenes/*.js` | S1 accroche · S2-S3 vérification chercheur + fiche produit · S4-S5 qualité + COA · S6-S7 catalogue + preuves · S8 fin |
