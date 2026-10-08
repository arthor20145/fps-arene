// Serveur FPS Arena : sert index.html + relais WebSocket (deathmatch en ligne)
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const HTML = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  fs.readFile(HTML, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server, maxPayload: 4096 });
let counter = 0;
const clients = new Map(); // id -> { ws, presence, alive }

const send = (ws, obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
const broadcast = (obj, exceptId) => {
  const msg = JSON.stringify(obj);
  clients.forEach((c, id) => { if (id !== exceptId && c.ws.readyState === WebSocket.OPEN) c.ws.send(msg); });
};

wss.on('connection', (ws) => {
  const id = 'p' + (++counter);
  clients.set(id, { ws, presence: { m: 0 }, alive: true, lastPresence: 0 });

  const peers = [];
  clients.forEach((c, pid) => { if (pid !== id) peers.push({ peer: pid, presence: c.presence }); });
  send(ws, { type: 'welcome', id, peers });

  ws.on('pong', () => { const c = clients.get(id); if (c) c.alive = true; });

  ws.on('message', (raw) => {
    const c = clients.get(id);
    if (!c) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'presence' && m.presence && typeof m.presence === 'object') {
      const now = Date.now();
      if (now - c.lastPresence < 30) return; // anti-flood (~33 msg/s max)
      c.lastPresence = now;
      c.presence = m.presence;
      broadcast({ type: 'presence', peer: id, presence: m.presence }, id);
    } else if (m.type === 'emit' && typeof m.name === 'string' && ['hit', 'kill', 'shot'].includes(m.name)) {
      broadcast({ type: 'event', name: m.name, peer: id, data: m.data });
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    broadcast({ type: 'leave', peer: id });
  });
  ws.on('error', () => {});
});

// Ping régulier : garde la connexion ouverte derrière le proxy de Render et nettoie les morts
setInterval(() => {
  clients.forEach((c, id) => {
    if (!c.alive) { c.ws.terminate(); return; }
    c.alive = false;
    try { c.ws.ping(); } catch (e) {}
  });
}, 25000);

server.listen(PORT, '0.0.0.0', () => console.log('FPS Arena en ligne sur le port ' + PORT));
