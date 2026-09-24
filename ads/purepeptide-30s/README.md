# PurePeptide — publicité 30 s « Purity you can verify. »

Composition HyperFrames (HTML + GSAP), 1080×1920, 30 fps, 30,00 s (900 images), son inclus.
Livrable : [`renders/purepeptide-30s.mp4`](renders/purepeptide-30s.mp4).

## À remplacer avant publication

Les valeurs ci-dessous sont des **substituts**. Elles doivent correspondre au vrai certificat d'analyse (COA) du lot montré :

| Variable      | Valeur actuelle                          | Remarque                                        |
| ------------- | ---------------------------------------- | ----------------------------------------------- |
| `PURITY`      | 99.3                                     | exemple du brief — imprimé tel quel (une décimale) |
| `TEST_DATE`   | 09/15/2026                               | substitut                                       |
| `M_OBS`       | 1419.6                                   | substitut (masse observée, sans l'unité)        |
| `M_EXP`       | 1419.5                                   | masse moyenne théorique du BPC-157              |
| `LAB`         | INDEPENDENT LAB                          | aucun nom de labo inventé                       |
| `COA_URL`     | https://purepeptide.care/coa/PP-2611-A   | le QR code encode cette URL : la page doit exister |
| `COUNTRIES`   | 30                                       | substitut — doit être vrai                      |
| `LOGO_URL`    | *(vide)* → logotype typographique        | PNG/SVG blanc transparent                       |
| `VIAL_URLS`   | *(vide)* → fiole SVG                     | rendus PNG transparents, dans l'ordre du catalogue |

Toutes les variables sont déclarées dans `index.html` (`data-composition-variables`) et lues par `js/config.js`.

## Rendre la vidéo

```bash
npm install                      # une fois
npx hyperframes browser ensure   # une fois (Chrome headless)
npx hyperframes check            # garde-fou : lint, runtime, mise en page, contraste
npx hyperframes render --quality delivery -o renders/purepeptide-30s.mp4 \
  --variables '{"PURITY":"99.1","BATCH":"PP-2701-B","TEST_DATE":"01/12/2027","M_OBS":"1419.4"}'
tools/verify_output.sh renders/purepeptide-30s.mp4   # 1080×1920 · 30 fps · 900 images · -14 LUFS · ≤ -1 dBTP
```

Nécessite Node ≥ 22 et FFmpeg. Rendu local ≈ 3–6 min sur 4 cœurs.

## Son

`assets/audio/soundtrack.wav` est entièrement synthétisé (aucun échantillon tiers) par `tools/make_audio.py`
(numpy/scipy, déterministe) : musique 120 BPM en ré mineur + tous les bruitages du brief, masterisée à -14 LUFS,
crête vraie -1,5 dBTP. Pour régénérer : `python3 tools/make_audio.py`. Les temps des bruitages sont dans la liste `CUES`.

## Structure

| Fichier                     | Rôle                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `BRIEF.md`                  | brief complet + décisions prises                                     |
| `SCENES.md`                 | contrat technique : API, règles de déterminisme, raccords entre scènes |
| `index.html`                | composition racine, jetons de design, polices embarquées, calques globaux |
| `js/lib.js`                 | helpers d'animation, fiole SVG, logotype, QR code                    |
| `js/global.js`              | grille, halo, grain, bloom ; assemble la timeline unique             |
| `js/scenes/s12.js … s8.js`  | une scène par fichier (S1+S2, S3, S4, S5, S6, S7, S8)                |
| `tools/snap.sh`             | captures PNG à des instants précis                                   |
