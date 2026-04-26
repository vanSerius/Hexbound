import { CONFIG } from './config.js';

let _instanceCounter = 0;
export function nextInstanceId() {
  _instanceCounter += 1;
  return `i${_instanceCounter}`;
}

export function createPlayer(name) {
  return {
    name,
    health: CONFIG.START_HEALTH,
    maxHealth: CONFIG.START_HEALTH,
    mana: CONFIG.START_MANA,
    maxMana: CONFIG.START_MANA,
    deck: [],
    hand: [],
    discardPile: [],
    battlefield: { left: [], center: [], right: [] },
    relics: [],
    hasStarted: false,
    pendingMana: 0,        // applied at the start of this player's next turn
    spellsCastThisTurn: 0, // reset on turn_start; used by Mirror Shard
  };
}

export function createInitialState() {
  return {
    player: createPlayer('Player'),
    enemy: createPlayer('Enemy'),
    turn: 'player',
    turnNumber: 1,
    log: [],
    gameOver: false,
    winner: null,
    aiThinking: false,
  };
}

export function otherSide(side) {
  return side === 'player' ? 'enemy' : 'player';
}

export function getPlayerBySide(state, side) {
  return state[side];
}

/**
 * Build a unit instance from a card template.
 * Units on the board are separate from card templates so buffs/debuffs/exhausted
 * can be tracked per instance.
 */
export function instantiateUnit(card, ownerSide) {
  return {
    instanceId: nextInstanceId(),
    cardId: card.id,
    name: card.name,
    type: 'creature',
    tribe: card.tribe || null,
    cost: card.cost,
    attack: card.attack,
    baseAttack: card.attack,
    health: card.health,
    maxHealth: card.health,
    text: card.text,
    sprite: card.sprite || null,
    abilities: Array.isArray(card.abilities) ? card.abilities.map((a) => ({ ...a })) : [],
    keywords: Array.isArray(card.keywords) ? [...card.keywords] : [],
    owner: ownerSide,
    lane: null,
    exhausted: false,
    silenced: false,
    summoningSickness: false, // not used in MVP, but reserved
    tempBuffs: [],
  };
}

/**
 * Build a hand-card instance from a card template (lightweight clone with an instanceId).
 */
export function instantiateCard(card) {
  return {
    instanceId: nextInstanceId(),
    cardId: card.id,
    name: card.name,
    type: card.type,
    cost: card.cost,
    tribe: card.tribe || null,
    attack: card.attack ?? null,
    health: card.health ?? null,
    text: card.text || '',
    sprite: card.sprite || null,
    restrictLane: card.restrictLane || null,
    abilities: Array.isArray(card.abilities) ? card.abilities.map((a) => ({ ...a })) : [],
    keywords: Array.isArray(card.keywords) ? [...card.keywords] : [],
  };
}

/**
 * Locate a unit on the battlefield by instanceId. Returns { unit, side, lane, index } or null.
 */
export function findUnitOnBoard(state, instanceId) {
  for (const side of ['player', 'enemy']) {
    for (const lane of CONFIG.LANES) {
      const arr = state[side].battlefield[lane];
      const idx = arr.findIndex((u) => u.instanceId === instanceId);
      if (idx !== -1) return { unit: arr[idx], side, lane, index: idx };
    }
  }
  return null;
}

export function allUnits(state) {
  const out = [];
  for (const side of ['player', 'enemy']) {
    for (const lane of CONFIG.LANES) {
      for (const u of state[side].battlefield[lane]) out.push(u);
    }
  }
  return out;
}

export function unitsForSide(state, side) {
  const out = [];
  for (const lane of CONFIG.LANES) {
    for (const u of state[side].battlefield[lane]) out.push(u);
  }
  return out;
}
