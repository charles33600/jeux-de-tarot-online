// Construit la vue expurgée envoyée à chaque joueur : jamais les mains des
// autres, ni l'écart ; le chien seulement pendant l'écart ; le partenaire
// (à 5 joueurs) seulement une fois révélé.

import { isOudler, isTrump } from '../shared/cards.js';
import { PHASES } from '../shared/constants.js';
import { legalBids } from '../shared/bidding.js';
import { callableCards } from '../shared/appelRoi.js';
import { plainDiscardables } from '../shared/ecart.js';
import { legalMoves } from '../shared/play.js';
import { poigneeOptions } from '../shared/poignee.js';

export function buildView(table, seat) {
  const room = table.room;
  const base = {
    ecran: room ? 'table' : 'lobby',
    code: table.code,
    nbJoueurs: table.nbJoueurs,
    mySeat: seat,
    hostSeat: 0,
    seats: table.seats.map((s) => ({
      name: s.name,
      isBot: s.isBot,
      connected: s.isBot ? true : !!s.connected,
      humanBecameBot: s.isBot && !!s.token,
    })),
  };
  if (!room || !room.g) return { ...base, ecran: 'lobby' };

  const g = room.g;
  const view = {
    ...base,
    phase: g.phase,
    donne: room.donneNumber,
    dealerSeat: room.dealerSeat,
    currentSeat: g.currentSeat,
    totals: room.totals,
    scoreboard: room.scoreboard,
    bids: g.bids,
    contract: g.contract,
    takerSeat: g.takerSeat,
    calledCard: g.calledCard,
    partnerSeat: g.partnerRevealed ? g.partnerSeat : null,
    maMain: g.hands[seat] ?? [],
    handCounts: g.hands.map((h) => h.length),
    trick: g.trick,
    lastTrick: g.lastTrick,
    trickNumber: g.trickNumber,
    tricksTotal: g.tricksTotal,
    chien: g.phase === PHASES.ECART ? g.chien : null,
    chienSize: g.chienSize,
    shownTrumps: g.shownTrumps,
    poignees: g.poignees,
    chelemAnnounced: g.chelemAnnounced,
    result: null,
    actions: null,
  };

  if (g.phase === PHASES.FIN_DONNE && g.result) {
    view.result = {
      ...g.result,
      contract: g.contract,
      takerSeat: g.takerSeat,
      partnerSeat: room.nbJoueurs === 5 ? g.partnerSeat : null,
      chelemAnnounced: g.chelemAnnounced,
      poignees: g.poignees.map((p) => ({ seat: p.seat, level: p.level })),
    };
    if (!table.seats[seat].isBot) view.actions = { type: 'donneSuivante' };
    return view;
  }

  if (seat !== g.currentSeat) return view;

  if (g.phase === PHASES.ENCHERES) {
    view.actions = { type: 'enchere', encheres: legalBids(g.bestBid) };
  } else if (g.phase === PHASES.APPEL_ROI) {
    view.actions = { type: 'appelRoi', cartes: callableCards(g.hands[seat]) };
  } else if (g.phase === PHASES.ECART) {
    const hand = g.hands[seat];
    const plain = plainDiscardables(hand, g.calledCard);
    let ecartables = plain;
    if (plain.length < g.chienSize) {
      ecartables = [...plain, ...hand.filter((c) => isTrump(c) && !isOudler(c))];
    }
    view.actions = { type: 'ecart', nb: g.chienSize, ecartables };
  } else if (g.phase === PHASES.JEU) {
    view.actions = {
      type: 'carte',
      cartes: legalMoves(g.hands[seat], g.trick, {
        firstTrick: g.trickNumber === 0,
        isTaker: seat === g.takerSeat,
        calledCard: room.nbJoueurs === 5 ? g.calledCard : null,
      }),
      poignees: g.playedFirst[seat] ? [] : poigneeOptions(g.hands[seat], room.nbJoueurs),
      chelemPossible: seat === g.takerSeat && !g.playedFirst[seat] && !g.chelemAnnounced,
    };
  }
  return view;
}
