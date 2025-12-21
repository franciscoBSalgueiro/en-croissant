<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    終極國際象棋工具包
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Discord 伺服器</a>
    ·
    <a href="https://www.encroissant.org/download">下載</a>
    .
    <a href="https://www.encroissant.org/docs">瀏覽文件</a>
  </p>
</div>

En-Croissant 是一個開源的跨平台國際象棋 GUI，旨在功能強大、可客製化且易於使用。


## 功能特性

- 儲存和分析您來自 [lichess.org](https://lichess.org) 和 [chess.com](https://chess.com) 的遊戲
- 多引擎分析。支援所有 UCI 引擎
- 準備開局庫並進行間隔重複訓練
- 簡單的引擎和資料庫安裝與管理
- 在資料庫中搜尋絕對或部分位置

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## 從原始碼建構

請參考 [Tauri 文件](https://tauri.app/v1/guides/getting-started/prerequisites) 了解您平台的要求。

En-Croissant 使用 pnpm 作為依賴項的套件管理器。請參考 [pnpm 安裝說明](https://pnpm.io/installation) 了解如何在您的平台上安裝它。

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

建構的應用程式可以在 `src-tauri/target/release` 中找到

## 捐贈

如果您希望支援此 GUI 的開發，您可以 [在此處](https://encroissant.org/support) 進行捐贈。所有捐贈都深表感謝！

## 貢獻

要為此專案做出貢獻，請參考 [貢獻指南](./CONTRIBUTING.md)。
## 授權
此軟體根據 GPL-3.0 授權。
