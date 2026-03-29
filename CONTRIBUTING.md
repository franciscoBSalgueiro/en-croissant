# Contributing

When it comes to open source, there are different ways you can contribute, all
of which are valuable. Here's few guidelines that should help you as you prepare
your contribution.

## Table of Contents

- [Initial Steps](#initial-steps)
- [Development](#development)
  - [Commands](#commands)
  - [Developer Tools](#developer-tools)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Extra Notes](#extra-notes)

## Initial Steps

Before you start working on a contribution, please check the issues page. It's possible someone else is already working on something similar, or perhaps there is a reason that feature isn't implemented. The maintainers will point you in the right direction.

> If you still have questions, please check [the Discord](https://discord.gg/tdYzfDbSSW)

## Development

The following steps will get you setup to contribute changes to this repo:

- Fork the repo
- Clone your forked repository: `git clone git@github.com:{your_username}/en-croissant.git`
- Enter the en-croissant directory: `cd en-croissant`
- Create a new branch off the `master` branch: `git checkout -b your-feature-name`
- Install dependencies `pnpm i` (or `pnpm install`)
- Open the code in your preferred IDE and contribute your changes

> It is recommended take a look at the [Commands](#commands) and [Extra Notes](#extra-notes) sections before starting.

### Commands

- `pnpm i` / `pnpm install` - Installs all dependencies.
- `pnpm dev` - Starts the app in development mode.
- `pnpm dev:react-devtools` - Starts the app and React DevTools together.
- `pnpm test` - Runs all tests.
- `pnpm format` - Formats the project according to project guidelines.
- `pnpm lint` - Runs type-checking (`tsgo --noEmit`) and linting.
- `pnpm lint:fix` - Runs lint auto-fixes where possible.
- `pnpm lint:ci` - Runs CI-style checks (types, formatting check, lint, i18n extract check).
- `pnpm i18n:extract` - Extracts translation keys and updates files in [src/translation](./src/translation/).
- `pnpm i18n:status` - Shows translation status.
- `pnpm i18n:types` - Generates i18n types.
- `pnpm i18n:sync` - Synchronizes translation resources.
- `pnpm tauri` - Runs Tauri CLI commands directly.
- `pnpm build` - Builds the app from source. The built app can be found at [src-tauri/target/release](./src-tauri/target/release/).

### Developer Tools

#### React DevTools (standalone)

1. Start en-croissant together with React DevTools using `pnpm dev:react-devtools`.
2. React DevTools will connect to the app automatically on `localhost:8097` and let you inspect the React tree.

If React DevTools does not connect, restart `pnpm dev:react-devtools` and refresh the app window.

## Submitting a Pull Request

- Implement your contributions (see the [Development](#development) section for more information)
- Before submitting a PR, first build the app using `pnpm build` and check every feature you've contributed to.
- Format and lint your code using `pnpm format` followed by `pnpm lint:fix`. If you added or changed any translation keys, run `pnpm i18n:extract` to update the translation files.
- Go to [the comparison page](https://github.com/franciscoBSalgueiro/en-croissant/compare) and select the branch you just pushed in the `compare:` dropdown
- Submit the new PR. The maintainers will follow up ASAP.

## Extra Notes

The app uses the Rust language for interacting with the filesystem, chess engines and databases, and React with Vite (using TypeScript, of course) for displaying the GUI.

- The Rust code can be found in [src-tauri/src](./src-tauri/src/)
- The React code can be found in [src](./src/)
