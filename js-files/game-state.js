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

  // Pontos conquistados na tentativa atual do nível.
  // Ao perder uma vida, este progresso volta a zero sem apagar
  // a pontuação total da partida.
  levelScore: 0,

  combo: 0,
  maxCombo: 0,
  barNumber: 1,

  // Pontos necessários para concluir a tentativa atual.
  levelTargetScore: 300,
  levelImprove: 50,

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

  // O metrónomo é agendado pelo CLICK_TRANSPORT, por isso já
  // não existe currentBeat. countdownBeat fica porque o
  // renderer lê-o para desenhar o número da contagem.
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
  stopMusicTransport();

  GAME.lives--;
  GAME.lifeLostFrame = frameCount;
  GAME.combo = 0;
  GAME.levelScore = 0;

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

  // O overlay já anuncia a perda de vida —
  // limpar o feedback da falha que a causou.
  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  playBeep(140, 220, 0.18);

  // Recomeçar o compasso: descartar o que estava a meio
  // e gerar uma partitura nova para o compasso e o preview.
  GAME.eventResults.clear();
  buildCurrentLevel();
  // fazer reset com buildCurrentLevel() pq gera o compasso ativo com allowNotesOnFirstBeat: false, ou seja, o primeiro tempo fica em silêncio.

  beginCountdown("lifelost");
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

function resetGame({ keepLevel = false } = {}) {
  stopMusicTransport();

  if (!keepLevel) {
    GAME.level = 1;
  }

  GAME.state = "ready";
  GAME.ballPosition = 0;

  GAME.score = 0;
  GAME.levelScore = 0;
  GAME.combo = 0;
  GAME.maxCombo = 0;
  GAME.barNumber = 1;

  GAME.levelTargetScore =
    GAME.level === 1
      ? 300
      : GAME.levelImprove * GAME.level;

  // vidas e barra a partir da config global
  GAME.maxLives = HEALTH.lives;
  GAME.lives = HEALTH.lives;
  GAME.health = HEALTH.max;
  GAME.lifeLostFrame = null;

  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  GAME.barStartAudioTime = null;

  GAME.countdownStartAudioTime = null;
  GAME.countdownBeat = null;

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

    // Cada nível começa com uma tentativa limpa. A pontuação total
    // continua acumulada, mas não conta como progresso no novo nível.
    GAME.levelScore = 0;
    GAME.levelTargetScore = GAME.levelImprove * GAME.level;

    // A barra de vida volta ao máximo no início de cada nível.
    // As vidas já gastas NÃO são devolvidas.
    resetHealth();

    console.log(`Level ${GAME.level}. Earn ${GAME.levelTargetScore} points to advance.`)

    // O nível já mudou, por isso a contagem sai com o bpm novo —
    // é ela que ensina o andamento do nível seguinte.
    beginCountdown("nextlevel");

    return true;
  }

  return false;
}