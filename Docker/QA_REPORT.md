# BeatCut Studio v0.4.1 – QA-Bericht

## Ergebnis

Die vollständige automatisierte Suite besteht aus **39 Tests**.

```text
39 bestanden
0 fehlgeschlagen
0 übersprungen
```

## Neue Exportprüfungen

- Deterministische Frame-Sequenz erzeugt H.264/AAC-MP4 ohne WebCodecs/WebM.
- 30 FPS CFR wird per FFprobe bestätigt.
- AAC 48 kHz Stereo wird bestätigt.
- Startzeit und Dauer werden geprüft.
- Fehlende Frames verhindern die Finalisierung.
- Frame-Export kann sauber abgebrochen und gelöscht werden.
- Spezieller Belastungstest verarbeitet **830 Frames** vollständig und überschreitet damit bewusst den früheren Hängepunkt bei Frame 826.
- Frontend-Test bestätigt, dass der finale MP4-Pfad `serverFrameSequenceExportProject` verwendet und im MP4-Zweig weder `VideoEncoder` noch `MediaRecorder` benutzt.

## Bestehende Prüfungen

Weiterhin geprüft werden u. a. Medienupload, FFprobe, Projektvalidierung, Projekt-Packaging/ZIP64, SmartCut, frei gewichtete Szenenanalyse, Vorschau-Synchronisation, Playhead, Offline-Audio/WAV, native FFmpeg-MP4-Ausgabe, Range/HEAD, Path-Traversal und Render-Abbruch.

## Zusätzliche Prüfung v0.4.1

- Frontend-Syntaxprüfung und statische Regression für Decoder-Seek-Zielzeit und FFmpeg-Fehlerbehandlung.
- 39/39 automatisierte Tests erfolgreich in der Testumgebung.
- Die Tests simulieren keine komplexen echten Browser-Videodecoder. Ein abschließender Exporttest mit Originalmaterial ist erforderlich.
