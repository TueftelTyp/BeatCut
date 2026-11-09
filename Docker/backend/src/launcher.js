import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { startServer } from './server.js';
import { closeDb } from './db.js';

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '127.0.0.1';
let server;
try {
  server = startServer({ port, host });
  await Promise.race([
    once(server, 'listening'),
    once(server, 'error').then(([error]) => Promise.reject(error))
  ]);
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} wird bereits verwendet. Ist BeatCut schon gestartet?`);
  } else {
    console.error('BeatCut-Server konnte nicht gestartet werden:', error instanceof Error ? error.message : error);
  }
  process.exit(1);
}

const address = server.address();
const actualPort = typeof address === 'object' && address ? address.port : port;
const browserHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
const url = `http://${browserHost}:${actualPort}`;

if (process.env.BEATCUT_NO_BROWSER !== '1') openBrowser(url);
console.log(`BeatCut wurde geöffnet: ${url}`);
console.log('Zum Beenden dieses Fenster schließen oder Strg+C drücken.');

const shutdown = signal => {
  console.log(`\n${signal}: BeatCut wird beendet ...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

function openBrowser(url) {
  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.once('error', () => {
      console.warn(`Browser konnte nicht automatisch geöffnet werden. Öffne manuell: ${url}`);
    });
    child.unref();
  } catch {
    console.warn(`Browser konnte nicht automatisch geöffnet werden. Öffne manuell: ${url}`);
  }
}
