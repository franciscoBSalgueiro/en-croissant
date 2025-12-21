<br />
<div align="center">
  <a href="https://github.com/franciscoBSalgueiro/en-croissant">
    <img width="115" height="115" src="https://github.com/franciscoBSalgueiro/en-croissant/blob/master/src-tauri/icons/icon.png" alt="Logo">
  </a>

<h3 align="center">En Croissant</h3>

  <p align="center">
    La caja de herramientas definitiva para ajedrez
    <br />
    <a href="https://www.encroissant.org"><strong>encroissant.org</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/tdYzfDbSSW">Servidor Discord</a>
    ·
    <a href="https://www.encroissant.org/download">Descargar</a>
    .
    <a href="https://www.encroissant.org/docs">Explorar la documentación</a>
  </p>
</div>

En-Croissant es una interfaz gráfica de ajedrez de código abierto y multiplataforma que busca ser poderosa, personalizable y fácil de usar.


## Características

- Almacena y analiza tus partidas de [lichess.org](https://lichess.org) y [chess.com](https://chess.com)
- Análisis multi-motor. Soporta todos los motores UCI
- Prepara un repertorio y entrénalo con repetición espaciada
- Instalación y gestión simple de motores y bases de datos
- Búsqueda de posiciones absolutas o parciales en la base de datos

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/assets/showcase.webp" />

## Compilar desde el código fuente

Consulta la [documentación de Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) para los requisitos en tu plataforma.

En-Croissant utiliza pnpm como gestor de paquetes para las dependencias. Consulta las [instrucciones de instalación de pnpm](https://pnpm.io/installation) para instalarlo en tu plataforma.

```bash
git clone https://github.com/franciscoBSalgueiro/en-croissant
cd en-croissant
pnpm install
pnpm build
```

La aplicación compilada se puede encontrar en `src-tauri/target/release`

## Donar

Si deseas apoyar el desarrollo de esta interfaz gráfica, puedes hacerlo [aquí](https://encroissant.org/support). ¡Todas las donaciones son muy apreciadas!

## Contribuir

Para contribuir a este proyecto, por favor consulta la [guía de contribución](./CONTRIBUTING.md).
## Licencia
Este software está licenciado bajo la Licencia GPL-3.0.
