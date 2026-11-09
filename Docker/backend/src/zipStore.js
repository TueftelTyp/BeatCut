import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';

const UINT16_MAX = 0xFFFF;
const UINT32_MAX = 0xFFFFFFFF;
const UINT32_MAX_BIG = 0xFFFFFFFFn;
const CRC_TABLE = makeCrcTable();

export async function writeStoredZip(outputPath, entries, options = {}) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('ZIP benötigt mindestens einen Eintrag.');
  const normalized = entries.map(normalizeEntry);
  const totalInputBytes = normalized.reduce((sum, entry) => sum + entry.size, 0n);
  const output = fs.createWriteStream(outputPath, { flags: 'wx' });
  let offset = 0n;
  let processed = 0n;
  const centralEntries = [];

  const write = async buffer => {
    if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
    if (!output.write(buffer)) await once(output, 'drain');
    offset += BigInt(buffer.length);
  };

  const ensureActive = () => {
    if (options.signal?.aborted) {
      const error = new Error('ZIP-Erstellung abgebrochen.');
      error.name = 'AbortError';
      throw error;
    }
  };

  try {
    for (let index = 0; index < normalized.length; index++) {
      ensureActive();
      const entry = normalized[index];
      const localOffset = offset;
      const name = Buffer.from(entry.name, 'utf8');
      const needsZip64Size = entry.size > UINT32_MAX_BIG;
      const localExtra = needsZip64Size ? zip64SizeExtra(entry.size) : Buffer.alloc(0);
      const { dosTime, dosDate } = dosDateTime(entry.mtime);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034B50, 0);
      local.writeUInt16LE(needsZip64Size ? 45 : 20, 4);
      local.writeUInt16LE(0x0808, 6); // data descriptor + UTF-8
      local.writeUInt16LE(0, 8); // STORE
      local.writeUInt16LE(dosTime, 10);
      local.writeUInt16LE(dosDate, 12);
      local.writeUInt32LE(0, 14);
      local.writeUInt32LE(needsZip64Size ? UINT32_MAX : 0, 18);
      local.writeUInt32LE(needsZip64Size ? UINT32_MAX : 0, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(localExtra.length, 28);
      await write(local);
      await write(name);
      if (localExtra.length) await write(localExtra);

      let crcState = 0xFFFFFFFF;
      let actualSize = 0n;
      const input = fs.createReadStream(entry.filePath, { highWaterMark: 1024 * 1024 });
      for await (const chunk of input) {
        ensureActive();
        actualSize += BigInt(chunk.length);
        if (actualSize > entry.size) throw new Error(`ZIP-Quelle ist während der Erstellung gewachsen: ${entry.name}`);
        crcState = crc32Update(crcState, chunk);
        await write(chunk);
        processed += BigInt(chunk.length);
        options.onProgress?.({
          entryIndex: index,
          entryCount: normalized.length,
          processedBytes: processed,
          totalBytes: totalInputBytes,
          progress: totalInputBytes > 0n ? Number(processed * 10000n / totalInputBytes) / 10000 : 1
        });
      }
      if (actualSize !== entry.size) throw new Error(`ZIP-Quelle hat ihre Größe geändert: ${entry.name}`);
      const crc = (crcState ^ 0xFFFFFFFF) >>> 0;

      const descriptor = Buffer.alloc(needsZip64Size ? 24 : 16);
      descriptor.writeUInt32LE(0x08074B50, 0);
      descriptor.writeUInt32LE(crc, 4);
      if (needsZip64Size) {
        descriptor.writeBigUInt64LE(entry.size, 8);
        descriptor.writeBigUInt64LE(entry.size, 16);
      } else {
        descriptor.writeUInt32LE(Number(entry.size), 8);
        descriptor.writeUInt32LE(Number(entry.size), 12);
      }
      await write(descriptor);
      centralEntries.push({ ...entry, localOffset, crc, nameBuffer: name, dosTime, dosDate });
    }

    const centralStart = offset;
    for (const entry of centralEntries) {
      ensureActive();
      const needsZip64Size = entry.size > UINT32_MAX_BIG;
      const needsZip64Offset = entry.localOffset > UINT32_MAX_BIG;
      const centralExtra = zip64CentralExtra(entry.size, entry.localOffset, needsZip64Size, needsZip64Offset);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014B50, 0);
      central.writeUInt16LE(45, 4);
      central.writeUInt16LE(needsZip64Size || needsZip64Offset ? 45 : 20, 6);
      central.writeUInt16LE(0x0808, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(entry.dosTime, 12);
      central.writeUInt16LE(entry.dosDate, 14);
      central.writeUInt32LE(entry.crc, 16);
      central.writeUInt32LE(needsZip64Size ? UINT32_MAX : Number(entry.size), 20);
      central.writeUInt32LE(needsZip64Size ? UINT32_MAX : Number(entry.size), 24);
      central.writeUInt16LE(entry.nameBuffer.length, 28);
      central.writeUInt16LE(centralExtra.length, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(needsZip64Offset ? UINT32_MAX : Number(entry.localOffset), 42);
      await write(central);
      await write(entry.nameBuffer);
      if (centralExtra.length) await write(centralExtra);
    }

    const centralSize = offset - centralStart;
    const entryCount = BigInt(centralEntries.length);
    const needsZip64End = entryCount > BigInt(UINT16_MAX) || centralStart > UINT32_MAX_BIG || centralSize > UINT32_MAX_BIG || centralEntries.some(entry => entry.size > UINT32_MAX_BIG || entry.localOffset > UINT32_MAX_BIG);

    if (needsZip64End) {
      const zip64EocdOffset = offset;
      const zip64 = Buffer.alloc(56);
      zip64.writeUInt32LE(0x06064B50, 0);
      zip64.writeBigUInt64LE(44n, 4);
      zip64.writeUInt16LE(45, 12);
      zip64.writeUInt16LE(45, 14);
      zip64.writeUInt32LE(0, 16);
      zip64.writeUInt32LE(0, 20);
      zip64.writeBigUInt64LE(entryCount, 24);
      zip64.writeBigUInt64LE(entryCount, 32);
      zip64.writeBigUInt64LE(centralSize, 40);
      zip64.writeBigUInt64LE(centralStart, 48);
      await write(zip64);

      const locator = Buffer.alloc(20);
      locator.writeUInt32LE(0x07064B50, 0);
      locator.writeUInt32LE(0, 4);
      locator.writeBigUInt64LE(zip64EocdOffset, 8);
      locator.writeUInt32LE(1, 16);
      await write(locator);
    }

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054B50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(needsZip64End ? UINT16_MAX : Number(entryCount), 8);
    eocd.writeUInt16LE(needsZip64End ? UINT16_MAX : Number(entryCount), 10);
    eocd.writeUInt32LE(needsZip64End ? UINT32_MAX : Number(centralSize), 12);
    eocd.writeUInt32LE(needsZip64End ? UINT32_MAX : Number(centralStart), 16);
    eocd.writeUInt16LE(0, 20);
    await write(eocd);

    output.end();
    await once(output, 'finish');
    options.onProgress?.({ entryIndex: normalized.length, entryCount: normalized.length, processedBytes: processed, totalBytes: totalInputBytes, progress: 1 });
    return { bytes: offset, entries: normalized.length, inputBytes: totalInputBytes };
  } catch (error) {
    output.destroy();
    try { fs.rmSync(outputPath, { force: true }); } catch {}
    throw error;
  }
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Ungültiger ZIP-Eintrag.');
  const filePath = path.resolve(String(entry.filePath || ''));
  const stat = fs.statSync(filePath, { bigint: true });
  if (!stat.isFile()) throw new Error(`ZIP-Quelle ist keine Datei: ${filePath}`);
  const name = normalizeZipName(entry.name);
  return {
    name,
    filePath,
    size: stat.size,
    mtime: entry.mtime instanceof Date ? entry.mtime : new Date(Number(stat.mtimeMs))
  };
}

function normalizeZipName(value) {
  const name = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!name || name.includes('\0')) throw new Error('Ungültiger ZIP-Dateiname.');
  const parts = name.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`Unsicherer ZIP-Dateiname: ${name}`);
  if (Buffer.byteLength(name, 'utf8') > 0xFFFF) throw new Error('ZIP-Dateiname ist zu lang.');
  return name;
}

function zip64SizeExtra(size) {
  const extra = Buffer.alloc(20);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(16, 2);
  extra.writeBigUInt64LE(size, 4);
  extra.writeBigUInt64LE(size, 12);
  return extra;
}

function zip64CentralExtra(size, offset, includeSize, includeOffset) {
  const payloadLength = (includeSize ? 16 : 0) + (includeOffset ? 8 : 0);
  if (!payloadLength) return Buffer.alloc(0);
  const extra = Buffer.alloc(4 + payloadLength);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(payloadLength, 2);
  let cursor = 4;
  if (includeSize) {
    extra.writeBigUInt64LE(size, cursor); cursor += 8;
    extra.writeBigUInt64LE(size, cursor); cursor += 8;
  }
  if (includeOffset) extra.writeBigUInt64LE(offset, cursor);
  return extra;
}

function dosDateTime(date) {
  const d = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);
  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day
  };
}

function crc32Update(crc, buffer) {
  let value = crc >>> 0;
  for (let i = 0; i < buffer.length; i++) value = (value >>> 8) ^ CRC_TABLE[(value ^ buffer[i]) & 0xFF];
  return value >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
