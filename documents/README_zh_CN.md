<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    终极国际象棋工具包
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Discord 服务器</a>
    ·
    <a href="https://www.encroissant.org/download">下载</a>
    .
    <a href="https://www.encroissant.org/docs">浏览文档</a>
  </p>
</div>

En-Croissant 是一个开源的跨平台国际象棋 GUI，旨在功能强大、可定制且易于使用。


## 功能特性

- 存储和分析您来自 [lichess.org](https://lichess.org) 和 [chess.com](https://chess.com) 的游戏
- 多引擎分析。支持所有 UCI 引擎
- 准备开局库并进行间隔重复训练
- 简单的引擎和数据库安装与管理
- 在数据库中搜索绝对或部分位置

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## 从源代码构建

请参考 [Tauri 文档](https://tauri.app/v1/guides/getting-started/prerequisites) 了解您平台的要求。

En-Croissant 使用 pnpm 作为依赖项的包管理器。请参考 [pnpm 安装说明](https://pnpm.io/installation) 了解如何在您的平台上安装它。

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

构建的应用程序可以在 `src-tauri/target/release` 中找到

## 捐赠

如果您希望支持此 GUI 的开发，您可以 [在此处](https://encroissant.org/support) 进行捐赠。所有捐赠都深表感谢！

## 贡献

要为此项目做出贡献，请参考 [贡献指南](./CONTRIBUTING.md)。
## 许可证
此软件根据 GPL-3.0 许可证授权。
