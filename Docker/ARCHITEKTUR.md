# BeatCut Studio – Architektur v0.4.0

## Editor

```text
Browser
├─ Timeline
├─ SmartCut
├─ Szenenanalyse
├─ Vorschau
├─ Texte / FX / Übergänge
├─ Audiomix
└─ Projektverwaltung
```

## Finaler MP4-Export

```text
Projektzeit n / FPS
      ↓
Videoquellen exakt seeken
      ↓
Canvas vollständig rendern
      ↓
JPEG-Frame lokal hochladen
      ↓
Framefolge auf dem BeatCut-Server
      ↓
natives FFmpeg
      ↓
H.264 CFR + AAC
      ↓
MP4
```

Der finale MP4-Pfad hängt nicht mehr von Browser-WebCodecs oder MediaRecorder ab.

## Exportzustand

Es existiert nur ein aktiver Exportjob. Die UI bleibt aktiv bis zu einem terminalen Zustand:

- `ready`
- `cancelled`
- `error`

Bei Browser-/Netzwerkfehlern nach gestarteter FFmpeg-Verarbeitung wird der Serverjob aktiv abgebrochen, bevor die UI zurückgesetzt wird.

## Temporäre Daten

Frame-Exporte liegen unter `data/temp/frame-exports/<token>/`. Nach erfolgreichem Rendern werden die einzelnen Frames und temporäres Audio entfernt. Das fertige MP4 bleibt bis zur automatischen Bereinigung verfügbar.
