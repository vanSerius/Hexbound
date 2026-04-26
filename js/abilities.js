import { CONFIG } from './config.js';
import { otherSide, allUnits, unitsForSide, findUnitOnBoard, instantiateUnit } from './state.js';
import { silenceUnit } from './keywords.js';
import { dealDamageToUnit, dealDamageToHero, killUnit } from './combat.js';
import { drawCard } from './deck.js';
import { TOKENS } from './cards.js';
import { logSystem, logForSide } from './log.js';

/**
 * Effect handlers. Each receives a context object and the ability spec.
 *
 * ctx fields (subset depending on call site):
 *   state, ownerSide, sourceUnit?, sourceCard?, target?, deadUnit?
 *
 * Handlers are safe to call repeatedly and never throw — they no-op when the
 * situation doesn't apply (e.g. effect needs a target but none is given).
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
      case 'random_enemy_in_my_lane': {
        if (!dealer || !dealer.lane) break;
        const enemy = otherSide(ownerSide);
        const laneUnits = state[enemy].battlefield[dealer.lane];
        if (!laneUnits.length) break;
        const u = laneUnits[Math.floor(Math.random() * laneUnits.length)];
        dealDamageToUnit(state, u, amount, dealer);
        logForSide(state, ownerSide, `${dealer.name} dealt ${amount} damage to ${u.name}.`);
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

  /**
   * Deal damage to the chosen target; if that target dies, draw `draw` cards.
   * Used by Ritual Flame.
   */
  deal_damage_draw_if_killed(ctx, ab) {
    const { state, ownerSide } = ctx;
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(state, ctx.target.instanceId);
    if (!found) return;
    const u = found.unit;
    const dealer = ctx.sourceUnit || null;
    dealDamageToUnit(state, u, ab.amount || 0, dealer);
    logForSide(state, ownerSide, `Dealt ${ab.amount || 0} damage to ${u.name}.`);
    // If target died, dealDamageToUnit removed it from the board.
    if (!findUnitOnBoard(state, ctx.target.instanceId)) {
      drawCard(state, ownerSide, ab.draw || 1);
      logForSide(state, ownerSide, `Drew ${ab.draw || 1} card(s) (kill bonus).`);
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

  /**
   * Widow's Kiss: target must be a friendly Undead. Grants +X/+Y and lifesteal.
   * MVP simplification: the buff/keyword are permanent (briefing said
   * "this turn" but we don't model temporary keyword grants beyond debuffs).
   */
  buff_unit_grant_lifesteal(ctx, ab) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    const u = found.unit;
    if (found.side !== ctx.ownerSide) return;
    if ((u.tribe || '').toLowerCase() !== 'undead') return;
    const a = ab.attack || 0;
    const h = ab.health || 0;
    u.attack += a;
    u.maxHealth += h;
    u.health += h;
    if (!u.keywords.includes('lifesteal')) u.keywords.push('lifesteal');
    logSystem(ctx.state, `${u.name} gains +${a}/+${h} and Lifesteal.`);
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

  /**
   * Temporary stat reduction; expires at the start of the caster's next turn.
   * Implemented as a tempBuffs entry; engine.startTurn clears matching ones.
   */
  temp_debuff_unit(ctx, ab) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    const u = found.unit;
    const a = ab.attack || 0;
    const h = ab.health || 0;
    u.attack = Math.max(0, u.attack - a);
    u.health -= h;
    u.maxHealth = Math.max(1, u.maxHealth - h);
    u.tempBuffs.push({
      attack: -a,
      health: -h,
      casterSide: ctx.ownerSide,
      expires: 'caster_next_turn_start',
    });
    logSystem(ctx.state, `${u.name} suffers -${a}/-${h} (temporary).`);
    if (u.health <= 0) killUnit(ctx.state, u);
  },

  silence(ctx /*, ab */) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    silenceUnit(found.unit);
    logSystem(ctx.state, `${found.unit.name} is silenced.`);
  },

  /** Black Candle: destroy a chosen friendly unit. */
  destroy_friendly_unit(ctx /*, ab */) {
    if (!ctx.target || ctx.target.kind !== 'unit') return;
    const found = findUnitOnBoard(ctx.state, ctx.target.instanceId);
    if (!found) return;
    if (found.side !== ctx.ownerSide) return;
    logSystem(ctx.state, `${found.unit.name} is consumed.`);
    killUnit(ctx.state, found.unit);
  },

  /** Black Candle: summon `count` token units into open friendly lane slots. */
  summon_token(ctx, ab) {
    const tpl = TOKENS[ab.tokenId];
    if (!tpl) return;
    const owner = ctx.state[ctx.ownerSide];
    const count = ab.count || 1;
    for (let i = 0; i < count; i++) {
      const lane = CONFIG.LANES.find(
        (l) => owner.battlefield[l].length < CONFIG.MAX_LANE_UNITS,
      );
      if (!lane) break; // no room
      const unit = instantiateUnit(tpl, ctx.ownerSide);
      unit.lane = lane;
      owner.battlefield[lane].push(unit);
      logForSide(ctx.state, ctx.ownerSide, `Summoned ${tpl.name} in ${lane.toUpperCase()} lane.`);
      // Fire friendly_unit_played so e.g. Lantern of the Veil can buff Spirits.
      triggerEffects(ctx.state, 'friendly_unit_played', {
        ownerSide: ctx.ownerSide,
        playedUnit: unit,
      });
    }
  },

  /** Crown of Salt: exhaust an enemy unit whose attack <= threshold. */
  exhaust_enemy_unit_low_power(ctx, ab) {
    const enemy = otherSide(ctx.ownerSide);
    const threshold = ab.threshold ?? 3;
    const candidates = unitsForSide(ctx.state, enemy).filter(
      (u) => !u.exhausted && u.attack <= threshold,
    );
    if (!candidates.length) return;
    const u = candidates[Math.floor(Math.random() * candidates.length)];
    u.exhausted = true;
    logSystem(ctx.state, `${u.name} is exhausted by Crown of Salt.`);
  },

  /** Lantern of the Veil: buff the unit that was just played (passed in payload). */
  buff_played_unit(ctx, ab) {
    const target = ctx.playedUnit;
    if (!target) return;
    const a = ab.attack || 0;
    const h = ab.health || 0;
    target.attack += a;
    target.maxHealth += h;
    target.health += h;
    logSystem(ctx.state, `${target.name} gains +${a}/+${h}.`);
  },

  /** Bone Cultist: queue +1 mana for next turn_start. */
  gain_mana_next_turn(ctx, ab) {
    ctx.state[ctx.ownerSide].pendingMana += ab.amount || 0;
    logForSide(ctx.state, ctx.ownerSide, `+${ab.amount || 0} Mana queued for next turn.`);
  },

  // Aura effects are passive — they're applied on-the-fly via applyRelicAura*
  // and are no-ops here so they don't fire as triggers.
  aura_attack() {},
  aura_health() {},

  // Cost modifiers are queried by engine when computing effective cost; no
  // active effect to run when triggered.
  cost_modifier() {},

  // Mirror Shard's listener is engine-handled (see engine.maybeMirrorShardEcho).
  noop() {},
};

/**
 * For a given card in `side`'s hand, compute the effective mana cost after
 * accounting for cost-modifier abilities owned by `side` (e.g. Ashen Choir
 * makes curses cost 1 less; Iron Saint makes relics cost 1 less). Cost can
 * never go below 0.
 */
export function effectiveCost(state, side, card) {
  let cost = card.cost || 0;
  for (const u of unitsForSide(state, side)) {
    if (u.silenced) continue;
    for (const ab of u.abilities || []) {
      if (ab.trigger === 'cost_modifier' && ab.cardType === card.type) {
        cost += ab.amount || 0;
      }
    }
  }
  for (const r of state[side].relics || []) {
    for (const ab of r.abilities || []) {
      if (ab.trigger === 'cost_modifier' && ab.cardType === card.type) {
        cost += ab.amount || 0;
      }
    }
  }
  return Math.max(0, cost);
}

/**
 * Sum a relic-based attack aura bonus for a given unit, based on the unit's
 * owner's relics. Aura is always-on; we apply it when the unit enters the
 * board (or when a relic is played that retroactively buffs existing units).
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
  if (scope.startsWith('lane:')) return unit.lane === scope.slice(5);
  return false;
}

/**
 * Trigger bus. Walks all units (and relics) on the board for both sides and
 * fires any abilities matching the event. The owner-relative semantics are
 * resolved via `shouldFire`.
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
  if (eventName === 'friendly_unit_dies') {
    if (payload.ownerSide !== side) return false;
    if (
      ability.condition === 'another' &&
      unit && payload.deadUnit && payload.deadUnit.instanceId === unit.instanceId
    ) {
      return false;
    }
    return true;
  }
  if (eventName === 'unit_dies') return true;
  if (eventName === 'on_death') {
    if (!unit) return false;
    return payload.deadUnit && payload.deadUnit.instanceId === unit.instanceId;
  }
  if (eventName === 'turn_start' || eventName === 'turn_end') {
    return payload.ownerSide === side;
  }
  if (eventName === 'self_survives_damage') {
    if (!unit) return false;
    return payload.sourceUnit && payload.sourceUnit.instanceId === unit.instanceId;
  }
  if (eventName === 'friendly_unit_played') {
    if (payload.ownerSide !== side) return false;
    if (ability.condition && ability.condition.startsWith('tribe:')) {
      const tribe = ability.condition.slice(6).toLowerCase();
      if (!payload.playedUnit || (payload.playedUnit.tribe || '').toLowerCase() !== tribe) {
        return false;
      }
    }
    return true;
  }
  if (eventName === 'on_play') {
    if (unit && payload.sourceUnit) {
      return unit.instanceId === payload.sourceUnit.instanceId;
    }
    return false;
  }
  return true;
}

export { CONFIG, allUnits };
