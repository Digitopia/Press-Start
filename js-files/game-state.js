// ============================================================
// ESTADO DO JOGO
// ============================================================

const GAME = {
  state: "ready",
  level: 1,

  ballPosition: 0,
  ballDiameter: 13,

  // Eventos musicais construídos a partir do compasso atual
  events: [],

  // Pontos usados para desenhar o percurso
  pathPoints: [],

  // Resultado de cada evento no compasso atual
  // id -> PERFECT / GOOD / OK / MISS / WRONG
  eventResults: new Map(),

  score: 0,
  combo: 0,
  maxCombo: 0,
  barNumber: 1,

  lastJudgement: "",
  judgementTimer: 0,

  // Clock musical
  barStartAudioTime: null,
  pausedElapsedSeconds: 0,

  currentBeat: null
};


// ============================================================
// NÍVEL ATUAL
// ============================================================

function getCurrentLevelConfig() {
  return LEVEL_CONFIGS[GAME.level - 1];
}

function getBarDurationMs() {
  return getCurrentLevelConfig().crossingDurationMs;
}

// ============================================================
// CONSTRUIR NÍVEL / GERAR UM NOVO COMPASSO
//
// Chamada tanto no arranque do jogo como no fim de cada
// compasso, para que o conteúdo seja sempre diferente.
// ============================================================

function buildCurrentLevel() {
  const config = getCurrentLevelConfig();
  config.beats = generateBar(config);
  GAME.events = buildEvents(config);
  GAME.pathPoints = buildPath(GAME.events);
}

// ============================================================
// RESET
// ============================================================

function resetGame() {
  GAME.state = "ready";
  GAME.ballPosition = 0;

  GAME.score = 0;
  GAME.combo = 0;
  GAME.maxCombo = 0;
  GAME.barNumber = 1;

  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  GAME.barStartAudioTime = null;
  GAME.pausedElapsedSeconds = 0;

  GAME.currentBeat = null;
  GAME.eventResults.clear();

  buildCurrentLevel();
}

// ============================================================
// MUDAR NÍVEL
// ============================================================

function changeLevel(newLevel) {
  const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
  if (nextLevel === GAME.level) return;

  GAME.level = nextLevel;
  resetGame();
}