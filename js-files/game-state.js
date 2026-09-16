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
  // Calculado por getLevelTargetScore() a partir das regras do
  // nível — este valor é só um seguro para antes do primeiro
  // resetGame().
  levelTargetScore: 300,

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

  // Instante (audioCtx.currentTime) em que a última vida foi
  // perdida — origem do zoom do overlay em drawLiveLostOverlay().
  lifeLostAudioTime: null,

  // Verdadeiro entre o início da transição de nível e o corte
  // para preto do overlay: só nesse instante é que
  // buildCurrentLevel() gera o compasso do nível novo, para as
  // notas não aparecerem antes do corte (ver updateCountdown()
  // em game-loop.js e NEXT_LEVEL_TRANSITION em main-config.js).
  nextLevelBarsPending: false,

  // Instante (audioCtx.currentTime) em que a transição de nível
  // começou — origem do fade em drawNextLevelOverlay(), separado
  // de countdownStartAudioTime porque este último só marca o
  // início do countdown a sério, adiado até a transição acabar.
  nextLevelAudioTime: null,

  lastJudgement: "",
  judgementTimer: 0,

  // Clock musical
  barStartAudioTime: null,

  // O metrónomo é agendado pelo CLICK_TRANSPORT. countdownBeat
  // fica só porque o renderer lê-o para desenhar o número da
  // contagem.
  countdownStartAudioTime: null,
  countdownBeat: null,

  // Frame (frameCount) em que o "gameover" começou,
  // usado só para controlar o piscar do overlay.
  gameOverStartFrame: null,

  // Frame em que se começou a sair do standby (screen wipe) —
  // null enquanto ainda se espera por um botão (ver
  // exitStandby() e updateStandby() em game-loop.js).
  standbyExitStartFrame: null,

  // O mesmo para a saída do game over: frame em que o screen
  // wipe começou. NÃO se repõe a null no reset a meio da
  // transição (ver resetGame()) — o wipe continua a desenhar-se
  // por cima do standby novo até acabar (ver
  // drawGameOverExitOverlay() em renderer.js).
  gameOverExitStartFrame: null,

  // Verdadeiro só enquanto se espera pelo corte do wipe do game
  // over — impede updateGameOver() de chamar resetGame() mais
  // do que uma vez por ciclo.
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
// O que rende uma passagem PERFEITA de barsToClearLevel
// compassos, com as notas que este nível põe em cada um.
//
// Como os níveis densos têm mais notas por compasso, o alvo
// sobe sozinho: o que se mantém constante é o número de
// compassos, que é a unidade em que o jogo se joga.
//
// Exigir PERFECT é de propósito. Tocar tudo certo mas em GOOD
// rende dois terços, portanto passa-se na mesma — só demora
// mais um compasso ou dois.
// ============================================================

function getLevelTargetScore(level) {
  const config = LEVEL_CONFIGS[level - 1];

  const notes = config.minNotesPerBar * SCORING.barsToClearLevel;

  return notes * JUDGEMENT_POINTS.PERFECT * SCORING.maxComboMultiplier;
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
  GAME.lifeLostAudioTime = audioCtx.currentTime;
  GAME.combo = 0;
  GAME.levelScore = 0;

  // Já não há vidas — fim de jogo.
  if (GAME.lives <= 0) {
    GAME.lives = 0;
    GAME.health = 0;

    GAME.state = "gameover";
    GAME.gameOverStartFrame = frameCount;

    playPlayerGameOver()
    return;
  }

  // Ainda há vidas: a barra volta a encher e o jogo continua.
  GAME.health = HEALTH.max;

  // O overlay já anuncia a perda de vida —
  // limpar o feedback da falha que a causou.
  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  playPlayerLifeLost();

  // Recomeçar o compasso: descartar o que estava a meio
  // e gerar uma partitura nova para o compasso e o preview.
  // buildCurrentLevel() já garante silêncio no primeiro tempo
  // (ver comentário acima da função).
  GAME.eventResults.clear();
  buildCurrentLevel();
  GAME.ballPosition = 0;

  // O countdown só arranca depois de o zoom do overlay acabar
  // (ver LIFE_LOST_ZOOM em main-config.js e beginCountdown()).
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
// COMEÇAR O NÍVEL NOVO (DEPOIS DA TRANSIÇÃO)
//
// changeLevel() já mudou GAME.level e começou o overlay, mas
// chama esta função só mais tarde, no corte da transição (ver
// updateCountdown() em game-loop.js) — até lá nada disto pode
// mudar no ecrã, ou ver-se-ia o compasso antigo a saltar para o
// estado do nível novo por baixo do fade out.
// ============================================================

function beginNextLevelBar() {
  // Cada nível começa com uma tentativa limpa. A pontuação total
  // continua acumulada, mas não conta como progresso no novo nível.
  GAME.levelScore = 0;
  GAME.levelTargetScore = getLevelTargetScore(GAME.level);

  // A barra de vida volta ao máximo no início de cada nível.
  // As vidas já gastas NÃO são devolvidas.
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

  GAME.lastJudgement = "";
  GAME.judgementTimer = 0;

  GAME.barStartAudioTime = null;

  GAME.countdownStartAudioTime = null;
  GAME.countdownBeat = null;

  GAME.eventResults.clear();

  GAME.gameOverStartFrame = null;
  GAME.standbyExitStartFrame = null;
  GAME.gameOverExitPending = false;

  // gameOverExitStartFrame fica de fora de propósito: este reset
  // corre a meio da saída do game over (ver updateGameOver()), e
  // o screen wipe ainda precisa dele para acabar de se desenhar
  // por cima do standby novo.

  buildCurrentLevel();
}

// ============================================================
// SAIR DO STANDBY
//
// Qualquer tecla ou nota MIDI chama isto enquanto GAME.state é
// "standby" (ver input.js). O corte do screen wipe é que decide
// quando o countdown a sério começa — ver updateStandby() em
// game-loop.js.
// ============================================================

function exitStandby() {
  if (GAME.state !== "standby" || GAME.standbyExitStartFrame !== null) {
    return;
  }

  ensureAudioContext();

  GAME.standbyExitStartFrame = frameCount;
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

    // O resto do estado do nível novo (pontuação, vida, bola,
    // compasso) só se aplica no corte da transição, em
    // beginNextLevelBar() — até lá o ecrã fica congelado no que
    // já lá estava. O nível já mudou aqui porque a contagem sai
    // com o bpm novo — é ela que ensina o andamento do nível
    // seguinte — mas só começa a sério depois de o fade do
    // overlay acabar (ver NEXT_LEVEL_TRANSITION em main-config.js).
    GAME.nextLevelAudioTime = audioCtx.currentTime;
    beginCountdown("nextlevel", NEXT_LEVEL_TRANSITION.durationSeconds);

    return true;
  }

  return false;
}