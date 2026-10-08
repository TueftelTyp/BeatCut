python -m http.server 8080


# BeatCut Studio – Detaillierte Projekt- und Funktionsbeschreibung

## 1. Überblick

**BeatCut Studio** ist ein lokaler, nichtlinearer Videoeditor mit Schwerpunkt auf kurzen, rhythmisch geschnittenen Social-Media-Videos. Das Projekt verbindet klassische Timeline-Bearbeitung mit automatisierten Funktionen wie **SmartCut**, **BPM-/Beat-Erkennung**, **Beatmatching**, **Szenenanalyse**, **automatischen Effekten** und **automatischen Übergängen**.

Das Ziel ist eine Bedienung, die sich an modernen Short-Video-Editoren orientiert, aber deutlich stärker auf einen schnellen, musikgetriebenen Workflow ausgelegt ist. BeatCut Studio soll sowohl für komplett manuelle Schnitte als auch für weitgehend automatisch erzeugte Clips geeignet sein.

Der typische Anwendungsfall ist:

1. Medien importieren.
2. Musik auswählen.
3. BPM beziehungsweise Beats analysieren.
4. SmartCut verwenden oder Clips manuell platzieren.
5. Texte, Effekte, Übergänge und Audioanpassungen ergänzen.
6. Vorschau prüfen.
7. Das fertige Video als MP4 exportieren.

---

## 2. Produktidee

BeatCut Studio soll kein reiner „Ein-Klick-Autoeditor“ sein. Die Automatisierung dient als Ausgangspunkt und Beschleuniger, während das Ergebnis anschließend vollständig auf einer klassischen Timeline weiterbearbeitet werden kann.

Der Kern des Produkts besteht deshalb aus zwei gleichwertigen Arbeitsweisen:

### 2.1 Manueller Schnitt

Der Benutzer kontrolliert selbst:

- Medienauswahl
- Clip-Reihenfolge
- Clip-Länge
- Quellbereich eines Videos
- Position auf der Timeline
- Originalton
- Musik
- Texte
- Effekte
- Übergänge
- Audioeffekte
- Projektauflösung
- Videolänge

### 2.2 Automatisierter SmartCut

SmartCut erzeugt anhand von Musik, Beats, Stil und Medien automatisch eine Schnittfolge.

Danach bleibt das Ergebnis vollständig editierbar.

Der Nutzer soll also nicht zwischen einem automatischen und einem manuellen Projekt wählen müssen. Beides gehört zum selben Projekt.

---

# 3. Zielgruppe

BeatCut Studio richtet sich vor allem an Benutzer, die schnell kurze Videos für Plattformen und Formate wie folgende erstellen möchten:

- TikTok
- Instagram Reels
- YouTube Shorts
- Social-Media-Werbung
- Event-Clips
- Reisevideos
- Musik-Clips
- Zusammenschnitte aus Bildern und Videos
- Produktclips
- kurze Präsentationen
- Highlight-Videos

Das Programm soll auch ohne tiefgehende Kenntnisse klassischer professioneller Videoschnittsoftware verständlich bleiben.

---

# 4. Grundprinzip der Oberfläche

Die Oberfläche folgt einem dunklen, modernen Editor-Design.

Die Anwendung ist in vier große Bereiche unterteilt:

1. **Kopfzeile**
2. **Medienbrowser links**
3. **Vorschau in der Mitte**
4. **Eigenschaften rechts**
5. **Timeline im unteren Bereich**

Die Timeline bildet den zentralen Arbeitsbereich und bleibt während der Bearbeitung ständig sichtbar.

---

# 5. Visuelles Erscheinungsbild

## 5.1 Grundstil

BeatCut Studio verwendet ein dunkles Interface mit klar getrennten Arbeitsflächen.

Typische Grundfarben sind:

- sehr dunkler Hintergrund
- dunkle Panels
- leicht hellere Unterpanels
- dezente graue Trennlinien
- weiße beziehungsweise sehr helle Hauptschrift
- violette Akzentfarbe
- rote Warn- und Limitfarbe
- grüne Farben für Audio
- blaue Farben für Übergänge
- goldene beziehungsweise gelbe Farben für Effekte
- orange Farben für Audio-FX

Der visuelle Stil soll technisch und modern wirken, ohne unnötige Dekoration.

---

## 5.2 Farblogik der Timeline

Timeline-Elemente unterscheiden sich visuell deutlich nach Typ.

### Videoclips

Violette beziehungsweise dunkelviolette Darstellung.

### Originalton

Grüne Darstellung.

### Texte

Rot-/Rosatöne.

### Videoeffekte

Gold-/Gelbtöne.

### Übergänge

Blau-/Türkistöne.

### Audioeffekte

Orange-/Brauntöne.

### Musik

Grün-/Türkistöne.

Diese Farblogik erleichtert die schnelle Orientierung auch in komplexeren Projekten.

---

# 6. Kopfzeile

Die obere Leiste enthält die wichtigsten projektweiten Funktionen.

Dazu gehören unter anderem:

- BeatCut-Studio-Branding
- Projektname
- SmartCut
- Videolänge
- Projektauflösung
- Projektverwaltung
- Export
- BPM-Anzeige
- Statusanzeige

Globale Einstellungen sollen von dort erreichbar sein, ohne die Timeline zu verlassen.

---

# 7. Medienbrowser

Der Medienbrowser befindet sich auf der linken Seite.

Er verwaltet die im Projekt verfügbaren Medien.

Unterstützte Medientypen umfassen:

- Videos
- Bilder
- Musik beziehungsweise Audiodateien

Jedes Medium wird mit grundlegenden Informationen dargestellt.

Bei visuellen Medien kann eine Vorschau beziehungsweise ein Thumbnail angezeigt werden.

---

# 8. Medienimport

Der Benutzer kann lokale Dateien in das Projekt importieren.

Beim Import werden je nach Dateityp Informationen ermittelt wie:

- Dateiname
- Medientyp
- Laufzeit
- Breite
- Höhe
- Seitenverhältnis
- Audio vorhanden oder nicht
- Videometadaten
- bei Musik Analyseinformationen

Videos können sowohl für die Bildspur als auch für den Originalton verwendet werden.

Bilder werden wie zeitlich begrenzte visuelle Clips behandelt.

---

# 9. Drag & Drop

Medien können direkt per Drag & Drop in die Timeline gezogen werden.

Das gilt für:

- Bilder
- Videos
- Musik

Das Ziel ist ein schneller Workflow ohne separate „Einfügen“-Dialoge.

Zusätzlich kann ein Medium durch direkte Aktion an der aktuellen Playhead-Position eingefügt werden.

---

# 10. Projektvorschau

In der Mitte befindet sich die Video-/Projektvorschau.

Sie zeigt den aktuellen Zustand des Projekts an der Position des Playheads.

Dargestellt werden abhängig vom Projekt:

- Bild oder Video
- Skalierung
- Rotation
- Deckkraft
- Videoeffekte
- Übergänge
- Texte
- Textumrandungen
- Projektformat
- schwarze Hintergrundbereiche
- Letterboxing/Pillarboxing je nach Seitenverhältnis

Die Vorschau ist gleichzeitig ein Bearbeitungsbereich.

Bestimmte Elemente, insbesondere Texte, können direkt in der Vorschau verschoben werden.

---

# 11. Transportsteuerung

Unter der Vorschau befindet sich die Transportsteuerung.

Vorgesehene beziehungsweise bereits definierte Funktionen sind:

- zum Projektanfang springen
- vorheriger Schnitt
- vorheriger Beat
- ein Frame zurück
- Play
- Pause
- ein Frame vor
- nächster Beat
- nächster Schnitt
- zum Projektende springen

Die aktuelle Zeit wird numerisch angezeigt.

---

# 12. Playhead

Der Playhead ist die zentrale Zeitmarke des Projekts.

Er kann:

- per Maus verschoben werden
- durch Klick in der Timeline gesetzt werden
- beim Abspielen automatisch weiterlaufen
- als Ziel für Kopier- und Einfügevorgänge dienen
- als Schnittposition dienen

Während der Wiedergabe kann die Timeline automatisch mitgeführt werden.

---

# 13. Timeline

Die Timeline ist mehrspurig aufgebaut.

Sie unterstützt mehrere logische Spurtypen gleichzeitig.

Die wichtigsten Spurarten sind:

- Videospuren
- Originaltonspuren
- Textspur
- Effektspur
- Übergangsspur
- Audio-FX-Spur
- Musikspur

---

# 14. Videospuren

Importierte Videos und Bilder werden auf Videospuren platziert.

Ein visueller Clip besitzt typischerweise:

- Startzeit
- Dauer
- Quellstart
- Quellmedium
- Position innerhalb der Spur
- Skalierung
- Rotation
- Deckkraft
- visuellen Effekt beziehungsweise Filter
- Originaltonstatus
- Originaltonlautstärke
- Audio-Fades

Clips können unabhängig voneinander bearbeitet werden.

---

# 15. Originaltonspuren

Zu einer Videospur gehört eine separate Darstellung des Originaltons.

Dadurch kann der Ton eines Videos unabhängig vom Bild bearbeitet werden.

Ein Originaltonabschnitt kann:

- ausgewählt werden
- stummgeschaltet werden
- in der Lautstärke verändert werden
- durch Audio-FX beeinflusst werden
- deaktiviert beziehungsweise gelöscht werden

Wird nur der Originalton entfernt, bleibt der visuelle Videoclip erhalten.

---

# 16. Textspur

Texte werden als eigene zeitliche Objekte behandelt.

Jeder Text besitzt einen Startpunkt und eine Dauer.

Texte können:

- verschoben
- verlängert
- verkürzt
- kopiert
- gelöscht
- direkt in der Vorschau positioniert

werden.

---

# 17. Effektspur

Zeitlich begrenzte Videoeffekte liegen auf einer separaten Spur.

Dadurch können Effekte unabhängig von einzelnen Clips positioniert und angepasst werden.

Ein Effekt besitzt typischerweise:

- Effektart
- Startzeit
- Dauer
- Intensität

---

# 18. Übergangsspur

Übergänge werden zwischen beziehungsweise um Schnittpunkte herum dargestellt.

Ein Übergang besitzt:

- Typ
- Startzeit
- Dauer
- Zielbereich

SmartCut kann Übergänge automatisch erzeugen.

---

# 19. Audio-FX-Spur

Audioeffekte besitzen eine eigene zeitliche Spur.

Dadurch lässt sich erkennen:

- wann ein Audioeffekt beginnt
- wie lange er wirkt
- auf welches Ziel er angewendet wird

Ziel kann sein:

- Musik
- komplette Originaltonspur
- einzelner Originaltonabschnitt
- mehrere ausgewählte Originaltonabschnitte

---

# 20. Musikspur

Musik wird unabhängig von Originalton verwaltet.

Ein Musiksegment besitzt:

- Timeline-Start
- Quellstart innerhalb der Musikdatei
- Länge
- Lautstärke
- Fade-In
- Fade-Out

Musik kann geschnitten und in mehreren Segmenten verwendet werden.

---

# 21. Timeline-Skalierung

Die Timeline kann gezoomt werden.

Dadurch ist sowohl eine grobe Übersicht als auch frame-nahe Bearbeitung möglich.

Die visuelle Breite einer Sekunde wird über einen Zoomfaktor bestimmt.

---

# 22. Spurauswahl

Ein Klick auf den Spurnamen kann die gesamte logische Spur auswählen.

Dies ermöglicht schnelle Mehrfachoperationen.

Beispiele:

- alle Clips einer Videospur auswählen
- gesamte Originaltonspur auswählen
- alle Texte auswählen
- alle Effekte einer Spur auswählen
- Musiksegmente gemeinsam auswählen

---

# 23. Mehrfachauswahl

BeatCut Studio unterstützt Mehrfachauswahl.

Mit Strg/Cmd/Shift können mehrere Timeline-Objekte gleichzeitig markiert werden.

Mehrfachauswahl dient unter anderem für:

- gemeinsames Verschieben
- Löschen
- Kopieren
- Audio-FX
- gemeinsame Eigenschaften
- Trackoperationen

---

# 24. Auswahl aufheben

Es gibt eine explizite Funktion zum Aufheben der aktuellen Auswahl.

Dadurch kann der Benutzer schnell in einen neutralen Zustand zurückkehren.

---

# 25. Clips verschieben

Timeline-Objekte können horizontal verschoben werden.

Die Position wird auf Basis der Projektzeit aktualisiert.

Je nach Objekt gelten unterschiedliche Regeln für Spur und Zielposition.

---

# 26. Trimmen

Clips können an beiden Seiten gekürzt beziehungsweise verlängert werden.

Beim linken Trimmen wird zusätzlich der Quellstart angepasst.

Beim rechten Trimmen verändert sich primär die Clipdauer.

---

# 27. Teilen

Ein Clip kann am aktuellen Playhead geteilt werden.

Dadurch entstehen zwei eigenständige Abschnitte.

Die Quellpositionen bleiben logisch korrekt erhalten.

---

# 28. Kopieren an den Playhead

Ausgewählte Timeline-Objekte können kopiert werden.

Die Kopie wird relativ zum aktuell gesetzten Playhead eingefügt.

Bei Mehrfachauswahl bleibt der zeitliche Abstand der ausgewählten Elemente untereinander erhalten.

Kopiert werden können unter anderem:

- Videoclips
- Texte
- Effekte
- Übergänge
- Musiksegmente
- Audio-FX

Originalton bleibt grundsätzlich mit dem zugehörigen Videoclip verbunden.

---

# 29. Löschen

Ausgewählte Elemente können gelöscht werden.

Das Verhalten hängt vom Elementtyp ab.

Beispiel:

- Löschen eines Videoclips entfernt den visuellen Clip.
- Löschen eines Originaltonabschnitts deaktiviert nur dessen Ton.
- Löschen eines Effekts entfernt nur den Effekt.
- Löschen eines Musiksegments entfernt nur diesen Musikabschnitt.

---

# 30. Undo / Redo

BeatCut Studio besitzt ein eigenes History-System.

Unterstützt werden:

- Rückgängig
- Wiederherstellen

Typische Aktionen im Verlauf sind:

- Clips verschieben
- trimmen
- löschen
- kopieren
- Texte verändern
- Effekte ändern
- Übergänge ändern
- Audioeinstellungen ändern
- SmartCut ausführen
- Auflösung ändern
- Videolimit ändern

Die History ist begrenzt, damit der Speicherverbrauch kontrollierbar bleibt.

---

# 31. Tastaturkürzel

Zu den vorgesehenen beziehungsweise vorhandenen Shortcuts gehören:

- `Strg + Z` – Rückgängig
- `Strg + Y` – Wiederherstellen
- `Strg + Shift + Z` – Wiederherstellen
- `Strg + D` – Auswahl an Playhead kopieren
- `Entf` – Auswahl löschen
- `Leertaste` – Play / Pause

Weitere Shortcuts können später ergänzt werden.

---

# 32. Spursteuerung

Spuren können abhängig vom Typ zusätzliche Zustände besitzen:

- sichtbar
- ausgeblendet
- gesperrt
- entsperrt
- minimiert
- maximiert
- stumm
- aktiv

Originaltonspuren können eigene Lautstärke- und Sperrwerte besitzen.

---

# 33. SmartCut

SmartCut ist eines der zentralen Features von BeatCut Studio.

Es erstellt automatisch eine Schnittfolge aus den vorhandenen Medien.

SmartCut berücksichtigt:

- Musik
- BPM
- Beatpositionen
- Beats pro Clip
- gewählten Stil
- Medienmenge
- Zieldauer
- Szenenbewertung
- erlaubte Effekte
- erlaubte Übergänge

---

# 34. SmartCut-Stile

Vorgesehene beziehungsweise definierte Stile sind:

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

Jeder Stil verändert die automatische Schnittlogik.

Unterschiede können bestehen bei:

- Clip-Länge
- Rhythmus
- Schnittdichte
- Übergangshäufigkeit
- Effektdichte
- erlaubten Effekten
- erlaubten Übergängen
- Szenenbewertung

---

# 35. Beats pro Clip

SmartCut kann festlegen, wie viele Musikbeats ein Clip typischerweise sichtbar bleibt.

Beispiele:

- 1 Beat
- 2 Beats
- 4 Beats
- variable Muster

Dadurch kann die Schnittgeschwindigkeit direkt mit dem Song verbunden werden.

---

# 36. BPM

Die BPM-Zahl beschreibt das musikalische Tempo.

BeatCut Studio kann BPM:

- automatisch analysieren
- manuell übernehmen
- manuell überschreiben
- für Beatmatching verwenden

Die BPM-Anzeige gehört zu den zentralen Projektinformationen.

---

# 37. BPM-Analyse

Die Analyse kann unter anderem folgende Signalmerkmale berücksichtigen:

- Lautstärkeverlauf
- Energie
- Signaländerungen
- Peaks
- wiederkehrende Impulse
- Autokorrelation
- Tempo-Kandidaten
- Beat-Phase

Ergebnis sind unter anderem:

- BPM
- Beatpositionen
- Konfidenz
- Beat-Phase

---

# 38. Beatmatching

Bei aktiviertem Beatmatching versucht BeatCut Studio, Schnitte an erkannten Beats auszurichten.

Berücksichtigt werden:

- BPM
- Beatpositionen
- Beats pro Clip
- SmartCut-Stil
- Übergänge
- geplante Clipdauer

Beats werden zusätzlich visuell auf der Timeline dargestellt.

---

# 39. Beatlinien

Beatpositionen werden als vertikale Marker in der Timeline angezeigt.

Stärkere Beats können visuell hervorgehoben werden.

Diese Marker helfen auch beim manuellen Schnitt.

---

# 40. Szenenanalyse

BeatCut Studio besitzt ein Konzept zur automatischen visuellen Szenenbewertung.

Analysiert werden können beispielsweise:

- Helligkeit
- Kontrast
- Sättigung
- Farbstimmung
- visuelle Veränderung
- Bewegung

Bei Videos können mehrere Frames untersucht werden.

---

# 41. Szenenbewertung

Die Ergebnisse der Szenenanalyse werden je nach SmartCut-Stil unterschiedlich gewichtet.

Ein dynamischer Stil kann beispielsweise bewegungsreiche Szenen bevorzugen.

Ein cinematic-orientierter Stil kann kontrastreiche beziehungsweise optisch markante Szenen bevorzugen.

Die Szenenanalyse ist als visuelle Heuristik ausgelegt und nicht als vollständige semantische Objekterkennung.

---

# 42. Vermeidung von Wiederholungen

SmartCut soll nicht bei jeder Generierung dieselben Quellbereiche verwenden.

Berücksichtigt werden können:

- bereits genutzte Medien
- Nutzungshäufigkeit
- zuletzt verwendete Medien
- bereits genutzte Quellbereiche
- vorherige SmartCut-Durchläufe
- Zufallsvariation
- Szenenbewertung

Dadurch sollen Regenerierungen stärker voneinander abweichen.

---

# 43. SmartCut-Regenerierung

Automatisch erzeugte Clips können neu generiert werden.

Bestehende SmartCut-Einstellungen bleiben dabei erhalten.

Wo sinnvoll sollen manuelle beziehungsweise medienspezifische Anpassungen übernommen werden, zum Beispiel:

- Skalierung
- Rotation
- Deckkraft
- Filter
- Originaltonstatus

---

# 44. Originalton

Jeder Videoclip kann seinen ursprünglichen Ton behalten oder deaktivieren.

Pro Clip sind Einstellungen vorgesehen wie:

- Audio aktiv
- Lautstärke
- Fade-In
- Fade-Out

Zusätzlich kann eine gesamte Originaltonspur eigene Lautstärke- und Mute-Werte besitzen.

---

# 45. Musikbearbeitung

Musik ist ein eigenständiger Teil des Projekts.

Ein Song kann:

- an beliebiger Timeline-Position starten
- ab einer beliebigen Stelle der Quelldatei beginnen
- geteilt werden
- gekürzt werden
- mehrfach verwendet werden
- leiser oder lauter gestellt werden
- ein- und ausgeblendet werden

---

# 46. Waveform

Die Musikspur kann eine Waveform anzeigen.

Sie visualisiert den Lautstärkeverlauf des Songs.

Dadurch lassen sich musikalische Peaks schneller erkennen.

---

# 47. Pitch-/Tonhöhenanzeige

Zusätzlich kann ein Tonhöhenverlauf dargestellt werden.

Dieser dient als ergänzende visuelle Orientierung.

---

# 48. Audio-Fades

Musik und Originalton können Fade-In und Fade-Out erhalten.

Fades sind zeitlich definierte Lautstärkeverläufe.

Sie dienen unter anderem für:

- weiche Musikeinstiege
- weiche Musikausstiege
- Überblendung zwischen Originalton und Musik
- Vermeidung harter Audiokanten

---

# 49. Audio-FX

BeatCut Studio besitzt ein zeitbasiertes Audioeffektsystem.

Vorgesehene beziehungsweise vorhandene Audioeffekte umfassen:

- Ton absenken
- Stumm
- Tremolo / Lautstärkepuls
- Geschwindigkeit 1,5×
- Geschwindigkeit 2×
- Geschwindigkeit 0,75×
- Geschwindigkeit 0,5×
- Tape Stop
- Tape Start

---

# 50. Audio-FX-Eigenschaften

Ein Audioeffekt besitzt typischerweise:

- Ziel
- Startzeit
- Dauer
- Intensität
- Fade-In
- Fade-Out

Ein Effekt kann auf unterschiedliche Audioquellen angewendet werden.

---

# 51. Videoeffekte

BeatCut Studio enthält eine umfangreiche Effektpalette.

Vorgesehene beziehungsweise definierte Effekte sind:

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

---

# 52. Videoeffekt-Eigenschaften

Videoeffekte besitzen mindestens:

- Typ
- Startzeit
- Dauer
- Intensität

Ein Effekt kann manuell gesetzt oder durch SmartCut erzeugt werden.

---

# 53. Übergänge

BeatCut Studio enthält zahlreiche Übergangstypen.

Dazu gehören:

- Fade
- Fade to Black
- Fade to White
- Flash
- Zoom
- Spin
- Blur
- Glitch
- Slide Left
- Slide Right
- Slide Up
- Slide Down
- Wipe Left
- Wipe Right
- Wipe Up
- Wipe Down
- Whip Left
- Whip Right
- Iris
- Bars

---

# 54. Automatische Übergänge

SmartCut kann Übergänge automatisch zwischen Clips platzieren.

Der Benutzer kann einschränken, welche Übergänge SmartCut verwenden darf.

Dadurch kann ein Projekt stilistisch konsistent gehalten werden.

---

# 55. Textsystem

Texte sind vollständig zeitgebundene Timeline-Objekte.

Wichtige Texteigenschaften sind:

- Textinhalt
- Startzeit
- Dauer
- Schriftart
- Schriftstärke
- kursiv / normal
- Schriftgröße
- Skalierung
- X-Position
- Y-Position
- Farbe
- Deckkraft
- Rotation
- Umrandung
- Umrandungsfarbe
- Umrandungsstärke

---

# 56. Textpositionierung

Texte können über Zahlenwerte oder direkt in der Vorschau positioniert werden.

Die direkte Bearbeitung soll sich möglichst intuitiv anfühlen.

---

# 57. Projektauflösung

Die Ausgabeauflösung ist projektweit einstellbar.

Schnellvorlagen sind:

- 16:9
- 9:16
- 1:1
- 4:5

Zusätzlich können Breite und Höhe frei eingegeben werden.

---

# 58. Typische Projektgrößen

Beispiele:

### Vertikales Social Video

1080 × 1920

### Klassisches Full-HD-Video

1920 × 1080

### Quadratisches Video

1080 × 1080

### Social Feed 4:5

1080 × 1350

Die Projektauflösung ist grundsätzlich nicht auf diese Werte beschränkt.

---

# 59. Videolängenlimit

Ein Projekt kann ein maximales Zeitlimit besitzen.

Vordefinierte Werte:

- 15 Sekunden
- 30 Sekunden
- 60 Sekunden
- 90 Sekunden
- 180 Sekunden
- manuelle Dauer
- kein Limit

---

# 60. Limit-Linie

Das aktive Zeitlimit wird als rote vertikale Linie in der Timeline dargestellt.

Dadurch erkennt der Benutzer direkt, wo das gewählte Social-Media-Limit endet.

Die Linie aktualisiert sich bei einer Änderung des Limits.

---

# 61. Verhalten des Limits

Das Limit ist als maximale Zieldauer gedacht.

Es soll nicht automatisch bedeuten, dass ein kürzeres Projekt künstlich bis zu dieser Dauer verlängert wird.

Optional kann ein Projekt physisch auf das Limit gekürzt werden.

---

# 62. Projektlaufzeit

Die tatsächliche Projektdauer ergibt sich aus den vorhandenen Timeline-Inhalten und dem optionalen Zeitlimit.

Relevante Elemente können sein:

- Videoclips
- Bilder
- Texte
- Effekte
- Übergänge
- Musik
- Audio-FX

---

# 63. Projektverwaltung

BeatCut Studio besitzt ein eigenes Projektmodell.

Gespeichert werden unter anderem:

- Projektname
- Auflösung
- Dauer
- Zeitlimit
- Medien
- Tracks
- Clips
- Texte
- Effekte
- Übergänge
- Audioeffekte
- Musiksegmente
- BPM
- Beats
- Beat-Phase
- Waveformdaten
- Pitchdaten
- SmartCut-Einstellungen
- Szenenanalyse
- Spurzustände

---

# 64. Projektdatei

Projekte können als BeatCut-Projekt gespeichert und wieder geöffnet werden.

Das Projektformat soll alle relevanten Bearbeitungsinformationen enthalten.

Langfristig ist vorgesehen, dass ein Projekt auf Wunsch Medien mitführen beziehungsweise eindeutig referenzieren kann.

---

# 65. Projektwiederherstellung

Beim Öffnen eines Projekts sollen alle wichtigen Zustände wiederhergestellt werden:

- Timeline
- Spuren
- Auswahlstruktur
- Clips
- Audio
- Musik
- Text
- Effekte
- Übergänge
- BPM
- SmartCut
- Auflösung
- Videolimit

---

# 66. Export

Das primäre Zielformat ist MP4.

Der Export soll direkt eine social-media-kompatible Videodatei erzeugen.

---

# 67. Exportformat

Wichtige Zielparameter sind:

- MP4-Container
- H.264-Video
- AAC-Audio
- YUV420P
- konstante Framerate
- korrekte Videodauer
- saubere Zeitstempel
- Fast Start

---

# 68. Export-Frameraten

Unterstützte beziehungsweise geplante Optionen umfassen:

- 24 FPS
- 25 FPS
- 30 FPS
- 50 FPS
- 60 FPS

---

# 69. Exportqualität

Der Benutzer soll verschiedene Qualitätsstufen wählen können.

Typische Stufen:

- niedrig
- mittel
- hoch
- sehr hoch

Die Qualitätsstufe beeinflusst Videobitrate beziehungsweise Kompressionsqualität.

---

# 70. Audio beim Export

Beim Export kann berücksichtigt werden:

- Musik
- Originalton
- Lautstärke
- Mute-Zustände
- Fades
- Audio-FX

Musik und Originalton werden entsprechend der Timeline gemischt.

---

# 71. Video-Timing

Ein besonders wichtiger Punkt ist eine saubere Zeitbasis.

Der Export soll vermeiden:

- falsche Videodauer
- variable oder fehlerhafte Framerate
- negative Zeitstempel
- fehlerhafte Startzeiten
- Plattformen, die die Videolänge falsch interpretieren

---

# 72. Social-Media-Kompatibilität

Der Export soll möglichst robust auf Social-Plattformen funktionieren.

Dafür sind insbesondere relevant:

- H.264
- AAC
- 48-kHz-Audio
- YUV420P
- CFR
- Fast Start
- korrekte Dauer
- saubere PTS/DTS-Zeitstempel

---

# 73. Bilder im Export

Bilder werden als echte zeitlich begrenzte Videosegmente behandelt.

Ein Bild kann beispielsweise 2, 4 oder 8 Sekunden auf der Timeline stehen.

Während dieser Dauer wird es als visuelles Videoelement gerendert.

---

# 74. Timeline-Lücken

Bereiche ohne visuelles Medium können als schwarze Videosegmente ausgegeben werden.

Dadurch bleibt die zeitliche Struktur des Projekts erhalten.

---

# 75. Fortschrittsanzeige

Längere Prozesse besitzen eine Fortschrittsanzeige.

Das betrifft unter anderem:

- Medienanalyse
- Musikanalyse
- SmartCut
- Szenenanalyse
- Projektverarbeitung
- Export
- Konvertierung

---

# 76. Export abbrechen

Ein laufender Export soll abgebrochen werden können.

Der Benutzer bleibt dadurch bei langen Renderprozessen handlungsfähig.

---

# 77. Eigenschaftenbereich

Die rechte Seite dient als kontextabhängiger Eigenschafteninspektor.

Je nach aktueller Auswahl werden passende Einstellungen dargestellt.

Beispiele:

- Clip ausgewählt → Video- und Audioeigenschaften
- Text ausgewählt → Texteigenschaften
- Effekt ausgewählt → Effekteinstellungen
- Übergang ausgewählt → Übergangseinstellungen
- Musik ausgewählt → Audioeinstellungen
- Audio-FX ausgewählt → Ziel und Effektparameter

---

# 78. Clip-Eigenschaften

Für einen visuellen Clip können unter anderem bearbeitet werden:

- Startzeit
- Dauer
- Quellstart
- Rotation
- Skalierung
- Deckkraft
- visueller Filter
- Originalton an/aus
- Originaltonlautstärke
- Audio-Fade-In
- Audio-Fade-Out

---

# 79. Medienorientierter Workflow

BeatCut Studio soll Medien nicht unnötig duplizieren.

Ein importiertes Medium kann mehrfach auf der Timeline verwendet werden.

Jeder Timeline-Clip referenziert dasselbe Quellmedium, besitzt jedoch eigene:

- Startzeit
- Dauer
- Quellposition
- Eigenschaften

---

# 80. Logische Tracks

Tracks sind nicht nur grafische Zeilen.

Sie besitzen eigene Zustände wie:

- Name
- Sichtbarkeit
- Sperrstatus
- Audiozustand
- Minimierung
- Auswahlstatus

Das ermöglicht spätere komplexere Projekte.

---

# 81. Mehrere Videospuren

Das Projektmodell ist auf mehrere Videospuren ausgelegt.

Langfristig erlaubt dies:

- Overlays
- Bild-in-Bild
- Logos
- zusätzliche Videoebenen
- komplexere Compositing-Szenen

Der vollständige Mehrspur-Compositor befindet sich dabei noch im Ausbau.

---

# 82. Auto-Schnitt und manueller Schnitt als ein System

Ein besonders wichtiges Designprinzip lautet:

**SmartCut erzeugt normale Timeline-Clips.**

Es existiert keine getrennte „SmartCut-Datei“.

Dadurch können automatisch erzeugte Ergebnisse anschließend wie normale manuelle Clips bearbeitet werden.

---

# 83. SmartGenerated-Kennzeichnung

Automatisch erzeugte Clips können intern als SmartCut-generiert markiert sein.

Das ermöglicht unter anderem:

- gezielte Regenerierung
- Erhalt manueller Clips
- Unterscheidung zwischen automatisch und manuell erzeugten Elementen

---

# 84. Benutzerkontrolle

Automatisierung soll nie bedeuten, dass der Benutzer die Kontrolle verliert.

Daher können automatisch erzeugte Inhalte:

- verschoben
- getrimmt
- gelöscht
- kopiert
- verändert
- neu generiert

werden.

---

# 85. Typischer SmartCut-Workflow

Ein möglicher Ablauf:

1. Videos und Bilder importieren.
2. Musik importieren.
3. BPM analysieren.
4. gewünschten Stil wählen.
5. Beats pro Clip wählen.
6. Beatmatching aktivieren.
7. Zieldauer festlegen.
8. erlaubte Effekte auswählen.
9. erlaubte Übergänge auswählen.
10. SmartCut starten.
11. Ergebnis auf der Timeline prüfen.
12. einzelne Clips manuell korrigieren.
13. Texte hinzufügen.
14. Originalton anpassen.
15. exportieren.

---

# 86. Typischer manueller Workflow

1. Medien importieren.
2. erstes Medium auf die Timeline ziehen.
3. weitere Clips hinzufügen.
4. Clips verschieben.
5. Clips trimmen.
6. Schnitte setzen.
7. Musik hinzufügen.
8. Schnitte an Beatlinien ausrichten.
9. Texte hinzufügen.
10. Effekte und Übergänge hinzufügen.
11. Audio anpassen.
12. Vorschau kontrollieren.
13. exportieren.

---

# 87. Benutzererlebnis

Die Bedienung soll schnell und visuell bleiben.

Wichtige UX-Prinzipien:

- möglichst wenig modale Dialoge
- direkte Timeline-Bearbeitung
- Drag & Drop
- Kontext über Farben
- sichtbarer Playhead
- direkte Vorschau
- schneller Zugriff auf SmartCut
- klare Spurnamen
- Undo/Redo jederzeit verfügbar

---

# 88. Social-Video-Fokus

BeatCut Studio ist besonders auf kurze Projekte ausgelegt.

Daher sind Funktionen wie folgende zentral:

- 9:16-Vorlage
- 15/30/60/90/180-Sekunden-Limits
- Beatmatching
- automatische kurze Schnitte
- starke Effektpalette
- Musik als zentrales Element
- schneller MP4-Export

---

# 89. Projektumfang

BeatCut Studio umfasst mittlerweile deutlich mehr als einen einfachen Clip-Trimmer.

Zum Gesamtumfang gehören:

- Medienverwaltung
- Mehrspur-Timeline
- Projektvorschau
- Video- und Bildclips
- Originalton
- Musik
- Texte
- Videoeffekte
- Audioeffekte
- Übergänge
- SmartCut
- BPM
- Beatmatching
- Szenenanalyse
- Projektdateien
- Undo/Redo
- Social-Media-Limits
- Auflösungsverwaltung
- Export
- Fortschrittsanzeige
- Drag & Drop
- Mehrfachauswahl
- Spurauswahl
- Clipkopien
- Trim/Split

---

# 90. Aktueller nativer Desktop-Stand

Die lokale Desktop-Fassung bildet bereits zentrale Kernfunktionen des Projekts nativ ab.

Dazu gehören:

- lokale Anwendung
- Medienbrowser
- Drag & Drop
- mehrspurige Timeline-Struktur
- Videospur
- Originaltonspur
- Textspur
- Effektspur
- Übergangsspur
- Audio-FX-Spur
- Musikspur
- Clip-Auswahl
- Mehrfachauswahl
- Spurauswahl
- Verschieben
- Trimmen
- Teilen
- Löschen
- Kopieren
- Undo
- Redo
- lokale Video-/Audio-Vorschau
- Bildvorschau
- Musik-Wiedergabe
- Clip-Lautstärke
- Mute
- Audio-Fades
- Projekt speichern
- Projekt öffnen
- SmartCut-Grundfunktion
- nativer MP4-Export
- Originalton im Export
- Musikmischung
- Bildsegmente im Export
- schwarze Timeline-Lücken
- Exportfortschritt
- Exportabbruch

---

# 91. Noch nicht vollständig nativ umgesetzte Bereiche

Einige Funktionen sind bereits konzeptionell und im Projektmodell vorgesehen, aber in der nativen Fassung noch nicht vollständig in der finalen Rendering-Pipeline umgesetzt.

Dazu gehören insbesondere:

- vollständiges Text-Rendering im finalen Export
- komplette Videoeffekt-Pipeline
- vollständige Übergangsberechnung
- vollständige Audio-FX-Verarbeitung
- automatische BPM-Erkennung in der nativen Fassung
- vollständige visuelle Szenenanalyse
- echtes Compositing mehrerer gleichzeitig sichtbarer Videospuren
- vollständige Waveform-Zeichnung
- vollständige Pitch-Zeichnung
- komplett portable Projektdatei mit eingebetteten Medien

Diese Bereiche gehören weiterhin zum vorgesehenen Gesamtumfang von BeatCut Studio.

---

# 92. Priorität der weiteren Entwicklung

Die wichtigsten nächsten Produktbereiche sind:

### Priorität 1 – Stabilität

- zuverlässiger Programmstart
- stabile Vorschau
- zuverlässige Medienanalyse
- robuste Projektdateien
- stabiler Export

### Priorität 2 – Renderqualität

- Text im Export
- Effekte im Export
- Übergänge im Export
- Audio-FX im Export
- Mehrspur-Compositing

### Priorität 3 – Automatisierung

- BPM-Erkennung
- Szenenanalyse
- SmartCut-Ausbau
- intelligente Clipauswahl
- bessere Regenerierung

### Priorität 4 – Bedienkomfort

- bessere Timeline-Interaktion
- Snap-Funktion
- Kontextmenüs
- Tastatursteuerung
- mehr Vorschauoptionen
- Thumbnail-Generierung
- Waveform
- visuelle Beatnavigation

---

# 93. Langfristige Produktvision

Die langfristige Vision ist ein eigenständiger, schneller Short-Video-Editor, der drei Dinge besonders gut verbindet:

1. **klassische manuelle Timeline-Bearbeitung**
2. **musik- und beatbasierte Automatisierung**
3. **schneller Social-Media-Export**

Der Benutzer soll ein Video entweder komplett selbst schneiden oder sich innerhalb weniger Sekunden einen automatischen Entwurf erstellen lassen können.

Beide Wege sollen nahtlos ineinander übergehen.

---

# 94. Abgrenzung des Projekts

BeatCut Studio soll kein vollwertiger Ersatz für sehr große professionelle Film- und Postproduktionssysteme sein.

Der Schwerpunkt liegt bewusst auf:

- Geschwindigkeit
- einfachem Workflow
- Musik
- Beatmatching
- kurzen Videos
- Social-Media-Formaten
- schneller manueller Korrektur
- Automatisierung

Dadurch bleibt der Editor fokussiert.

---

# 95. Kerneigenschaften in Kurzform

**BeatCut Studio ist ein lokaler, mehrspuriger Social-Video-Editor mit:**

- Video- und Bildimport
- Musik
- Originalton
- Mehrspur-Timeline
- Drag & Drop
- Clip-Trimmen
- Clip-Teilen
- Mehrfachauswahl
- Undo/Redo
- Text
- Videoeffekten
- Übergängen
- Audio-FX
- SmartCut
- BPM
- Beatmatching
- Szenenanalyse
- Social-Limits
- frei wählbarer Auflösung
- Projektdateien
- lokaler Vorschau
- nativer MP4-Ausgabe

---

# 96. Zusammenfassung

BeatCut Studio ist inzwischen als umfassender Videoeditor geplant und teilweise umgesetzt, dessen Kernidee weit über einen einfachen Video-Trimmer hinausgeht.

Die Anwendung kombiniert einen klassischen nichtlinearen Schnitt mit einem stark automatisierten, musikbasierten Workflow.

Das wichtigste Alleinstellungsmerkmal des Projekts ist die Kombination aus:

- visueller Mehrspur-Timeline
- direkter manueller Bearbeitung
- SmartCut
- BPM-/Beat-System
- automatischer Szenenauswahl
- automatischen Effekten
- automatischen Übergängen
- Social-Media-orientierter Projektsteuerung

Der Editor soll besonders dann stark sein, wenn aus vielen Bildern und kurzen Videoclips schnell ein rhythmisches, fertiges Video entstehen soll, ohne dass der Benutzer auf manuelle Kontrolle verzichten muss.

Die Oberfläche bleibt dabei auf ein modernes, dunkles, klar gegliedertes Studio-Layout ausgerichtet: Medien links, Vorschau in der Mitte, Eigenschaften rechts und eine große mehrspurige Timeline im unteren Bereich.

Damit bildet BeatCut Studio die Grundlage für einen eigenständigen lokalen Videoeditor, dessen Schwerpunkt auf **schneller Bearbeitung, Musik, Automatisierung und Social-Media-Video** liegt.
