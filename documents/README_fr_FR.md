<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    La Boîte à Outils d'Échecs Ultime
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Serveur Discord</a>
    ·
    <a href="https://www.encroissant.org/download">Télécharger</a>
    .
    <a href="https://www.encroissant.org/docs">Explorer la documentation</a>
  </p>
</div>

En-Croissant est une interface graphique d'échecs open-source, multi-plateforme qui vise à être puissante, personnalisable et facile à utiliser.


## Fonctionnalités

- Stockez et analysez vos parties de [lichess.org](https://lichess.org) et [chess.com](https://chess.com)
- Analyse multi-moteurs. Prend en charge tous les moteurs UCI
- Préparez un répertoire et entraînez-le avec répétition espacée
- Installation et gestion simples de moteurs et de bases de données
- Recherche de position absolue ou partielle dans la base de données

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Compilation à partir des sources

Reportez-vous à la [documentation Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) pour les exigences sur votre plateforme.

En-Croissant utilise pnpm comme gestionnaire de paquets pour les dépendances. Reportez-vous aux [instructions d'installation de pnpm](https://pnpm.io/installation) pour savoir comment l'installer sur votre plateforme.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

L'application compilée peut être trouvée dans `src-tauri/target/release`

## Faire un don

Si vous souhaitez soutenir le développement de cette interface graphique, vous pouvez le faire [ici](https://encroissant.org/support). Tous les dons sont grandement appréciés !

## Contribuer

Pour contribuer à ce projet, veuillez vous reporter au [guide de contribution](./CONTRIBUTING.md).
## Licence
Ce logiciel est sous licence GPL-3.0.
