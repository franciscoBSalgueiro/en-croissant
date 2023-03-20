<p align="center">
  <a href="#">
    
  </a>
  <p align="center">
   <img width="150" height="150" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </p>
  <h1 align="center"><b>En Croissant</b></h1>
  <p align="center">
  A Modern Chess Database.
    <br />
    <a href="https://encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
  </p>
</p>


En-Croissant is a free cross-platform chess GUI and analysis tool. It comes with a database, a powerful position search engine, opening explorer, and much more.

## Features

* Store and analyze your games from [lichess.org](https://lichess.org) and [chess.com](https://chess.com)
* Multi-engine analysis. Supports all UCI engines
* Prepare a repertoire with the opening explorer
* Simple engine and database installation and management

It also includes a database, similar to [OCGDB](https://github.com/nguyenpham/ocgdb), with support for absolute or partial position search.


## Building from source

Refer to the [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites) for the requirements on your platform.


```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm tauri build
```

The built app will be on `src-tauri/target/release`