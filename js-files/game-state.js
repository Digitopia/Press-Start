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

  // Lado do ecrã onde está o compasso ativo.
  // Alterna a cada compasso: o preview passa a ativo sem
  // mudar de sítio, e o preview novo nasce do outro lado.
  activeSide: "left",

  // Resultado de cada evento no compasso atual
  // id -> PERFECT / GOOD / OK / MISS / WRONG
  eventResults: new Map(),

  score: 0,
  combo: 0,
  maxCombo: 0,
  barNumber: 1,

  // parâmetros iniciais para se avançar de nível
  nextlevel_score: 300,
  levelImprove: 50,

  // Pontuação em que o nível atual começou.
  // Serve de base à barra de progresso do HUD.
  levelStartScore: 0,

  // ----------------------------------------------------------
  // VIDA
  //
  // health desce com falhas e sobe com acertos.
  // Chegando a 0 perde-se uma vida e a barra volta a encher.
  // Sem vidas -> gameover.
  //
  // Estes valores são substituídos por resetGame() a partir
  // das healthRules do nível — aqui ficam só valores seguros
  // para antes do primeiro reset.
  // ----------------------------------------------------------
  health: 100,
  lives: 3,
  maxLives: 3,

  // Frame em que a última vida foi perdida (flash da barra).
  lifeLostFrame: null,

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
// VIDA / HEALTH
//
// Regras em HEALTH e FAILURES (main-config.js),
// iguais em todos os níveis.
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
  GAME.lives--;
  GAME.lifeLostFrame = frameCount;
  GAME.combo = 0;

  // Já não há vidas — fim de jogo.
  if (GAME.lives <= 0) {
    GAME.lives = 0;
    GAME.health = 0;

    GAME.state = "gameover";
    GAME.gameOverStartFrame = frameCount;

    playBeep(90, 400, 0.2);
    return;
  }

  // Ainda há vidas: a barra volta a encher e o jogo continua.
  GAME.health = HEALTH.max;
  GAME.state = "lifelost";

  // O overlay já anuncia a perda de vida —
  // limpar o feedback da falha que a causou.
  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  playBeep(140, 220, 0.18);

  // Copiado do startCountdown() 
  GAME.countdownStartAudioTime = audioCtx.currentTime
  GAME.countdownBeat = null
  GAME.ballPosition = 0
  GAME.combo = 0

  // Recomeçar o compasso: descartar o que estava a meio
  // e gerar uma partitura nova para o compasso e o preview.
  GAME.eventResults.clear();
  GAME.currentBeat = null;
  buildCurrentLevel();
  // fazer reset com buildCurrentLevel() pq gera o compasso ativo com allowNotesOnFirstBeat: false, ou seja, o primeiro tempo fica em silêncio.
}

// Usada no início de cada nível.
function resetHealth() {
  GAME.health = HEALTH.max;
  GAME.lifeLostFrame = null;
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

  // As duas partituras são refeitas de raiz e não há nada a
  // herdar da direita, por isso a leitura recomeça à esquerda.
  GAME.activeSide = "left";
}


// ============================================================
// AVANÇAR PARA O COMPASSO SEGUINTE
// ============================================================

function advanceToNextBar() {
  // O preview passa a ser o compasso atual.
  GAME.events = GAME.nextEvents;

  // Gerar imediatamente um novo preview.
  GAME.nextEvents = generateBarEvents();

  // O preview vira ativo sem sair do lugar, portanto o lado
  // ativo troca e o preview novo ocupa a área libertada.
  GAME.activeSide = GAME.activeSide === "left" ? "right" : "left";
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
  GAME.levelStartScore = 0;

  // vidas e barra a partir da config global
  GAME.maxLives = HEALTH.lives;
  GAME.lives = HEALTH.lives;
  GAME.health = HEALTH.max;
  GAME.lifeLostFrame = null;

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

    // A barra de progresso mede o caminho entre o alvo anterior
    // e o novo, por isso guardamos o antigo antes de o substituir.
    GAME.levelStartScore = GAME.nextlevel_score

    // sempre que se passa de nível é calculado numa nova pontuação necessária para avançar
    GAME.nextlevel_score = GAME.nextlevel_score + GAME.levelImprove * GAME.level

    // A barra de vida volta ao máximo no início de cada nível.
    // As vidas já gastas NÃO são devolvidas.
    resetHealth();

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