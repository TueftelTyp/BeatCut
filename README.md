# BeatCut Studio

## 1. Projektziel

**BeatCut Studio** ist ein browserbasierter Video-Editor mit Fokus auf Social-Media-Videos. Das Projekt orientiert sich funktional an Editoren wie CapCut, soll aber als eigenständige Web-Anwendung direkt im Browser funktionieren.

Der Schwerpunkt liegt auf einer möglichst schnellen Erstellung rhythmischer Kurzvideos aus vorhandenen Bildern, Videos und Musik. Dazu kombiniert BeatCut Studio klassische Timeline-Bearbeitung mit automatisierten Funktionen wie **SmartCut**, **BPM-/Beat-Erkennung**, automatischer Szenenauswahl sowie Effekten und Übergängen.

Die aktuelle Umsetzung ist als **Single-File-Web-App in HTML, CSS und JavaScript** aufgebaut.

## 2. Grundlegender Funktionsumfang

BeatCut Studio unterstützt den Import von Bildern, Videos, Musikdateien und gespeicherten BeatCut-Projektdateien.

Medien werden in einem eigenen Medienbrowser verwaltet. Zusätzlich können Medien direkt an der aktuellen Abspielposition eingefügt, per Drag & Drop in die Timeline gezogen und wieder entfernt werden. Musik kann ebenfalls per Drag & Drop an einer gewünschten Timeline-Position eingefügt werden.

Für jede importierte Mediendatei wird automatisch eine eigene Videospur erzeugt.

## 3. Timeline-System

Die Anwendung besitzt eine mehrspurige Timeline mit:

- Videospuren
- separaten Originaltonspuren der Videoclips
- Textspur
- Effektspur
- Übergangsspur
- Audio-FX-Spur
- Musikspur

Timeline-Elemente können markiert, mehrfach markiert, verschoben, verlängert, verkürzt, gelöscht, kopiert, geteilt und an der aktuellen Playhead-Position eingefügt werden.

Zusätzlich stehen Timeline-Zoom, „Alles markieren“, „Auswahl aufheben“, Spur-Auswahl per Klick auf den Spurnamen sowie Mehrfachauswahl über Strg/Cmd/Shift zur Verfügung.

Spuren können – je nach Typ – minimiert, maximiert, gesperrt, entsperrt, ein- oder ausgeblendet und stummgeschaltet werden.

## 4. Playhead und Transportsteuerung

Der Playhead kann per Maus verschoben oder durch Klick in die Timeline gesetzt werden. Während der Wiedergabe scrollt die Timeline automatisch mit, damit der Marker sichtbar bleibt.

Unterhalb der Vorschau befinden sich:

- zum Projektanfang springen
- vorheriger Schnitt
- vorheriger Beat
- ein Frame zurück
- Play / Pause
- ein Frame vor
- nächster Beat
- nächster Schnitt
- zum Projektende springen

## 5. Undo / Redo

BeatCut Studio besitzt ein eigenes History-System mit Rückgängig- und Wiederherstellen-Funktion.

Tastaturkürzel:

- `Strg/Cmd + Z` → Rückgängig
- `Strg/Cmd + Shift + Z` → Wiederherstellen
- `Strg + Y` → Wiederherstellen

Die History umfasst unter anderem Timeline-Änderungen, Löschen, Verschieben, Trimmen, Eigenschaften, Texte, Effekte, Audioänderungen, SmartCut, Projektauflösung und Videolimits.

## 6. SmartCut

SmartCut ist eines der zentralen Automatisierungsfeatures und befindet sich in einem eigenen Popup.

Einstellbar sind unter anderem:

- Stil
- Beats pro Clip
- BPM
- Beatmatching
- intelligente Szenenanalyse
- automatische Effekte
- automatische Übergänge
- erlaubte Effekte
- erlaubte Übergänge

Die Listen für erlaubte Effekte und Übergänge sind ein- und ausklappbar.

### SmartCut-Stile

- Balanced
- Dynamic
- Cinematic
- Energetic
- Smooth
- Travel
- Minimal
- Dreamy
- Glitch / Tech
- Dramatic

Jeder Stil besitzt eigene Vorgaben für Effektarten, Übergänge, Effektdichte, Schnittlängen und Rhythmus.

## 7. SmartCut – Medienauswahl und Regenerierung

Die SmartCut-Logik berücksichtigt Nutzungshäufigkeit, zuletzt verwendete Medien, bereits verwendete Quellbereiche eines Videos, Quellbereiche aus vorherigen SmartCut-Durchläufen, Zufallsvariation und – bei aktivierter Szenenanalyse – die visuelle Szenenbewertung.

Dadurch sollen Wiederholungen reduziert und neue SmartCut-Durchläufe stärker voneinander unterschieden werden.

Mit **„Clips neu generieren“** können automatisch erstellte Clips neu erzeugt werden, ohne die bisherigen SmartCut-Einstellungen zu verlieren. Soweit möglich werden bestehende Eigenschaften pro Medium übernommen, etwa Skalierung, Rotation, Deckkraft, Clipfilter und Originalton-Einstellungen.

## 8. Intelligente Szenenanalyse

BeatCut Studio besitzt eine lokale Szenenanalyse im Browser. Dabei werden bei Bildern beziehungsweise mehreren Frames eines Videos unter anderem analysiert:

- Helligkeit
- Kontrast
- Farbsättigung
- Farbstimmung
- visuelle Bewegung

Je nach SmartCut-Stil werden diese Werte unterschiedlich gewichtet.

Die aktuelle Szenenanalyse ist eine **visuelle Heuristik** und noch kein semantisches KI-Modell. Sie erkennt daher noch nicht zuverlässig Motive wie Personen, Autos, Landschaften, Tiere oder konkrete Handlungen.

## 9. BPM-Erkennung

Beim Laden einer Musikdatei wird automatisch eine BPM-Analyse durchgeführt. Zusätzlich kann die Prüfung im SmartCut-Popup manuell erneut gestartet werden.

Die Analyse verwendet unter anderem:

- Energie-/Lautstärkeverlauf
- Signaländerungen
- Peak-Erkennung
- Autokorrelation
- Tempo-Kandidaten
- Beat-Phase

Das Ergebnis enthält BPM, Beatpositionen, Konfidenz und Beat-Phase. BPM können außerdem manuell überschrieben werden.

## 10. Beatmatching

SmartCut besitzt eine aktivierbare Beatmatching-Funktion. Ist sie eingeschaltet, werden Schnitte möglichst an erkannten Beats ausgerichtet.

Berücksichtigt werden:

- BPM
- Beatpositionen
- gewählte Anzahl Beats pro Clip
- stilabhängige Schnittmuster

Auch Übergänge werden in der Nähe rhythmischer Schnittpunkte platziert. Beats erscheinen zusätzlich als Marker in der Timeline.

## 11. Audiovisualisierung

Die Musikspur zeigt:

- Lautstärke-/Waveform-Verlauf
- Beatpositionen
- stärkere Beat-Markierungen
- Tonhöhenverlauf
- Fade-In
- Fade-Out

Damit lässt sich Musik visuell besser mit der Timeline synchronisieren.

## 12. Originalton von Videoclips

Der Originalton eines Videos wird separat unter der jeweiligen Videospur angezeigt.

Originaltonabschnitte können:

- einzeln markiert werden
- spurweise markiert werden
- stummgeschaltet werden
- in der Lautstärke verändert werden
- ein- und ausgeblendet werden
- vollständig gelöscht bzw. deaktiviert werden

Beim Löschen des Originaltons bleibt das Bild des zugehörigen Videoclips erhalten.

## 13. Musikbearbeitung

Musik liegt in einer eigenen Timeline-Spur.

Musikabschnitte besitzen:

- Timeline-Start
- Quellstart
- Länge
- Lautstärke
- Fade-In
- Fade-Out

Dadurch muss ein Musikstück nicht zwingend an seinem eigenen Anfang beginnen. Musik kann außerdem geteilt und in mehreren Abschnitten verwendet werden.

## 14. Audio-Effekte

Für zeitlich begrenzte Toneffekte existiert eine eigene **Audio-FX-Spur**.

Effekte können auf folgende Ziele angewendet werden:

- Musik
- komplette Originaltonspur eines Mediums
- einzelnen Originaltonabschnitt eines Clips
- mehrere markierte Originaltonabschnitte gleichzeitig

Aktuell vorhandene Audioeffekte:

- Ton absenken
- Stumm
- Tremolo / Lautstärkepuls
- Beschleunigen 1,5×
- Beschleunigen 2×
- Verlangsamen auf 0,75×
- Verlangsamen auf 0,5×
- Tape Stop
- Tape Start

Audioeffekte besitzen Startzeit, Dauer, Effektstärke, Fade-In und Fade-Out.

## 15. Videoeffekte

Effekte können manuell über die Eigenschaften eingefügt oder automatisch durch SmartCut gesetzt werden.

Aktuell vorhanden sind unter anderem:

- Flash
- Glitch
- Strobe
- Vignette
- Film Grain
- Cinematic
- Neon
- Dream
- Shake
- Hue Shift
- Zoom Punch
- Black & White
- Warm
- Cold
- Invert
- Blur Pulse
- RGB Shift
- Scanlines
- Exposure Pulse
- Soft Glow
- Letterbox
- Pixelate
- Color Wash

Effekte besitzen Startzeit, Dauer und Intensität.

## 16. Übergänge

Übergänge liegen auf einer eigenen Timeline-Spur.

Unterstützt werden unter anderem:

- Fade
- Fade to Black
- Fade to White
- Flash
- Zoom
- Spin
- Blur
- Glitch
- Slide Left / Right / Up / Down
- Wipe Left / Right / Up / Down
- Whip Left / Right
- Iris
- Bars

SmartCut kann Übergänge automatisch setzen. Welche Übergänge verwendet werden dürfen, lässt sich im SmartCut-Popup festlegen.

## 17. Textsystem

Texte werden als eigene Timeline-Objekte verwaltet.

Text kann eingefügt, verschoben, verlängert, verkürzt, kopiert und gelöscht werden.

Texteigenschaften umfassen unter anderem:

- Textinhalt
- Schriftart
- Schriftstärke
- kursiv / normal
- Schriftgröße
- Skalierung
- X-Position
- Y-Position
- Textfarbe
- Deckkraft
- Rotation
- Umrandung aktiv / deaktiviert
- Umrandungsfarbe
- Umrandungsstärke

Texte können zusätzlich direkt in der Vorschau per Maus verschoben werden.

## 18. Projektauflösung

Die Projektauflösung kann frei festgelegt werden.

Vorhandene Schnellvorlagen:

- 16:9
- 9:16
- 1:1
- 4:5

Zusätzlich können Breite und Höhe manuell eingegeben werden.

## 19. Videolängen-Limit

Für Social-Media-Projekte kann ein maximales Videolimit gesetzt werden.

Vorlagen:

- 15 Sekunden
- 30 Sekunden
- 60 Sekunden
- 90 Sekunden
- 180 Sekunden
- benutzerdefinierte Länge
- kein Limit

Optional kann das Projekt auf 9:16 umgestellt und die Timeline physisch auf das Limit gekürzt werden.

Das aktive Limit wird als rote Linie in der Timeline dargestellt und bei Änderungen neu positioniert.

## 20. Projekt speichern und öffnen

BeatCut Studio unterstützt zwei Speicherwege.

### Im Browser

Das vollständige Projekt kann über IndexedDB gespeichert werden, einschließlich Medien, Musik, Timeline, Texte, Effekte, Übergänge, Audioeffekte, BPM-Daten, Szenenanalyse und SmartCut-Einstellungen.

### Projektdatei

Projekte können als `*.beatcut` heruntergeladen und später wieder geöffnet werden.

Technisch handelt es sich um ein ZIP-basiertes Projektformat mit:

- `project.json`
- Medien
- Musik

## 21. Export

BeatCut Studio unterstützt aktuell:

- WebM
- MP4

### Exportoptionen

**Format**

- MP4 / H.264 / AAC
- WebM

**Qualität**

- niedrig
- mittel
- hoch
- sehr hoch

**Framerate**

- 24 FPS
- 25 FPS
- 30 FPS
- 50 FPS
- 60 FPS

**Audio**

Optional können Musik und Originalton in den Export aufgenommen werden.

## 22. Social-Media-kompatibler MP4-Export

Ein wichtiger Entwicklungsbereich war die Stabilität der exportierten MP4-Dateien.

Frühere Exporte konnten zu ruckelnder Wiedergabe, falscher Videodauer oder Fehlinterpretationen durch Plattformen führen, beispielsweise einer angeblichen Laufzeit von über 60 Minuten.

Die aktuelle Exportlogik verwendet deshalb unter anderem:

- feste Projektzeit pro Frame
- konstante Framerate
- neu erzeugte Videozeitstempel
- exakte Begrenzung auf Projektdauer
- H.264
- YUV420P
- AAC
- 48-kHz-Audio
- MP4 Fast Start
- definierte Video-Timescale
- Korrektur negativer Zeitstempel

Der FFmpeg-Schritt normalisiert die Videospur zusätzlich für eine bessere Plattformkompatibilität.

## 23. Fortschritt und Abbruch

Für längere Prozesse wird ein Fortschrittsfenster angezeigt, unter anderem bei:

- Medienimport
- Musikanalyse
- Szenenanalyse
- SmartCut
- Projektdateierstellung
- Export
- FFmpeg-Konvertierung

Ein laufender Export kann abgebrochen werden.

## 24. Technische Architektur

BeatCut Studio läuft derzeit vollständig clientseitig im Browser.

### Kerntechnologien

- HTML5
- CSS
- Vanilla JavaScript
- Canvas API
- MediaRecorder API
- HTML Video / Audio
- Web Audio API
- IndexedDB
- Drag & Drop API
- File API
- JSZip
- FFmpeg.wasm

### Externe Komponenten

Die aktuelle Single-File-Version lädt externe Ressourcen für:

- JSZip
- Google Fonts
- FFmpeg.wasm

Dadurch ist für einzelne Funktionen, insbesondere den MP4-Export beim ersten Laden, eine Internetverbindung erforderlich.

## 25. Bedienkonzept

Die Oberfläche ist in vier Hauptbereiche gegliedert.

### Kopfzeile

Enthält:

- Projektname
- SmartCut
- Videolänge
- Auflösung
- Projektverwaltung
- Export
- BPM-/Statusanzeige

### Linke Seite

Medienbrowser für:

- Bilder
- Videos
- Musik

Der Browser kann minimiert werden.

### Mitte

- Videovorschau
- Textverschiebung direkt auf der Vorschau
- zentrale Transportsteuerung

### Rechte Seite

Eigenschaften für:

- Auswahl
- Texte
- Videoeffekte
- Übergänge
- Audioeffekte

### Unterer Bereich

Mehrspurige Timeline.

## 26. Aktueller Entwicklungsstand

BeatCut Studio ist inzwischen deutlich mehr als ein einfacher Prototyp.

Der aktuelle Funktionsumfang umfasst bereits zentrale Bausteine eines nichtlinearen Videoeditors:

- Mehrspur-Timeline
- Audio-/Videobearbeitung
- Texte
- Effekte
- Übergänge
- Drag & Drop
- Undo / Redo
- automatische Schnitte
- Beatmatching
- BPM-Erkennung
- Szenenanalyse
- Social-Media-Limits
- Projektverwaltung
- MP4-/WebM-Export

Der gesamte Editor ist weiterhin als kompakte Browser-Anwendung ohne eigenes Backend aufgebaut.

## 27. Noch bestehende technische Grenzen

### Kein semantisches KI-Verständnis

Die Szenenanalyse basiert auf Bildmerkmalen und nicht auf einem echten Vision-Modell.

### Exportgeschwindigkeit

Der Browserexport ist weitgehend echtzeitnah. Ein 60-Sekunden-Projekt benötigt daher ungefähr dieselbe Größenordnung an Renderzeit, bevor gegebenenfalls die MP4-Konvertierung erfolgt.

### CPU-basierte Effekte

Viele Effekte werden über Canvas 2D gerendert. Bei hoher Auflösung, vielen Spuren, zahlreichen Effekten oder mehreren Videos kann dies die Browserleistung stark beanspruchen.

### Audio-Engine

Die Audiofunktionen sind inzwischen umfangreich, erreichen aber noch nicht den Komfort einer professionellen DAW.

Mögliche spätere Erweiterungen:

- echte Audioüberblendungen
- Keyframes
- Equalizer
- Kompressor
- Pitch-Shifting unabhängig von der Geschwindigkeit
- mehrere Musikspuren
- detailliertere Waveforms einzelner Videoquellen

### Übergänge

Die Übergänge sind aktuell überwiegend canvasbasierte visuelle Übergangseffekte. Ein vollständig professionelles Transition-System mit echtem Compositing zweier gleichzeitig gerenderter Clips wäre ein weiterer Ausbauschritt.

## 28. Sinnvolle nächste Entwicklungsstufen

### Editing

- Snapping an Beats, Schnittkanten und andere Elemente
- Timeline-Elemente zwischen Spuren verschieben
- Gruppen
- Keyframes
- Geschwindigkeitskurven
- Freeze Frames
- Crop / Position / Anchor
- Masken

### Audio

- mehrere Musikspuren
- echte Crossfades
- EQ
- Kompressor
- Reverb
- Echo
- Pitch Shift
- Noise Reduction
- Sprachverbesserung

### SmartCut / KI

- Gesichts-/Personenerkennung
- Motivklassifizierung
- Action-Erkennung
- automatische Highlight-Erkennung
- Erkennung von Kamerawechseln
- Erkennung von Drops und Songabschnitten
- automatische Text-/Caption-Erzeugung

### Social Media

- TikTok-Presets
- Instagram-Reel-Presets
- YouTube-Shorts-Presets
- Safe-Zone-Overlays
- automatische Seitenverhältnis-Anpassung
- Export-Profile je Plattform

### Produktreife

- Backend
- Benutzerkonten
- Cloudprojekte
- Autosave
- Kollaboration
- Versionshistorie
- Asset-Cloud
- serverseitiger Export

## 29. Zusammenfassung

BeatCut Studio ist aktuell ein umfangreicher browserbasierter Social-Media-Videoeditor mit besonderem Schwerpunkt auf automatisierten Musikvideos.

Der Editor kombiniert **manuelles Editing** mit **SmartCut, BPM-Erkennung, Beatmatching, Szenenanalyse sowie automatischen Effekten und Übergängen**.

Der aktuelle Projektumfang umfasst bereits:

- vollständige Medienverwaltung
- Mehrspur-Timeline
- getrennte Video- und Originaltonbearbeitung
- Musikbearbeitung
- Audioeffekte
- Videoeffekte
- Übergänge
- Textbearbeitung
- Spurverwaltung
- Undo / Redo
- Kopieren / Teilen / Löschen
- BPM- und Beat-Analyse
- SmartCut mit verschiedenen Stilprofilen
- lokale Szenenanalyse
- Social-Media-Limits
- Projektdateien
- Browser-Speicherung
- MP4- und WebM-Export

Damit bildet die Anwendung bereits eine solide Grundlage für einen eigenständigen webbasierten Kurzvideo-Editor und kann in weiteren Entwicklungsschritten technisch und funktional zu einem professionelleren Editor ausgebaut werden.
