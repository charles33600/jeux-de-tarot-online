// Registre des tables : création/jonction par code aléatoire, sièges,
// tokens de reconnexion, remplacement des absents par un bot, nettoyage.

import { randomInt, randomUUID } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L
const BOT_NAMES = [
  'Marcel', 'Odette', 'Fernand', 'Ginette', 'Raymond',
  'Suzanne', 'Gaston', 'Colette', 'Lucien', 'Yvette',
];

export const REPLACE_DELAY_MS = 90_000; // absent depuis 90 s → remplacé par un bot
export const GC_DELAY_MS = 30 * 60_000; // table sans humain connecté depuis 30 min

export class Lobby {
  constructor() {
    this.tables = new Map(); // code → table
    this.tokens = new Map(); // token → { code, seat }
  }

  makeCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.tables.has(code)) return code;
    }
  }

  createTable(pseudo, nbJoueurs) {
    if (![3, 4, 5].includes(nbJoueurs)) return { error: 'Table de 3, 4 ou 5 joueurs.' };
    const name = cleanName(pseudo);
    if (!name) return { error: 'Choisissez un pseudo.' };
    const code = this.makeCode();
    const token = randomUUID();
    const table = {
      code,
      nbJoueurs,
      seats: [{ name, isBot: false, token, socketId: null, connected: false, replaceTimer: null }],
      room: null,
      lastHumanAt: Date.now(),
    };
    this.tables.set(code, table);
    this.tokens.set(token, { code, seat: 0 });
    return { table, token, seat: 0 };
  }

  joinTable(code, pseudo) {
    const table = this.tables.get(String(code ?? '').trim().toUpperCase());
    if (!table) return { error: 'Aucune table avec ce code.' };
    if (table.room) return { error: 'La partie a déjà commencé.' };
    if (table.seats.length >= table.nbJoueurs) return { error: 'La table est complète.' };
    const name = cleanName(pseudo);
    if (!name) return { error: 'Choisissez un pseudo.' };
    const token = randomUUID();
    const seat = table.seats.length;
    table.seats.push({ name, isBot: false, token, socketId: null, connected: false, replaceTimer: null });
    this.tokens.set(token, { code: table.code, seat });
    return { table, token, seat };
  }

  addBot(table) {
    if (table.room) return { error: 'La partie a déjà commencé.' };
    if (table.seats.length >= table.nbJoueurs) return { error: 'La table est complète.' };
    const used = new Set(table.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(`${n} 🤖`)) ?? `Bot ${table.seats.length + 1}`;
    table.seats.push({ name: `${name} 🤖`, isBot: true, token: null, socketId: null, connected: false });
    return { ok: true };
  }

  removeBot(table) {
    if (table.room) return { error: 'La partie a déjà commencé.' };
    for (let i = table.seats.length - 1; i >= 0; i--) {
      if (table.seats[i].isBot) {
        table.seats.splice(i, 1);
        // Réindexe les tokens des sièges suivants.
        for (let j = i; j < table.seats.length; j++) {
          const t = table.seats[j].token;
          if (t) this.tokens.set(t, { code: table.code, seat: j });
        }
        return { ok: true };
      }
    }
    return { error: 'Aucun bot à retirer.' };
  }

  byToken(token) {
    const ref = this.tokens.get(token);
    if (!ref) return null;
    const table = this.tables.get(ref.code);
    if (!table) {
      this.tokens.delete(token);
      return null;
    }
    return { table, seat: ref.seat };
  }

  dropTable(table) {
    for (const s of table.seats) {
      if (s.token) this.tokens.delete(s.token);
      if (s.replaceTimer) clearTimeout(s.replaceTimer);
    }
    table.room?.destroy();
    this.tables.delete(table.code);
  }

  // Supprime les tables sans aucun humain connecté depuis trop longtemps.
  gc() {
    const now = Date.now();
    for (const table of this.tables.values()) {
      const humanConnected = table.seats.some((s) => s.token && s.connected);
      if (humanConnected) table.lastHumanAt = now;
      else if (now - table.lastHumanAt > GC_DELAY_MS) this.dropTable(table);
    }
  }
}

function cleanName(pseudo) {
  return String(pseudo ?? '').trim().slice(0, 20).replace(/[<>]/g, '');
}
