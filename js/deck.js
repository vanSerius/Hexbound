import { CARDS, CARD_INDEX } from './cards.js';
import { instantiateCard } from './state.js';
import { logSystem } from './log.js';

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a deck from a list of card ids. Each id becomes one card instance.
 * Falls back to all cards if no ids are given (MVP "all cards once").
 */
export function buildDeck(cardIds) {
  const ids = cardIds && cardIds.length ? cardIds : CARDS.map((c) => c.id);
  const cards = [];
  for (const id of ids) {
    const tpl = CARD_INDEX[id];
    if (!tpl) {
      console.warn('Unknown card id in deck:', id);
      continue;
    }
    cards.push(instantiateCard(tpl));
  }
  shuffle(cards);
  return cards;
}

export function drawCard(state, side, n = 1) {
  const player = state[side];
  for (let i = 0; i < n; i++) {
    if (player.deck.length === 0 && player.discardPile.length > 0) {
      player.deck = shuffle(player.discardPile);
      player.discardPile = [];
      logSystem(state, `${player.name}'s discard pile reshuffled into deck.`);
    }
    if (player.deck.length === 0) return; // both empty: no fatigue in MVP
    const card = player.deck.shift();
    player.hand.push(card);
  }
}
