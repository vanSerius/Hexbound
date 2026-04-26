import { CONFIG } from './config.js';
import { otherSide, unitsForSide } from './state.js';
import {
  canPlayCard,
  playCard,
  endTurn,
  getTargetingRequirement,
  validLanesForCreature,
} from './engine.js';

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Decide a target for an AI-played spell/curse that needs a 'chosen' target.
 * Strategy is intentionally dumb for the MVP:
 *   - damage spells: prefer enemy units, fall back to enemy hero
 *   - debuff/silence: prefer enemy units only
 */
function pickAiTarget(state, side, card) {
  const enemy = otherSide(side);
  const enemyUnits = unitsForSide(state, enemy);
  const friendlyUnits = unitsForSide(state, side);

  const hasDamage  = (card.abilities || []).some((a) => a.effect === 'deal_damage');
  const hasDebuff  = (card.abilities || []).some((a) => a.effect === 'debuff_unit' || a.effect === 'silence');
  const hasBuff    = (card.abilities || []).some((a) => a.effect === 'buff_unit');
  const hasHeal    = (card.abilities || []).some((a) => a.effect === 'heal');

  if (hasDebuff && enemyUnits.length > 0) {
    const u = pickRandom(enemyUnits);
    return { kind: 'unit', instanceId: u.instanceId };
  }
  if (hasBuff && friendlyUnits.length > 0) {
    const u = pickRandom(friendlyUnits);
    return { kind: 'unit', instanceId: u.instanceId };
  }
  if (hasHeal && state[side].health < state[side].maxHealth) {
    return { kind: 'hero', side };
  }
  if (hasDamage) {
    if (enemyUnits.length > 0 && Math.random() < 0.6) {
      const u = pickRandom(enemyUnits);
      return { kind: 'unit', instanceId: u.instanceId };
    }
    return { kind: 'hero', side: enemy };
  }
  // Fallback: random unit on board, otherwise enemy hero.
  if (enemyUnits.length > 0) {
    const u = pickRandom(enemyUnits);
    return { kind: 'unit', instanceId: u.instanceId };
  }
  return { kind: 'hero', side: enemy };
}

/**
 * Returns a list of plays the AI can make right now (a play = handIndex + lane/target).
 */
function listValidPlays(state, side) {
  const player = state[side];
  const plays = [];
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (!canPlayCard(state, side, i)) continue;
    if (card.type === 'creature') {
      const lanes = validLanesForCreature(state, side, card);
      if (lanes.length === 0) continue;
      plays.push({ handIndex: i, lane: pickRandom(lanes), target: null });
    } else if (card.type === 'spell' || card.type === 'curse') {
      const req = getTargetingRequirement(card);
      let target = null;
      if (req) {
        target = pickAiTarget(state, side, card);
        if (!target) continue;
      }
      plays.push({ handIndex: i, lane: null, target });
    } else if (card.type === 'relic') {
      plays.push({ handIndex: i, lane: null, target: null });
    }
  }
  return plays;
}

/**
 * Run a single AI play step. Returns true if a card was played, false if no
 * valid plays remain. The UI calls this on a timer until it returns false,
 * then advances to endTurn for the AI.
 */
export function aiPlayOne(state) {
  const side = 'enemy';
  const plays = listValidPlays(state, side);
  if (plays.length === 0) return false;
  // Bias toward higher-cost cards (more impactful) but stay random.
  plays.sort((a, b) => state.enemy.hand[b.handIndex].cost - state.enemy.hand[a.handIndex].cost);
  // Pick from top half (rough heuristic).
  const top = plays.slice(0, Math.max(1, Math.ceil(plays.length / 2)));
  const choice = pickRandom(top);
  return playCard(state, side, choice.handIndex, { lane: choice.lane, target: choice.target });
}

export function aiEndTurn(state) {
  endTurn(state, 'enemy');
}
