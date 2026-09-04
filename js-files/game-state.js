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

  // parâmetros iniciais para se avançar de nível
  nextlevel_score: 15,
  nextlevel_combo: 3,

  // parâmetros para gameover
  missStreak: 0,
  maxMissStreak: 5,

  lastJudgement: "",
  judgementTimer: 0,

  // Clock musical
  barStartAudioTime: null,
  pausedElapsedSeconds: 0,

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

  GAME.nextlevel_score = 15;
  GAME.nextlevel_combo = 3;

  GAME.missStreak = 0;
  GAME.maxMissStreak = 5;

  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  GAME.barStartAudioTime = null;
  GAME.pausedElapsedSeconds = 0;

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

  if (GAME.score >= GAME.nextlevel_score && GAME.combo >= GAME.nextlevel_combo) {

    // se já está no último nível — não há mais para onde subir
    if (GAME.level >= LEVEL_CONFIGS.length) return;

    const newLevel = GAME.level + 1
    const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
    GAME.level = nextLevel;

    // sempre que se passa de nível é calculado numa nova pontuação e um novo combo para avançar
    // a pontuação necessária duplica em relação à pontuação atual do jogador
    // quanto melhor for o jogador, ou seja, passar de nível com uma pontuação mais alta, 
    // mais difícil o jogo se torna, pois precisa de maior pontuação para avançar no nível seguinte
    GAME.nextlevel_score = GAME.score * 2
    GAME.nextlevel_combo++


    // sempre que se passa de nível o nº máximo de falhas sucessivas para perder aumenta vezes 
    // para se perder aumenta um, até um máximo de 10
    // e o missStreak faz reset

    if (GAME.maxMissStreak !== 10) {
      GAME.maxMissStreak++
    }

    GAME.missStreak = 0


    console.log(`next level, yay! Go to level ${GAME.nextLevel} now you need to reach a score of ${GAME.nextlevel_score} and a como of x${GAME.nextlevel_combo}... GO!`)

    GAME.state = "nextlevel"
    // Copiado do startCountdown() 
    GAME.countdownStartAudioTime = audioCtx.currentTime
    GAME.countdownBeat = null
    GAME.ballPosition = 0
    GAME.combo = 0
    //resetGame();
  }
}