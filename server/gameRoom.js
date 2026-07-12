// Orchestrateur d'une table : machine à états d'une donne, application des
// règles via shared/, planification des bots. Le serveur est autoritaire :
// toute action passe par act(seat, type, payload) et est validée ici.

import { isExcuse, isTrump, isOudler, points, sortHand, PETIT } from '../shared/cards.js';
import { PHASES } from '../shared/constants.js';
import { deal } from '../shared/deal.js';
import { legalBids } from '../shared/bidding.js';
import { callableCards } from '../shared/appelRoi.js';
import { validateEcart } from '../shared/ecart.js';
import { legalMoves, trickWinner } from '../shared/play.js';
import { poigneeOptions } from '../shared/poignee.js';
import { scoreDonne } from '../shared/scoring.js';
import * as bot from './bot.js';

const ATTACK = 0;
const DEFENSE = 1;

export class GameRoom {
  constructor({
    nbJoueurs,
    seats,
    rng = Math.random,
    botDelay = () => 600 + Math.random() * 900,
    resolveDelay = () => 1600,
    onUpdate = () => {},
    onEvent = () => {},
    onDonneEnd = () => {},
  }) {
    this.nbJoueurs = nbJoueurs;
    this.seats = seats;
    this.rng = rng;
    this.botDelay = botDelay;
    this.resolveDelay = resolveDelay;
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.onDonneEnd = onDonneEnd;

    this.donneNumber = 0;
    this.dealerSeat = Math.floor(rng() * nbJoueurs);
    this.totals = new Array(nbJoueurs).fill(0);
    this.scoreboard = [];
    this.g = null;
    this.seq = 0; // invalide les timers planifiés dès qu'une action avance l'état
    this.destroyed = false;
  }

  destroy() {
    this.destroyed = true;
  }

  // Planifie fn ; annulée si l'état a avancé entre-temps.
  schedule(fn, delay) {
    const seq = this.seq;
    setTimeout(() => {
      if (!this.destroyed && this.seq === seq) fn();
    }, delay);
  }

  campOf(seat) {
    const g = this.g;
    if (seat === g.takerSeat) return ATTACK;
    if (this.nbJoueurs === 5 && g.partnerSeat !== null && seat === g.partnerSeat) return ATTACK;
    return DEFENSE;
  }

  startDonne() {
    const n = this.nbJoueurs;
    this.seq++;
    this.donneNumber++;
    if (this.donneNumber > 1) this.dealerSeat = (this.dealerSeat + 1) % n;
    const { hands, chien } = deal(n, this.rng);
    this.g = {
      phase: PHASES.ENCHERES,
      hands: hands.map(sortHand),
      chien,
      chienSize: chien.length,
      ecart: [],
      shownTrumps: [],
      bids: new Array(n).fill(null),
      bidsPlaced: 0,
      bestBid: null,
      contract: null,
      takerSeat: null,
      calledCard: null,
      partnerSeat: null,
      partnerRevealed: false,
      currentSeat: (this.dealerSeat + 1) % n,
      trick: [],
      trickNumber: 0,
      tricksTotal: hands[0].length,
      piles: [[], []], // [attaque, défense]
      trickWins: [0, 0],
      excuseDebt: null, // { from, to } : le camp `from` doit une basse carte à `to`
      poignees: [],
      playedFirst: new Array(n).fill(false),
      chelemAnnounced: false,
      petitAuBout: null,
      lastTrick: null,
      playedCards: [],
      result: null,
    };
    this.onEvent({ type: 'nouvelleDonne', donne: this.donneNumber, dealerSeat: this.dealerSeat });
    this.afterChange();
  }

  afterChange() {
    this.onUpdate();
    this.maybeBot();
  }

  maybeBot() {
    const g = this.g;
    if (!g || this.destroyed) return;
    const actionPhases = [PHASES.ENCHERES, PHASES.APPEL_ROI, PHASES.ECART, PHASES.JEU];
    if (actionPhases.includes(g.phase) && g.currentSeat !== null && this.seats[g.currentSeat].isBot) {
      const seat = g.currentSeat;
      this.schedule(() => {
        if (this.seats[seat].isBot) this.botAct(seat);
      }, this.botDelay());
    }
    if (g.phase === PHASES.FIN_DONNE && this.seats.every((s) => s.isBot)) {
      this.schedule(() => this.act(0, 'donneSuivante'), this.botDelay());
    }
  }

  act(seat, type, payload = {}) {
    const g = this.g;
    if (!g) return { error: "La partie n'a pas commencé." };
    switch (type) {
      case 'enchere':
        return this.actEnchere(seat, payload);
      case 'appelRoi':
        return this.actAppelRoi(seat, payload);
      case 'ecart':
        return this.actEcart(seat, payload);
      case 'carte':
        return this.actCarte(seat, payload);
      case 'donneSuivante':
        if (g.phase !== PHASES.FIN_DONNE) return { error: 'La donne est en cours.' };
        this.startDonne();
        return { ok: true };
      default:
        return { error: 'Action inconnue.' };
    }
  }

  checkTurn(seat, phase) {
    const g = this.g;
    if (g.phase !== phase) return { error: "Ce n'est pas le moment pour cette action." };
    if (seat !== g.currentSeat) return { error: "Ce n'est pas à vous de jouer." };
    return null;
  }

  actEnchere(seat, { enchere }) {
    const g = this.g;
    const err = this.checkTurn(seat, PHASES.ENCHERES);
    if (err) return err;
    if (!legalBids(g.bestBid).includes(enchere)) return { error: 'Enchère non autorisée.' };
    g.bids[seat] = enchere;
    g.bidsPlaced++;
    if (enchere !== 'passe') {
      g.bestBid = enchere;
      g.takerSeat = seat;
    }
    this.seq++;
    if (g.bidsPlaced === this.nbJoueurs) {
      this.resolveBidding();
    } else {
      g.currentSeat = (seat + 1) % this.nbJoueurs;
      this.afterChange();
    }
    return { ok: true };
  }

  resolveBidding() {
    const g = this.g;
    if (g.takerSeat === null) {
      this.onEvent({ type: 'redonne' });
      this.startDonne();
      return;
    }
    g.contract = g.bestBid;
    this.onEvent({ type: 'preneur', seat: g.takerSeat, contract: g.contract });
    if (this.nbJoueurs === 5) {
      g.phase = PHASES.APPEL_ROI;
      g.currentSeat = g.takerSeat;
      this.afterChange();
    } else {
      this.afterAppel();
    }
  }

  actAppelRoi(seat, { carte }) {
    const g = this.g;
    const err = this.checkTurn(seat, PHASES.APPEL_ROI);
    if (err) return err;
    if (!callableCards(g.hands[seat]).includes(carte)) return { error: 'Carte non appelable.' };
    g.calledCard = carte;
    const holder = g.hands.findIndex((h) => h.includes(carte));
    g.partnerSeat = holder >= 0 ? holder : g.takerSeat; // au chien → preneur seul
    this.onEvent({ type: 'appel', carte });
    this.afterAppel();
    return { ok: true };
  }

  afterAppel() {
    const g = this.g;
    if (g.contract === 'petite' || g.contract === 'garde') {
      // Le chien est révélé à tous puis intégré à la main du preneur pour l'écart.
      g.phase = PHASES.ECART;
      g.currentSeat = g.takerSeat;
      // Si la carte appelée était au chien, tout le monde le voit : preneur seul.
      if (g.calledCard && g.chien.includes(g.calledCard)) {
        g.partnerRevealed = true;
        this.onEvent({ type: 'partenaire', seat: g.takerSeat, auChien: true });
      }
      g.hands[g.takerSeat] = sortHand([...g.hands[g.takerSeat], ...g.chien]);
      this.onEvent({ type: 'chien', cartes: [...g.chien] });
      this.seq++;
      this.afterChange();
    } else {
      // Garde sans : le chien compte pour l'attaque. Garde contre : pour la défense.
      g.piles[g.contract === 'gardeSans' ? ATTACK : DEFENSE].push(...g.chien);
      this.startPlay();
    }
  }

  actEcart(seat, { cartes }) {
    const g = this.g;
    const err = this.checkTurn(seat, PHASES.ECART);
    if (err) return err;
    const r = validateEcart(g.hands[seat], cartes, g.chienSize, g.calledCard);
    if (!r.ok) return { error: r.error };
    g.ecart = [...cartes];
    g.shownTrumps = r.shownTrumps;
    g.hands[seat] = g.hands[seat].filter((c) => !cartes.includes(c));
    g.piles[ATTACK].push(...cartes); // l'écart compte pour l'attaque
    if (r.shownTrumps.length) this.onEvent({ type: 'atoutsEcartes', cartes: r.shownTrumps });
    this.startPlay();
    return { ok: true };
  }

  startPlay() {
    const g = this.g;
    g.phase = PHASES.JEU;
    g.trick = [];
    g.currentSeat = (this.dealerSeat + 1) % this.nbJoueurs;
    this.seq++;
    this.afterChange();
  }

  playCtx(seat) {
    const g = this.g;
    return {
      firstTrick: g.trickNumber === 0,
      isTaker: seat === g.takerSeat,
      calledCard: this.nbJoueurs === 5 ? g.calledCard : null,
    };
  }

  actCarte(seat, { carte, poignee = null, chelem = false }) {
    const g = this.g;
    const err = this.checkTurn(seat, PHASES.JEU);
    if (err) return err;
    const moves = legalMoves(g.hands[seat], g.trick, this.playCtx(seat));
    if (!moves.includes(carte)) return { error: 'Cette carte ne peut pas être jouée.' };

    if (!g.playedFirst[seat]) {
      if (poignee !== null && poignee !== undefined) {
        const opt = poigneeOptions(g.hands[seat], this.nbJoueurs).find((o) => o.level === poignee);
        if (!opt) return { error: 'Poignée non valable.' };
        g.poignees.push({ seat, level: opt.level, cards: opt.cards });
        this.onEvent({ type: 'poignee', seat, level: opt.level, cards: opt.cards });
      }
      if (chelem === true && seat === g.takerSeat) {
        g.chelemAnnounced = true;
        this.onEvent({ type: 'chelem', seat });
      }
      g.playedFirst[seat] = true;
    }

    g.hands[seat] = g.hands[seat].filter((c) => c !== carte);
    g.trick.push({ seat, card: carte });
    g.playedCards.push(carte);
    if (carte === g.calledCard && !g.partnerRevealed) {
      g.partnerRevealed = true;
      this.onEvent({ type: 'partenaire', seat: g.partnerSeat });
    }
    this.seq++;
    if (g.trick.length === this.nbJoueurs) {
      g.currentSeat = null;
      this.onUpdate();
      this.schedule(() => this.resolveTrick(), this.resolveDelay());
    } else {
      g.currentSeat = (seat + 1) % this.nbJoueurs;
      this.afterChange();
    }
    return { ok: true };
  }

  resolveTrick() {
    const g = this.g;
    const trick = g.trick;
    const isLast = g.trickNumber === g.tricksTotal - 1;
    const excusePlay = trick.find((t) => isExcuse(t.card));

    let winner = null;
    if (excusePlay && isLast) {
      // Chelem : l'Excuse jouée au dernier pli par le camp qui a fait tous
      // les plis gagne le pli.
      const exCamp = this.campOf(excusePlay.seat);
      if (g.trickWins[exCamp] === g.trickNumber) winner = excusePlay;
    }
    if (!winner) winner = trickWinner(trick);
    const winCamp = this.campOf(winner.seat);
    g.trickWins[winCamp]++;

    for (const t of trick) {
      if (isExcuse(t.card) && t !== winner && !isLast) {
        // L'Excuse reste à son camp, qui devra une basse carte au camp du pli.
        const exCamp = this.campOf(t.seat);
        g.piles[exCamp].push(t.card);
        if (exCamp !== winCamp) g.excuseDebt = { from: exCamp, to: winCamp };
      } else {
        g.piles[winCamp].push(t.card);
      }
    }
    this.settleExcuseDebt();

    if (isLast && trick.some((t) => t.card === PETIT)) {
      g.petitAuBout = winCamp === ATTACK ? 'attack' : 'defense';
    }

    g.lastTrick = { cards: trick, winnerSeat: winner.seat };
    g.trickNumber++;
    g.trick = [];
    this.seq++;
    this.onEvent({ type: 'pli', winnerSeat: winner.seat });
    if (g.trickNumber === g.tricksTotal) {
      this.endDonne();
    } else {
      g.currentSeat = winner.seat;
      this.afterChange();
    }
  }

  settleExcuseDebt() {
    const g = this.g;
    const d = g.excuseDebt;
    if (!d) return;
    const pile = g.piles[d.from];
    const idx = pile.findIndex((c) => !isExcuse(c) && points(c) === 0.5);
    if (idx >= 0) {
      g.piles[d.to].push(pile.splice(idx, 1)[0]);
      g.excuseDebt = null;
    }
  }

  endDonne() {
    const g = this.g;
    this.settleExcuseDebt();
    const attackWonAll = g.trickWins[DEFENSE] === 0;
    const defenseWonAll = g.trickWins[ATTACK] === 0;
    const result = scoreDonne({
      nbJoueurs: this.nbJoueurs,
      contract: g.contract,
      attackCards: g.piles[ATTACK],
      takerSeat: g.takerSeat,
      partnerSeat: this.nbJoueurs === 5 ? g.partnerSeat : null,
      petitAuBout: g.petitAuBout,
      poignees: g.poignees,
      chelem: { announced: g.chelemAnnounced, attackWonAll, defenseWonAll },
    });
    g.partnerRevealed = true;
    for (let s = 0; s < this.nbJoueurs; s++) this.totals[s] += result.deltas[s];
    this.scoreboard.push({
      donne: this.donneNumber,
      contract: g.contract,
      takerSeat: g.takerSeat,
      partnerSeat: this.nbJoueurs === 5 ? g.partnerSeat : null,
      made: result.made,
      pts: result.pts,
      target: result.target,
      oudlers: result.oudlers,
      petitAuBout: g.petitAuBout,
      poignees: g.poignees.map((p) => ({ seat: p.seat, level: p.level })),
      chelemBonus: result.chelemBonus,
      total: result.total,
      deltas: result.deltas,
    });
    g.result = result;
    g.phase = PHASES.FIN_DONNE;
    g.currentSeat = null;
    this.seq++;
    this.onDonneEnd(result);
    if (!this.destroyed) this.afterChange();
  }

  botAct(seat) {
    const g = this.g;
    if (!g || g.currentSeat !== seat) return;
    let r;
    if (g.phase === PHASES.ENCHERES) {
      r = this.act(seat, 'enchere', {
        enchere: bot.chooseBid(g.hands[seat], this.nbJoueurs, legalBids(g.bestBid)),
      });
    } else if (g.phase === PHASES.APPEL_ROI) {
      r = this.act(seat, 'appelRoi', {
        carte: bot.chooseCall(g.hands[seat], callableCards(g.hands[seat])),
      });
    } else if (g.phase === PHASES.ECART) {
      r = this.act(seat, 'ecart', {
        cartes: bot.chooseEcart(g.hands[seat], g.chienSize, g.calledCard),
      });
    } else if (g.phase === PHASES.JEU) {
      const legal = legalMoves(g.hands[seat], g.trick, this.playCtx(seat));
      const ctx = {
        seat,
        hand: g.hands[seat],
        legal,
        trick: g.trick,
        nbJoueurs: this.nbJoueurs,
        takerSeat: g.takerSeat,
        partnerSeat: g.partnerRevealed || seat === g.partnerSeat ? g.partnerSeat : null,
        trickNumber: g.trickNumber,
        tricksTotal: g.tricksTotal,
        playedCards: g.playedCards,
      };
      const poignee = g.playedFirst[seat] ? null : bot.choosePoignee(g.hands[seat], this.nbJoueurs);
      r = this.act(seat, 'carte', { carte: bot.chooseCard(ctx), poignee });
    }
    if (r && r.error) {
      // Filet de sécurité : un bot ne doit jamais bloquer la partie.
      console.error(`[bot] action refusée (siège ${seat}, phase ${g.phase}) : ${r.error}`);
      this.botFallback(seat);
    }
  }

  botFallback(seat) {
    const g = this.g;
    if (g.phase === PHASES.ENCHERES) this.act(seat, 'enchere', { enchere: 'passe' });
    else if (g.phase === PHASES.APPEL_ROI) {
      this.act(seat, 'appelRoi', { carte: callableCards(g.hands[seat])[0] });
    } else if (g.phase === PHASES.ECART) {
      // Écarte les premières cartes légales trouvées.
      const plain = g.hands[seat].filter(
        (c) => !isTrump(c) && !isOudler(c) && points(c) < 4.5 && c !== g.calledCard
      );
      const trumps = g.hands[seat].filter((c) => isTrump(c) && !isOudler(c));
      this.act(seat, 'ecart', { cartes: [...plain, ...trumps].slice(0, g.chienSize) });
    } else if (g.phase === PHASES.JEU) {
      const legal = legalMoves(g.hands[seat], g.trick, this.playCtx(seat));
      this.act(seat, 'carte', { carte: legal[0] });
    }
  }
}
