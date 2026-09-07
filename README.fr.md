<p align="center"><img src="apps/macos/Assets/AppIcon-1024.png" width="128" alt="Icône de DevDoctor"></p>

<h1 align="center">DevDoctor</h1>

<p align="center"><strong>Trouvez ce qui a cassé votre environnement de développement.</strong><br>Diagnostiquez, comprenez et réparez vos outils locaux en toute sécurité.</p>

<p align="center">
  <a href="https://github.com/IsaacPolignac/DevDoctor/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/IsaacPolignac/DevDoctor/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/IsaacPolignac/DevDoctor/releases/latest"><img alt="Dernière version" src="https://img.shields.io/github/v/release/IsaacPolignac/DevDoctor?display_name=tag&sort=semver"></a>
  <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg"></a>
  <img alt="Local par défaut" src="https://img.shields.io/badge/local-par%20défaut-34C759">
</p>

<p align="center"><a href="#télécharger"><strong>Télécharger</strong></a> · <a href="#installer-le-cli">Installer la CLI</a> · <a href="README.md">English</a> · <a href="CONTRIBUTING.md">Contribuer</a></p>

## Télécharger

| Votre ordinateur | Téléchargement conseillé |
| --- | --- |
| **Apple Silicon · macOS 26+** | **[Télécharger l’app Mac native](https://github.com/IsaacPolignac/DevDoctor/releases/download/v0.2.1/DevDoctor-v0.2.1-macos26-arm64.zip)** |
| **Apple Silicon · macOS 12–15** | **[Télécharger l’app Mac compatible](https://github.com/IsaacPolignac/DevDoctor/releases/download/v0.2.1/DevDoctor-Web-v0.2.1-macos-arm64.zip)** |
| **Windows 10/11 · x64** | **[Télécharger l’installateur Windows](https://github.com/IsaacPolignac/DevDoctor/releases/download/v0.2.1/DevDoctor-v0.2.1-windows-x64-setup.exe)** |

Les versions Mac Intel, MSI et ligne de commande se trouvent dans les [autres téléchargements](https://github.com/IsaacPolignac/DevDoctor/releases/tag/v0.2.1).

## DevDoctor en action

![Démonstration de DevDoctor : Overview, Problems, Runtimes et Developer Storage](docs/images/devdoctor-demo.gif)

Cette démonstration utilise uniquement des données fictives. Aucun nom d’utilisateur, chemin
personnel, nom de projet ou détail privé de l’environnement n’y apparaît.

DevDoctor réunit PATH, runtimes, gestionnaires de paquets, processus, ports, éléments de
démarrage, stockage de développement et outils d’IA locale dans une interface claire. Chaque
résultat présente sa cause, son impact et la modification proposée avant toute écriture.

## Ce que DevDoctor détecte

| Zone | Exemples |
| --- | --- |
| Shell et PATH | Entrées dupliquées ou absentes, liens cassés, fichiers de démarrage invalides, instructions `source` récursives |
| Runtimes | Installations Python ou Node concurrentes, incohérences `pip`/Python et `npm`/Node, PATH de rustup absent |
| Paquets et outils | Santé de Homebrew, permissions npm globales, paquets oubliés, Claude Code installé plusieurs fois |
| Activité | Processus de développement abandonnés, ports occupés, launch agents et services Homebrew |
| Stockage et IA locale | Caches volumineux, anciens `node_modules`, virtualenvs cassés et modèles Ollama |
| Historique | Instantanés de l’environnement, installations enregistrées et vue « Ce qui a changé » |

DevDoctor fournit actuellement 37 détecteurs et 18 réparations transactionnelles avec aperçu.

## Des réparations conçues pour être sûres

```text
détecter → expliquer → prévisualiser → sauvegarder → appliquer → valider
                                                           ↘ restaurer si échec
```

- Aucun `sudo`, compte ou système de télémétrie.
- Une réparation exige toujours un aperçu et une confirmation.
- Les fichiers modifiés sont sauvegardés avant l’écriture.
- Une validation échouée déclenche un retour arrière automatique.
- Les réparations éligibles restent annulables depuis l’Historique.
- Les rapports raccourcissent les chemins personnels et retirent les données sensibles probables.

## Une vraie application macOS

L’application macOS 26 est écrite en SwiftUI et utilise le même moteur Rust que la CLI. Elle
propose un radar de santé, des cartes par zone système, un inspecteur technique, l’aperçu exact
des réparations, les thèmes Système/Clair/Sombre et les contrôles Liquid Glass natifs. L’interface
existe en anglais, français, espagnol et chinois simplifié ; les diagnostics produits par le
moteur restent en anglais.

## Captures d’écran

<table>
  <tr>
    <td><img src="docs/images/demo-problems.png" alt="Problèmes et détails d’une réparation sûre"><br><sub><b>Problems</b> — preuves, impact et plan de réparation réunis.</sub></td>
    <td><img src="docs/images/demo-runtimes-tools.png" alt="Inventaire des runtimes"><br><sub><b>Runtimes</b> — voir quelles installations Node.js, Python et Rust sont réellement utilisées.</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/images/demo-developer-storage.png" alt="Developer Storage en mode sombre"><br><sub><b>Developer Storage</b> — comprendre l’espace récupérable avant tout nettoyage.</sub></td>
  </tr>
</table>

## Plateformes

| | Application | CLI | État |
| --- | --- | --- | --- |
| macOS 26+ | SwiftUI native, Apple Silicon | Apple Silicon et Intel | Plateforme principale |
| macOS 12–15 | Application Tauri, Apple Silicon | Apple Silicon et Intel | Pris en charge |
| Windows 10/11 | Tauri, MSI et installateur utilisateur | x64 | Bêta |

Linux n’est pas encore pris en charge. Sous Windows, DevDoctor détecte les problèmes de PATH
mais ne modifie pas automatiquement le registre.

## Installer le CLI

Chaque binaire téléchargeable possède un fichier `.sha256` associé sur la [page de la release](https://github.com/IsaacPolignac/DevDoctor/releases/tag/v0.2.1).

### CLI macOS

```sh
curl -fsSL https://raw.githubusercontent.com/IsaacPolignac/DevDoctor/main/scripts/install.sh | sh
```

Ou avec Homebrew :

```sh
brew tap IsaacPolignac/DevDoctor https://github.com/IsaacPolignac/DevDoctor
brew install devdoctor
```

### CLI Windows

```powershell
irm https://raw.githubusercontent.com/IsaacPolignac/DevDoctor/main/scripts/install.ps1 | iex
```

Les builds actuels ne sont pas encore notarisés sur macOS ni signés avec Authenticode sous
Windows. Les notes de version expliquent le premier lancement.

## Commandes utiles

```sh
devdoctor scan                         # analyse rapide
devdoctor scan --deep                  # vérifications plus longues
devdoctor issue <id>                   # preuves et aperçu
devdoctor fix <id>                     # confirmer et appliquer une réparation
devdoctor fix-safe                     # réparations confirmées à faible risque
devdoctor rollback <transaction-id>    # annuler une réparation éligible
devdoctor startup                      # mesurer le démarrage du terminal
devdoctor run <commande...>            # enregistrer les changements d’un installateur
devdoctor snapshot changes --since 24h
devdoctor report --markdown            # rapport d’assistance nettoyé
```

## Compiler le projet

Prérequis : Rust stable, Xcode 26 pour l’application native et Node.js 20+ pour Tauri.

```sh
git clone https://github.com/IsaacPolignac/DevDoctor.git
cd DevDoctor

cargo test --workspace --exclude devdoctor-desktop
cargo build --release -p devdoctor-cli

# Application native macOS 26
scripts/build-macos-app.sh --open

# Application Tauri
cd apps/desktop
npm ci
npm run tauri dev
```

Consultez [l’architecture](docs/ARCHITECTURE.md), les [choix techniques](docs/DECISIONS.md) et le
[guide de contribution](CONTRIBUTING.md). DevDoctor est publié sous [licence MIT](LICENSE).
