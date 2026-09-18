// ============================================================
// ESTADO DO JOGO
// ============================================================

const GAME = {
  state: "standby",
  level: 1,

  ballPosition: 0,
  ballDiameter: 13,

  // Eventos musicais construídos a partir do compasso atual
  events: [],

  // Eventos do compasso seguinte (preview)
  nextEvents: [],

  // Lado do compasso ativo; alterna a cada compasso.
  activeSide: "left",

  // Resultado de cada evento no compasso atual
  // id -> PERFECT / GOOD / OK / MISS / WRONG
  eventResults: new Map(),

  // Batida antecipada numa nota do compasso seguinte (a que está
  // em t = 0 tem a primeira metade da janela ainda neste
  // compasso). Guarda-se aqui e aplica-se na viragem, porque os
  // ids são posicionais e eventResults é limpo ao fim do compasso.
  // { id, result }
  pendingEarlyResult: null,

  score: 0,

  // Pontos da tentativa atual; volta a zero ao perder uma vida.
  levelScore: 0,

  combo: 0,
  maxCombo: 0,
  barNumber: 1,

  // Calculado por getLevelTargetScore(); valor provisório.
  levelTargetScore: 300,

  // ----------------------------------------------------------
  // VIDA
  //
  // health a 0 gasta uma vida; sem vidas -> gameover.
  // Valores provisórios, repostos por resetGame() via HEALTH.
  // ----------------------------------------------------------
  health: 100,
  lives: 3,
  maxLives: 3,

  // Instante da última vida perdida (zoom do overlay).
  lifeLostAudioTime: null,

  // Compasso do nível novo à espera do corte para preto.
  nextLevelBarsPending: false,

  // Instante em que a transição de nível começou (fade).
  nextLevelAudioTime: null,

  lastJudgement: "",
  judgementTimer: 0,

  // Clock musical
  barStartAudioTime: null,

  // countdownBeat serve só para o número desenhado.
  countdownStartAudioTime: null,
  countdownBeat: null,

  // Frame de início do gameover (piscar do overlay).
  gameOverStartFrame: null,

  // Frame de início do wipe de saída do standby; null à espera.
  standbyExitStartFrame: null,

  // Frame de início do wipe do game over. Não é reposto no
  // reset, para o wipe acabar por cima do standby.
  gameOverExitStartFrame: null,

  // Evita chamar resetGame() mais de uma vez por saída.
  gameOverExitPending: false
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
// ALVO DO NÍVEL
//
// Pontos de barsToClearLevel compassos todos em PERFECT.
// Em GOOD também se passa, só demora mais uns compassos.
// ============================================================

function getLevelTargetScore(level) {
  const config = LEVEL_CONFIGS[level - 1];

  const notes = config.minNotesPerBar * SCORING.barsToClearLevel;

  return notes * JUDGEMENT_POINTS.PERFECT * SCORING.maxComboMultiplier;
}

// ============================================================
// FEEDBACK DE JULGAMENTO
//
// judgementTimer só corre em "playing", por isso um julgamento
// apanhado por uma transição ficaria no ecrã e voltaria a
// aparecer ao retomar. Limpa-se ao sair do jogo.
// ============================================================

function clearJudgement() {
  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;
}

// ============================================================
// VIDA / HEALTH
// ============================================================

function healPlayer(amount) {
  if (GAME.state === "gameover") return;

  GAME.health = min(HEALTH.max, GAME.health + amount);
}

function damagePlayer(amount) {
  if (GAME.state === "gameover") return;

  GAME.health = max(0, GAME.health - amount);

  if (GAME.health <= 0) {
    loseLife();
  }
}

// A barra chegou a zero: gasta-se uma vida.
function loseLife() {
  stopMusicTransport();

  GAME.lives--;
  GAME.lifeLostAudioTime = audioCtx.currentTime;
  GAME.combo = 0;
  GAME.levelScore = 0;

  // Já não há vidas — fim de jogo.
  if (GAME.lives <= 0) {
    GAME.lives = 0;
    GAME.health = 0;

    GAME.state = "gameover";
    GAME.gameOverStartFrame = frameCount;

    // O overlay já anuncia o fim.
    clearJudgement();

    playPlayerGameOver()
    return;
  }

  // Ainda há vidas: a barra volta a encher e o jogo continua.
  GAME.health = HEALTH.max;

  playPlayerLifeLost();

  // Recomeça com uma partitura nova.
  GAME.eventResults.clear();
  buildCurrentLevel();
  GAME.ballPosition = 0;

  // Countdown só depois do zoom do overlay.
  beginCountdown("lifelost", LIFE_LOST_ZOOM.durationSeconds);
}

// Usada no início de cada nível.
function resetHealth() {
  GAME.health = HEALTH.max;
  GAME.lifeLostAudioTime = null;
}

// ============================================================
// GERAR EVENTOS DE UM COMPASSO
// ============================================================

function generateBarEvents({ allowNotesOnFirstBeat = true } = {}) {
  const config = getCurrentLevelConfig();

  const beats = generateBar(config, { allowNotesOnFirstBeat });

  // buildEvents() espera config.beats.
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
  // Partitura nova: a batida antecipada já não tem destino.
  GAME.pendingEarlyResult = null;

  // Primeiro tempo vazio, para dar tempo a ler.
  GAME.events = generateBarEvents({ allowNotesOnFirstBeat: false });
  GAME.nextEvents = generateBarEvents();

  // Partituras novas: a leitura recomeça à esquerda.
  GAME.activeSide = "left";
}


// ============================================================
// COMEÇAR O NÍVEL NOVO (DEPOIS DA TRANSIÇÃO)
//
// Chamada no corte da transição, para nada mudar no ecrã
// antes do fade out acabar.
// ============================================================

function beginNextLevelBar() {
  GAME.levelScore = 0;
  GAME.levelTargetScore = getLevelTargetScore(GAME.level);

  // A barra enche; as vidas gastas não voltam.
  resetHealth();

  GAME.ballPosition = 0;
  GAME.combo = 0;

  GAME.eventResults.clear();
  buildCurrentLevel();
}


// ============================================================
// AVANÇAR PARA O COMPASSO SEGUINTE
// ============================================================

function advanceToNextBar() {
  GAME.events = GAME.nextEvents;
  GAME.nextEvents = generateBarEvents();

  // A nota batida antes do compasso virar já está resolvida.
  applyPendingEarlyResult();

  // O preview fica no lugar; o novo nasce do outro lado.
  GAME.activeSide = GAME.activeSide === "left" ? "right" : "left";
}

// Chamada depois de eventResults ser limpo (ver finishCurrentBar).
function applyPendingEarlyResult() {
  const pending = GAME.pendingEarlyResult;
  GAME.pendingEarlyResult = null;

  if (!pending) return;

  GAME.eventResults.set(pending.id, pending.result);
}

// ============================================================
// RESET
// ============================================================

function resetGame({ keepLevel = false } = {}) {
  stopMusicTransport();
  stopCountdownClicks();

  if (!keepLevel) {
    GAME.level = 1;
  }

  GAME.state = "standby";
  GAME.ballPosition = 0;

  GAME.score = 0;
  GAME.levelScore = 0;
  GAME.combo = 0;
  GAME.maxCombo = 0;
  GAME.barNumber = 1;

  GAME.levelTargetScore = getLevelTargetScore(GAME.level);

  // vidas e barra a partir da config global
  GAME.maxLives = HEALTH.lives;
  GAME.lives = HEALTH.lives;
  GAME.health = HEALTH.max;
  GAME.lifeLostAudioTime = null;
  GAME.nextLevelBarsPending = false;
  GAME.nextLevelAudioTime = null;

  clearJudgement();

  GAME.barStartAudioTime = null;

  GAME.countdownStartAudioTime = null;
  GAME.countdownBeat = null;

  GAME.eventResults.clear();

  GAME.gameOverStartFrame = null;
  GAME.standbyExitStartFrame = null;
  GAME.gameOverExitPending = false;

  // gameOverExitStartFrame não se repõe: o wipe ainda o usa.

  buildCurrentLevel();
}

// ============================================================
// SAIR DO STANDBY
//
// Qualquer tecla ou nota. O countdown começa no corte do wipe.
// ============================================================

function exitStandby() {
  if (GAME.state !== "standby" || GAME.standbyExitStartFrame !== null) {
    return;
  }

  ensureAudioContext();

  GAME.standbyExitStartFrame = frameCount;
}

// ============================================================
// ROTATE — ECRÃ NA VERTICAL
//
// Entrar reseta a partida (o jogador não vê o jogo); sair volta
// ao standby. Controlado por updateOrientation() em sketch.js.
// ============================================================

function enterRotateMode() {
  if (GAME.state === "rotate") return;

  resetGame();
  GAME.state = "rotate";
}

function exitRotateMode() {
  if (GAME.state !== "rotate") return;

  GAME.state = "standby";
}

// ============================================================
// MUDAR NÍVEL
// ============================================================


// by hand
function handChangeLevel(newLevel) {
  const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
  if (nextLevel === GAME.level) return;

  GAME.level = nextLevel;
  resetGame({ keepLevel: true });
}

// automaticamente
function changeLevel() {

  if (GAME.levelScore >= GAME.levelTargetScore) {

    // se já está no último nível — não há mais para onde subir
    if (GAME.level >= LEVEL_CONFIGS.length) return false;

    stopMusicTransport();

    const newLevel = GAME.level + 1
    const nextLevel = constrain(newLevel, 1, LEVEL_CONFIGS.length);
    GAME.level = nextLevel;

    console.log(`Level ${GAME.level}. Earn ${getLevelTargetScore(GAME.level)} points to advance.`)

    // O nível muda já, para a contagem sair no bpm novo; o resto
    // do estado só se aplica no corte (beginNextLevelBar()).
    GAME.nextLevelAudioTime = audioCtx.currentTime;
    beginCountdown("nextlevel", NEXT_LEVEL_TRANSITION.durationSeconds);

    return true;
  }

  return false;
}
