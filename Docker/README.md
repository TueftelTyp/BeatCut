# BeatCut Studio Server – Full Editor v0.4.2

BeatCut Studio ist ein lokaler Web-Videoeditor mit vollständiger Timeline, SmartCut, Szenenanalyse, Effekten, Übergängen, Text, Audio-FX und nativem FFmpeg-Backend.

## Wichtigste Änderung in v0.4.0

Der **finale MP4-Export benutzt kein WebCodecs und kein WebM mehr**.

Ablauf:

```text
BeatCut Canvas
   ↓
Frame 0, 1, 2, ...
   ↓
lokaler BeatCut-Server
   ↓
nummerierte JPEG-Framefolge
   ↓
natives FFmpeg
   ↓
H.264 + AAC MP4
```

Dadurch gibt es beim finalen MP4-Export keinen `VideoEncoder.flush()`-Deadlock, keinen `Codec reclaimed due to inactivity`-Abbruch und keinen ruckeligen MediaRecorder/WebM-Fallback mehr.

## Start unter Windows

1. Eine vollständige Windows-Version von `ffmpeg.exe` und `ffprobe.exe` nach `tools/ffmpeg/` legen oder über PATH verfügbar machen.
2. `start-local.bat` starten.
3. BeatCut unter `http://127.0.0.1:5000` verwenden.

## Export

Der neue MP4-Pfad:

1. Audiomix wird vorbereitet (normalerweise OfflineAudioContext → WAV).
2. Jeder Projektframe wird exakt bei `frame / fps` gerendert.
3. Der fertige Canvas-Frame wird lokal an den BeatCut-Server übertragen.
4. FFmpeg verarbeitet die Framefolge mit konstanter Framerate.
5. Audio wird als AAC 48 kHz Stereo gemuxt.
6. Das fertige MP4 wird heruntergeladen.

Ein 60-Sekunden-Socialprojekt bleibt weiterhin auf der sicheren BeatCut-Zieldauer unterhalb von 60 Sekunden.

## Hinweise

- Der neue Export ist absichtlich robuster statt maximal schnell.
- Während des Exports werden temporär viele JPEG-Frames auf der lokalen Festplatte gespeichert. Sie werden nach erfolgreicher FFmpeg-Verarbeitung entfernt.
- Die Vorschau verwendet weiterhin die schnelle Browser-Pipeline; nur der finale MP4-Export wurde umgestellt.
- WebM kann weiterhin separat als Browserformat angeboten werden, wird aber für MP4 nicht als Zwischenformat benutzt.

## Patch v0.4.1

Diese Ausgabe korrigiert Video-Seek-Prüfung, MP4-Fehlerdurchleitung und Frame-Fortschrittsanzeige. Die MP4-Pipeline bleibt lokale JPEG-Framefolge → natives FFmpeg; WebCodecs wird dafür nicht verwendet. Prüfe einen vollständigen Export mit deinen eigenen Videodateien, insbesondere über Frame 826 hinaus.

## Patch v0.4.2

- Versionsnummer direkt im HTML-Kopfbereich und Seitentitel sichtbar.
- MOV-Decoder-Neustart bei Metadaten-/Seek-Timeouts im Frame-fuer-Frame-Export.
- Keine wiederholten `load()`-Resets bei bereits ladenden Medien.
- Nach Seek muss ein tatsaechlicher Frame in den Canvas-Cache uebernommen werden.
- Bei wiederholtem Fehler wird Quellzeit und Quelle angezeigt.

Hinweis: Der fehlerausloesende MOV-Clip liegt nicht vor; ein Browser-End-to-End-Test mit dieser Datei ist noch offen.


## Docker / Self-Hosting

Anleitung siehe [README-DOCKER.md](README-DOCKER.md). Start: `docker compose up -d --build` und `http://localhost:5000` oeffnen.
