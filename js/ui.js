import { CONFIG } from './config.js';
import { effectiveCost } from './abilities.js';

const $ = (id) => document.getElementById(id);

const SHEET_COLS = 5;
const SHEET_ROWS = 2;

const _sheetCache = new Map(); // sheet name -> 'available' | 'missing' | 'loading'

function ensureSheet(sheetName) {
  if (!sheetName) return;
  if (_sheetCache.has(sheetName)) return;
  _sheetCache.set(sheetName, 'loading');
  const img = new Image();
  img.onload = () => _sheetCache.set(sheetName, 'available');
  img.onerror = () => _sheetCache.set(sheetName, 'missing');
  img.src = `assets/${sheetName}.png`;
}

/**
 * Build CSS that crops the sprite-sheet down to one card cell. Uses the
 * percentage-grid trick: with background-size = (cols*100%, rows*100%) the
 * background image becomes (cols x rows) viewports tall/wide, and
 * background-position 0..100% snaps to each cell.
 */
function spriteBackground(sprite) {
  if (!sprite || !sprite.sheet) return null;
  ensureSheet(sprite.sheet);
  const idx = sprite.index || 0;
  const col = idx % SHEET_COLS;
  const row = Math.floor(idx / SHEET_COLS);
  const xPct = (col / Math.max(1, SHEET_COLS - 1)) * 100;
  const yPct = (row / Math.max(1, SHEET_ROWS - 1)) * 100;
  return {
    backgroundImage: `url('assets/${sprite.sheet}.png')`,
    backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    backgroundRepeat: 'no-repeat',
  };
}

function applyBg(el, bg) {
  if (!bg) return;
  el.style.backgroundImage = bg.backgroundImage;
  el.style.backgroundSize = bg.backgroundSize;
  el.style.backgroundPosition = bg.backgroundPosition;
  el.style.backgroundRepeat = bg.backgroundRepeat;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function cardElement(state, card, opts = {}) {
  const div = document.createElement('div');
  div.className =
    `card ${card.type}` +
    (opts.unplayable ? ' unplayable' : '') +
    (opts.selected ? ' selected' : '');
  div.dataset.handIndex = opts.handIndex;
  div.title = `${card.name}\nCost ${card.cost}\n${card.text || ''}`;

  applyBg(div, spriteBackground(card.sprite));

  // Show modified cost badge if the effective cost differs from the printed
  // cost (Ashen Choir / Iron Saint discounts).
  const eff = effectiveCost(state, 'player', card);
  if (eff !== (card.cost || 0)) {
    const badge = document.createElement('div');
    badge.className = 'cost-mod';
    badge.textContent = String(eff);
    badge.title = `Discounted cost: ${eff} (was ${card.cost})`;
    div.appendChild(badge);
  }

  return div;
}

function unitElement(unit, sideClass, opts = {}) {
  const div = document.createElement('div');
  const kw = (unit.keywords || []);
  div.className =
    `unit ${sideClass}` +
    (unit.exhausted ? ' exhausted' : '') +
    (kw.includes('taunt') ? ' taunt' : '') +
    (kw.includes('fleeting') ? ' fleeting' : '') +
    (opts.targetable ? ' targetable' : '');
  div.dataset.instanceId = unit.instanceId;

  applyBg(div, spriteBackground(unit.sprite));

  // Stats overlay — current ATK/HP can drift from printed values via buffs
  // and damage, so we show them on top.
  const damaged = unit.health < unit.maxHealth;
  const stats = document.createElement('div');
  stats.className = 'unit-stats-overlay';
  stats.innerHTML =
    `<span class="atk">${unit.attack}</span>` +
    `<span class="hp${damaged ? ' damaged' : ''}">${unit.health}</span>`;
  div.appendChild(stats);

  if (kw.length) {
    const k = document.createElement('div');
    k.className = 'unit-keywords-overlay';
    k.innerHTML = kw.map((w) => `<span>${w[0].toUpperCase()}</span>`).join('');
    k.title = kw.join(', ');
    div.appendChild(k);
  }

  // For tokens that have no sprite, fall back to a small label.
  if (!unit.sprite) {
    const label = document.createElement('div');
    label.className = 'unit-fallback-label';
    label.textContent = unit.name;
    div.appendChild(label);
  }

  return div;
}

function relicElement(relic) {
  const d = document.createElement('div');
  d.className = 'relic';
  d.title = `${relic.name}\n\n${relic.text || ''}`;
  applyBg(d, spriteBackground(relic.sprite));
  if (!relic.sprite) {
    const initials = relic.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    d.textContent = initials;
  }
  return d;
}

/**
 * Full re-render. `selection` describes the player's current click state:
 *   { selectedHandIndex, validLanes, targetableUnits, heroTargetSides }
 */
export function render(state, selection = {}) {
  const sel = {
    selectedHandIndex: null,
    validLanes: new Set(),
    targetableUnits: new Set(),
    heroTargetSides: new Set(),
    ...selection,
  };

  // Hero stats
  $('player-health').textContent = Math.max(0, state.player.health);
  $('player-max-health').textContent = state.player.maxHealth;
  $('player-mana').textContent = state.player.mana;
  $('player-max-mana').textContent = state.player.maxMana;
  $('player-deck-count').textContent = state.player.deck.length;
  $('player-discard-count').textContent = state.player.discardPile.length;

  $('enemy-health').textContent = Math.max(0, state.enemy.health);
  $('enemy-max-health').textContent = state.enemy.maxHealth;
  $('enemy-mana').textContent = state.enemy.mana;
  $('enemy-max-mana').textContent = state.enemy.maxMana;
  $('enemy-hand-count').textContent = state.enemy.hand.length;
  $('enemy-deck-count').textContent = state.enemy.deck.length;

  // Hero target highlights
  $('enemy-area').classList.toggle('targetable', sel.heroTargetSides.has('enemy'));
  $('player-area').classList.toggle('targetable', sel.heroTargetSides.has('player'));

  // Battlefield
  for (const lane of CONFIG.LANES) {
    const enemyLaneEl = document.querySelector(`#enemy-battlefield .lane[data-lane="${lane}"]`);
    const playerLaneEl = document.querySelector(`#player-battlefield .lane[data-lane="${lane}"]`);

    const enemyUnitsEl = enemyLaneEl.querySelector('.lane-units');
    const playerUnitsEl = playerLaneEl.querySelector('.lane-units');
    enemyUnitsEl.innerHTML = '';
    playerUnitsEl.innerHTML = '';

    for (const u of state.enemy.battlefield[lane]) {
      enemyUnitsEl.appendChild(unitElement(u, 'enemy-unit', {
        targetable: sel.targetableUnits.has(u.instanceId),
      }));
    }
    for (const u of state.player.battlefield[lane]) {
      playerUnitsEl.appendChild(unitElement(u, 'player-unit', {
        targetable: sel.targetableUnits.has(u.instanceId),
      }));
    }

    enemyLaneEl.classList.remove('lane-valid');
    playerLaneEl.classList.toggle('lane-valid', sel.validLanes.has(lane));
  }

  // Relics
  const playerRelicsEl = $('player-relics');
  const enemyRelicsEl = $('enemy-relics');
  playerRelicsEl.innerHTML = '';
  enemyRelicsEl.innerHTML = '';
  for (const r of state.player.relics) playerRelicsEl.appendChild(relicElement(r));
  for (const r of state.enemy.relics) enemyRelicsEl.appendChild(relicElement(r));

  // Hand
  const handEl = $('player-hand');
  handEl.innerHTML = '';
  state.player.hand.forEach((card, i) => {
    const isMine = state.turn === 'player' && !state.gameOver;
    const playable = isMine && effectiveCost(state, 'player', card) <= state.player.mana && !state.aiThinking;
    handEl.appendChild(cardElement(state, card, {
      handIndex: i,
      unplayable: !playable,
      selected: sel.selectedHandIndex === i,
    }));
  });

  // End turn button
  $('end-turn-button').disabled =
    state.turn !== 'player' || state.gameOver || state.aiThinking;

  renderLog(state);
}

function renderLog(state) {
  const ul = $('log-list');
  ul.innerHTML = '';
  const last = state.log.slice(-60);
  for (const entry of last) {
    const li = document.createElement('li');
    li.className = `log-${entry.kind}`;
    li.textContent = entry.message;
    ul.appendChild(li);
  }
  ul.scrollTop = ul.scrollHeight;
}

export function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(id).classList.add('active');
}

export function showGameOver(state) {
  const modal = $('game-over');
  const title = $('game-over-title');
  const msg = $('game-over-message');
  modal.classList.remove('hidden');
  if (state.winner === 'player') {
    title.textContent = 'Victory';
    title.classList.remove('lose');
    msg.textContent = 'The Lich crumbles to dust. You have prevailed.';
  } else if (state.winner === 'enemy') {
    title.textContent = 'Defeat';
    title.classList.add('lose');
    msg.textContent = 'Your soul joins the dread chorus.';
  } else {
    title.textContent = 'Draw';
    title.classList.remove('lose');
    msg.textContent = 'Both heroes fall together.';
  }
}

export function hideGameOver() {
  $('game-over').classList.add('hidden');
}
