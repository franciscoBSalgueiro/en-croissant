<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    Набор Инструментов для Шахмат
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Сервер Discord</a>
    ·
    <a href="https://www.encroissant.org/download">Скачать</a>
    .
    <a href="https://www.encroissant.org/docs">Изучить документацию</a>
  </p>
</div>

En-Croissant - это открытый кроссплатформенный графический интерфейс для шахмат, который стремится быть мощным, настраиваемым и простым в использовании.


## Функции

- Сохраняйте и анализируйте свои игры с [lichess.org](https://lichess.org) и [chess.com](https://chess.com)
- Многодвижковый анализ. Поддерживает все движки UCI
- Подготовьте репертуар и тренируйте его с интервальным повторением
- Простая установка и управление движками и базами данных
- Поиск абсолютных или частичных позиций в базе данных

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Сборка из исходного кода

Обратитесь к [документации Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) для требований к вашей платформе.

En-Croissant использует pnpm в качестве менеджера пакетов для зависимостей. Обратитесь к [инструкциям по установке pnpm](https://pnpm.io/installation), чтобы узнать, как установить его на вашей платформе.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

Собранное приложение можно найти в `src-tauri/target/release`

## Пожертвовать

Если вы хотите поддержать разработку этого графического интерфейса, вы можете сделать это [здесь](https://encroissant.org/support). Все пожертвования высоко ценятся!

## Вклад

Для внесения вклада в этот проект, пожалуйста, обратитесь к [руководству по внесению вклада](./CONTRIBUTING.md).
## Лицензия
Это программное обеспечение лицензировано под лицензией GPL-3.0.
