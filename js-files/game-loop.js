// ============================================================
// CLOCK PRINCIPAL
// ============================================================

function updateGame() {



  if (!audioCtx) return;

  if (GAME.state === "countdown" || GAME.state === "nextlevel") {
    console.log(GAME.state)
    updateCountdown();

    return;

  }

  if (

    GAME.state !== "playing" ||

    GAME.barStartAudioTime === null

  ) {

    return;

  }
  if (GAME.state !== "playing" || !audioCtx || GAME.barStartAudioTime === null) {
    return;
  }

  const durationSeconds = getBarDurationMs() / 1000;
  let elapsed = audioCtx.currentTime - GAME.barStartAudioTime;

  // ==========================================================
  // FIM DO COMPASSO
  //
  // Não faz bounce.
  // O playhead reaparece à esquerda.
  //
  // Somamos a duração ao relógio anterior em vez de usar
  // currentTime, para evitar drift.
  // ==========================================================

  while (elapsed >= durationSeconds) {
    finishCurrentBar();
    GAME.barStartAudioTime += durationSeconds;
    elapsed = audioCtx.currentTime - GAME.barStartAudioTime;
  }

  GAME.ballPosition = constrain(elapsed / durationSeconds, 0, 1);

  updateBeat();
  checkAutomaticMisses();

  if (GAME.judgementTimer > 0) {
    GAME.judgementTimer -= deltaTime;
  }
  changeLevel();
}

// ============================================================
// MARCAR MISS EM EVENTOS NÃO RESOLVIDOS
//
// Usada tanto no fim do compasso (tudo o que falta é MISS)
// como durante o compasso (só o que já passou da janela OK).
// ============================================================

function markUnresolvedAsMiss(shouldMiss) {
  let foundMiss = false;

  for (const event of GAME.events) {
    if (GAME.eventResults.has(event.id)) continue;

    if (shouldMiss(event)) {
      GAME.eventResults.set(event.id, "MISS");
      foundMiss = true;
    }
  }

  if (foundMiss) {
    registerFailure("MISS", 500);
  }
}

// ============================================================
// FIM DO COMPASSO
//
// Além de fechar as notas em falta, gera já o compasso
// seguinte — é aqui que a aleatoriedade "entra em jogo".
// ============================================================

function finishCurrentBar() {
  // Qualquer nota ainda não resolvida
  // conta como MISS.
  markUnresolvedAsMiss(() => true);

  GAME.barNumber++;
  GAME.eventResults.clear();
  GAME.currentBeat = null;

  // O preview torna-se o compasso atual
  // e é gerado um novo preview.
  advanceToNextBar();
}

// ============================================================
// BEAT / METRÓNOMO
// ============================================================

function updateBeat() {
  const config = getCurrentLevelConfig();
  const beat = min(config.beatsPerBar - 1, floor(GAME.ballPosition * config.beatsPerBar));

  if (beat === GAME.currentBeat) return;
  GAME.currentBeat = beat;

  // Beat 1 ligeiramente mais forte
  if (beat === 0) {
    playBeep(520, 35, 0.08);
  } else {
    playBeep(440, 30, 0.045);
  }
}

// ============================================================
// MISS AUTOMÁTICO
//
// Quando uma nota já ficou para trás mais do que a janela OK,
// deixa de poder ser acertada.
// ============================================================

function checkAutomaticMisses() {
  const elapsedMs = getCurrentElapsedMs();
  const okWindow = getCurrentLevelConfig().hitWindows.ok;

  markUnresolvedAsMiss(event => elapsedMs > getEventTimeMs(event) + okWindow);
}

// ============================================================
// TEMPO
// ============================================================

function getCurrentElapsedMs() {
  if (!audioCtx || GAME.barStartAudioTime === null) return 0;
  return (audioCtx.currentTime - GAME.barStartAudioTime) * 1000;
}

function getEventTimeMs(event) {
  return event.t * getBarDurationMs();
}

// ============================================================
// JULGAMENTO
// ============================================================

function evaluateTiming(differenceMs) {
  const windows = getCurrentLevelConfig().hitWindows;
  const difference = Math.abs(differenceMs);

  if (difference <= windows.perfect) return "PERFECT";
  if (difference <= windows.good) return "GOOD";
  if (difference <= windows.ok) return "OK";
  return "MISS";
}

// ============================================================
// ENCONTRAR A NOTA NÃO RESOLVIDA MAIS PRÓXIMA
// ============================================================

function findClosestUnresolvedEvent(elapsedMs) {
  let closestEvent = null;
  let closestDifference = Infinity;

  for (const event of GAME.events) {
    if (GAME.eventResults.has(event.id)) continue;

    const difference = elapsedMs - getEventTimeMs(event);

    if (Math.abs(difference) < Math.abs(closestDifference)) {
      closestDifference = difference;
      closestEvent = event;
    }
  }

  return { event: closestEvent, difference: closestDifference };
}

// ============================================================
// JOGADOR BATE NUMA FILA
// ============================================================

function tryLaneHit(lane) {
  if (GAME.state !== "playing") return;

  const elapsedMs = getCurrentElapsedMs();
  const okWindow = getCurrentLevelConfig().hitWindows.ok;

  // Encontrar a nota NÃO RESOLVIDA
  // temporalmente mais próxima.
  const { event: closestEvent, difference: closestDifference } = findClosestUnresolvedEvent(elapsedMs);

  // Não existe sequer uma nota perto.
  // Isto pune "button mashing".
  if (!closestEvent || Math.abs(closestDifference) > okWindow) {
    registerStrayHit();
    return;
  }

  // ==========================================================
  // TEMPO CERTO, FILA ERRADA
  // ==========================================================

  if (closestEvent.lane !== lane) {
    GAME.eventResults.set(closestEvent.id, "WRONG");
    registerWrongLane();
    return;
  }

  // ==========================================================
  // FILA CERTA
  // ==========================================================

  const judgement = evaluateTiming(closestDifference);
  GAME.eventResults.set(closestEvent.id, judgement);

  registerSuccessfulHit(closestEvent, judgement);
}

// ============================================================
// ACERTO – CORRESPONDÊNCIA DE PONTOS
// ============================================================

const JUDGEMENT_POINTS = { OK: 1, GOOD: 2, PERFECT: 3 };

function registerSuccessfulHit(event, judgement) {
  const points = JUDGEMENT_POINTS[judgement] ?? 1;

  GAME.combo++;
  GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo);
  GAME.score += points;

  GAME.lastJudgement = judgement;
  GAME.judgementTimer = 550;

  const lane = LANES[event.lane];
  playBeep(lane.frequency, 60, 0.22);
}

// ============================================================
// ERROS
//
// registerFailure centraliza o padrão comum: zera o combo,
// define o texto/timer do feedback e, opcionalmente, toca um beep.
// ============================================================

function registerFailure(label, timerMs, beep = null) {
  GAME.combo = 0;
  GAME.lastJudgement = label;
  GAME.judgementTimer = timerMs;

  if (beep) {
    playBeep(...beep);
  }
}

function registerWrongLane() {
  registerFailure("WRONG ROW", 550, [110, 90, 0.12]);
}

function registerStrayHit() {
  registerFailure("MISS", 400, [110, 60, 0.07]);
}


// ============================================================
// PLAY / PAUSE
// ============================================================

function togglePlay() {
  ensureAudioContext();

  if (GAME.state === "playing") {
    GAME.pausedElapsedSeconds = audioCtx.currentTime - GAME.barStartAudioTime;
    GAME.state = "paused";
    return;
  }

  GAME.state = "playing";
  GAME.barStartAudioTime = audioCtx.currentTime - GAME.pausedElapsedSeconds;
  GAME.currentBeat = null;
}

// ============================================================
// COUNTDOWN
// ============================================================

function startCountdown() {
  ensureAudioContext();

  GAME.state = "countdown";

  GAME.countdownStartAudioTime =
    audioCtx.currentTime;

  GAME.countdownBeat = null;

  GAME.ballPosition = 0;
}

function updateCountdown() {
  const config =
    getCurrentLevelConfig();

  const beatDurationSeconds =
    60 / config.bpm;

  const totalCountdownSeconds =
    beatDurationSeconds *
    config.beatsPerBar;

  const elapsed =
    audioCtx.currentTime -
    GAME.countdownStartAudioTime;

  const beatIndex =
    floor(
      elapsed /
      beatDurationSeconds
    );

  // Novo beat do countdown
  if (
    beatIndex !== GAME.countdownBeat &&
    beatIndex < config.beatsPerBar
  ) {
    GAME.countdownBeat =
      beatIndex;

    // click de contagem
    playBeep(
      beatIndex === 0 ? 700 : 500,
      50,
      0.12
    );
  }

  // Countdown terminou
  if (
    elapsed >= totalCountdownSeconds
  ) {
    GAME.state = "playing";

    GAME.barStartAudioTime =
      GAME.countdownStartAudioTime +
      totalCountdownSeconds;

    GAME.countdownStartAudioTime =
      null;

    GAME.countdownBeat =
      null;

    GAME.currentBeat = null;
  }
}