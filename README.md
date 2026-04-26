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

## Adding cards

The engine is data-driven. To add new cards, just edit `js/cards.js`:

```js
{
  id: 'my_unit',
  name: 'My Unit',
  cost: 3,
  type: 'creature',         // 'creature' | 'spell' | 'relic' | 'curse'
  tribe: 'undead',
  attack: 3,
  health: 3,
  text: 'Card text shown to the player.',
  keywords: ['rush'],       // optional: rush, taunt, lifesteal, fleeting
  abilities: [
    { trigger: 'on_play', effect: 'deal_damage', amount: 2, target: 'enemy_hero' }
  ],
  sprite: { sheet: 'cards_sheet_01', index: 0 }, // optional
}
```

If a sprite sheet PNG exists under `assets/<sheet>.png`, the engine will slice it as
5 columns × 2 rows automatically. If not, the card renders with the CSS placeholder
art — the game still works.

## Project structure

```
index.html
.nojekyll
css/styles.css
assets/                # sprite sheets go here later
js/
  main.js              # bootstrap + screen switching
  config.js            # constants
  cards.js             # card definitions (replace with your 20 cards)
  state.js             # state factories
  deck.js              # shuffle / draw / reshuffle
  log.js               # game log
  abilities.js         # trigger bus + effect handlers
  keywords.js          # Rush / Fleeting / Taunt / Lifesteal / Exhaust / Silence
  combat.js            # lane combat resolution
  engine.js            # turn flow + playCard
  ai.js                # random-valid-move enemy
  ui.js                # DOM render
  targeting.js         # click flow: card → lane / target
```
