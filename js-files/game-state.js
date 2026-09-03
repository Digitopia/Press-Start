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

  // Eventos musicais do compasso seguinte,
  // usados apenas para PREVIEW.
  nextEvents: [],

  // Pontos usados para desenhar o percurso
  pathPoints: [],

  // Percurso do compasso seguinte.
  nextPathPoints: [],

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
// GERAR DADOS DE UM COMPASSO
// ============================================================

function generateBarData() {
  const config = getCurrentLevelConfig();

  const beats = generateBar(config);

  // buildEvents() espera config.beats,
  // por isso criamos uma cópia temporária da configuração.
  const tempConfig = {
    ...config,
    beats
  };

  const events = buildEvents(tempConfig);
  const pathPoints = buildPath(events);

  return {
    beats,
    events,
    pathPoints
  };
}


// ============================================================
// CONSTRUIR COMPASSO ATUAL + PREVIEW
// ============================================================

function buildCurrentLevel() {
  const current = generateBarData();
  const next = generateBarData();

  GAME.events = current.events;
  GAME.pathPoints = current.pathPoints;

  GAME.nextEvents = next.events;
  GAME.nextPathPoints = next.pathPoints;
}


// ============================================================
// AVANÇAR PARA O COMPASSO SEGUINTE
// ============================================================

function advanceToNextBar() {
  // O preview passa a ser o compasso atual.
  GAME.events = GAME.nextEvents;
  GAME.pathPoints = GAME.nextPathPoints;

  // Gerar imediatamente um novo preview.
  const next = generateBarData();

  GAME.nextEvents = next.events;
  GAME.nextPathPoints = next.pathPoints;
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