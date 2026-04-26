import { CONFIG } from './config.js';

function push(state, kind, message) {
  if (!state || !state.log) return;
  state.log.push({ kind, message, turn: state.turnNumber });
  if (state.log.length > CONFIG.MAX_LOG_ENTRIES) {
    state.log.splice(0, state.log.length - CONFIG.MAX_LOG_ENTRIES);
  }
}

export function logPlayer(state, msg)  { push(state, 'player',  msg); }
export function logEnemy(state, msg)   { push(state, 'enemy',   msg); }
export function logSystem(state, msg)  { push(state, 'system',  msg); }
export function logCombat(state, msg)  { push(state, 'combat',  msg); }
export function logDeath(state, msg)   { push(state, 'death',   msg); }

export function logForSide(state, side, msg) {
  push(state, side === 'player' ? 'player' : 'enemy', msg);
}
