# Guia de Narracion Text-to-Speech

*Esta guia tambien esta disponible en:
[English](TTS-GUIDE.md) |
[Francais](TTS-GUIDE-fr.md) |
Espanol |
[Deutsch](TTS-GUIDE-de.md) |
[日本語](TTS-GUIDE-ja.md) |
[Русский](TTS-GUIDE-ru.md) |
[中文](TTS-GUIDE-zh.md)*

## Por que TTS cambia tu forma de estudiar ajedrez

Cuando revisas una partida anotada, tus ojos hacen doble trabajo. Intentas seguir las piezas en el tablero *y* leer los comentarios al mismo tiempo. Tu mirada va y viene entre el tablero y el panel de anotaciones, y cada vez que lo hace, pierdes la posicion por una fraccion de segundo. Tienes que volver a encontrar las piezas, volver a trazar las lineas, volver a construir la imagen en tu cabeza.

Text-to-speech soluciona esto por completo.

Con TTS activado, avanzas por la partida y las anotaciones se *leen en voz alta*. Tus ojos permanecen en el tablero. Ves al caballo aterrizar en f3 mientras una voz te explica por que es un movimiento de desarrollo fuerte. Observas como cambia la estructura de peones mientras el comentario explica la idea estrategica detras. El tablero y las palabras llegan juntos, tal como te ensenaria un entrenador sentado frente a ti.

Esto es especialmente potente para:

- **Estudio de aperturas** -- escucha las ideas detras de cada movimiento mientras observas como se desarrolla la posicion
- **Revision de partidas** -- recorre tus propias partidas anotadas y absorbe las lecciones de forma natural
- **Practica de finales** -- manten el foco en las casillas criticas mientras el comentario te guia
- **Inmersion linguistica** -- estudia ajedrez en frances, aleman, espanol, ruso, japones o chino con todos los terminos de ajedrez traducidos correctamente. Escucha "Cavalier f3, echec" en lugar de "Knight f3, check". Aprende el juego en el idioma en el que piensas.
- **Accesibilidad** -- para jugadores que les resulta mas facil escuchar que leer, o que quieren estudiar lejos del escritorio

Una vez que lo pruebes, volver a las anotaciones en silencio se siente como ver una pelicula en modo mudo.

## Elegir un proveedor

Esta version incluye dos proveedores de TTS -- Google Cloud y ElevenLabs. Si la comunidad desea ver otro proveedor, haganoslo saber y podemos agregarlo. Solo necesitas un proveedor para empezar -- elige el que mejor se adapte a tus necesidades.

|                        | Google Cloud                  | ElevenLabs                    |
|------------------------|-------------------------------|-------------------------------|
| **Nivel gratuito**     | 1,000,000 caracteres/mes      | 10,000 caracteres/mes         |
| **Calidad de voz**     | Muy buena (WaveNet)           | Excelente (voces AI premium)  |
| **Seleccion de voces** | Masculina o femenina por idioma | Docenas de personajes unicos |
| **Planes de pago**     | Pago por uso (centavos)       | Desde $5/mes                  |
| **Ideal para**         | La mayoria de usuarios        | Entusiastas de calidad de voz |
| **Dificultad de configuracion** | Moderada (Cloud Console) | Facil (registro sencillo) |

**Nuestra recomendacion:** Comienza con **Google Cloud**. El nivel gratuito te da un millon de caracteres al mes -- eso equivale a cientos de partidas completamente anotadas, gratis. Las voces WaveNet suenan muy bien. Si mas adelante quieres una narracion mas rica y expresiva con mayor personalidad de voz, ElevenLabs esta ahi para ti.

## Configurar Google Cloud TTS

Este proceso toma unos 5 minutos. Necesitaras una cuenta de Google (la misma que usas para Gmail o YouTube funciona perfectamente).

### Paso 1: Iniciar sesion en Google Cloud Console

1. Abre tu navegador y ve a **[console.cloud.google.com](https://console.cloud.google.com/)**
2. Inicia sesion con tu cuenta de Google
3. Si es tu primera vez, Google te pedira que aceptes los Terminos de Servicio. Marca la casilla y haz clic en **Agree and Continue**

Ahora deberias ver el panel de Google Cloud Console. Se ve bastante cargado -- no te preocupes, solo necesitamos dos cosas de aqui.

### Paso 2: Configurar la facturacion

Google requiere una cuenta de facturacion incluso para su nivel gratuito. **No se te cobrara** a menos que superes 1 millon de caracteres en un mes (eso es muy dificil de lograr con anotaciones de ajedrez). Google te muestra una advertencia mucho antes de que eso suceda.

1. En la barra de busqueda superior, escribe **"Billing"** y haz clic en **Billing** en el menu desplegable
2. Haz clic en **Link a billing account** (o **Create account** si aun no tienes una)
3. Sigue las instrucciones para agregar una tarjeta de credito o debito
4. Una vez completado, veras una marca de verificacion verde junto a tu cuenta de facturacion

> **Nota:** Si ya tienes configurada la facturacion de Google Cloud por otro proyecto, puedes omitir este paso. Tu cuenta de facturacion existente funciona sin problemas.

### Paso 3: Habilitar la API de Text-to-Speech

Esto le indica a Google que servicio deseas utilizar.

1. En la barra de busqueda superior, escribe **"Text-to-Speech"**
2. En los resultados del menu desplegable, haz clic en **Cloud Text-to-Speech API** (tiene un icono azul de API)
3. Llegaras a la pagina de detalles de la API. Haz clic en el gran boton azul **Enable**
4. Espera unos segundos. Cuando el boton cambie a **Manage**, la API esta habilitada

### Paso 4: Crear una API key

La API key es lo que En Croissant utiliza para comunicarse con los servidores de Google.

1. En la barra de busqueda superior, escribe **"Credentials"** y haz clic en **Credentials** bajo "APIs & Services"
2. Cerca de la parte superior de la pagina, haz clic en **+ Create Credentials**
3. En el menu desplegable, selecciona **API key**
4. Aparecera un cuadro de dialogo mostrando tu nueva clave. Se ve algo asi: `AIzaSyC...about 35 characters...`
5. **Haz clic en el icono de copiar** junto a la clave para copiarla al portapapeles
6. Haz clic en **Close**

> **Recomendado: Restringe tu clave.** Despues de crear la clave, la veras listada en la pagina de Credentials. Haz clic en el nombre de la clave para abrir su configuracion. En **API restrictions**, selecciona **Restrict key**, luego elige **Cloud Text-to-Speech API** en el menu desplegable y haz clic en **Save**. Esto significa que incluso si alguien obtiene tu clave, solo podra usarla para TTS -- nada mas.

### Paso 5: Configurar En Croissant

Ya casi terminamos!

1. Abre En Croissant y ve a **Settings** (icono de engranaje) > pestana **Sound**
2. Desplazate hacia abajo hasta la seccion de TTS
3. Establece **TTS Provider** en **Google Cloud**
4. Haz clic dentro del campo **Google Cloud API Key** y pega tu clave (Ctrl+V)
5. Establece **Text-to-Speech** en **On**
6. Haz clic en el boton **Test** junto al selector de voz

Deberias escuchar un movimiento de ajedrez en voz alta. Si lo oyes, felicitaciones, ya esta todo configurado!

> **Solucion de problemas:** Si la prueba es silenciosa, verifica que (1) pegaste la API key completa, (2) la API de Text-to-Speech esta habilitada (Paso 3), y (3) la facturacion esta vinculada (Paso 2). El problema mas comun es olvidar habilitar la API.

## Configurar ElevenLabs

ElevenLabs es mas sencillo de configurar pero tiene un nivel gratuito mas reducido (10,000 caracteres/mes -- suficiente para probar con algunas partidas).

### Paso 1: Crear una cuenta

1. Abre tu navegador y ve a **[elevenlabs.io](https://elevenlabs.io/)**
2. Haz clic en **Sign Up** en la esquina superior derecha
3. Puedes registrarte con Google, GitHub o correo electronico -- elige lo que te resulte mas facil
4. Despues de registrarte, llegaras al panel de ElevenLabs

### Paso 2: Obtener tu API key

1. En la esquina inferior izquierda del panel, haz clic en tu **icono de perfil** (o tu nombre)
2. Haz clic en **Profile + API key**
3. Veras una seccion de API key. Haz clic en **Reveal** para mostrar tu clave, o en **Generate** si aun no tienes una
4. La clave se ve algo asi: `sk_...about 30 characters...`
5. **Haz clic en el icono de copiar** para copiarla al portapapeles

### Paso 3: Configurar En Croissant

1. Abre En Croissant y ve a **Settings** (icono de engranaje) > pestana **Sound**
2. Desplazate hacia abajo hasta la seccion de TTS
3. Establece **TTS Provider** en **ElevenLabs**
4. Haz clic dentro del campo **ElevenLabs API Key** y pega tu clave (Ctrl+V)
5. El menu desplegable de **TTS Voice** se llenara con las voces disponibles. **Adam** es una excelente opcion predeterminada -- clara, natural y funciona muy bien para comentarios de ajedrez
6. Establece **Text-to-Speech** en **On**
7. Haz clic en el boton **Test** junto al selector de voz

Deberias escuchar un movimiento de ajedrez en voz alta.

> **Sobre el nivel gratuito:** ElevenLabs te ofrece 10,000 caracteres/mes en el plan gratuito. Una partida anotada tipica consume entre 2,000 y 4,000 caracteres, asi que puedes revisar de 2 a 5 partidas al mes gratis. Si TTS te resulta valioso, su plan Starter a $5/mes (30,000 caracteres) es una mejora solida. El plan Pro ($22/mes, 100,000 caracteres) cubre un uso intensivo.

## Referencia de ajustes

Todos los ajustes de TTS se encuentran en **Settings > Sound**:

| Ajuste                   | Que hace                                                                       |
|--------------------------|--------------------------------------------------------------------------------|
| **Text-to-Speech**       | Interruptor principal de encendido/apagado para todas las funciones de TTS      |
| **Auto-Narrate on Move** | Lee automaticamente las anotaciones al avanzar por los movimientos con las flechas |
| **TTS Provider**         | Cambiar entre ElevenLabs y Google Cloud                                        |
| **ElevenLabs API Key**   | Tu API key de ElevenLabs (solo necesaria si usas ElevenLabs)                   |
| **Google Cloud API Key** | Tu API key de Google Cloud (solo necesaria si usas Google)                      |
| **TTS Voice**            | ElevenLabs: elige entre tus voces. Google: elige Masculina o Femenina          |
| **TTS Language**         | Idioma de la narracion -- todos los terminos de ajedrez se traducen automaticamente |
| **TTS Volume**           | Volumen de la narracion                                                        |
| **TTS Speed**            | Velocidad de reproduccion (0.5x a 2x) -- se ajusta al instante sin regenerar audio |
| **TTS Audio Cache**      | Borrar el audio en cache para forzar la regeneracion (util tras editar anotaciones) |

## Idiomas compatibles

La narracion TTS actualmente soporta siete idiomas con vocabulario de ajedrez completamente traducido:

| Idioma             | Ejemplo de ajedrez                                  |
|--------------------|-----------------------------------------------------|
| **English**        | Knight f3, check. A strong developing move.         |
| **Francais**       | Cavalier f3, echec. Un coup de developpement fort.  |
| **Espanol**        | Caballo f3, jaque. Un fuerte movimiento.            |
| **Deutsch**        | Springer f3, Schach. Ein starker Entwicklungszug.   |
| **日本語**          | ナイト f3、チェック。強い展開の手。                      |
| **Русский**        | Конь f3, шах. Сильный развивающий ход.              |
| **中文**            | 马 f3，将军。一步控制中心的强力出子。                    |

Cada termino de ajedrez -- nombres de piezas, "jaque", "jaque mate", "enroque", "captura", anotaciones de calidad de movimiento como "Jugada brillante" y "Error grave" -- se pronuncia en el idioma seleccionado. Los comentarios en tus archivos PGN se leen tal como estan escritos, asi que anota tus partidas en el idioma que quieras escuchar.

## Consejos para la mejor experiencia

- **Usa Auto-Narrate.** Activa "Auto-Narrate on Move" y simplemente usa las flechas del teclado para avanzar por las partidas. Los comentarios llegan de forma natural mientras te mueves, como tener un entrenador a tu lado.

- **Anota tus propias partidas.** TTS brilla especialmente cuando escuchas comentarios sobre *tus* partidas. Anota tus partidas y luego recorrelas con la narracion activada. Escuchar "Capturar ese peon parece tentador, pero todo tu flanco de rey sigue dormido" mientras miras fijamente la posicion pega distinto que leerlo.

- **Prueba diferentes velocidades.** Algunos jugadores prefieren 1x para estudio cuidadoso, otros prefieren 1.3x para una revision mas rapida. El control de velocidad ajusta la reproduccion en tiempo real sin gastar caracteres adicionales de la API -- el audio se genera una sola vez y se reproduce mas rapido.

- **Usa el icono de altavoz.** Cada comentario en la lista de movimientos tiene un pequeno icono de altavoz. Haz clic en el para escuchar solo esa anotacion sin tener que recorrer toda la partida.

- **Cambia de idioma para aprender vocabulario ajedrecistico.** Si estudias ajedrez en un segundo idioma, configura el idioma de TTS para que coincida. Aprenderas terminos como "Cavalier" (caballo), "echec" (jaque) y "mat" (jaque mate) de forma natural simplemente escuchando.

## Acerca de esta funcionalidad

En Croissant es una herramienta de estudio de ajedrez de codigo abierto creada por [Francisco Salgueiro](https://github.com/franciscoBSalgueiro). Francisco construyo algo genuinamente especial -- una plataforma gratuita, potente y creada por la comunidad para estudiar ajedrez -- y la publico bajo la licencia GPL-3.0 para que cualquiera pueda usarla, mejorarla y compartirla. Esta funcionalidad de TTS existe gracias a esa generosidad. Estamos agradecidos por los cimientos que el construyo, y estamos orgullosos de contribuir de vuelta.

El plugin de TTS fue desarrollado por Darrell en [Red Shed](mailto:darrell@redshed.ai), con la ayuda de [Claude Code](https://claude.ai/claude-code). Soporte multiidioma, integracion con dos proveedores, vocabulario de ajedrez traducido a siete idiomas -- construido desde el codigo fuente, probado a mano y contribuido con esmero.

Esa es la belleza del codigo abierto. Alguien construye algo grandioso. Alguien mas le agrega valor. Todos se benefician.

## Contactanos

Estamos entusiasmados con esta funcionalidad y nos encantaria saber como te esta funcionando. Comentarios, sugerencias y opiniones siempre son bienvenidos.

- **Quieres un idioma que aun no soportamos?** Haznos saber -- podemos agregar nuevos idiomas rapidamente.
- **Encontraste un error?** Cuentanos y lo arreglaremos rapido.
- **Tienes una idea para otro proveedor de TTS?** Con gusto lo agregamos.
- **Solo quieres decirnos que funciona bien?** Eso tambien nos alegra escucharlo.

Abre un issue aqui en GitHub, o escribenos directamente a **[darrell@redshed.ai](mailto:darrell@redshed.ai)**.
