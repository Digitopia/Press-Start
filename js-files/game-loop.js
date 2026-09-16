// ============================================================
// CLOCK PRINCIPAL
// ============================================================

function updateGame() {

  if (!audioCtx) return;

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
  // Não faz bounce.
  // O playhead reaparece à esquerda.
  //
  // Somamos a duração ao relógio anterior em vez de usar
  // currentTime, para evitar drift.
  // ==========================================================

  while (elapsed >= durationSeconds) {
    finishCurrentBar();

    // Perder uma vida (ou o jogo) interrompe o compasso:
    // o relógio é reposto no fim da contagem.
    if (GAME.state !== "playing") return;

    GAME.barStartAudioTime += durationSeconds;
    elapsed = audioCtx.currentTime - GAME.barStartAudioTime;
  }

  // Agenda música E metrónomo com antecedência, os dois juntos.
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
// Usada tanto no fim do compasso (tudo o que falta é MISS)
// como durante o compasso (só o que já passou da janela OK).
//
// O dano é proporcional ao número de notas falhadas de uma vez.
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
// Além de fechar as notas em falta, gera já o compasso
// seguinte — é aqui que a aleatoriedade "entra em jogo".
// ============================================================

function finishCurrentBar() {
  // Qualquer nota ainda não resolvida
  // conta como MISS.
  markUnresolvedAsMiss(() => true);

  // Se as últimas notas custaram uma vida (ou o jogo), não
  // avançar o compasso nem deixar que changeLevel() substitua
  // o estado que acabou de ser definido.
  if (GAME.state !== "playing") return;

  GAME.barNumber++;
  GAME.eventResults.clear();

  // o nível só avança no final de compassos, nunca a meio
  const levelChanged = changeLevel();

  if (levelChanged) {
    // A configuração mudou: gerar o compasso ativo e o preview
    // com as regras do novo nível.
    buildCurrentLevel();
  } else {
    // Sem mudança de nível, o preview torna-se o compasso atual
    // e é gerado um novo preview.
    advanceToNextBar();
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
// BATIDA REPETIDA NUMA NOTA JÁ RESOLVIDA
//
// Depois de acertar uma nota, ela sai do conjunto das não
// resolvidas — e por isso deixa de estar "perto" para efeitos
// do findClosestUnresolvedEvent(). Uma segunda batida em cima
// dela seria contada como stray.
//
// Isso é ruído do gesto, não erro de leitura: ignora-se.
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

  // Encontrar a nota NÃO RESOLVIDA
  // temporalmente mais próxima.
  const { event: closestEvent, difference: closestDifference } = findClosestUnresolvedEvent(elapsedMs);

  // Não existe sequer uma nota perto.
  // Isto pune "button mashing".
  if (!closestEvent || Math.abs(closestDifference) > okWindow) {
    // ... a não ser que seja uma repetição de uma nota
    // acabada de tocar, que não custa nada.
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

  // O combo continua a contar sem limite no ecrã; o tecto
  // aplica-se só ao multiplicador dos pontos.
  const earnedPoints =
    basePoints * Math.min(GAME.combo, SCORING.maxComboMultiplier);

  GAME.score += earnedPoints;
  GAME.levelScore += earnedPoints;

  // ==========================================================
  // CURA
  //
  // Porta rígida: abaixo de comboHealThreshold acertar não
  // recupera nada. A partir daí a cura é fixa, definida só
  // pelo julgamento — o combo abre a porta, não a alarga.
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
// registerFailure centraliza o padrão comum: zera o combo,
// mostra o feedback definido em FAILURES, toca o som da falha
// e aplica o dano à health.
//
// count multiplica o dano — usado quando várias notas
// falham ao mesmo tempo no fim do compasso.
//
// O dano é aplicado no fim porque damagePlayer() pode
// gastar uma vida e sobrepor o texto de feedback.
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
// COUNTDOWN
//
// O ÁUDIO da contagem é agendado todo de uma vez, no arranque.
// A deteção por frame fica apenas para o NÚMERO no ecrã
// (GAME.countdownBeat é lido pelo renderer).
// ============================================================

function beginCountdown(state) {
  GAME.state = state;

  GAME.countdownStartAudioTime =
    audioCtx.currentTime + SFX_LOOKAHEAD_SECONDS;

  GAME.countdownBeat = null;

  GAME.ballPosition = 0;
  GAME.combo = 0;

  scheduleCountdownClicks();
}

function scheduleCountdownClicks() {
  const config = getCurrentLevelConfig();
  const beatDurationSeconds = 60 / config.bpm;

  for (let beat = 0; beat < config.beatsPerBar; beat++) {
    scheduleBeep(
      beat === 0 ? 700 : 500,
      50,
      0.12,
      GAME.countdownStartAudioTime + beat * beatDurationSeconds
    );
  }
}

function startCountdown() {
  ensureAudioContext();

  beginCountdown("countdown");
}

function updateCountdown() {
  const config = getCurrentLevelConfig();

  const beatDurationSeconds = 60 / config.bpm;

  const totalCountdownSeconds =
    beatDurationSeconds * config.beatsPerBar;

  const elapsed =
    audioCtx.currentTime - GAME.countdownStartAudioTime;

  const beatIndex = floor(elapsed / beatDurationSeconds);

  // Novo beat do countdown — só para o ecrã.
  // O click já foi agendado em scheduleCountdownClicks().
  if (
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