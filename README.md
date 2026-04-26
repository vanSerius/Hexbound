# HEXBOUND

A dark fantasy 3-lane card battler MVP. Plain HTML / CSS / Vanilla JS — no build step.

## Run locally

ES modules need to be served over HTTP, so just opening `index.html` from disk won't
work. Easiest options:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push the branch to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Pick the branch (e.g. `main`) and folder `/ (root)`.
5. Wait ~1 min, then visit `https://<user>.github.io/<repo>/`.

The `.nojekyll` file at the repo root tells GitHub Pages **not** to run Jekyll, so
the `js/` folder is served as-is.

## How to play

- Both heroes start at 30 HP, 1 mana, and 4 cards in hand. Mana cap rises by 1 each
  turn up to 7.
- Click a card in your hand to select it.
  - **Creatures** highlight your battlefield lanes — click a lane to drop them in
    (max 3 per lane).
  - **Spells / Curses** highlight valid targets — click a unit or hero portrait, or
    click anywhere on your side if no target is required.
  - **Relics** play directly into your relic zone (max 5).
- Click **End Turn** to resolve combat. Each lane's frontmost units fight; if your
  side is empty in a lane, the enemy unit hits your hero (and vice versa).

### Keywords

| Keyword     | Meaning                                                        |
|-------------|----------------------------------------------------------------|
| On Play     | Triggers when the card is played from hand.                    |
| On Death    | Triggers when this unit dies.                                  |
| Rush        | This unit attacks once immediately when played.                |
| Fleeting    | Dies at the end of its controller's turn.                      |
| Taunt       | Enemy units in this lane must attack this unit first.          |
| Lifesteal   | Damage dealt by this unit heals its hero by the same amount.   |
| Exhaust     | Cannot attack during its next combat phase.                    |
| Silence     | Removes all abilities, buffs, and keywords from a unit.        |

## Cards

The 20 final cards are wired up in `js/cards.js`, sliced from the two
`assets/cards_sheet_*.png` sprite sheets (5 cols × 2 rows each).

| Sheet 1               | Sheet 2                |
|-----------------------|------------------------|
| Bone Widow            | Cathedral Giant        |
| Ash Hound             | Rot Banner             |
| Bone Cultist          | Moonlit Hex            |
| Gravebound Acolyte    | Wraithling             |
| Withered Prophet      | Ashen Choir            |
| Ritual Flame          | Crypt Leech            |
| Blood Pact            | Grave Salt             |
| Black Candle          | Iron Saint             |
| Crown of Salt         | Widow's Kiss           |
| Mirror Shard          | Lantern of the Veil    |

### Adding or changing cards

The engine is data-driven. To add a new card, just append to `CARDS` in
`js/cards.js`:

```js
{
  id: 'my_unit',
  name: 'My Unit',
  cost: 3,
  type: 'creature',                // 'creature' | 'spell' | 'relic' | 'curse'
  tribe: 'undead',
  attack: 3,
  health: 3,
  text: 'Card text shown to the player.',
  keywords: ['rush'],              // rush, taunt, lifesteal, fleeting
  restrictLane: 'center',          // optional, creature can only land here
  abilities: [
    { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'enemy_hero' }
  ],
  sprite: { sheet: 'cards_sheet_01', index: 0 },
}
```

Triggers supported by the trigger bus: `on_play`, `on_death`, `turn_start`,
`turn_end`, `friendly_unit_dies` (with optional `condition: 'another'`),
`unit_dies`, `self_survives_damage`, `friendly_unit_played` (with optional
`condition: 'tribe:<name>'`), `aura`, `cost_modifier`.

Effect handlers in `js/abilities.js` (extend by adding a new key to
`effectHandlers`): `deal_damage`, `deal_damage_draw_if_killed`, `heal`, `draw`,
`gain_stats`, `buff_unit`, `buff_unit_grant_lifesteal`, `buff_played_unit`,
`debuff_unit`, `temp_debuff_unit`, `silence`, `destroy_friendly_unit`,
`summon_token`, `exhaust_enemy_unit_low_power`, `gain_mana_next_turn`,
`aura_attack`, `aura_health`, `cost_modifier`.

## Project structure

```
index.html
.nojekyll
css/styles.css
assets/
  arena.png               # battlefield backdrop
  cards_sheet_01.png      # cards 1–10
  cards_sheet_02.png      # cards 11–20
js/
  main.js                 # bootstrap + screen switching
  config.js               # constants
  cards.js                # card + token definitions
  state.js                # state factories, instance helpers
  deck.js                 # shuffle / draw / reshuffle
  log.js                  # game log
  abilities.js            # trigger bus, effect handlers, cost modifiers, auras
  keywords.js             # Rush / Fleeting / Taunt / Lifesteal / Exhaust / Silence
  combat.js               # lane combat resolution
  engine.js               # turn flow, playCard, restrictLane, mirror echo
  ai.js                   # random-valid-move enemy
  ui.js                   # DOM render with sprite-sheet slicing
  targeting.js            # click flow: card → lane / target
```
