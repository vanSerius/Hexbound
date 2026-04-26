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
  effectiveCost,
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
  if (effectiveCost(state, side, card) > player.mana) return false;
  if (card.type === 'creature') {
    // Lane restriction (e.g. Cathedral Giant only in center).
    if (card.restrictLane) {
      return laneHasRoom(state, side, card.restrictLane);
    }
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
 * Lanes the given creature card is allowed to be played into for `side`.
 */
export function validLanesForCreature(state, side, card) {
  if (!card || card.type !== 'creature') return [];
  const allowed = card.restrictLane ? [card.restrictLane] : CONFIG.LANES;
  return allowed.filter((lane) => laneHasRoom(state, side, lane));
}

/** Run a card's on_play abilities directly. */
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

/** Mirror Shard: if the relic is in play and this is the side's first
 *  spell this turn, re-resolve the spell's on_play abilities once. */
function maybeMirrorShardEcho(state, side, card, target) {
  const player = state[side];
  if (player.spellsCastThisTurn !== 1) return;
  const hasMirror = player.relics.some((r) => r.cardId === 'mirror_shard');
  if (!hasMirror) return;
  logSystem(state, `Mirror Shard echoes ${card.name}.`);
  runOnPlayAbilities(state, side, card, null, target);
}

/**
 * Play a card from hand. `target` is { kind: 'unit', instanceId } |
 * { kind: 'hero', side } | null. `lane` (creatures) is one of CONFIG.LANES.
 *
 * Returns true if the card was played, false otherwise.
 */
export function playCard(state, side, handIndex, { lane = null, target = null } = {}) {
  if (state.gameOver) return false;
  if (!canPlayCard(state, side, handIndex)) return false;
  const player = state[side];
  const card = player.hand[handIndex];
  const cost = effectiveCost(state, side, card);

  if (card.type === 'creature') {
    if (card.restrictLane && lane !== card.restrictLane) return false;
    if (!lane || !laneHasRoom(state, side, lane)) return false;
    player.mana -= cost;
    player.hand.splice(handIndex, 1);
    const unit = instantiateUnit(card, side);
    unit.lane = lane;
    state[side].battlefield[lane].push(unit);
    applyRelicAuraToUnit(state, unit);
    logForSide(state, side, `${player.name} played ${card.name} in ${lane.toUpperCase()} lane.`);
    runOnPlayAbilities(state, side, card, unit, target);
    if (!state.gameOver) {
      // Notify listeners (e.g. Lantern of the Veil reacts to Spirit summons).
      triggerEffects(state, 'friendly_unit_played', {
        ownerSide: side,
        playedUnit: unit,
      });
    }
    if (!state.gameOver && isRush(unit)) runRushAttack(state, unit);
    checkGameOver(state);
    return true;
  }

  if (card.type === 'spell' || card.type === 'curse') {
    player.mana -= cost;
    player.hand.splice(handIndex, 1);
    logForSide(state, side, `${player.name} cast ${card.name}.`);
    player.spellsCastThisTurn += 1;
    runOnPlayAbilities(state, side, card, null, target);
    if (!state.gameOver) maybeMirrorShardEcho(state, side, card, target);
    player.discardPile.push(card);
    checkGameOver(state);
    return true;
  }

  if (card.type === 'relic') {
    player.mana -= cost;
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

/** True if the card's on_play wants the player to pick a target. */
export function getTargetingRequirement(card) {
  if (!card) return null;
  const needsChosen = (card.abilities || []).some(
    (a) => a.trigger === 'on_play' && (
      a.target === 'chosen' || a.target === 'chosen_friendly_undead'
    ),
  );
  if (!needsChosen) return null;
  // Most chosen-targets accept any unit or hero. We let the click flow decide.
  // Specific abilities (buff_unit_grant_lifesteal) silently no-op on invalid
  // targets, which is acceptable for the MVP.
  return { kind: 'any' };
}

/**
 * Expire any temporary buffs that should end on the start of `side`'s turn.
 * Currently the only kind is 'caster_next_turn_start' (set by Moonlit Hex).
 */
function expireTempBuffs(state, side) {
  for (const u of unitsForSide(state, 'player').concat(unitsForSide(state, 'enemy'))) {
    if (!u.tempBuffs || !u.tempBuffs.length) continue;
    const remaining = [];
    for (const buff of u.tempBuffs) {
      const shouldExpire =
        buff.expires === 'caster_next_turn_start' && buff.casterSide === side;
      if (!shouldExpire) {
        remaining.push(buff);
        continue;
      }
      // Reverse the buff's stat changes.
      u.attack = Math.max(0, u.attack - (buff.attack || 0));
      u.maxHealth = Math.max(1, u.maxHealth - (buff.health || 0));
      u.health -= (buff.health || 0);
      // Don't auto-revive: if reversing somehow took health > maxHealth, clamp.
      if (u.health > u.maxHealth) u.health = u.maxHealth;
    }
    u.tempBuffs = remaining;
  }
}

export function startTurn(state, side) {
  const p = state[side];
  // Expire temp buffs that end at start of this side's turn.
  expireTempBuffs(state, side);
  if (p.hasStarted) {
    p.maxMana = Math.min(p.maxMana + 1, CONFIG.MAX_MANA);
  }
  p.hasStarted = true;
  // Apply queued mana from effects like Bone Cultist.
  if (p.pendingMana) {
    p.maxMana = Math.min(CONFIG.MAX_MANA, p.maxMana + p.pendingMana);
    p.pendingMana = 0;
  }
  p.mana = p.maxMana;
  p.spellsCastThisTurn = 0;
  drawCard(state, side, 1);
  logSystem(state, `--- ${p.name}'s turn (${state.turnNumber}) — Mana ${p.mana}/${p.maxMana} ---`);
  triggerEffects(state, 'turn_start', { ownerSide: side });
  checkGameOver(state);
}

export function endTurn(state, side) {
  if (state.gameOver) return;
  resolveCombat(state, side);
  if (state.gameOver) return;
  triggerEffects(state, 'turn_end', { ownerSide: side });
  if (state.gameOver) return;
  // Fleeting units controlled by the ending side die.
  const fleetingUnits = unitsForSide(state, side).filter((u) => isFleeting(u));
  for (const u of fleetingUnits) {
    logCombat(state, `${u.name} fades away (Fleeting).`);
    killUnit(state, u);
    if (state.gameOver) return;
  }
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
