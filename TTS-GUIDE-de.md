# Text-to-Speech Narrations-Anleitung

*Diese Anleitung ist auch verfügbar auf:
[English](TTS-GUIDE.md) |
[Francais](TTS-GUIDE-fr.md) |
[Espanol](TTS-GUIDE-es.md) |
Deutsch |
[日本語](TTS-GUIDE-ja.md) |
[Русский](TTS-GUIDE-ru.md) |
[中文](TTS-GUIDE-zh.md)*

## Warum TTS das Schachstudium grundlegend verändert

Wenn du eine kommentierte Partie durchgehst, müssen deine Augen Doppelarbeit leisten. Du versuchst gleichzeitig, den Figuren auf dem Brett zu folgen *und* die Kommentare zu lesen. Dein Blick springt ständig zwischen Brett und Kommentarfeld hin und her, und jedes Mal verlierst du für einen kurzen Moment die Stellung. Du musst die Figuren wiederfinden, die Varianten nachvollziehen und dir das Bild im Kopf neu aufbauen.

Text-to-Speech löst dieses Problem vollständig.

Mit aktiviertem TTS klickst du dich durch eine Partie, und die Kommentare werden dir *vorgelesen*. Deine Augen bleiben auf dem Brett. Du beobachtest, wie der Springer auf f3 landet, während eine Stimme dir erklärt, warum das ein starker Entwicklungszug ist. Du siehst, wie sich die Bauernstruktur verändert, während der Kommentar die strategische Idee dahinter erläutert. Brett und Worte kommen gleichzeitig an — genau so, wie ein Trainer dir gegenüber es erklären würde.

Das ist besonders wirkungsvoll für:

- **Eröffnungsstudium** — höre die Ideen hinter jedem Zug, während du die Stellung sich entwickeln siehst
- **Partiebesprechung** — gehe deine eigenen kommentierten Partien durch und nimm die Lektionen ganz natürlich auf
- **Endspieltraining** — halte deinen Fokus auf den entscheidenden Feldern, während der Kommentar dich leitet
- **Sprachimmersion** — studiere Schach auf Französisch, Deutsch, Spanisch, Russisch, Japanisch oder Chinesisch, wobei alle Schachbegriffe korrekt übersetzt werden. Höre „Springer f3, Schach" statt „Knight f3, check." Lerne das Spiel in der Sprache, in der du denkst.
- **Barrierefreiheit** — für Spieler, denen Zuhören leichter fällt als Lesen, oder die abseits vom Schreibtisch lernen möchten

Wenn du es einmal ausprobiert hast, fühlen sich stumme Kommentare an wie ein Film ohne Ton.

## Einen Anbieter wählen

Diese Version enthält zwei TTS-Anbieter — Google Cloud und ElevenLabs. Wenn die Community einen weiteren Anbieter wünscht, gebt uns Bescheid und wir können ihn hinzufügen. Du brauchst nur einen Anbieter, um loszulegen — wähle den, der am besten zu dir passt.

|                        | Google Cloud                  | ElevenLabs                    |
|------------------------|-------------------------------|-------------------------------|
| **Kostenloses Kontingent** | 1.000.000 Zeichen/Monat   | 10.000 Zeichen/Monat          |
| **Stimmqualität**      | Sehr gut (WaveNet)            | Ausgezeichnet (Premium-KI-Stimmen) |
| **Stimmauswahl**       | Männlich oder Weiblich je Sprache | Dutzende einzigartiger Stimmen |
| **Bezahlpläne**        | Nutzungsbasiert (wenige Cent) | Ab 5 $/Monat                  |
| **Am besten für**      | Die meisten Nutzer            | Stimmqualitäts-Enthusiasten   |
| **Einrichtungsaufwand**| Mittel (Cloud Console)        | Einfach (unkomplizierte Anmeldung) |

**Unsere Empfehlung:** Starte mit **Google Cloud**. Das kostenlose Kontingent bietet dir eine Million Zeichen pro Monat — das reicht für Hunderte voll kommentierter Partien, völlig kostenlos. Die WaveNet-Stimmen klingen hervorragend. Wenn du später ausdrucksstärkere Narration mit mehr stimmlicher Persönlichkeit möchtest, ist ElevenLabs für dich da.

## Google Cloud TTS einrichten

Diese Anleitung dauert etwa 5 Minuten. Du brauchst ein Google-Konto (dasselbe, das du für Gmail oder YouTube verwendest, funktioniert einwandfrei).

### Schritt 1: Bei der Google Cloud Console anmelden

1. Öffne deinen Browser und gehe zu **[console.cloud.google.com](https://console.cloud.google.com/)**
2. Melde dich mit deinem Google-Konto an
3. Wenn du zum ersten Mal hier bist, wirst du gebeten, den Nutzungsbedingungen zuzustimmen. Setze das Häkchen und klicke auf **Agree and Continue**

Du solltest jetzt das Dashboard der Google Cloud Console sehen. Es sieht nach viel aus — keine Sorge, wir brauchen hier nur zwei Dinge.

### Schritt 2: Abrechnung einrichten

Google verlangt ein Rechnungskonto, auch für das kostenlose Kontingent. **Dir wird nichts berechnet**, es sei denn, du überschreitest eine Million Zeichen pro Monat (was mit Schachkommentaren kaum zu schaffen ist). Google warnt dich rechtzeitig, bevor das passiert.

1. Tippe in die obere Suchleiste **„Billing"** und klicke auf **Billing** im Dropdown
2. Klicke auf **Link a billing account** (oder **Create account**, falls du noch keines hast)
3. Folge den Anweisungen, um eine Kredit- oder Debitkarte hinzuzufügen
4. Wenn alles fertig ist, siehst du ein grünes Häkchen neben deinem Rechnungskonto

> **Hinweis:** Falls du bereits ein Google Cloud Rechnungskonto von einem anderen Projekt hast, kannst du diesen Schritt überspringen. Dein bestehendes Rechnungskonto funktioniert problemlos.

### Schritt 3: Die Text-to-Speech API aktivieren

Damit teilst du Google mit, welchen Dienst du nutzen möchtest.

1. Tippe in die obere Suchleiste **„Text-to-Speech"**
2. Klicke in den Suchergebnissen auf **Cloud Text-to-Speech API** (mit dem blauen API-Symbol)
3. Du landest auf der Detailseite der API. Klicke auf den großen blauen **Enable**-Button
4. Warte ein paar Sekunden. Wenn sich der Button zu **Manage** ändert, ist die API aktiviert

### Schritt 4: Einen API key erstellen

Der API key ist das, womit En Croissant mit den Google-Servern kommuniziert.

1. Tippe in die obere Suchleiste **„Credentials"** und klicke auf **Credentials** unter „APIs & Services"
2. Klicke oben auf der Seite auf **+ Create Credentials**
3. Wähle im Dropdown **API key**
4. Ein Dialogfenster erscheint und zeigt deinen neuen Schlüssel an. Er sieht ungefähr so aus: `AIzaSyC...about 35 characters...`
5. **Klicke auf das Kopier-Symbol** neben dem Schlüssel, um ihn in die Zwischenablage zu kopieren
6. Klicke auf **Close**

> **Empfohlen: Schränke deinen Schlüssel ein.** Nachdem du den Schlüssel erstellt hast, siehst du ihn auf der Credentials-Seite aufgelistet. Klicke auf den Schlüsselnamen, um seine Einstellungen zu öffnen. Wähle unter **API restrictions** die Option **Restrict key**, dann wähle **Cloud Text-to-Speech API** aus dem Dropdown und klicke auf **Save**. Damit kann selbst bei einem Schlüsselleck nur TTS genutzt werden — sonst nichts.

### Schritt 5: En Croissant konfigurieren

Fast geschafft!

1. Öffne En Croissant und gehe zu **Settings** (Zahnrad-Symbol) > **Sound**-Tab
2. Scrolle nach unten zum TTS-Bereich
3. Setze **TTS Provider** auf **Google Cloud**
4. Klicke in das Feld **Google Cloud API Key** und füge deinen Schlüssel ein (Strg+V)
5. Setze **Text-to-Speech** auf **On**
6. Klicke auf den **Test**-Button neben der Stimmauswahl

Du solltest einen Schachzug vorgesprochen hören. Wenn ja — herzlichen Glückwunsch, du bist fertig eingerichtet!

> **Fehlerbehebung:** Wenn der Test stumm bleibt, überprüfe, ob (1) du den vollständigen API key eingefügt hast, (2) die Text-to-Speech API aktiviert ist (Schritt 3) und (3) die Abrechnung verknüpft ist (Schritt 2). Das häufigste Problem ist, dass man vergisst, die API zu aktivieren.

## ElevenLabs einrichten

ElevenLabs ist einfacher einzurichten, bietet aber ein kleineres kostenloses Kontingent (10.000 Zeichen/Monat — genug, um es mit ein paar Partien auszuprobieren).

### Schritt 1: Ein Konto erstellen

1. Öffne deinen Browser und gehe zu **[elevenlabs.io](https://elevenlabs.io/)**
2. Klicke oben rechts auf **Sign Up**
3. Du kannst dich mit Google, GitHub oder E-Mail anmelden — nimm, was am einfachsten ist
4. Nach der Anmeldung landest du auf dem ElevenLabs-Dashboard

### Schritt 2: Deinen API key abrufen

1. Klicke unten links im Dashboard auf dein **Profilsymbol** (oder deinen Namen)
2. Klicke auf **Profile + API key**
3. Du siehst einen API-key-Bereich. Klicke auf **Reveal**, um deinen Schlüssel anzuzeigen, oder auf **Generate**, falls du noch keinen hast
4. Der Schlüssel sieht so aus: `sk_...about 30 characters...`
5. **Klicke auf das Kopier-Symbol**, um ihn in die Zwischenablage zu kopieren

### Schritt 3: En Croissant konfigurieren

1. Öffne En Croissant und gehe zu **Settings** (Zahnrad-Symbol) > **Sound**-Tab
2. Scrolle nach unten zum TTS-Bereich
3. Setze **TTS Provider** auf **ElevenLabs**
4. Klicke in das Feld **ElevenLabs API Key** und füge deinen Schlüssel ein (Strg+V)
5. Das Dropdown **TTS Voice** wird mit deinen verfügbaren Stimmen befüllt. **Adam** ist eine hervorragende Standardwahl — klar, natürlich und ideal für Schachkommentare
6. Setze **Text-to-Speech** auf **On**
7. Klicke auf den **Test**-Button neben der Stimmauswahl

Du solltest einen Schachzug vorgesprochen hören.

> **Zum kostenlosen Kontingent:** ElevenLabs bietet dir 10.000 Zeichen/Monat im kostenlosen Plan. Eine typische kommentierte Partie verbraucht 2.000–4.000 Zeichen, sodass du 2–5 Partien pro Monat kostenlos durchgehen kannst. Wenn du TTS als wertvoll empfindest, ist der Starter-Plan für 5 $/Monat (30.000 Zeichen) ein solides Upgrade. Der Pro-Plan (22 $/Monat, 100.000 Zeichen) deckt auch intensiven Gebrauch ab.

## Einstellungsübersicht

Alle TTS-Einstellungen findest du unter **Settings > Sound**:

| Einstellung              | Funktion                                                                      |
|--------------------------|-------------------------------------------------------------------------------|
| **Text-to-Speech**       | Hauptschalter für alle TTS-Funktionen                                         |
| **Auto-Narrate on Move** | Spricht Kommentare automatisch, wenn du mit den Pfeiltasten durch Züge gehst  |
| **TTS Provider**         | Wechsel zwischen ElevenLabs und Google Cloud                                  |
| **ElevenLabs API Key**   | Dein ElevenLabs API key (nur nötig bei Nutzung von ElevenLabs)                |
| **Google Cloud API Key** | Dein Google Cloud API key (nur nötig bei Nutzung von Google)                  |
| **TTS Voice**            | ElevenLabs: Auswahl aus deinen Stimmen. Google: Männlich oder Weiblich        |
| **TTS Language**         | Sprache für die Narration — alle Schachbegriffe werden automatisch übersetzt   |
| **TTS Volume**           | Lautstärke der Narration                                                      |
| **TTS Speed**            | Wiedergabegeschwindigkeit (0,5x bis 2x) — sofortige Anpassung ohne erneute Audio-Generierung |
| **TTS Audio Cache**      | Zwischengespeicherte Audiodateien löschen, um eine Neugenerierung zu erzwingen (nützlich nach Bearbeitung von Kommentaren) |

## Unterstützte Sprachen

Die TTS-Narration unterstützt derzeit sieben Sprachen mit vollständig übersetztem Schachvokabular:

| Sprache            | Schachbeispiel                                      |
|--------------------|-----------------------------------------------------|
| **English**        | Knight f3, check. A strong developing move.         |
| **Francais**       | Cavalier f3, echec. Un coup de developpement fort.  |
| **Espanol**        | Caballo f3, jaque. Un fuerte movimiento.            |
| **Deutsch**        | Springer f3, Schach. Ein starker Entwicklungszug.   |
| **日本語**          | ナイト f3、チェック。強い展開の手。                      |
| **Русский**        | Конь f3, шах. Сильный развивающий ход.              |
| **中文**            | 马 f3，将军。一步控制中心的强力出子。                    |

Jeder Schachbegriff — Figurennamen, „Schach", „Schachmatt", „Rochade", „schlägt", Zugbewertungen wie „Brillanter Zug" und „Patzer" — wird in der gewählten Sprache gesprochen. Kommentare in deinen PGN-Dateien werden so vorgelesen, wie sie geschrieben sind. Kommentiere deine Partien also in der Sprache, die du hören möchtest.

## Tipps für das beste Erlebnis

- **Nutze Auto-Narrate.** Aktiviere „Auto-Narrate on Move" und verwende einfach die Pfeiltasten, um durch Partien zu gehen. Die Kommentare kommen ganz natürlich beim Weiterklicken — als hättest du einen Trainer neben dir sitzen.

- **Kommentiere deine eigenen Partien.** TTS entfaltet seine wahre Stärke, wenn du Kommentare zu *deinen* Partien hörst. Kommentiere deine Partien und gehe sie dann mit Narration durch. „Der Bauer sieht verlockend aus, aber dein gesamter Königsflügel schläft noch" zu hören, während du auf die Stellung starrst, trifft ganz anders als es nur zu lesen.

- **Probiere verschiedene Geschwindigkeiten aus.** Manche Spieler mögen 1x für gründliches Studium, andere bevorzugen 1,3x für schnelleres Durchgehen. Der Geschwindigkeitsregler passt die Wiedergabe in Echtzeit an, ohne zusätzliche API-Zeichen zu verbrauchen — das Audio wird einmal generiert und dann schneller abgespielt.

- **Nutze das Lautsprecher-Symbol.** Jeder Kommentar in der Zugliste hat ein kleines Lautsprecher-Symbol. Klicke darauf, um nur diesen einen Kommentar zu hören, ohne die ganze Partie durchgehen zu müssen.

- **Wechsle die Sprache, um Schachvokabular zu lernen.** Wenn du Schach in einer Fremdsprache studierst, stelle die TTS-Sprache entsprechend ein. Du lernst Begriffe wie „Cavalier" (Springer), „echec" (Schach) und „mat" (Schachmatt) ganz nebenbei beim Zuhören.

## Über diese Funktion

En Croissant ist ein quelloffenes Schachstudien-Werkzeug, das von [Francisco Salgueiro](https://github.com/franciscoBSalgueiro) entwickelt wurde. Francisco hat etwas wirklich Besonderes geschaffen — eine kostenlose, leistungsstarke, gemeinschaftsgetriebene Plattform zum Schachstudium — und sie unter der GPL-3.0-Lizenz veröffentlicht, damit jeder sie nutzen, verbessern und teilen kann. Diese TTS-Funktion existiert dank dieser Großzügigkeit. Wir sind dankbar für das Fundament, das er gelegt hat, und stolz darauf, etwas zurückgeben zu können.

Das TTS-Plugin wurde von Darrell bei [Red Shed](mailto:darrell@redshed.ai) entwickelt, mit Unterstützung von [Claude Code](https://claude.ai/claude-code). Mehrsprachige Unterstützung, Anbindung zweier Provider, übersetztes Schachvokabular in sieben Sprachen — aus dem Quellcode gebaut, von Hand getestet und mit Sorgfalt beigesteuert.

Das ist das Schöne an Open Source. Jemand baut etwas Großartiges. Jemand anderes erweitert es. Alle profitieren davon.

## Kontakt

Wir freuen uns über diese Funktion und würden gerne hören, wie sie bei dir funktioniert. Kommentare, Vorschläge und Feedback sind jederzeit willkommen.

- **Du wünschst dir eine Sprache, die wir noch nicht unterstützen?** Lass es uns wissen — wir können neue Sprachen schnell hinzufügen.
- **Einen Fehler gefunden?** Sag uns Bescheid, und wir beheben ihn zügig.
- **Eine Idee für einen weiteren TTS-Anbieter?** Wir bauen ihn gerne ein.
- **Willst du einfach nur sagen, dass es funktioniert?** Auch das hören wir gerne.

Eröffne ein Issue hier auf GitHub oder schreib uns direkt an **[darrell@redshed.ai](mailto:darrell@redshed.ai)**.
