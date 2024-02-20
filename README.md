<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    A modern Chess database.
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Discord Server</a>
    ·
    <a href="https://www.encroissant.org/download">Download</a>
    .
    <a href="https://www.encroissant.org/docs">Explore the docs</a>
  </p>
</div>

En-Croissant is a free cross-platform chess GUI and analysis tool. It comes with a database, a powerful position search engine, opening explorer, and much more.

## Features

- Store and analyze your games from [lichess.org](https://lichess.org) and [chess.com](https://chess.com)
- Multi-engine analysis. Supports all UCI engines
- Prepare a repertoire with the opening explorer
- Simple engine and database installation and management

It also includes a database, similar to [OCGDB](https://github.com/nguyenpham/ocgdb), with support for absolute or partial position search.

## Building from source

Refer to the [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites) for the requirements on your platform.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm tauri build -b none
```

The built app can be found at `src-tauri/target/release`

## Contributing

When it comes to open source, there are different ways you can contribute, all
of which are valuable. Here's few guidelines that should help you as you prepare
your contribution.

### Initial steps

Before you start working on a contribution, please check the issues page. It's possible someone else is already working on something similar, or perhaps there is a reason that feature isn't implemented. The maintainers will point you in the right direction.

> If you still have questions, please [check the Discord](https://discord.gg/tdYzfDbSSW)

### Submitting a Pull Request

- Fork the repo
- Clone your forked repository: `git clone git@github.com:{your_username}/en-croissant.git`
- Enter the en-croissant directory: `cd en-croissant`
- Create a new branch off the `master` branch: `git checkout -b your-feature-name`
- Implement your contributions (see the Development section for more information)
- Push your branch to the repo: `git push origin your-feature-name`
- Go to <https://github.com/franciscoBSalgueiro/en-croissant/compare> and select the branch you just pushed in the "compare:" dropdown
- Submit the new PR. The maintainers will follow up ASAP.

### Development

The following steps will get you setup to contribute changes to this repo:

1. After forking the repository, open it in your preferred IDE (`code .` for example)
2. To run the app in development mode, run `pnpm tauri dev`
3. Before submitting a PR, first [build the app](#building-from-source) and check every feature you've contributed to.
4. Format and lint your code using `pnpm format` followed by `pnpm lint`
5. Submit your pull request! The maintainers will get back to you ASAP.

### Extra Notes

The app uses the Rust language for interacting with the filesystem and the chess engine, and Vite (using TypeScript, of course) for displaying the GUI.

- The Rust code can be found in [src-tauri/src](./src-tauri/src/)
- The Vite code can be found in [src](./src/)
