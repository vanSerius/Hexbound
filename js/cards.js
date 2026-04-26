/**
 * HEXBOUND card database.
 *
 * The engine is data-driven — to add new cards just append to CARDS.
 *
 * Card schema:
 *   id        string (unique)
 *   name      string
 *   cost      number  (mana cost)
 *   type      'creature' | 'spell' | 'relic' | 'curse'
 *   tribe     string?  (creatures)
 *   attack    number?  (creatures)
 *   health    number?  (creatures)
 *   text      string   (rules text)
 *   keywords  string[]  one or more of: rush, taunt, lifesteal, fleeting
 *   abilities Ability[]
 *   sprite    { sheet: string, index: number }?
 *
 * Ability schema:
 *   trigger   'on_play' | 'on_death' | 'turn_start' | 'turn_end'
 *             | 'friendly_unit_dies' | 'unit_dies'
 *   condition 'another'?         (e.g. exclude self for friendly_unit_dies)
 *   effect    string  matches a handler in abilities.js effectHandlers
 *
 * Effect-specific fields are passed through to the handler:
 *   - deal_damage: amount, target: 'enemy_hero' | 'self_hero' | 'chosen' | 'random_enemy_unit' | 'all_enemy_units'
 *   - heal:        amount, target: 'self_hero' | 'chosen'
 *   - draw:        amount
 *   - gain_stats:  attack, health   (buff self when trigger fires)
 *   - buff_unit:   attack, health, target: 'chosen' | 'all_friendly'
 *   - debuff_unit: attack, health, target: 'chosen'
 *   - silence:     target: 'chosen'
 *   - summon:      summonId, lane: 'same' | 'chosen'
 *   - aura_attack: attack, scope: 'all_friendly' | 'lane:left' | 'lane:center' | 'lane:right'  (relic)
 *   - aura_health: health, scope ...
 *
 * "chosen" effects on player cards prompt for a target. AI picks a random valid one.
 */
export const CARDS = [
  // ── Creatures ──────────────────────────────────────────────────────────
  {
    id: 'bone_widow',
    name: 'Bone Widow',
    cost: 3,
    type: 'creature',
    tribe: 'undead',
    attack: 3,
    health: 3,
    text: 'Whenever another friendly unit dies, gain +1/+1.',
    abilities: [
      {
        trigger: 'friendly_unit_dies',
        condition: 'another',
        effect: 'gain_stats',
        attack: 1,
        health: 1,
      },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 0 },
  },
  {
    id: 'ash_hound',
    name: 'Ash Hound',
    cost: 2,
    type: 'creature',
    tribe: 'beast',
    attack: 3,
    health: 2,
    text: 'Rush.',
    keywords: ['rush'],
    sprite: { sheet: 'cards_sheet_01', index: 1 },
  },
  {
    id: 'bone_cultist',
    name: 'Bone Cultist',
    cost: 1,
    type: 'creature',
    tribe: 'cultist',
    attack: 2,
    health: 1,
    text: 'A simple sacrifice.',
    sprite: { sheet: 'cards_sheet_01', index: 2 },
  },
  {
    id: 'gravewatch_acolyte',
    name: 'Gravewatch Acolyte',
    cost: 2,
    type: 'creature',
    tribe: 'cultist',
    attack: 1,
    health: 4,
    text: 'Taunt.',
    keywords: ['taunt'],
    sprite: { sheet: 'cards_sheet_01', index: 3 },
  },
  {
    id: 'crimson_seeress',
    name: 'Crimson Seeress',
    cost: 3,
    type: 'creature',
    tribe: 'cultist',
    attack: 2,
    health: 3,
    text: 'Lifesteal.',
    keywords: ['lifesteal'],
    sprite: { sheet: 'cards_sheet_01', index: 4 },
  },
  {
    id: 'wraithling',
    name: 'Wraithling',
    cost: 1,
    type: 'creature',
    tribe: 'spirit',
    attack: 2,
    health: 1,
    text: 'Fleeting.',
    keywords: ['fleeting'],
    sprite: { sheet: 'cards_sheet_01', index: 5 },
  },
  {
    id: 'withered_prophet',
    name: 'Withered Prophet',
    cost: 4,
    type: 'creature',
    tribe: 'undead',
    attack: 3,
    health: 4,
    text: 'On Play: deal 2 damage to the enemy hero.',
    abilities: [
      { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'enemy_hero' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 6 },
  },
  {
    id: 'tomb_revenant',
    name: 'Tomb Revenant',
    cost: 4,
    type: 'creature',
    tribe: 'undead',
    attack: 3,
    health: 3,
    text: 'On Death: draw a card.',
    abilities: [
      { trigger: 'on_death', effect: 'draw', amount: 1 },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 7 },
  },

  // ── Spells ─────────────────────────────────────────────────────────────
  {
    id: 'shadowbolt',
    name: 'Shadowbolt',
    cost: 2,
    type: 'spell',
    text: 'Deal 3 damage to a chosen unit or hero.',
    abilities: [
      { trigger: 'on_play', effect: 'deal_damage', amount: 3, target: 'chosen' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 8 },
  },
  {
    id: 'soul_drain',
    name: 'Soul Drain',
    cost: 3,
    type: 'spell',
    text: 'Deal 2 damage to a chosen unit and heal yourself for 2.',
    abilities: [
      { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'chosen' },
      { trigger: 'on_play', effect: 'heal', amount: 2, target: 'self_hero' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 9 },
  },

  // ── Relics ─────────────────────────────────────────────────────────────
  {
    id: 'banner_of_dread',
    name: 'Banner of Dread',
    cost: 2,
    type: 'relic',
    text: 'Your creatures have +1 Attack.',
    abilities: [
      { trigger: 'aura', effect: 'aura_attack', amount: 1, scope: 'all_friendly' },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 0 },
  },
  {
    id: 'rite_of_ash',
    name: 'Rite of Ash',
    cost: 2,
    type: 'relic',
    text: 'At the start of your turn, draw an extra card.',
    abilities: [
      { trigger: 'turn_start', effect: 'draw', amount: 1 },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 1 },
  },

  // ── Curses ─────────────────────────────────────────────────────────────
  {
    id: 'wither',
    name: 'Wither',
    cost: 1,
    type: 'curse',
    text: 'Give a chosen unit -2/-2.',
    abilities: [
      { trigger: 'on_play', effect: 'debuff_unit', attack: 2, health: 2, target: 'chosen' },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 2 },
  },
  {
    id: 'silencing_hex',
    name: 'Silencing Hex',
    cost: 2,
    type: 'curse',
    text: 'Silence a chosen unit.',
    abilities: [
      { trigger: 'on_play', effect: 'silence', target: 'chosen' },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 3 },
  },
];

export const CARD_INDEX = Object.fromEntries(CARDS.map((c) => [c.id, c]));
