/**
 * Keyword helpers. Most keywords are checked in-line by combat/engine; this
 * module centralises the predicates and the few side-effecting helpers
 * (silence / lifesteal heal) that are reused across modules.
 */

export function hasKeyword(unit, keyword) {
  if (!unit || unit.silenced) return false;
  return Array.isArray(unit.keywords) && unit.keywords.includes(keyword);
}

export function isRush(unit)      { return hasKeyword(unit, 'rush'); }
export function isTaunt(unit)     { return hasKeyword(unit, 'taunt'); }
export function isLifesteal(unit) { return hasKeyword(unit, 'lifesteal'); }
export function isFleeting(unit)  { return hasKeyword(unit, 'fleeting'); }

/**
 * Find the first taunt unit in a lane, or null if none.
 */
export function findTauntInLane(laneArr) {
  return laneArr.find((u) => isTaunt(u)) || null;
}

/**
 * Silence a unit: clear abilities, keywords, temp buffs.
 * Stats are preserved at their current values (Hearthstone-style).
 */
export function silenceUnit(unit) {
  unit.abilities = [];
  unit.keywords = [];
  unit.tempBuffs = [];
  unit.silenced = true;
}

/**
 * Apply lifesteal heal: caller has already dealt `damage`; if the dealer has
 * lifesteal, heal the dealer's owner by the same amount (capped to maxHealth).
 */
export function applyLifestealHeal(state, dealer, damage) {
  if (damage <= 0) return;
  if (!isLifesteal(dealer)) return;
  const ownerSide = dealer.owner;
  if (!ownerSide) return;
  const owner = state[ownerSide];
  owner.health = Math.min(owner.maxHealth, owner.health + damage);
}
