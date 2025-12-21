<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    Den Ultimate Sjakkverktøykassen
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Discord-server</a>
    ·
    <a href="https://www.encroissant.org/download">Last ned</a>
    .
    <a href="https://www.encroissant.org/docs">Utforsk dokumentasjonen</a>
  </p>
</div>

En-Croissant er en åpen kildekode, plattformuavhengig sjakk-GUI som sikter på å være kraftig, tilpassbar og enkel å bruke.


## Funksjoner

- Lagre og analyser dine partier fra [lichess.org](https://lichess.org) og [chess.com](https://chess.com)
- Flermotor-analyse. Støtter alle UCI-motorer
- Forbered et repertoar og tren det med spredt repetisjon
- Enkel motor- og databaseinstallasjon og -administrasjon
- Absolutt eller delvis posisjonssøk i databasen

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Bygging fra kildekode

Se [Tauri-dokumentasjonen](https://tauri.app/v1/guides/getting-started/prerequisites) for kravene på din plattform.

En-Croissant bruker pnpm som pakkebehandler for avhengigheter. Se [pnpm-installasjonsinstruksjoner](https://pnpm.io/installation) for hvordan du installerer det på din plattform.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

Den bygde applikasjonen kan finnes i `src-tauri/target/release`

## Doner

Hvis du ønsker å støtte utviklingen av denne GUI-en, kan du gjøre det [her](https://encroissant.org/support). Alle donasjoner settes stor pris på!

## Bidra

For å bidra til dette prosjektet, se [bidragsveiledningen](./CONTRIBUTING.md).
## Lisens
Denne programvaren er lisensiert under GPL-3.0-lisensen.
