/**
 * HEXBOUND card database — final 20 cards.
 *
 * Cards are matched to their cell in two sprite sheets (5 cols × 2 rows each):
 *   cards_sheet_01.png — first 10 cards
 *   cards_sheet_02.png — last 10 cards
 *
 * Engine is data-driven — to add a card just append to CARDS.
 *
 * Card schema:
 *   id           string (unique)
 *   name         string
 *   cost         number (mana cost)
 *   type         'creature' | 'spell' | 'relic' | 'curse'
 *   tribe        string?
 *   attack       number?
 *   health       number?
 *   text         string
 *   keywords     string[]   rush, taunt, lifesteal, fleeting
 *   restrictLane 'left' | 'center' | 'right'?    creature can only land here
 *   abilities    Ability[]
 *   sprite       { sheet: string, index: number }
 */
export const CARDS = [
  // ════════ Sheet 1 ════════════════════════════════════════════════════
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
    tribe: 'spirit',
    attack: 4,
    health: 2,
    text: 'Rush. End of your turn: deal 1 damage to a random enemy in this lane.',
    keywords: ['rush'],
    abilities: [
      {
        trigger: 'turn_end',
        effect: 'deal_damage',
        amount: 1,
        target: 'random_enemy_in_my_lane',
      },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 1 },
  },
  {
    id: 'bone_cultist',
    name: 'Bone Cultist',
    cost: 1,
    type: 'creature',
    tribe: 'cultist',
    attack: 2,
    health: 2,
    text: 'On play: gain 1 Mana next turn.',
    abilities: [
      { trigger: 'on_play', effect: 'gain_mana_next_turn', amount: 1 },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 2 },
  },
  {
    id: 'gravebound_acolyte',
    name: 'Gravebound Acolyte',
    cost: 1,
    type: 'creature',
    tribe: 'cultist',
    attack: 1,
    health: 2,
    text: 'On Death: draw a card.',
    abilities: [
      { trigger: 'on_death', effect: 'draw', amount: 1 },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 3 },
  },
  {
    id: 'withered_prophet',
    name: 'Withered Prophet',
    cost: 3,
    type: 'creature',
    tribe: 'cultist',
    attack: 3,
    health: 2,
    text: 'On Play: the enemy hero loses 2 Health.',
    abilities: [
      { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'enemy_hero' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 4 },
  },
  {
    id: 'ritual_flame',
    name: 'Ritual Flame',
    cost: 1,
    type: 'spell',
    text: 'Deal 3 damage to a unit. If it dies, draw a card.',
    abilities: [
      {
        trigger: 'on_play',
        effect: 'deal_damage_draw_if_killed',
        amount: 3,
        target: 'chosen',
        draw: 1,
      },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 5 },
  },
  {
    id: 'blood_pact',
    name: 'Blood Pact',
    cost: 1,
    type: 'spell',
    text: 'Draw 2 cards. Lose 2 Health.',
    abilities: [
      { trigger: 'on_play', effect: 'draw', amount: 2 },
      { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'self_hero' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 6 },
  },
  {
    id: 'black_candle',
    name: 'Black Candle',
    cost: 2,
    type: 'spell',
    text: 'Destroy a friendly unit. Summon two 1/1 Wraiths.',
    abilities: [
      { trigger: 'on_play', effect: 'destroy_friendly_unit', target: 'chosen' },
      { trigger: 'on_play', effect: 'summon_token', tokenId: 'wraith_token', count: 2 },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 7 },
  },
  {
    id: 'crown_of_salt',
    name: 'Crown of Salt',
    cost: 2,
    type: 'relic',
    text: 'Start of your turn: Exhaust an enemy unit with 3 or less Power.',
    abilities: [
      {
        trigger: 'turn_start',
        effect: 'exhaust_enemy_unit_low_power',
        threshold: 3,
      },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 8 },
  },
  {
    id: 'mirror_shard',
    name: 'Mirror Shard',
    cost: 3,
    type: 'relic',
    text: 'The first spell you cast each turn is copied.',
    abilities: [
      { trigger: 'spell_echo', effect: 'noop' },
    ],
    sprite: { sheet: 'cards_sheet_01', index: 9 },
  },

  // ════════ Sheet 2 ════════════════════════════════════════════════════
  {
    id: 'cathedral_giant',
    name: 'Cathedral Giant',
    cost: 6,
    type: 'creature',
    tribe: 'construct',
    attack: 6,
    health: 7,
    text: 'Can only be played in the center lane.',
    restrictLane: 'center',
    sprite: { sheet: 'cards_sheet_02', index: 0 },
  },
  {
    id: 'rot_banner',
    name: 'Rot Banner',
    cost: 2,
    type: 'relic',
    text: 'Units in the left lane have +1 Power.',
    abilities: [
      { trigger: 'aura', effect: 'aura_attack', amount: 1, scope: 'lane:left' },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 1 },
  },
  {
    id: 'moonlit_hex',
    name: 'Moonlit Hex',
    cost: 2,
    type: 'curse',
    text: 'A unit gets -2/-2 until your next turn.',
    abilities: [
      {
        trigger: 'on_play',
        effect: 'temp_debuff_unit',
        attack: 2,
        health: 2,
        target: 'chosen',
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 2 },
  },
  {
    id: 'wraithling',
    name: 'Wraithling',
    cost: 1,
    type: 'creature',
    tribe: 'spirit',
    attack: 1,
    health: 1,
    text: 'Fleeting. On Death: deal 1 damage to the enemy hero.',
    keywords: ['fleeting'],
    abilities: [
      { trigger: 'on_death', effect: 'deal_damage', amount: 1, target: 'enemy_hero' },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 3 },
  },
  {
    id: 'ashen_choir',
    name: 'Ashen Choir',
    cost: 4,
    type: 'creature',
    tribe: 'cultist',
    attack: 3,
    health: 5,
    text: 'Your curses cost 1 less.',
    abilities: [
      {
        trigger: 'cost_modifier',
        effect: 'cost_modifier',
        cardType: 'curse',
        amount: -1,
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 4 },
  },
  {
    id: 'crypt_leech',
    name: 'Crypt Leech',
    cost: 2,
    type: 'creature',
    tribe: 'undead',
    attack: 2,
    health: 4,
    text: 'Whenever this survives damage, heal your hero 1.',
    abilities: [
      {
        trigger: 'self_survives_damage',
        effect: 'heal',
        amount: 1,
        target: 'self_hero',
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 5 },
  },
  {
    id: 'grave_salt',
    name: 'Grave Salt',
    cost: 1,
    type: 'spell',
    text: 'Silence a unit. Draw a card.',
    abilities: [
      { trigger: 'on_play', effect: 'silence', target: 'chosen' },
      { trigger: 'on_play', effect: 'draw', amount: 1 },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 6 },
  },
  {
    id: 'iron_saint',
    name: 'Iron Saint',
    cost: 3,
    type: 'creature',
    tribe: 'knight',
    attack: 3,
    health: 6,
    text: 'Taunt. Friendly relics cost 1 less.',
    keywords: ['taunt'],
    abilities: [
      {
        trigger: 'cost_modifier',
        effect: 'cost_modifier',
        cardType: 'relic',
        amount: -1,
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 7 },
  },
  {
    id: 'widows_kiss',
    name: "Widow's Kiss",
    cost: 2,
    type: 'spell',
    text: 'Give a friendly Undead +2/+2 and Lifesteal this turn.',
    abilities: [
      {
        trigger: 'on_play',
        effect: 'buff_unit_grant_lifesteal',
        attack: 2,
        health: 2,
        target: 'chosen_friendly_undead',
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 8 },
  },
  {
    id: 'lantern_of_the_veil',
    name: 'Lantern of the Veil',
    cost: 3,
    type: 'relic',
    text: 'Whenever you summon a Spirit, give it +1/+0.',
    abilities: [
      {
        trigger: 'friendly_unit_played',
        condition: 'tribe:spirit',
        effect: 'buff_played_unit',
        attack: 1,
        health: 0,
      },
    ],
    sprite: { sheet: 'cards_sheet_02', index: 9 },
  },
];

/**
 * Token templates — units summoned by spells (e.g. Black Candle's Wraiths).
 * Tokens never go to deck/discard; they live only on the board.
 */
export const TOKENS = {
  wraith_token: {
    id: 'wraith_token',
    name: 'Wraith',
    type: 'creature',
    tribe: 'spirit',
    cost: 0,
    attack: 1,
    health: 1,
    text: 'Wraith.',
    abilities: [],
    sprite: null,
  },
};

export const CARD_INDEX = Object.fromEntries(CARDS.map((c) => [c.id, c]));
