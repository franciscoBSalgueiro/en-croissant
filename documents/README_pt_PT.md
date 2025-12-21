<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    O Kit de Ferramentas de Xadrez Definitivo
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Servidor Discord</a>
    ·
    <a href="https://www.encroissant.org/download">Descarregar</a>
    .
    <a href="https://www.encroissant.org/docs">Explorar a documentação</a>
  </p>
</div>

En-Croissant é uma GUI de xadrez open-source, multiplataforma que visa ser poderosa, personalizável e fácil de usar.


## Funcionalidades

- Armazene e analise os seus jogos de [lichess.org](https://lichess.org) e [chess.com](https://chess.com)
- Análise multi-motor. Suporta todos os motores UCI
- Prepare um repertório e treine-o com repetição espaçada
- Instalação e gestão simples de motores e bases de dados
- Pesquisa de posição absoluta ou parcial na base de dados

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Compilação a partir do código fonte

Consulte a [documentação Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) para os requisitos na sua plataforma.

En-Croissant usa pnpm como gestor de pacotes para dependências. Consulte as [instruções de instalação do pnpm](https://pnpm.io/installation) para saber como o instalar na sua plataforma.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

A aplicação compilada pode ser encontrada em `src-tauri/target/release`

## Doar

Se deseja suportar o desenvolvimento desta GUI, pode fazê-lo [aqui](https://encroissant.org/support). Todas as doações são grandemente apreciadas!

## Contribuir

Para contribuir para este projeto, consulte o [guia de contribuição](./CONTRIBUTING.md).
## Licença
Este software está licenciado sob a Licença GPL-3.0.
