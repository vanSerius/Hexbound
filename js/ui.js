import { CONFIG } from './config.js';

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

function spriteStyle(sprite) {
  if (!sprite) return '';
  ensureSheet(sprite.sheet);
  if (_sheetCache.get(sprite.sheet) !== 'available') return '';
  const idx = sprite.index || 0;
  const col = idx % SHEET_COLS;
  const row = Math.floor(idx / SHEET_COLS);
  // background-size: each cell at (100%/cols, 100%/rows). position: cell index.
  return `background-image:url('assets/${sprite.sheet}.png');` +
         `background-size:${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%;` +
         `background-position:${(col / (SHEET_COLS - 1)) * 100}% ${(row / (SHEET_ROWS - 1 || 1)) * 100}%;` +
         `background-repeat:no-repeat;`;
}

function placeholderArt(card) {
  // Different styling per type for a quick visual cue.
  const tribe = card.tribe || card.type || '';
  return tribe.toUpperCase();
}

function cardElement(card, opts = {}) {
  const div = document.createElement('div');
  div.className = `card ${card.type}` + (opts.unplayable ? ' unplayable' : '') + (opts.selected ? ' selected' : '');
  div.dataset.handIndex = opts.handIndex;
  div.innerHTML = `
    <div class="cost">${card.cost}</div>
    <div class="name" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</div>
    <div class="art" style="${spriteStyle(card.sprite)}">
      ${spriteStyle(card.sprite) ? '' : escapeHtml(placeholderArt(card))}
    </div>
    <div class="typeline">${cardTypeLine(card)}</div>
    <div class="text-box">${escapeHtml(card.text || '')}</div>
    ${card.type === 'creature'
      ? `<div class="stats-line"><span class="atk">${card.attack}</span><span class="hp">${card.health}</span></div>`
      : ''}
  `;
  return div;
}

function cardTypeLine(card) {
  if (card.type === 'creature') return `Creature${card.tribe ? ' — ' + capitalize(card.tribe) : ''}`;
  if (card.type === 'spell')    return 'Spell';
  if (card.type === 'curse')    return 'Curse';
  if (card.type === 'relic')    return 'Relic';
  return '';
}

function unitElement(unit, sideClass, opts = {}) {
  const div = document.createElement('div');
  const kw = (unit.keywords || []);
  div.className = `unit ${sideClass}` +
    (unit.exhausted ? ' exhausted' : '') +
    (kw.includes('taunt') ? ' taunt' : '') +
    (kw.includes('fleeting') ? ' fleeting' : '') +
    (opts.targetable ? ' targetable' : '');
  div.dataset.instanceId = unit.instanceId;
  const damaged = unit.health < unit.maxHealth;
  div.innerHTML = `
    <div class="unit-name" title="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</div>
    <div class="unit-art" style="${spriteStyle(unit.sprite)}">
      ${spriteStyle(unit.sprite) ? '' : escapeHtml(unit.tribe ? unit.tribe.toUpperCase() : '')}
    </div>
    <div class="unit-stats"><span class="atk">${unit.attack}</span><span class="hp ${damaged ? 'damaged' : ''}">${unit.health}</span></div>
    ${kw.length ? `<div class="keywords">${kw.map((k) => `<span>${k.toUpperCase()}</span>`).join('')}</div>` : ''}
  `;
  return div;
}

function relicElement(relic) {
  const d = document.createElement('div');
  d.className = 'relic';
  d.title = `${relic.name}\n\n${relic.text || ''}`;
  // Two-letter abbreviation as glyph.
  const initials = relic.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  d.textContent = initials;
  return d;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/**
 * Full re-render. `selection` describes the player's current click state:
 *   { selectedHandIndex, validLanes: Set<lane>, targetableUnits: Set<instanceId>, heroTargetSides: Set<side> }
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
  const enemyHero = $('enemy-area');
  const playerHero = $('player-area');
  enemyHero.classList.toggle('targetable', sel.heroTargetSides.has('enemy'));
  playerHero.classList.toggle('targetable', sel.heroTargetSides.has('player'));

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
    const playable = isMine && card.cost <= state.player.mana && !state.aiThinking;
    const el = cardElement(card, {
      handIndex: i,
      unplayable: !playable,
      selected: sel.selectedHandIndex === i,
    });
    handEl.appendChild(el);
  });

  // End turn button
  const endBtn = $('end-turn-button');
  endBtn.disabled = state.turn !== 'player' || state.gameOver || state.aiThinking;

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
