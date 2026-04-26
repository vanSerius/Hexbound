import { CONFIG } from './config.js';
import {
  otherSide,
  instantiateUnit,
  findUnitOnBoard,
  unitsForSide,
} from './state.js';
import { drawCard } from './deck.js';
import {
  effectHandlers,
  triggerEffects,
  applyRelicAuraToUnit,
  applyRelicAuraToBoard,
} from './abilities.js';
import { isRush, isFleeting } from './keywords.js';
import { runRushAttack, resolveCombat, killUnit } from './combat.js';
import { logForSide, logSystem, logCombat } from './log.js';

/**
 * Returns whether the side can play the card from hand index `handIndex`.
 */
export function canPlayCard(state, side, handIndex) {
  const player = state[side];
  const card = player.hand[handIndex];
  if (!card) return false;
  if (card.cost > player.mana) return false;
  if (card.type === 'creature') {
    const hasFreeLane = CONFIG.LANES.some(
      (lane) => player.battlefield[lane].length < CONFIG.MAX_LANE_UNITS,
    );
    if (!hasFreeLane) return false;
  }
  if (card.type === 'relic') {
    if (player.relics.length >= CONFIG.MAX_RELICS) return false;
  }
  return true;
}

export function laneHasRoom(state, side, lane) {
  return state[side].battlefield[lane].length < CONFIG.MAX_LANE_UNITS;
}

/**
 * Run a card's on_play abilities directly. Spells / curses use this; creatures
 * also use this for any on_play abilities they declare.
 */
function runOnPlayAbilities(state, ownerSide, card, sourceUnit, target) {
  const onPlay = (card.abilities || []).filter((a) => a.trigger === 'on_play');
  for (const ab of onPlay) {
    const handler = effectHandlers[ab.effect];
    if (!handler) {
      console.warn('Unknown effect:', ab.effect);
      continue;
    }
    handler(
      { state, ownerSide, sourceUnit, sourceCard: card, target },
      ab,
    );
    if (state.gameOver) return;
  }
}

/**
 * Play a card from hand. `target` is { kind: 'unit', instanceId } | { kind: 'hero', side } | null.
 * `lane` (for creatures) is one of CONFIG.LANES.
 *
 * Returns true if the card was played, false otherwise.
 */
export function playCard(state, side, handIndex, { lane = null, target = null } = {}) {
  if (state.gameOver) return false;
  if (!canPlayCard(state, side, handIndex)) return false;
  const player = state[side];
  const card = player.hand[handIndex];

  if (card.type === 'creature') {
    if (!lane || !laneHasRoom(state, side, lane)) return false;
    player.mana -= card.cost;
    player.hand.splice(handIndex, 1);
    const unit = instantiateUnit(card, side);
    unit.lane = lane;
    state[side].battlefield[lane].push(unit);
    applyRelicAuraToUnit(state, unit);
    logForSide(state, side, `${player.name} played ${card.name} in ${lane.toUpperCase()} lane.`);
    runOnPlayAbilities(state, side, card, unit, target);
    if (state.gameOver) return true;
    if (isRush(unit)) {
      runRushAttack(state, unit);
    }
    checkGameOver(state);
    return true;
  }

  if (card.type === 'spell' || card.type === 'curse') {
    player.mana -= card.cost;
    player.hand.splice(handIndex, 1);
    logForSide(state, side, `${player.name} cast ${card.name}.`);
    runOnPlayAbilities(state, side, card, null, target);
    // Cast cards go to discard with full data so reshuffle keeps them playable.
    player.discardPile.push(card);
    checkGameOver(state);
    return true;
  }

  if (card.type === 'relic') {
    player.mana -= card.cost;
    player.hand.splice(handIndex, 1);
    const relic = {
      instanceId: card.instanceId,
      cardId: card.cardId,
      name: card.name,
      text: card.text,
      sprite: card.sprite,
      abilities: card.abilities,
    };
    player.relics.push(relic);
    logForSide(state, side, `${player.name} placed ${card.name}.`);
    applyRelicAuraToBoard(state, side, relic);
    runOnPlayAbilities(state, side, card, null, target);
    checkGameOver(state);
    return true;
  }

  return false;
}

/**
 * Determine if a target choice is required for the given hand card.
 */
export function getTargetingRequirement(card) {
  if (!card) return null;
  // Look at on_play abilities; if any have target: 'chosen', we need a target.
  const needsChosen = (card.abilities || []).some(
    (a) => a.trigger === 'on_play' && a.target === 'chosen',
  );
  if (!needsChosen) return null;
  // For now we accept any unit or hero as a valid target. Spells like Wither/Silence
  // typically target units; deal_damage spells can target hero or unit. We allow both
  // and let the player's intent decide.
  return { kind: 'any' };
}

export function startTurn(state, side) {
  const p = state[side];
  if (p.hasStarted) {
    p.maxMana = Math.min(p.maxMana + 1, CONFIG.MAX_MANA);
  }
  p.hasStarted = true;
  p.mana = p.maxMana;
  drawCard(state, side, 1);
  // Refresh exhausted state at start of *own* turn (so units that became
  // exhausted during the opponent's turn lose the flag without a wasted
  // attack — safer for MVP). Actually: the brief specifies exhausted units
  // skip their NEXT combat; we already handle the clear in resolveCombat.
  // So nothing to do here for exhaust — but we still trigger turn_start.
  logSystem(state, `--- ${p.name}'s turn (${state.turnNumber}) — Mana ${p.mana}/${p.maxMana} ---`);
  triggerEffects(state, 'turn_start', { ownerSide: side });
  checkGameOver(state);
}

export function endTurn(state, side) {
  if (state.gameOver) return;
  // Combat for the side that ended its turn.
  resolveCombat(state, side);
  if (state.gameOver) return;
  // End-of-turn triggers (e.g. effects that watch turn_end on this side).
  triggerEffects(state, 'turn_end', { ownerSide: side });
  if (state.gameOver) return;
  // Fleeting units controlled by the ending side die.
  const fleetingUnits = unitsForSide(state, side).filter((u) => isFleeting(u));
  for (const u of fleetingUnits) {
    logCombat(state, `${u.name} fades away (Fleeting).`);
    killUnit(state, u);
    if (state.gameOver) return;
  }
  // Hand off to the other side
  const next = otherSide(side);
  state.turn = next;
  if (next === 'player') state.turnNumber += 1;
  startTurn(state, next);
}

export function checkGameOver(state) {
  if (state.gameOver) return;
  const playerDead = state.player.health <= 0;
  const enemyDead = state.enemy.health <= 0;
  if (playerDead && enemyDead) {
    state.gameOver = true;
    state.winner = 'draw';
    logSystem(state, 'Both heroes fall. The match ends in a draw.');
  } else if (enemyDead) {
    state.gameOver = true;
    state.winner = 'player';
    logSystem(state, 'You have won.');
  } else if (playerDead) {
    state.gameOver = true;
    state.winner = 'enemy';
    logSystem(state, 'You have fallen.');
  }
}
