# Node.js is included in this official base image (Node >=22.5 required).
FROM node:22-bookworm-slim

# Install system FFmpeg (including ffprobe) and HTTPS CA certificates.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# This project currently has no npm dependencies; keep the package manifest
# in the image for the correct start and test scripts.
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY frontend ./frontend
COPY tools/ffmpeg/README.txt ./tools/ffmpeg/README.txt

RUN mkdir -p /app/data/uploads /app/data/projects /app/data/renders \
        /app/data/thumbs /app/data/precomposed /app/data/temp

ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0 \
    BEATCUT_ALLOW_REMOTE=1 \
    BEATCUT_DATA_DIR=/app/data

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>r.json()).then(j=>process.exit(j.ok && j.ffmpeg && j.ffprobe ? 0 : 1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
