# PurePeptide — motion design néon 30 s (FR)

Pub verticale 1080×1920, 30 fps, 30,00 s, son inclus, dans le style de la vidéo de référence Trendtrack
(analyse image par image : [`../reference-trendtrack/ANALYSE.md`](../reference-trendtrack/ANALYSE.md)).
Livrable : [`renders/purepeptide-neon-fr.mp4`](renders/purepeptide-neon-fr.mp4).

## Le film en 7 temps (texte simple, pour des prospects qui ne connaissent pas les termes techniques)
| Temps | Voix (Hugo) | À l'écran |
| --- | --- | --- |
| 0–4 s | « Vous achetez des peptides en ligne ? Mais savez-vous vraiment ce qu'il y a dans la fiole ? » | barre de recherche tapée + clic, la fiole monte, **plongée dans le « o » de « fiole »** |
| 4–8 s | « Chez PurePeptide, chaque lot part dans un laboratoire indépendant. » | la fiole voyage sur un tracé néon jusqu'à la carte « Laboratoire indépendant » ; **flash + anneau n° 1** sur le drop musical |
| 8–12 s | « On vérifie que c'est bien le bon produit, et on mesure sa pureté. » | carte « Analyse du lot » : scan de la fiole, barre de surlignage, coches |
| 12–14 s | « 99 %, minimum. » | **compteur qui roule** jusqu'à 99 %, **flash + anneau n° 2** |
| 14–18 s | « Et le rapport d'analyse est publié en ligne. Vous pouvez tout vérifier. » | **le vrai site en action** : fenêtre de navigateur 3D, curseur qui clique la ligne « Vérifié · Pureté 99.0 % · Certificat d'analyse inclus », loupe |
| 18–22 s | « Six références, expédiées sous 24 heures, vers 10 pays. » | les 6 fioles claquent une par une, carte « Expédition sous 24 h », globe « Livraison vers 10 pays » |
| 22–30 s | « PurePeptide. La pureté, prouvée. » | **flash + anneau n° 3**, logo tapé lettre par lettre avec reflet, bouton « purepeptide.care » cliqué, mention légale |

## Outils utilisés
| Outil | Rôle |
| --- | --- |
| ElevenLabs — voix v3 (Hugo « Serious and Professional ») | voix off dynamique, 3 prises générées, prise la plus expressive retenue (plus grande variation de ton mesurée) |
| ElevenLabs — Music v2 | musique 120 BPM, intro tendue puis drop à 8,00 s |
| ElevenLabs — Sound Effects | anneau néon, whoosh, clic, frappe clavier |
| ElevenLabs — Scribe | vérification de la prononciation de la prise |
| Whisper large-v3 + détection d'attaques | minutage mot à mot (texte synchronisé à la voix) |
| HyperFrames + GSAP | animation (7 scènes construites en parallèle, une seule timeline déterministe) |
| Python (numpy/scipy) | mixage : ducking de la musique sous la voix, −14 LUFS, true peak ≤ −1,5 dBTP |

Canevas ElevenLabs du projet : https://elevenlabs.io/app/flows/WcZuJTUMXr2o5bZRrFRi

## À valider avant diffusion
1. **« Le rapport d'analyse est publié en ligne. »** La fiche produit indique « Certificat d'analyse inclus », mais la
   page `/coa/` du site affiche encore « Certificats à venir ». Publiez les certificats avant de diffuser.
2. **Janoshik Analytical** est cité en texte simple (pas de logo) sous « Laboratoire indépendant », comme sur le site.
3. **Symbole de la marque** : version plus lumineuse du dégradé (`assets/brand/brand-symbol-neon.svg`) pour qu'il
   ressorte sur fond noir. Le logotype PUREPEPTIDE est la version claire officielle du site.
4. **« 99 %, minimum »** reprend « Pureté HPLC ≥ 99 % » de l'accueil ; la page Qualité parle d'un seuil de 98 % —
   à harmoniser sur le site.

## Refaire le rendu
```bash
npm install                     # (ou lien vers ../purepeptide-30s-saas/node_modules)
python3 tools/build_vo.py       # js/vo.js (découpe et minutage de la voix)
python3 tools/mix_audio.py      # assets/audio/mix.wav
npx hyperframes check
npx hyperframes render --quality delivery -o renders/purepeptide-neon-fr.mp4
tools/verify_output.sh renders/purepeptide-neon-fr.mp4
```
Contrat de production (timings, table des sons, règles) : `SCENES.md`.
