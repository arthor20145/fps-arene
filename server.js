const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Game state: players with their positions, health, ammo, etc
const players = {};
let playerIdCounter = 0;

// Create HTTP server to serve the static game files
const server = http.createServer((req, res) => {
  // Serve index.html for any request
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  let id = null;
  
  // Assign a unique player ID
  id = 'player_' + (++playerIdCounter);
  players[id] = {
    id: id,
    x: 0,
    y: 1.6,
    z: 0,
    hp: 100,
    maxHp: 100,
    ammo: 30,
    score: 0,
    angle: 0
  };
  
  // Send the player their ID and initial state
  ws.send(JSON.stringify({
    type: 'init',
    id: id,
    players: Object.values(players),
    entities: getInitialEntities()
  }));
  
  // Broadcast new player to everyone else
  broadcast(JSON.stringify({
    type: 'new_player',
    id: id,
    player: players[id]
  }), ws);
  
  // Handle player input updates
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'update') {
        // Update player state
        const player = players[id];
        if (player) {
          player.x = data.x;
          player.y = data.y;  
          player.z = data.z;
          player.angle = data.angle;
          player.hp = data.hp;
          player.ammo = data.ammo;
          player.score = data.score;
        }
        
        // Broadcast updated state to all other players
        broadcast(JSON.stringify({
          type: 'update_player',
          id: id,
          player: players[id]
        }), ws);
      }
      
      if (data.type === 'shoot') {
        // Handle shooting - broadcast to other players
        broadcast(JSON.stringify({
          type: 'shot_fired',
          shooter: id,
          position: data.position,
          direction: data.direction
        }), ws);
      }
      
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  // Handle player disconnection
  ws.on('close', () => {
    if (id && players[id]) {
      const removedPlayer = players[id];
      delete players[id];
      broadcast(JSON.stringify({
        type: 'remove_player',
        id: id
      }), ws);
    }
  });
});

// Function to get initial entities (simplified for multiplayer)
function getInitialEntities() {
  return { boxes: [], enemies: [], items: [] };
}

// Broadcast message to all players except the sender
function broadcast(message, ws) {
  wss.clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`FPS Arena Multiplayer Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});