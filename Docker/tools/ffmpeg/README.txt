BeatCut Studio benötigt ffmpeg und ffprobe.

Windows (empfohlen):
- vollständigen STATIC Build verwenden
- ffmpeg.exe und ffprobe.exe in diesen Ordner kopieren

Erwartete Pfade:
  tools\ffmpeg\ffmpeg.exe
  tools\ffmpeg\ffprobe.exe

Bei einem SHARED Build müssen zusätzlich alle zugehörigen FFmpeg-DLLs vorhanden sein.
Fehlen diese DLLs, kann Windows z. B. mit 0xC0000135 / 3221225781 abbrechen.

Alternativ dürfen ffmpeg und ffprobe über die PATH-Umgebungsvariable erreichbar sein.
