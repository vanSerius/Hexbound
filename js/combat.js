import { CONFIG } from './config.js';
import { otherSide, findUnitOnBoard, instantiateCard } from './state.js';
import { CARD_INDEX } from './cards.js';
import { applyLifestealHeal, isTaunt, findTauntInLane } from './keywords.js';
import { triggerEffects } from './abilities.js';
import { logCombat, logDeath } from './log.js';

/**
 * Apply damage to a unit. Lifesteal-aware: pass the dealer (unit or null)
 * so lifesteal can heal the dealer's owner. Returns the actual damage dealt.
 */
export function dealDamageToUnit(state, target, amount, dealer = null) {
  if (!target || amount <= 0) return 0;
  const dealt = Math.min(amount, target.health);
  target.health -= amount;
  if (dealer) applyLifestealHeal(state, dealer, dealt);
  if (target.health <= 0) {
    killUnit(state, target);
  }
  return dealt;
}

export function dealDamageToHero(state, side, amount, dealer = null) {
  if (amount <= 0) return 0;
  const hero = state[side];
  const dealt = Math.min(amount, Math.max(0, hero.health));
  hero.health -= amount;
  if (dealer) applyLifestealHeal(state, dealer, amount);
  return dealt;
}

/**
 * Remove a unit from the board, send its template to the discard pile, and
 * fire on_death + friendly_unit_dies triggers.
 */
export function killUnit(state, unit) {
  const found = findUnitOnBoard(state, unit.instanceId);
  if (!found) return; // already dead / removed
  const { side, lane, index } = found;
  state[side].battlefield[lane].splice(index, 1);
  // Push a fresh hand-card instance back to the discard pile (will be reshuffled
  // into the deck later and must be playable, with full stats and abilities).
  const tpl = CARD_INDEX[unit.cardId];
  if (tpl) state[side].discardPile.push(instantiateCard(tpl));
  logDeath(state, `${unit.name} died.`);
  // 1) Per-unit on_death
  triggerEffects(state, 'on_death', { source: unit, ownerSide: side });
  // 2) Friendly-death listeners (other friendly units)
  triggerEffects(state, 'friendly_unit_dies', { deadUnit: unit, ownerSide: side });
  // 3) Generic any-death listeners
  triggerEffects(state, 'unit_dies', { deadUnit: unit, ownerSide: side });
}

/**
 * Choose the defending unit in a lane. Taunt overrides — but in MVP only
 * the frontmost unit fights, so taunt only matters if the frontmost isn't
 * the taunt and there's a taunt deeper in the lane. We pick the taunt first
 * if any taunt unit exists in the lane.
 */
function pickDefender(defenderLane) {
  const taunt = findTauntInLane(defenderLane);
  if (taunt) return taunt;
  return defenderLane[0] || null;
}

/**
 * One-on-one combat: simultaneous damage between attacker and defender.
 * Used for both end-of-turn lane combat and Rush mini-combats.
 */
export function unitVsUnit(state, attacker, defender) {
  const atkDmg = attacker.attack;
  const defDmg = defender.attack;
  logCombat(
    state,
    `${attacker.name} (${attacker.attack}/${attacker.health}) clashes with ${defender.name} (${defender.attack}/${defender.health}).`,
  );
  // Snapshot health for simultaneous resolution
  const attackerWasAlive = attacker.health > 0;
  const defenderWasAlive = defender.health > 0;
  if (attackerWasAlive && defDmg > 0) {
    // attacker takes damage, but lifesteal applies to defender
    dealDamageToUnit(state, attacker, defDmg, defender);
  }
  if (defenderWasAlive && atkDmg > 0) {
    dealDamageToUnit(state, defender, atkDmg, attacker);
  }
}

/**
 * Rush mini-combat — runs immediately when a unit with rush enters the field.
 * The unit attacks the defender in its own lane (or the enemy hero if empty).
 */
export function runRushAttack(state, unit) {
  const ownerSide = unit.owner;
  const enemySide = otherSide(ownerSide);
  const enemyLane = state[enemySide].battlefield[unit.lane];
  const defender = pickDefender(enemyLane);
  if (defender) {
    logCombat(state, `${unit.name} rushes ${defender.name}.`);
    unitVsUnit(state, unit, defender);
  } else {
    const dealt = dealDamageToHero(state, enemySide, unit.attack, unit);
    logCombat(state, `${unit.name} rushes the enemy hero for ${dealt} damage.`);
  }
}

/**
 * End-of-turn combat: for the side that just ended its turn, each lane's
 * frontmost unit attacks the opponent's frontmost unit in the same lane
 * (or the enemy hero if the opposing lane is empty). Exhausted units skip
 * and clear their exhausted flag.
 */
export function resolveCombat(state, attackingSide) {
  const defendingSide = otherSide(attackingSide);
  for (const lane of CONFIG.LANES) {
    if (state.gameOver) return;
    const attackerLane = state[attackingSide].battlefield[lane];
    const defenderLane = state[defendingSide].battlefield[lane];
    const attacker = attackerLane[0];
    if (!attacker) continue;
    if (attacker.exhausted) {
      attacker.exhausted = false;
      logCombat(state, `${attacker.name} is exhausted and skips combat.`);
      continue;
    }
    const defender = pickDefender(defenderLane);
    if (defender) {
      unitVsUnit(state, attacker, defender);
    } else {
      const dealt = dealDamageToHero(state, defendingSide, attacker.attack, attacker);
      logCombat(state, `${attacker.name} hits the ${defendingSide} hero for ${dealt} damage.`);
    }
  }
}
