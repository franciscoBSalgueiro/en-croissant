<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    Набір Інструментів для Шахів
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Сервер Discord</a>
    ·
    <a href="https://www.encroissant.org/download">Завантажити</a>
    .
    <a href="https://www.encroissant.org/docs">Дослідити документацію</a>
  </p>
</div>

En-Croissant - це відкритий кросплатформений графічний інтерфейс для шахів, який прагне бути потужним, налаштовуваним і простим у використанні.


## Функції

- Зберігайте та аналізуйте свої ігри з [lichess.org](https://lichess.org) та [chess.com](https://chess.com)
- Багаторушійний аналіз. Підтримує всі рушії UCI
- Підготуйте репертуар і тренуйте його з інтервальним повторенням
- Проста інсталяція та керування рушіями та базами даних
- Пошук абсолютних або часткових позицій у базі даних

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Збірка з вихідного коду

Зверніться до [документації Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) для вимог до вашої платформи.

En-Croissant використовує pnpm як менеджер пакетів для залежностей. Зверніться до [інструкцій з встановлення pnpm](https://pnpm.io/installation), щоб дізнатися, як встановити його на вашій платформі.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

Зібраний додаток можна знайти в `src-tauri/target/release`

## Підтримати

Якщо ви хочете підтримати розробку цього графічного інтерфейсу, ви можете зробити це [тут](https://encroissant.org/support). Усі пожертви високо цінуються!

## Внесок

Для внесення внеску в цей проект, будь ласка, зверніться до [посібника зі внеску](./CONTRIBUTING.md).
## Ліцензія
Це програмне забезпечення ліцензовано під ліцензією GPL-3.0.
