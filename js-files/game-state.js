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

  // Resultado de cada evento no compasso atual
  // id -> PERFECT / GOOD / OK / MISS / WRONG
  eventResults: new Map(),

  score: 0,
  combo: 0,
  maxCombo: 0,
  barNumber: 1,

  // parâmetros iniciais para se avançar de nível
  nextlevel_score: 300,
  levelImprove: 100,

  // parâmetros para gameover
  missStreak: 0,
  maxMissStreak: 5,

  lastJudgement: "",
  judgementTimer: 0,

  // Clock musical
  barStartAudioTime: null,

  currentBeat: null,

  countdownStartAudioTime: null,
  countdownBeat: null,

  // Frame (frameCount) em que o "gameover" começou,
  // usado só para controlar o piscar do overlay.
  gameOverStartFrame: null
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
// GERAR EVENTOS DE UM COMPASSO
// ============================================================

function generateBarEvents({ allowNotesOnFirstBeat = true } = {}) {
  const config = getCurrentLevelConfig();

  const beats = generateBar(config, { allowNotesOnFirstBeat });

  // buildEvents() espera config.beats,
  // por isso criamos uma cópia temporária da configuração.
  const tempConfig = {
    ...config,
    beats
  };

  return buildEvents(tempConfig);
}


// ============================================================
// CONSTRUIR COMPASSO ATUAL + PREVIEW
// ============================================================

function buildCurrentLevel() {
  // O primeiro compasso do nível começa com um tempo vazio,
  // dando ao jogador tempo para ler a nova partitura.
  GAME.events = generateBarEvents({ allowNotesOnFirstBeat: false });
  GAME.nextEvents = generateBarEvents();
}


// ============================================================
// AVANÇAR PARA O COMPASSO SEGUINTE
// ============================================================

function advanceToNextBar() {
  // O preview passa a ser o compasso atual.
  GAME.events = GAME.nextEvents;

  // Gerar imediatamente um novo preview.
  GAME.nextEvents = generateBarEvents();
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

  GAME.nextlevel_score = 300;

  GAME.missStreak = 0;
  GAME.maxMissStreak = 5;

  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  GAME.barStartAudioTime = null;

  GAME.currentBeat = null;
  GAME.eventResults.clear();

  GAME.gameOverStartFrame = null;

  buildCurrentLevel();
}

// ============================================================
// MUDAR NÍVEL
// ============================================================


// by hand
function handChangeLevel(newLevel) {
  const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
  if (nextLevel === GAME.level) return;

  GAME.level = nextLevel;
  resetGame();
}

// automaticamente
function changeLevel() {

  if (GAME.score >= GAME.nextlevel_score) {

    // se já está no último nível — não há mais para onde subir
    if (GAME.level >= LEVEL_CONFIGS.length) return false;

    const newLevel = GAME.level + 1
    const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
    GAME.level = nextLevel;

    // sempre que se passa de nível é calculado numa nova pontuação necessária para avançar: 
    // o valor extra à pontuação necessária atual é multiplicado pelo best combo do jogador
    // quanto melhor for o jogador, mais difícil o jogo se torna, 
    // pois precisa de maior pontuação para avançar no nível seguinte
    GAME.nextlevel_score = GAME.nextlevel_score + GAME.levelImprove * floor(GAME.maxCombo / 2)


    // sempre que se passa de nível o nº máximo de falhas sucessivas para perder aumenta vezes 
    // para se perder aumenta um, até um máximo de 10
    // e o missStreak faz reset

    if (GAME.maxMissStreak !== 10) {
      GAME.maxMissStreak++
    }

    GAME.missStreak = 0

    console.log(`Level ${GAME.level}. Reach a score of ${GAME.nextlevel_score} to advance.`)

    GAME.state = "nextlevel"

    // Copiado do startCountdown() 
    GAME.countdownStartAudioTime = audioCtx.currentTime
    GAME.countdownBeat = null
    GAME.ballPosition = 0
    GAME.combo = 0

    return true;
  }

  return false;
}
