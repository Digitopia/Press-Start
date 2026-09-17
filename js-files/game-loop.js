// ============================================================
// CLOCK PRINCIPAL
// ============================================================

const COUNTDOWN_CLICKS = {
  session: null
};

function updateGame() {

  // O jogo já foi reposto; só se espera voltar à horizontal.
  if (GAME.state === "rotate") return;

  if (!audioCtx) return;

  if (GAME.state === "standby") {
    updateStandby();
    return;
  }

  if (GAME.state === "gameover") {
    updateGameOver();
    return;
  }

  if (GAME.state === "countdown" || GAME.state === "nextlevel" || GAME.state === "lifelost") {
    updateCountdown();
    return;
  }

  if (GAME.state !== "playing" || GAME.barStartAudioTime === null) {
    return;
  }

  const durationSeconds = getBarDurationMs() / 1000;
  let elapsed = audioCtx.currentTime - GAME.barStartAudioTime;

  // ==========================================================
  // FIM DO COMPASSO
  //
  // Soma-se a duração ao relógio anterior (e não currentTime)
  // para evitar drift.
  // ==========================================================

  while (elapsed >= durationSeconds) {
    finishCurrentBar();

    // Vida perdida: o relógio é reposto no fim da contagem.
    if (GAME.state !== "playing") return;

    GAME.barStartAudioTime += durationSeconds;
    elapsed = audioCtx.currentTime - GAME.barStartAudioTime;
  }

  // Agenda música e metrónomo com antecedência.
  updateMusicTransport();

  GAME.ballPosition = constrain(elapsed / durationSeconds, 0, 1);

  checkAutomaticMisses();

  if (GAME.judgementTimer > 0) {
    GAME.judgementTimer -= deltaTime;
  }
}

// ============================================================
// MARCAR MISS EM EVENTOS NÃO RESOLVIDOS
//
// Dano proporcional ao número de notas falhadas.
// ============================================================

function markUnresolvedAsMiss(shouldMiss) {
  let missCount = 0;

  for (const event of GAME.events) {
    if (GAME.eventResults.has(event.id)) continue;

    if (shouldMiss(event)) {
      GAME.eventResults.set(event.id, "MISS");
      missCount++;
    }
  }

  if (missCount > 0) {
    registerFailure("miss", missCount);
  }
}

// ============================================================
// FIM DO COMPASSO
//
// Fecha as notas em falta e gera o compasso seguinte. Ao mudar
// de nível, a geração espera pelo corte para preto
// (ver updateCountdown()).
// ============================================================

function finishCurrentBar() {
  markUnresolvedAsMiss(() => true);

  // Vida ou jogo perdido: não avançar nem mudar de nível.
  if (GAME.state !== "playing") return;

  GAME.barNumber++;

  // o nível só avança no final de compassos
  const levelChanged = changeLevel();

  if (levelChanged) {
    // eventResults fica até ao corte, para o compasso tocado
    // continuar visível durante o fade out.
    GAME.nextLevelBarsPending = true;
  } else {
    GAME.eventResults.clear();
    advanceToNextBar();
  }
}

// ============================================================
// MISS AUTOMÁTICO
//
// Nota que já passou da janela OK deixa de poder ser acertada.
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
// BATIDA REPETIDA NUMA NOTA JÁ RESOLVIDA
//
// Uma segunda batida numa nota já acertada contaria como stray.
// É ruído do gesto, por isso ignora-se.
// ============================================================

function isNearResolvedEvent(elapsedMs, okWindow) {
  for (const event of GAME.events) {
    if (!GAME.eventResults.has(event.id)) continue;

    if (Math.abs(elapsedMs - getEventTimeMs(event)) <= okWindow) {
      return true;
    }
  }

  return false;
}

// ============================================================
// JOGADOR BATE NUMA FILA
// ============================================================

function tryLaneHit(lane) {
  if (GAME.state !== "playing") return;

  const elapsedMs = getCurrentElapsedMs();
  const okWindow = getCurrentLevelConfig().hitWindows.ok;

  const { event: closestEvent, difference: closestDifference } = findClosestUnresolvedEvent(elapsedMs);

  // Nenhuma nota perto: pune "button mashing".
  if (!closestEvent || Math.abs(closestDifference) > okWindow) {
    // ... exceto repetições de uma nota acabada de tocar.
    if (isNearResolvedEvent(elapsedMs, okWindow)) return;

    registerFailure("stray");
    return;
  }

  // ==========================================================
  // TEMPO CERTO, FILA ERRADA
  // ==========================================================

  if (closestEvent.lane !== lane) {
    GAME.eventResults.set(closestEvent.id, "WRONG");
    registerFailure("wrong");
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
  const basePoints = JUDGEMENT_POINTS[judgement] ?? 1;

  GAME.combo++;
  GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo);

  // O tecto aplica-se só ao multiplicador, não ao combo mostrado.
  const earnedPoints =
    basePoints * Math.min(GAME.combo, SCORING.maxComboMultiplier);

  GAME.score += earnedPoints;
  GAME.levelScore += earnedPoints;

  // ==========================================================
  // CURA
  //
  // Só a partir de comboHealThreshold; o valor depende apenas
  // do julgamento.
  // ==========================================================

  if (GAME.combo >= HEALTH.comboHealThreshold) {
    healPlayer(HEALTH.heal[judgement] ?? 0);
  }

  GAME.lastJudgement = judgement;
  GAME.judgementTimer = 550;

  playPlayerHit(event.lane, judgement);
}

// ============================================================
// ERROS
//
// Zera o combo, mostra feedback, toca o som e aplica dano
// (× count). O dano vem no fim porque damagePlayer() pode
// gastar uma vida e sobrepor o feedback.
// ============================================================

function registerFailure(type, count = 1) {
  const failure = FAILURES[type];

  GAME.combo = 0;

  GAME.lastJudgement = failure.label;
  GAME.judgementTimer = failure.timer;

  playPlayerFailure(type);

  damagePlayer(failure.damage * count);
}

// ============================================================
// STANDBY
//
// Espera o corte do screen wipe para arrancar o countdown.
// ============================================================

function updateStandby() {
  if (GAME.standbyExitStartFrame === null) return;

  const elapsedFrames = frameCount - GAME.standbyExitStartFrame;

  if (elapsedFrames >= SCREEN_WIPE.cutFrames) {
    beginCountdown("countdown");
  }
}

// ============================================================
// GAME OVER — SAÍDA
//
// Após displayFrames começa o screen wipe; no corte, o jogo
// reseta-se e volta ao standby.
// ============================================================

function updateGameOver() {
  if (frameCount - GAME.gameOverStartFrame < GAME_OVER_EXIT.displayFrames) {
    return;
  }

  if (!GAME.gameOverExitPending) {
    GAME.gameOverExitPending = true;
    GAME.gameOverExitStartFrame = frameCount;
    return;
  }

  if (frameCount - GAME.gameOverExitStartFrame >= SCREEN_WIPE.cutFrames) {
    resetGame();
  }
}

// ============================================================
// COUNTDOWN
//
// O áudio é agendado todo no arranque; o frame só atualiza o
// número no ecrã.
// ============================================================

// extraDelaySeconds: usado pelo "lifelost" para esperar o zoom
// do overlay. ballPosition e combo são repostos pelo chamador.
function beginCountdown(state, extraDelaySeconds = 0) {
  stopCountdownClicks();

  GAME.state = state;

  GAME.countdownStartAudioTime =
    audioCtx.currentTime + SFX_LOOKAHEAD_SECONDS + extraDelaySeconds;

  GAME.countdownBeat = null;

  scheduleCountdownClicks();
}

function scheduleCountdownClicks() {
  const config = getCurrentLevelConfig();
  const beatDurationSeconds = 60 / config.bpm;
  const session = {
    gain: audioCtx.createGain(),
    activeSources: new Set()
  };

  session.gain.connect(audioCtx.destination);
  COUNTDOWN_CLICKS.session = session;

  for (let beat = 0; beat < config.beatsPerBar; beat++) {
    const source = scheduleBeep(
      beat === 0 ? 700 : 500,
      50,
      0.12,
      GAME.countdownStartAudioTime + beat * beatDurationSeconds,
      session.gain
    );

    if (!source) continue;

    session.activeSources.add(source);
    source.addEventListener("ended", () => {
      session.activeSources.delete(source);

      if (session.activeSources.size === 0) {
        session.gain.disconnect();

        if (COUNTDOWN_CLICKS.session === session) {
          COUNTDOWN_CLICKS.session = null;
        }
      }
    });
  }

  if (session.activeSources.size === 0) {
    session.gain.disconnect();
    COUNTDOWN_CLICKS.session = null;
  }
}

function stopCountdownClicks() {
  const session = COUNTDOWN_CLICKS.session;

  if (!audioCtx || !session) return;

  const stopTime = audioCtx.currentTime + 0.008;
  const gain = session.gain.gain;

  gain.cancelScheduledValues(audioCtx.currentTime);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), audioCtx.currentTime);
  gain.exponentialRampToValueAtTime(0.0001, stopTime);

  for (const source of session.activeSources) {
    try {
      source.stop(stopTime);
    } catch (error) {
      // A fonte pode já ter terminado naturalmente.
    }
  }

  COUNTDOWN_CLICKS.session = null;
}

function updateCountdown() {
  const config = getCurrentLevelConfig();

  const beatDurationSeconds = 60 / config.bpm;

  const totalCountdownSeconds =
    beatDurationSeconds * config.beatsPerBar;

  const elapsed =
    audioCtx.currentTime - GAME.countdownStartAudioTime;

  // O nível novo só se aplica no corte para preto. Mede-se a
  // partir de nextLevelAudioTime (countdownStartAudioTime já
  // inclui o fade).
  if (
    GAME.nextLevelBarsPending &&
    audioCtx.currentTime - GAME.nextLevelAudioTime >=
      NEXT_LEVEL_TRANSITION.cutSeconds
  ) {
    beginNextLevelBar();
    GAME.nextLevelBarsPending = false;
  }

  const beatIndex = floor(elapsed / beatDurationSeconds);

  // Atualiza o número mostrado. beatIndex < 0 durante o
  // extraDelaySeconds.
  if (
    beatIndex >= 0 &&
    beatIndex !== GAME.countdownBeat &&
    beatIndex < config.beatsPerBar
  ) {
    GAME.countdownBeat = beatIndex;
  }

  // Countdown terminou
  if (elapsed >= totalCountdownSeconds) {
    GAME.state = "playing";

    GAME.barStartAudioTime =
      GAME.countdownStartAudioTime + totalCountdownSeconds;

    GAME.countdownStartAudioTime = null;
    GAME.countdownBeat = null;

    startMusicTransport(GAME.barStartAudioTime);
  }
}
