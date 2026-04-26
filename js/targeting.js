import { CONFIG } from './config.js';
import { canPlayCard, playCard, getTargetingRequirement } from './engine.js';
import { unitsForSide } from './state.js';
import { render } from './ui.js';

/**
 * Click-state machine for the player's hand.
 *
 *   selectedHandIndex == null           → clicking a hand card selects it
 *   selectedHandIndex != null && card is creature
 *       → highlight free lanes; clicking a lane plays it; clicking another
 *         hand card or outside cancels
 *   selectedHandIndex != null && card needs target
 *       → highlight valid units/heroes; clicking one plays the card
 *   selectedHandIndex != null && card has no constraints (e.g. relic)
 *       → played immediately on selection
 */
export function createTargeting(getState, onAfterPlay) {
  let selectedHandIndex = null;

  function clearAndRender() {
    selectedHandIndex = null;
    refresh();
  }

  function refresh() {
    const state = getState();
    if (selectedHandIndex == null) {
      render(state, {});
      return;
    }
    const card = state.player.hand[selectedHandIndex];
    if (!card) {
      selectedHandIndex = null;
      render(state, {});
      return;
    }
    if (card.type === 'creature') {
      const validLanes = new Set(
        CONFIG.LANES.filter((lane) => state.player.battlefield[lane].length < CONFIG.MAX_LANE_UNITS),
      );
      render(state, { selectedHandIndex, validLanes });
      return;
    }
    const req = getTargetingRequirement(card);
    if (req && req.kind === 'any') {
      const targetableUnits = new Set(
        [...unitsForSide(state, 'player'), ...unitsForSide(state, 'enemy')].map((u) => u.instanceId),
      );
      const heroTargetSides = new Set(['player', 'enemy']);
      render(state, { selectedHandIndex, targetableUnits, heroTargetSides });
      return;
    }
    // No targeting needed (relic, no-target spell): no highlights, just selection.
    render(state, { selectedHandIndex });
  }

  function tryPlayWithTarget(target) {
    const state = getState();
    if (selectedHandIndex == null) return;
    const ok = playCard(state, 'player', selectedHandIndex, { target });
    selectedHandIndex = null;
    if (ok) onAfterPlay();
    else refresh();
  }

  function tryPlayInLane(lane) {
    const state = getState();
    if (selectedHandIndex == null) return;
    const ok = playCard(state, 'player', selectedHandIndex, { lane });
    selectedHandIndex = null;
    if (ok) onAfterPlay();
    else refresh();
  }

  function selectHandCard(handIndex) {
    const state = getState();
    if (state.turn !== 'player' || state.gameOver || state.aiThinking) return;
    if (!canPlayCard(state, 'player', handIndex)) return;
    const card = state.player.hand[handIndex];
    selectedHandIndex = handIndex;
    if (card.type === 'relic' && !getTargetingRequirement(card)) {
      // Relics with no chosen target play immediately.
      tryPlayWithTarget(null);
      return;
    }
    if ((card.type === 'spell' || card.type === 'curse') && !getTargetingRequirement(card)) {
      // Spells/curses with no target requirement play immediately.
      tryPlayWithTarget(null);
      return;
    }
    refresh();
  }

  function bind() {
    document.addEventListener('click', (ev) => {
      const state = getState();
      // Hand card click
      const cardEl = ev.target.closest('.card[data-hand-index]');
      if (cardEl) {
        const idx = Number(cardEl.dataset.handIndex);
        selectHandCard(idx);
        ev.stopPropagation();
        return;
      }
      if (selectedHandIndex == null) return;

      const card = state.player.hand[selectedHandIndex];
      if (!card) { clearAndRender(); return; }

      // Lane click (only player's own lanes)
      const laneEl = ev.target.closest('#player-battlefield .lane');
      if (laneEl && card.type === 'creature') {
        const lane = laneEl.dataset.lane;
        tryPlayInLane(lane);
        return;
      }

      // Unit click (any side)
      const unitEl = ev.target.closest('.unit[data-instance-id]');
      if (unitEl && getTargetingRequirement(card)) {
        const instanceId = unitEl.dataset.instanceId;
        tryPlayWithTarget({ kind: 'unit', instanceId });
        return;
      }

      // Hero portrait click (target the hero)
      const heroEl = ev.target.closest('.hero-area');
      if (heroEl && getTargetingRequirement(card)) {
        const side = heroEl.classList.contains('player') ? 'player' : 'enemy';
        tryPlayWithTarget({ kind: 'hero', side });
        return;
      }

      // Click anywhere else cancels
      clearAndRender();
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') clearAndRender();
    });
  }

  return { bind, refresh, clear: clearAndRender };
}
