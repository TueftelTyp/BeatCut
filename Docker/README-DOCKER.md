# BeatCut Studio v0.4.2 – Docker Self-Hosting

Dies ist die originale BeatCut Studio v0.4.2 (MOVDecoderRecovery) samt Docker-Konfiguration.

## Voraussetzungen

- Docker Engine + Docker Compose Plugin (oder Docker Desktop)
- Genuegend freier Speicherplatz fuer Quellvideos und temporaere JPEG-Frames

**Keine lokale Node.js-, npm-, FFmpeg- oder FFprobe-Installation notwendig.**
Node.js kommt aus dem offiziellen Node-Image. FFmpeg und FFprobe werden beim ersten Image-Build ueber das Debian-Paket installiert.

## Start

Im Ordner dieser README:

```bash
docker compose up -d --build
```

Danach im Browser `http://localhost:5000` oeffnen.

Status pruefen:

```bash
docker compose ps
docker compose logs -f beatcut
```

FFmpeg/FFprobe pruefen:

```bash
docker compose exec beatcut ffmpeg -version
docker compose exec beatcut ffprobe -version
```

## Zugriff aus dem LAN

Standardmaessig wird Port 5000 **nur auf 127.0.0.1 des Hosts** freigegeben.
Fuer Zugriff von einem anderen PC `.env.example` nach `.env` kopieren und
`BEATCUT_BIND_IP=0.0.0.0` einstellen. Dann `docker compose up -d` ausfuehren.
Anschliessend `http://SERVER-IP:5000` aufrufen.

**Sicherheit:** BeatCut ist fuer den lokalen Einsatz konzipiert. Der Server hat
keine vollstaendige Benutzeranmeldung/Zugriffstrennung. Den Port niemals
ungefiltert ins Internet stellen. Fuer Fernzugriff einen abgesicherten Reverse
Proxy mit HTTPS + Authentifizierung oder ein VPN verwenden. Mehrere Nutzer
teilen sich dieselben serverseitigen Projekte und Medien.

## Dateien und Speicher

Alle Projekte, Uploads, Renderings und SQLite-Daten liegen auf dem Host unter
`./data/` und ueberleben `docker compose down` und Image-Neubauten. Dieser
Ordner enthaelt nutzereigene Daten und sollte gesichert und **nicht** auf GitHub
hochgeladen werden. Temporare Frames koennen waehrend eines Exports viel Platz brauchen.

## Stoppen / Aktualisieren

```bash
docker compose down
docker compose up -d --build
```

Beim Stoppen werden Container entfernt, aber `./data/` bleibt erhalten.

## Fehlerbehebung

- `docker compose logs -f beatcut` zeigt Serverfehler.
- `docker compose ps` zeigt den Health-Status.
- Wenn Port 5000 belegt ist: In `.env` `BEATCUT_PORT=5001` setzen.
- Browser-Export bleibt eine rechenintensive Aufgabe: BeatCut erstellt Frames
  im Browser und uebertraegt sie an das Backend. FFmpeg encodiert sie im Container.
  Docker ersetzt **nicht** die Browser-Berechnung oder Medien-Decoder.
- Die MOV-Decoder-Recovery wurde aus v0.4.2 uebernommen; nicht alle MOV-Dateien
  sind automatisch in jedem Browser decodierbar.

## GitHub veroeffentlichen

Vor Veroeffentlichung bitte Rechte an Code, eingebundenen Bibliotheken und
weiteren Assets pruefen und eine gewuenschte Lizenz bewusst waehlen.
Die enthaltene Datei `frontend/vendor/JSZIP-LICENSE.md` beibehalten.
Das Repo ohne `data/`-Inhalt und `.env` pushen.

```bash
git init
git add .
git commit -m "BeatCut Studio v0.4.2 with Docker Compose"
```

Eine GitHub-Container-Registry-Verteilung kann spaeter ergaenzt werden.
