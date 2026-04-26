import { CONFIG } from './config.js';
import { otherSide, allUnits, unitsForSide, findUnitOnBoard } from './state.js';
import { silenceUnit } from './keywords.js';
import { dealDamageToUnit, dealDamageToHero, killUnit } from './combat.js';
import { drawCard } from './deck.js';
import { logSystem, logForSide } from './log.js';

/**
 * Effect handlers. Each handler receives a context object and the ability spec.
 *
 * ctx fields:
 *   state, ownerSide, sourceUnit?, sourceCard?, target?, deadUnit?
 *
 * Handlers should be safe to call repeatedly and never throw — they no-op when
 * the situation doesn't apply (e.g. effect needs a target but none is given).
 */
export const effectHandlers = {
  deal_damage(ctx, ab) {
    const { state, ownerSide } = ctx;
    const amount = ab.amount || 0;
    const dealer = ctx.sourceUnit || null;
    switch (ab.target) {
      case 'enemy_hero': {
        const enemy = otherSide(ownerSide);
        const dealt = dealDamageToHero(state, enemy, amount, dealer);
        logForSide(state, ownerSide, `Dealt ${dealt} damage to the ${enemy} hero.`);
        break;
      }
      case 'self_hero': {
        const dealt = dealDamageToHero(state, ownerSide, amount, dealer);
        logForSide(state, ownerSide, `Dealt ${dealt} damage to own hero.`);
        break;
      }
      case 'random_enemy_unit': {
        const enemy = otherSide(ownerSide);
        const units = unitsForSide(state, enemy);
        if (units.length === 0) break;
        const u = units[Math.floor(Math.random() * units.length)];
        dealDamageToUnit(state, u, amount, dealer);
        logForSide(state, ownerSide, `Dealt ${amount} damage to ${u.name}.`);
        break;
      }
      case 'all_enemy_units': {
        const enemy = otherSide(ownerSide);
        const units = unitsForSide(state, enemy).slice();
        for (const u of units) dealDamageToUnit(state, u, amount, dealer);
        logForSide(state, ownerSide, `Dealt ${amount} damage to all enemy units.`);
        break;
      }
      case 'chosen':
      default: {
        if (!ctx.target) return;
        if (ctx.target.kind === 'hero') {
          const dealt = dealDamageToHero(state, ctx.target.side, amount, dealer);
          logForSide(state, ownerSide, `Dealt ${dealt} damage to the ${ctx.target.side} hero.`);
        } else if (ctx.target.kind === 'unit') {
          const found = findUnitOnBoard(state, ctx.target.instanceId);
          if (!found) return;
          dealDamageToUnit(state, found.unit, amount, dealer);
          logForSide(state, ownerSide, `Dealt ${amount} damage to ${found.unit.name}.`);
        }
      }
    }
  },

  heal(ctx, ab) {
    const { state, ownerSide } = ctx;
    const amount = ab.amount || 0;
    if (ab.target === 'self_hero' || !ab.target) {
      const hero = state[ownerSide];
      const before = hero.health;
      hero.health = Math.min(hero.maxHealth, hero.health + amount);
      logForSide(state, ownerSide, `${hero.name} healed for ${hero.health - before}.`);
    } else if (ab.target === 'chosen' && ctx.target) {
      if (ctx.target.kind === 'hero') {
        const hero = state[ctx.target.side];
        const before = hero.health;
        hero.health = Math.min(hero.maxHealth, hero.health + amount);
        logForSide(state, ownerSide, `${hero.name} healed for ${hero.health - before}.`);
      } else if (ctx.target.kind === 'unit') {
        const found = findUnitOnBoard(state, ctx.target.instanceId);
        if (!found) return;
        const before = found.unit.health;
        found.unit.health = Math.min(found.unit.maxHealth, found.unit.health + amount);
        logForSide(state, ownerSide, `${found.unit.name} healed for ${found.unit.health - before}.`);
      }
    }
  },

  draw(ctx, ab) {
    const { state, ownerSide } = ctx;
    drawCard(state, ownerSide, ab.amount || 1);
    logForSide(state, ownerSide, `Drew ${ab.amount || 1} card(s).`);
  },

  /**
   * gain_stats: typically used as a self-buff in response to a trigger
   * (e.g. Bone Widow gains +1/+1 when another friendly unit dies).
   */
  gain_stats(ctx, ab) {
    const { state, sourceUnit } = ctx;
    if (!sourceUnit) return;
    const a = ab.attack || 0;
    const h = ab.health || 0;
    sourceUnit.attack += a;
    sourceUnit.maxHealth += h;
    sourceUnit.health += h;
    logSystem(state, `${sourceUnit.name} gains +${a}/+${h}.`);
  },

  buff_unit(ctx, ab) {
    const a = ab.attack || 0;
    const h = ab.health || 0;
    if (ab.target === 'all_friendly') {
      for (const u of unitsForSide(ctx.state, ctx.ownerSide)) {
        u.attack += a;
        u.maxHealth += h;
        u.health += h;
      }
    } else if (ctx.target && ctx.target.kind === 'unit') {
      const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
      if (!found) return;
      found.unit.attack += a;
      found.unit.maxHealth += h;
      found.unit.health += h;
      logSystem(ctx.state, `${found.unit.name} gains +${a}/+${h}.`);
    }
  },

  debuff_unit(ctx, ab) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    const u = found.unit;
    const a = ab.attack || 0;
    const h = ab.health || 0;
    u.attack = Math.max(0, u.attack - a);
    u.health -= h;
    u.maxHealth = Math.max(1, u.maxHealth - h);
    logSystem(ctx.state, `${u.name} suffers -${a}/-${h}.`);
    if (u.health <= 0) {
      killUnit(ctx.state, u);
    }
  },

  silence(ctx /*, ab */) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    silenceUnit(found.unit);
    logSystem(ctx.state, `${found.unit.name} is silenced.`);
  },

  // Aura effects are passive — they're applied on-the-fly via auraAttackBonus
  // and are no-ops here so they don't fire as triggers.
  aura_attack() {},
  aura_health() {},
};

/**
 * Sum a relic-based attack aura bonus for a given unit, based on the unit's
 * owner's relics. Aura is always-on; we apply it when reading the unit's
 * effective attack (currently we just bake it into the unit's attack at
 * render time / combat time).
 *
 * For MVP we apply auras when the relic is played (one-shot buff) AND when
 * a new unit enters via on_play. This keeps things simple and avoids
 * needing a separate "effective stats" system.
 */
export function applyRelicAuraToUnit(state, unit) {
  const owner = state[unit.owner];
  for (const relic of owner.relics) {
    for (const ab of relic.abilities || []) {
      if (ab.trigger === 'aura' && ab.effect === 'aura_attack') {
        if (matchesScope(unit, ab.scope)) {
          unit.attack += ab.amount || 0;
        }
      }
      if (ab.trigger === 'aura' && ab.effect === 'aura_health') {
        if (matchesScope(unit, ab.scope)) {
          unit.health += ab.amount || 0;
          unit.maxHealth += ab.amount || 0;
        }
      }
    }
  }
}

/**
 * When a relic is played, retroactively buff existing friendly units that
 * match the aura scope.
 */
export function applyRelicAuraToBoard(state, ownerSide, relic) {
  for (const ab of relic.abilities || []) {
    if (ab.trigger !== 'aura') continue;
    const units = unitsForSide(state, ownerSide);
    for (const u of units) {
      if (!matchesScope(u, ab.scope)) continue;
      if (ab.effect === 'aura_attack') u.attack += ab.amount || 0;
      if (ab.effect === 'aura_health') {
        u.health += ab.amount || 0;
        u.maxHealth += ab.amount || 0;
      }
    }
  }
}

function matchesScope(unit, scope) {
  if (!scope || scope === 'all_friendly') return true;
  if (scope.startsWith('lane:')) {
    return unit.lane === scope.slice(5);
  }
  return false;
}

/**
 * Trigger bus. Walks all units (and relics) on the board for both sides and
 * fires any abilities matching the event. The owner-relative semantics
 * (e.g. "friendly_unit_dies") are resolved here using the trigger metadata.
 */
export function triggerEffects(state, eventName, payload = {}) {
  // Snapshot the listener list — handlers may modify the board.
  const listeners = [];
  for (const side of ['player', 'enemy']) {
    for (const u of unitsForSide(state, side)) {
      if (u.silenced) continue;
      for (const ab of u.abilities || []) {
        if (ab.trigger === eventName) listeners.push({ side, unit: u, ability: ab });
      }
    }
    for (const relic of state[side].relics || []) {
      for (const ab of relic.abilities || []) {
        if (ab.trigger === eventName) listeners.push({ side, unit: null, relic, ability: ab });
      }
    }
  }
  for (const l of listeners) {
    if (state.gameOver) break;
    if (!shouldFire(state, eventName, l, payload)) continue;
    const handler = effectHandlers[l.ability.effect];
    if (!handler) continue;
    handler(
      {
        state,
        ownerSide: l.side,
        sourceUnit: l.unit,
        sourceRelic: l.relic || null,
        ...payload,
      },
      l.ability,
    );
  }
}

function shouldFire(state, eventName, listener, payload) {
  const { side, unit, ability } = listener;
  // friendly_unit_dies: owner of listener must match owner of dead unit;
  // condition 'another' excludes the dead unit itself.
  if (eventName === 'friendly_unit_dies') {
    if (payload.ownerSide !== side) return false;
    if (ability.condition === 'another' && unit && payload.deadUnit && payload.deadUnit.instanceId === unit.instanceId) {
      return false;
    }
    return true;
  }
  if (eventName === 'unit_dies') {
    return true;
  }
  if (eventName === 'on_death') {
    // The dying unit's own on_death triggers; only fire on the matching unit.
    if (!unit) return false;
    return payload.deadUnit && payload.deadUnit.instanceId === unit.instanceId;
  }
  if (eventName === 'turn_start' || eventName === 'turn_end') {
    // Only fire on the side whose turn is starting/ending.
    return payload.ownerSide === side;
  }
  if (eventName === 'on_play') {
    // Fire only on the entering unit / playing card.
    if (unit && payload.sourceUnit) {
      return unit.instanceId === payload.sourceUnit.instanceId;
    }
    if (!unit && payload.sourceCardInstanceId && listener.relic) {
      return listener.relic.instanceId === payload.sourceCardInstanceId;
    }
    // For one-shot spell/curse on_play we don't reach here — those are run
    // directly when the spell resolves (see engine.playCard).
    return false;
  }
  return true;
}

// Small util reused by engine.js / ai.js
export { CONFIG, allUnits };
