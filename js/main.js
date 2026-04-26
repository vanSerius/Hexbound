import { CONFIG } from './config.js';
import { createInitialState } from './state.js';
import { buildDeck, drawCard } from './deck.js';
import { startTurn, endTurn, checkGameOver } from './engine.js';
import { aiPlayOne, aiEndTurn } from './ai.js';
import { render, showScreen, showGameOver, hideGameOver } from './ui.js';
import { createTargeting } from './targeting.js';
import { logSystem } from './log.js';

let state = null;
let targeting = null;

function startNewGame() {
  state = createInitialState();
  state.player.deck = buildDeck();
  state.enemy.deck = buildDeck();
  drawCard(state, 'player', CONFIG.STARTING_HAND);
  drawCard(state, 'enemy', CONFIG.STARTING_HAND);
  logSystem(state, 'The pact begins.');
  // First turn: player. We invoke startTurn to draw + log the turn header.
  startTurn(state, 'player');
  hideGameOver();
  showScreen('game-screen');
  if (!targeting) {
    targeting = createTargeting(() => state, afterAction);
    targeting.bind();
  }
  targeting.refresh();
}

function afterAction() {
  // Re-render and check end conditions after any player action.
  render(state, {});
  if (state.gameOver) {
    showGameOver(state);
  }
}

async function runEnemyTurn() {
  if (state.gameOver) return;
  state.aiThinking = true;
  render(state, {});
  await sleep(CONFIG.AI_TURN_DELAY_MS);
  // Loop: play one card, render, sleep, repeat.
  // (startTurn for the enemy was already done when the player ended their turn
  // — endTurn handles the side hand-off.)
  while (!state.gameOver) {
    const played = aiPlayOne(state);
    render(state, {});
    if (state.gameOver) break;
    if (!played) break;
    await sleep(CONFIG.AI_BETWEEN_PLAYS_MS);
  }
  if (state.gameOver) {
    state.aiThinking = false;
    afterAction();
    return;
  }
  await sleep(CONFIG.AI_TURN_DELAY_MS);
  aiEndTurn(state);
  state.aiThinking = false;
  afterAction();
}

function onPlayerEndTurn() {
  if (!state || state.turn !== 'player' || state.gameOver || state.aiThinking) return;
  endTurn(state, 'player');
  if (state.gameOver) {
    afterAction();
    return;
  }
  // endTurn already called startTurn for the enemy. Now run AI plays + AI endTurn.
  afterAction();
  runEnemyTurn();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function bindGlobalControls() {
  document.getElementById('start-button').addEventListener('click', startNewGame);
  document.getElementById('restart-button').addEventListener('click', startNewGame);
  document.getElementById('end-turn-button').addEventListener('click', onPlayerEndTurn);
}

bindGlobalControls();
