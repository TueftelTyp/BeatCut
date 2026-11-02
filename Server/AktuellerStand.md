## Aktueller Stand

Die aktuelle Version ist:

**BeatCut Studio Server v0.3.7 – WebCodecs Recovery**

Die Anwendung läuft derzeit als **lokale Web-App mit Server-Backend**:

```text
Browser
   │
   ▼
BeatCut Editor
   │
   ▼
Node.js Server auf 127.0.0.1:5000
   │
   ├─ FFmpeg
   ├─ FFprobe
   ├─ Projektdateien
   ├─ Renderjobs
   └─ temporäre Dateien
```

Die Bedienoberfläche läuft also im Browser, während der Server native Aufgaben wie FFmpeg übernimmt.

---

# Editor

Der vollständige große BeatCut-Editor ist wieder vorhanden.

Enthalten sind:

- Medienbrowser
- Video- und Bildimport
- Musikimport
- mehrere Videospuren
- separate Originaltonspuren
- Musikspur
- Textspur
- FX-Spur
- Transition-Spur
- Audio-FX-Spur
- Drag & Drop
- Timeline-Zoom
- Playhead/Marker
- Trimmen
- Teilen
- Verschieben
- Löschen
- Mehrfachauswahl
- ganze Tracks auswählen
- Kopieren an Marker
- Undo/Redo

---

# Vorschau

Die Vorschau wurde mehrfach optimiert.

Aktuell:

- ca. 30 FPS Preview-Rendering
- Playhead kann trotzdem mit Bildschirmfrequenz aktualisiert werden
- Videos werden nicht mehr ständig hart per `currentTime` nachgesucht
- kleine Audio-/Video-Abweichungen werden toleriert
- erst bei größerem Drift erfolgt eine Korrektur
- unnötige doppelte Canvas-Kopien wurden entfernt
- Video-Decoding verwendet einen Frame-Cache
- bei Seek-/Decoderwechseln wird der letzte gültige Frame gehalten

Damit wurden insbesondere Probleme reduziert wie:

```text
schwarzer Frame
→ Effekt wird darauf angewendet
→ erster Durchlauf sieht kaputt aus
→ zweiter Durchlauf funktioniert
```

Der Export ist davon getrennt und verwendet weiterhin die volle Projektauflösung.

---

# SmartCut

SmartCut ist inzwischen einer der umfangreicheren Teile von BeatCut.

Vorhanden sind verschiedene Stile, unter anderem:

- Dynamic
- Energetic
- Cinematic
- Dramatic
- Smooth
- Travel
- Minimal
- Dreamy
- Glitch/Tech
- Balanced

Zusätzlich:

- Beats pro Clip
- Beatmatching
- automatische Effekte
- automatische Übergänge
- Szenenanalyse
- Regenerierung
- Vermeidung bereits häufig verwendeter Szenen

---

# Neue SmartCut-Szenenanalyse

Die Analyse wurde zuletzt deutlich erweitert.

Sie arbeitet jetzt zweistufig:

```text
gesamtes Video
      ↓
Grobanalyse
      ↓
beste Bereiche erkennen
      ↓
Feinanalyse
      ↓
Szenenkandidaten
      ↓
stilabhängige Bewertung
      ↓
SourceStart für SmartCut
```

Pro Szene werden Rohwerte gespeichert.

Aktuell berücksichtigt BeatCut unter anderem:

- Bewegung
- Kontrast
- Sättigung
- Schärfe / Details
- Helligkeit
- Farbtemperatur

---

# Frei einstellbare Analyse

Im SmartCut-Dialog gibt es inzwischen den Bereich:

**Szenenanalyse & Gewichtung**

Darin befinden sich Schieberegler.

Zum Beispiel:

```text
Bewegung       -100 ───────── +100
Kontrast       -100 ───────── +100
Sättigung      -100 ───────── +100
Schärfe        -100 ───────── +100
Helligkeit     -100 ───────── +100
Farbwärme      -100 ───────── +100
```

Bedeutung:

```text
+100  = stark bevorzugen
0     = ignorieren
-100  = möglichst vermeiden
```

Damit kann dasselbe Video bei unterschiedlichen SmartCut-Einstellungen tatsächlich andere Szenen liefern.

Beispiel:

```text
Dynamic
→ schnelle, bewegte Szene

Cinematic
→ kontrastreiche, detailreiche Szene

Smooth
→ ruhige Szene
```

Zusätzlich gibt es einen Regler für die **Analysegenauigkeit**.

---

# BPM und Musik

BeatCut kann:

- Musik analysieren
- BPM bestimmen
- Beatpositionen erkennen
- Beatmarker anzeigen
- Schnitte auf Beats legen
- Beats pro Clip berücksichtigen

Musiksegmente besitzen:

- Startposition
- Quellposition
- Dauer
- Lautstärke
- Fade-In
- Fade-Out

---

# Originalton

Video und Originalton werden getrennt behandelt.

Damit kann beispielsweise:

```text
Video bleibt sichtbar
Originalton wird gelöscht/stummgeschaltet
```

werden.

Pro Originalton sind unter anderem möglich:

- Lautstärke
- Mute
- Fade-In
- Fade-Out
- Audio-FX

---

# Audio-FX

Vorhanden sind unter anderem:

- Lautstärke reduzieren
- Mute
- Volume Pulse
- 1,5× Speed
- 2× Speed
- 0,75×
- 0,5×
- Tape Stop
- Tape Start

Die Effekte können auf:

- Musik
- Track
- einzelnen Clip

angewendet werden.

---

# Videoeffekte

Es gibt bereits eine recht große Effektbibliothek, beispielsweise:

- Flash
- Glitch
- Strobe
- Vignette
- Film Grain
- Cinematic
- Neon
- Dream
- Shake
- Hue
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

# Übergänge

Unter anderem:

- Fade
- Black
- White
- Flash
- Zoom
- Spin
- Blur
- Glitch
- Slide Left/Right/Up/Down
- Wipe
- Whip
- Iris
- Bars

SmartCut kann daraus automatisch auswählen.

---

# Textsystem

Texte besitzen unter anderem:

- Inhalt
- Start
- Dauer
- Schrift
- Schriftstärke
- kursiv
- Größe
- Skalierung
- X/Y
- Farbe
- Deckkraft
- Rotation
- Kontur
- Konturfarbe
- Konturstärke

Texte können auch direkt in der Vorschau positioniert werden.

---

# Projektformate

Unterstützt werden beispielsweise:

- 16:9
- 9:16
- 1:1
- 4:5
- freie Breite/Höhe

Typisches TikTok-Projekt:

```text
1080 × 1920
30 FPS
```

---

# Videolimits

Es gibt:

- 15 s
- 30 s
- 60 s
- 90 s
- 180 s
- freie Länge
- kein Limit

Das Limit wird als Linie in der Timeline angezeigt.

Für den 60-Sekunden-Social-Export wird bewusst auf:

```text
59,900 Sekunden
```

begrenzt.

Damit soll TikTok die Datei nicht wegen Container-/AAC-Rundung als länger als 60 Sekunden erkennen.

---

# MP4-Export

Der MP4-Export läuft inzwischen nicht mehr ausschließlich über Browser-FFmpeg.

Der Ablauf ist ungefähr:

```text
Browser rendert Bildframes
        ↓
WebCodecs H.264
        ↓
Audiomix
        ↓
Server
        ↓
native FFmpeg
        ↓
H.264 + AAC MP4
```

Zielwerte:

- H.264
- AAC
- 48 kHz Stereo
- YUV420P
- CFR
- SAR 1:1
- Startzeit 0
- Fast Start

---

# WebCodecs-Recovery

Zuletzt kam der Fehler:

```text
Codec reclaimed due to inactivity
```

Das wurde in v0.3.7 abgefangen.

BeatCut macht jetzt:

```text
Frame encodieren
↓
flush()
↓
nächster Frame
```

Wenn Chrome/Brave den Encoder trotzdem freigibt:

```text
Encoder kaputt
     ↓
neuen Encoder erstellen
     ↓
Keyframe erzeugen
     ↓
Export fortsetzen
```

Falls WebCodecs mehrfach ausfällt:

```text
MediaRecorder
     ↓
Server-FFmpeg
     ↓
MP4
```

Der Export soll also nicht mehr komplett abbrechen.

---

# Audioexport

Normale Projekte werden inzwischen über:

```text
OfflineAudioContext
       ↓
48 kHz Stereo
       ↓
PCM WAV
       ↓
Server-FFmpeg
       ↓
AAC
```

gemischt.

Dadurch hängt der Export nicht mehr davon ab, ob:

- der Browser-Tab stumm ist
- das Audiogerät aktiv ist
- Echtzeit-Audio sauber läuft

Für spezielle Time-Stretch-FX wie Tape Stop/Speed existiert weiterhin ein Fallback.

---

# Projektdateien

BeatCut besitzt weiterhin `.beatcut`-Projektdateien.

Enthalten sind:

- project.json
- Medien
- Musik
- Timeline
- SmartCut-Einstellungen
- Analysewerte
- Texte
- FX
- Übergänge
- Audio-FX

---

# Große Projekte

Ein wichtiges Problem wurde zuletzt ebenfalls behoben.

Vorher wurde im Browser:

```text
mehrere GB Medien
       ↓
JSZip
       ↓
riesiger Blob
```

gebaut.

Bei mehreren langen Videospuren kam:

```text
can't construct the Blob
```

Jetzt erfolgt das Packaging serverseitig:

```text
Browser
  │
  ├─ Datei 1 streamen
  ├─ Datei 2 streamen
  ├─ Datei 3 streamen
  └─ Musik streamen
        ↓
Server
        ↓
ZIP64
        ↓
Projekt.beatcut
```

Dadurch muss das komplette Projekt nicht mehr gleichzeitig im Browser-RAM liegen.

ZIP64 ermöglicht auch sehr große Projektarchive.

---

# Aktuelle Tests

Die letzte Version **v0.3.7** besitzt aktuell:

```text
32 automatisierte Testgruppen
32 bestanden
0 Fehler
```

Geprüft werden unter anderem:

- Syntax
- Medienupload
- FFprobe
- Projektvalidierung
- Projekt-Packaging
- ZIP64
- Path Traversal
- SmartCut
- Szenenanalyse
- Slider-Gewichtungen
- Preview-Synchronisation
- Playhead
- Audioexport
- WAV→AAC
- WebCodecs Recovery
- H.264-Neustarts
- MP4
- 59,9-Sekunden-Export
- Render-Abbruch

---

# Aktuelle Architektur

Der jetzige Stand ist:

```text
Benutzer-PC

Browser
│
├─ BeatCut UI
├─ Timeline
├─ SmartCut
├─ Preview
├─ Szenenanalyse
└─ WebCodecs
       │
       ▼
Node.js Server
127.0.0.1:5000
       │
       ├─ FFmpeg
       ├─ FFprobe
       ├─ Renderjobs
       ├─ Projektpacker
       └─ temporäre Dateien
```

Also aktuell noch komplett lokal.

---

# Geplante Webarchitektur

Wir haben außerdem bereits festgelegt, wie BeatCut später online angeboten werden könnte:

```text
BeatCut Webserver
      │
      ▼
Webbrowser
      │
      ▼
BeatCut Local Engine
      │
      ├─ FFmpeg
      ├─ FFprobe
      ├─ Analyse
      ├─ SmartCut
      └─ Export
```

Damit könnte:

- die Webseite zentral gehostet werden,
- Projekte online gespeichert werden,
- aber CPU/GPU des Benutzer-PCs die eigentliche Videoarbeit erledigen.

Originalmedien müssten dann nicht zwingend auf deinen Server hochgeladen werden.

---

## Was noch sinnvoll ausgebaut werden kann

Die wichtigsten nächsten Schritte wären aus meiner Sicht:

1. **Proxy-Videos**
   - 4K/60-FPS-Material automatisch auf kleine Vorschau-Proxies herunterrechnen.

2. **lokale BeatCut Engine**
   - Web-App online, FFmpeg lokal beim Benutzer.

3. **semantische Szenenanalyse**
   - Personen/Gesichter
   - Fahrzeuge
   - Landschaft
   - Motivwechsel
   - unscharfe/verwackelte Frames
   - besonders gute Einstellungen

4. **GPU-Beschleunigung**
   - NVIDIA NVENC
   - Intel Quick Sync
   - AMD AMF

5. **weiteres Preview-Tuning**
   - dynamische Vorschauauflösung
   - Proxy-Decoding
   - aggressiveres Preloading der nächsten Clips

Unterm Strich ist BeatCut inzwischen nicht mehr nur ein HTML-Prototyp, sondern ein recht umfangreicher **browserbasierter Non-Linear-Videoeditor mit SmartCut, eigener Szenenanalyse und nativem FFmpeg-Backend**. Der größte nächste Architekturgewinn wäre jetzt tatsächlich die Kombination **Web-App + lokale BeatCut Engine**, damit die Anwendung online angeboten werden kann, ohne dass dein Server sämtliche Video-Rechenarbeit übernehmen muss.

## Aktueller Stand

Die aktuelle Version ist:

**BeatCut Studio Server v0.3.7 – WebCodecs Recovery**

Die Anwendung läuft derzeit als **lokale Web-App mit Server-Backend**:

```text
Browser
   │
   ▼
BeatCut Editor
   │
   ▼
Node.js Server auf 127.0.0.1:5000
   │
   ├─ FFmpeg
   ├─ FFprobe
   ├─ Projektdateien
   ├─ Renderjobs
   └─ temporäre Dateien
```

Die Bedienoberfläche läuft also im Browser, während der Server native Aufgaben wie FFmpeg übernimmt.

---

# Editor

Der vollständige große BeatCut-Editor ist wieder vorhanden.

Enthalten sind:

- Medienbrowser
- Video- und Bildimport
- Musikimport
- mehrere Videospuren
- separate Originaltonspuren
- Musikspur
- Textspur
- FX-Spur
- Transition-Spur
- Audio-FX-Spur
- Drag & Drop
- Timeline-Zoom
- Playhead/Marker
- Trimmen
- Teilen
- Verschieben
- Löschen
- Mehrfachauswahl
- ganze Tracks auswählen
- Kopieren an Marker
- Undo/Redo

---

# Vorschau

Die Vorschau wurde mehrfach optimiert.

Aktuell:

- ca. 30 FPS Preview-Rendering
- Playhead kann trotzdem mit Bildschirmfrequenz aktualisiert werden
- Videos werden nicht mehr ständig hart per `currentTime` nachgesucht
- kleine Audio-/Video-Abweichungen werden toleriert
- erst bei größerem Drift erfolgt eine Korrektur
- unnötige doppelte Canvas-Kopien wurden entfernt
- Video-Decoding verwendet einen Frame-Cache
- bei Seek-/Decoderwechseln wird der letzte gültige Frame gehalten

Damit wurden insbesondere Probleme reduziert wie:

```text
schwarzer Frame
→ Effekt wird darauf angewendet
→ erster Durchlauf sieht kaputt aus
→ zweiter Durchlauf funktioniert
```

Der Export ist davon getrennt und verwendet weiterhin die volle Projektauflösung.

---

# SmartCut

SmartCut ist inzwischen einer der umfangreicheren Teile von BeatCut.

Vorhanden sind verschiedene Stile, unter anderem:

- Dynamic
- Energetic
- Cinematic
- Dramatic
- Smooth
- Travel
- Minimal
- Dreamy
- Glitch/Tech
- Balanced

Zusätzlich:

- Beats pro Clip
- Beatmatching
- automatische Effekte
- automatische Übergänge
- Szenenanalyse
- Regenerierung
- Vermeidung bereits häufig verwendeter Szenen

---

# Neue SmartCut-Szenenanalyse

Die Analyse wurde zuletzt deutlich erweitert.

Sie arbeitet jetzt zweistufig:

```text
gesamtes Video
      ↓
Grobanalyse
      ↓
beste Bereiche erkennen
      ↓
Feinanalyse
      ↓
Szenenkandidaten
      ↓
stilabhängige Bewertung
      ↓
SourceStart für SmartCut
```

Pro Szene werden Rohwerte gespeichert.

Aktuell berücksichtigt BeatCut unter anderem:

- Bewegung
- Kontrast
- Sättigung
- Schärfe / Details
- Helligkeit
- Farbtemperatur

---

# Frei einstellbare Analyse

Im SmartCut-Dialog gibt es inzwischen den Bereich:

**Szenenanalyse & Gewichtung**

Darin befinden sich Schieberegler.

Zum Beispiel:

```text
Bewegung       -100 ───────── +100
Kontrast       -100 ───────── +100
Sättigung      -100 ───────── +100
Schärfe        -100 ───────── +100
Helligkeit     -100 ───────── +100
Farbwärme      -100 ───────── +100
```

Bedeutung:

```text
+100  = stark bevorzugen
0     = ignorieren
-100  = möglichst vermeiden
```

Damit kann dasselbe Video bei unterschiedlichen SmartCut-Einstellungen tatsächlich andere Szenen liefern.

Beispiel:

```text
Dynamic
→ schnelle, bewegte Szene

Cinematic
→ kontrastreiche, detailreiche Szene

Smooth
→ ruhige Szene
```

Zusätzlich gibt es einen Regler für die **Analysegenauigkeit**.

---

# BPM und Musik

BeatCut kann:

- Musik analysieren
- BPM bestimmen
- Beatpositionen erkennen
- Beatmarker anzeigen
- Schnitte auf Beats legen
- Beats pro Clip berücksichtigen

Musiksegmente besitzen:

- Startposition
- Quellposition
- Dauer
- Lautstärke
- Fade-In
- Fade-Out

---

# Originalton

Video und Originalton werden getrennt behandelt.

Damit kann beispielsweise:

```text
Video bleibt sichtbar
Originalton wird gelöscht/stummgeschaltet
```

werden.

Pro Originalton sind unter anderem möglich:

- Lautstärke
- Mute
- Fade-In
- Fade-Out
- Audio-FX

---

# Audio-FX

Vorhanden sind unter anderem:

- Lautstärke reduzieren
- Mute
- Volume Pulse
- 1,5× Speed
- 2× Speed
- 0,75×
- 0,5×
- Tape Stop
- Tape Start

Die Effekte können auf:

- Musik
- Track
- einzelnen Clip

angewendet werden.

---

# Videoeffekte

Es gibt bereits eine recht große Effektbibliothek, beispielsweise:

- Flash
- Glitch
- Strobe
- Vignette
- Film Grain
- Cinematic
- Neon
- Dream
- Shake
- Hue
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

# Übergänge

Unter anderem:

- Fade
- Black
- White
- Flash
- Zoom
- Spin
- Blur
- Glitch
- Slide Left/Right/Up/Down
- Wipe
- Whip
- Iris
- Bars

SmartCut kann daraus automatisch auswählen.

---

# Textsystem

Texte besitzen unter anderem:

- Inhalt
- Start
- Dauer
- Schrift
- Schriftstärke
- kursiv
- Größe
- Skalierung
- X/Y
- Farbe
- Deckkraft
- Rotation
- Kontur
- Konturfarbe
- Konturstärke

Texte können auch direkt in der Vorschau positioniert werden.

---

# Projektformate

Unterstützt werden beispielsweise:

- 16:9
- 9:16
- 1:1
- 4:5
- freie Breite/Höhe

Typisches TikTok-Projekt:

```text
1080 × 1920
30 FPS
```

---

# Videolimits

Es gibt:

- 15 s
- 30 s
- 60 s
- 90 s
- 180 s
- freie Länge
- kein Limit

Das Limit wird als Linie in der Timeline angezeigt.

Für den 60-Sekunden-Social-Export wird bewusst auf:

```text
59,900 Sekunden
```

begrenzt.

Damit soll TikTok die Datei nicht wegen Container-/AAC-Rundung als länger als 60 Sekunden erkennen.

---

# MP4-Export

Der MP4-Export läuft inzwischen nicht mehr ausschließlich über Browser-FFmpeg.

Der Ablauf ist ungefähr:

```text
Browser rendert Bildframes
        ↓
WebCodecs H.264
        ↓
Audiomix
        ↓
Server
        ↓
native FFmpeg
        ↓
H.264 + AAC MP4
```

Zielwerte:

- H.264
- AAC
- 48 kHz Stereo
- YUV420P
- CFR
- SAR 1:1
- Startzeit 0
- Fast Start

---

# WebCodecs-Recovery

Zuletzt kam der Fehler:

```text
Codec reclaimed due to inactivity
```

Das wurde in v0.3.7 abgefangen.

BeatCut macht jetzt:

```text
Frame encodieren
↓
flush()
↓
nächster Frame
```

Wenn Chrome/Brave den Encoder trotzdem freigibt:

```text
Encoder kaputt
     ↓
neuen Encoder erstellen
     ↓
Keyframe erzeugen
     ↓
Export fortsetzen
```

Falls WebCodecs mehrfach ausfällt:

```text
MediaRecorder
     ↓
Server-FFmpeg
     ↓
MP4
```

Der Export soll also nicht mehr komplett abbrechen.

---

# Audioexport

Normale Projekte werden inzwischen über:

```text
OfflineAudioContext
       ↓
48 kHz Stereo
       ↓
PCM WAV
       ↓
Server-FFmpeg
       ↓
AAC
```

gemischt.

Dadurch hängt der Export nicht mehr davon ab, ob:

- der Browser-Tab stumm ist
- das Audiogerät aktiv ist
- Echtzeit-Audio sauber läuft

Für spezielle Time-Stretch-FX wie Tape Stop/Speed existiert weiterhin ein Fallback.

---

# Projektdateien

BeatCut besitzt weiterhin `.beatcut`-Projektdateien.

Enthalten sind:

- project.json
- Medien
- Musik
- Timeline
- SmartCut-Einstellungen
- Analysewerte
- Texte
- FX
- Übergänge
- Audio-FX

---

# Große Projekte

Ein wichtiges Problem wurde zuletzt ebenfalls behoben.

Vorher wurde im Browser:

```text
mehrere GB Medien
       ↓
JSZip
       ↓
riesiger Blob
```

gebaut.

Bei mehreren langen Videospuren kam:

```text
can't construct the Blob
```

Jetzt erfolgt das Packaging serverseitig:

```text
Browser
  │
  ├─ Datei 1 streamen
  ├─ Datei 2 streamen
  ├─ Datei 3 streamen
  └─ Musik streamen
        ↓
Server
        ↓
ZIP64
        ↓
Projekt.beatcut
```

Dadurch muss das komplette Projekt nicht mehr gleichzeitig im Browser-RAM liegen.

ZIP64 ermöglicht auch sehr große Projektarchive.

---

# Aktuelle Tests

Die letzte Version **v0.3.7** besitzt aktuell:

```text
32 automatisierte Testgruppen
32 bestanden
0 Fehler
```

Geprüft werden unter anderem:

- Syntax
- Medienupload
- FFprobe
- Projektvalidierung
- Projekt-Packaging
- ZIP64
- Path Traversal
- SmartCut
- Szenenanalyse
- Slider-Gewichtungen
- Preview-Synchronisation
- Playhead
- Audioexport
- WAV→AAC
- WebCodecs Recovery
- H.264-Neustarts
- MP4
- 59,9-Sekunden-Export
- Render-Abbruch

---

# Aktuelle Architektur

Der jetzige Stand ist:

```text
Benutzer-PC

Browser
│
├─ BeatCut UI
├─ Timeline
├─ SmartCut
├─ Preview
├─ Szenenanalyse
└─ WebCodecs
       │
       ▼
Node.js Server
127.0.0.1:5000
       │
       ├─ FFmpeg
       ├─ FFprobe
       ├─ Renderjobs
       ├─ Projektpacker
       └─ temporäre Dateien
```

Also aktuell noch komplett lokal.

---

# Geplante Webarchitektur

Wir haben außerdem bereits festgelegt, wie BeatCut später online angeboten werden könnte:

```text
BeatCut Webserver
      │
      ▼
Webbrowser
      │
      ▼
BeatCut Local Engine
      │
      ├─ FFmpeg
      ├─ FFprobe
      ├─ Analyse
      ├─ SmartCut
      └─ Export
```

Damit könnte:

- die Webseite zentral gehostet werden,
- Projekte online gespeichert werden,
- aber CPU/GPU des Benutzer-PCs die eigentliche Videoarbeit erledigen.

Originalmedien müssten dann nicht zwingend auf deinen Server hochgeladen werden.

---

## Was noch sinnvoll ausgebaut werden kann

Die wichtigsten nächsten Schritte wären aus meiner Sicht:

1. **Proxy-Videos**
   - 4K/60-FPS-Material automatisch auf kleine Vorschau-Proxies herunterrechnen.

2. **lokale BeatCut Engine**
   - Web-App online, FFmpeg lokal beim Benutzer.

3. **semantische Szenenanalyse**
   - Personen/Gesichter
   - Fahrzeuge
   - Landschaft
   - Motivwechsel
   - unscharfe/verwackelte Frames
   - besonders gute Einstellungen

4. **GPU-Beschleunigung**
   - NVIDIA NVENC
   - Intel Quick Sync
   - AMD AMF

5. **weiteres Preview-Tuning**
   - dynamische Vorschauauflösung
   - Proxy-Decoding
   - aggressiveres Preloading der nächsten Clips

Unterm Strich ist BeatCut inzwischen nicht mehr nur ein HTML-Prototyp, sondern ein recht umfangreicher **browserbasierter Non-Linear-Videoeditor mit SmartCut, eigener Szenenanalyse und nativem FFmpeg-Backend**. Der größte nächste Architekturgewinn wäre jetzt tatsächlich die Kombination **Web-App + lokale BeatCut Engine**, damit die Anwendung online angeboten werden kann, ohne dass dein Server sämtliche Video-Rechenarbeit übernehmen muss.
