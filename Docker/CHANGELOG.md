## v0.4.2 – MOV-Decoder-Recovery und sichtbare Versionsnummer

- Bei Metadaten-, Seek- und Frame-Fehlern wird die betroffene Videoinstanz verworfen und frisch aufgebaut.
- Keine unnoetigen `load()`-Aufrufe bei bereits ladenden Quellen.
- Sichtbare Versionsnummer im HTML-Kopf und Browser-Tab.
- Detailliertere Exportfehler.

## v0.4.1 – MP4-Export-Stabilisierung

- Decoder-Seeks werden nicht mehr nur anhand von `seeked`/`readyState`, sondern auch anhand der tatsächlichen Zielzeit validiert.
- Genauer Fehlertext bei hängenden Video-Seeks mit angeforderter und aktueller Zeit.
- FFmpeg-Fehler beim Status-Polling werden sofort angezeigt statt als Verbindungsfehler behandelt.
- Zusätzliche Fortschrittsanzeige vor JPEG-Erstellung, mehr Zeit für aufwendige Canvas-Frames.
- Regressionstest für Seek-Verifikation und Fehlerdurchleitung.

**Grenze der Tests:** Die automatisierten Exporte verwenden synthetische JPEG-Frames; Browser-Decoder, echte Timelines sowie dein konkreter Videoclip müssen lokal zusätzlich getestet werden.

# Changelog

## 0.4.0 – Deterministic MP4 Frame Pipeline

- Finaler MP4-Export verwendet weder WebCodecs noch MediaRecorder/WebM.
- BeatCut rendert jeden Projektframe deterministisch auf dem Canvas.
- Frames werden als einzelne JPEG-Dateien zum lokalen BeatCut-Server gestreamt.
- Native FFmpeg erzeugt direkt H.264/AAC-MP4 aus der nummerierten Framefolge.
- Ein einzelner Exportzustand bleibt bis `ready`, `cancelled` oder `error` aktiv.
- Fehler nach gestartem FFmpeg-Job brechen den zugehörigen Serverjob aktiv ab; kein unsichtbares Hintergrundrendern mehr.
- Export-Abbruch beendet Upload/FFmpeg und entfernt temporäre Frame-Dateien.
- Nach erfolgreichem Rendern werden Framefolge und temporäres Audio gelöscht.
- Neuer Regressionstest überschreitet gezielt den früheren Hängepunkt bei Frame 826 (830 Frames vollständig gerendert).
- Bestehende SmartCut-, Szenenanalyse-, Vorschau-, Projektdatei- und Audiofunktionen bleiben erhalten.
