// Point d'entrée : serveur Express (statique) + Socket.IO (temps réel).

import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Lobby, REPLACE_DELAY_MS } from './lobby.js';
import { GameRoom } from './gameRoom.js';
import { buildView } from './views.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(join(__dirname, '../public')));
app.use('/shared', express.static(join(__dirname, '../shared')));

const httpServer = createServer(app);
const io = new Server(httpServer);
const lobby = new Lobby();

setInterval(() => lobby.gc(), 60_000).unref();

function broadcast(table) {
  table.seats.forEach((seat, i) => {
    if (seat.socketId && seat.connected) {
      io.to(seat.socketId).emit('etat', buildView(table, i));
    }
  });
}

// TAROT_RAPIDE=1 accélère bots et résolution des plis (tests de bout en bout).
const RAPIDE = process.env.TAROT_RAPIDE === '1';

function startGame(table) {
  table.room = new GameRoom({
    nbJoueurs: table.nbJoueurs,
    seats: table.seats,
    ...(RAPIDE ? { botDelay: () => 40, resolveDelay: () => 80 } : {}),
    onUpdate: () => broadcast(table),
    onEvent: (evt) => io.to(`t:${table.code}`).emit('evenement', evt),
  });
  table.room.startDonne();
}

function attach(socket, table, seat, token) {
  const s = table.seats[seat];
  if (s.socketId && s.socketId !== socket.id) {
    // Une seule connexion par siège : l'ancienne est débranchée.
    io.sockets.sockets.get(s.socketId)?.disconnect(true);
  }
  s.socketId = socket.id;
  s.connected = true;
  if (s.replaceTimer) {
    clearTimeout(s.replaceTimer);
    s.replaceTimer = null;
  }
  if (s.isBot && s.token === token) {
    s.isBot = false; // l'humain récupère son siège occupé par un bot
    io.to(`t:${table.code}`).emit('evenement', { type: 'reconnecte', seat, name: s.name });
  }
  socket.data.ref = { code: table.code, seat, token };
  socket.join(`t:${table.code}`);
}

io.on('connection', (socket) => {
  const ctx = () => {
    const ref = socket.data.ref;
    if (!ref) return null;
    const table = lobby.tables.get(ref.code);
    if (!table) return null;
    const seat = table.seats[ref.seat];
    if (!seat || seat.token !== ref.token || seat.socketId !== socket.id) return null;
    return { table, seat: ref.seat };
  };
  const fail = (cb, error) => {
    if (typeof cb === 'function') cb({ error });
    else socket.emit('erreur', { message: error });
  };

  socket.on('table:creer', (payload = {}, cb) => {
    const r = lobby.createTable(payload.pseudo, Number(payload.nbJoueurs));
    if (r.error) return fail(cb, r.error);
    attach(socket, r.table, r.seat, r.token);
    cb?.({ ok: true, code: r.table.code, token: r.token, seat: r.seat });
    broadcast(r.table);
  });

  socket.on('table:rejoindre', (payload = {}, cb) => {
    const r = lobby.joinTable(payload.code, payload.pseudo);
    if (r.error) return fail(cb, r.error);
    attach(socket, r.table, r.seat, r.token);
    cb?.({ ok: true, code: r.table.code, token: r.token, seat: r.seat });
    broadcast(r.table);
  });

  socket.on('table:reconnecter', (payload = {}, cb) => {
    const r = lobby.byToken(payload.token);
    if (!r) return fail(cb, 'Session introuvable ou expirée.');
    attach(socket, r.table, r.seat, payload.token);
    cb?.({ ok: true, code: r.table.code, seat: r.seat });
    broadcast(r.table);
  });

  socket.on('table:bot', (payload = {}, cb) => {
    const c = ctx();
    if (!c) return fail(cb, 'Session invalide.');
    if (c.seat !== 0) return fail(cb, "Seul l'hôte peut gérer les bots.");
    const r = payload.action === 'retirer' ? lobby.removeBot(c.table) : lobby.addBot(c.table);
    if (r.error) return fail(cb, r.error);
    cb?.({ ok: true });
    broadcast(c.table);
  });

  socket.on('table:demarrer', (_payload, cb) => {
    const c = ctx();
    if (!c) return fail(cb, 'Session invalide.');
    if (c.seat !== 0) return fail(cb, "Seul l'hôte peut lancer la partie.");
    if (c.table.room) return fail(cb, 'La partie a déjà commencé.');
    if (c.table.seats.length !== c.table.nbJoueurs) {
      return fail(cb, 'La table doit être complète (ajoutez des bots ?).');
    }
    cb?.({ ok: true });
    startGame(c.table);
  });

  socket.on('jeu:action', (payload = {}, cb) => {
    const c = ctx();
    if (!c) return fail(cb, 'Session invalide.');
    if (!c.table.room) return fail(cb, "La partie n'a pas commencé.");
    const r = c.table.room.act(c.seat, payload.type, payload);
    if (r.error) return fail(cb, r.error);
    cb?.({ ok: true });
  });

  socket.on('table:quitter', (_payload, cb) => {
    const c = ctx();
    cb?.({ ok: true });
    if (!c) return;
    const seat = c.table.seats[c.seat];
    socket.leave(`t:${c.table.code}`);
    socket.data.ref = null;
    if (!c.table.room) {
      // Dans le lobby : libère le siège (sauf l'hôte, qui dissout la table).
      if (c.seat === 0) {
        io.to(`t:${c.table.code}`).emit('evenement', { type: 'tableFermee' });
        lobby.dropTable(c.table);
        return;
      }
      lobby.tokens.delete(seat.token);
      c.table.seats.splice(c.seat, 1);
      c.table.seats.forEach((s, j) => {
        if (s.token) lobby.tokens.set(s.token, { code: c.table.code, seat: j });
      });
    } else {
      // En partie : le siège passe au bot immédiatement.
      seat.connected = false;
      seat.socketId = null;
      seat.isBot = true;
      io.to(`t:${c.table.code}`).emit('evenement', { type: 'remplace', seat: c.seat, name: seat.name });
      c.table.room.maybeBot();
    }
    broadcast(c.table);
  });

  socket.on('disconnect', () => {
    const c = ctx();
    if (!c) return;
    const table = c.table;
    const seat = table.seats[c.seat];
    seat.connected = false;
    seat.socketId = null;
    io.to(`t:${table.code}`).emit('evenement', { type: 'deconnecte', seat: c.seat, name: seat.name });
    if (table.room && !seat.isBot) {
      // Après un délai de grâce, un bot prend le relais pour ne pas bloquer la table.
      seat.replaceTimer = setTimeout(() => {
        seat.replaceTimer = null;
        if (!seat.connected && lobby.tables.get(table.code) === table) {
          seat.isBot = true;
          io.to(`t:${table.code}`).emit('evenement', { type: 'remplace', seat: c.seat, name: seat.name });
          table.room.maybeBot();
          broadcast(table);
        }
      }, REPLACE_DELAY_MS);
      seat.replaceTimer.unref?.();
    }
    broadcast(table);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Tarot en ligne prêt : http://localhost:${PORT}`);
});
