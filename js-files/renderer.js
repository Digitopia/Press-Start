// ============================================================
// ÁREAS DAS PARTITURAS
// ============================================================

function getScoreAreas() {
  const totalWidth =
    SCREEN_SIZE.width -
    SCORE_LAYOUT.marginX * 2 -
    SCORE_LAYOUT.gap;

  const scoreWidth =
    totalWidth / 2;

  return {
    left: {
      x: SCORE_LAYOUT.marginX,
      y: SCORE_LAYOUT.top,
      width: scoreWidth,
      height:
        SCORE_LAYOUT.bottom -
        SCORE_LAYOUT.top
    },

    right: {
      x:
        SCORE_LAYOUT.marginX +
        scoreWidth +
        SCORE_LAYOUT.gap,

      y: SCORE_LAYOUT.top,
      width: scoreWidth,
      height:
        SCORE_LAYOUT.bottom -
        SCORE_LAYOUT.top
    }
  };
}

function getLaneYInArea(area, lane) {
  const index =
    LANE_ORDER.indexOf(lane);

  if (index === -1) {
    return area.y + area.height / 2;
  }

  const spacing =
    area.height /
    (LANE_ORDER.length - 1);

  return (
    area.y +
    index * spacing
  );
}

function getXInArea(area, t) {
  return lerp(
    area.x,
    area.x + area.width,
    t
  );
}

function drawScore(
  area,
  events,
  isActive,
  resultsMap = null
) {
  push();

  // Preview mais discreto.
  drawingContext.globalAlpha =
    isActive ? 1.0 : 0.35;

  drawScoreLabel(area, isActive);
  drawScoreLaneGuides(area);
  drawScoreSubdivisionGrid(area);
  drawScoreBeatGrid(area);

  // Linha decidida por área (ativo vs preview).
  const config = getCurrentLevelConfig();

  if (isActive ? config.showScorePath : config.showPreviewPath) {
    drawScorePath(area, events, isActive);
  } else if (isActive && config.showScoreTrail) {
    // Sem linha à frente, fica o rasto atrás.
    drawScoreTrail(area, events);
  }

  drawScoreEvents(
    area,
    events,
    resultsMap,
    isActive
  );

  // Só a partitura ativa tem bola.
  if (isActive) {
    drawScoreBall(area, events);
  }

  pop();
}

function drawScoreLabel(area, isActive) {
  noStroke();

  textAlign(LEFT, CENTER);
  textSize(FONT_SIZES.scoreLabel);
  textStyle(BOLD);

  fill(isActive ? 220 : 100);

  text(
    isActive ? "ACTIVE" : "PREVIEW",
    area.x,
    area.y - 35
  );

  textStyle(NORMAL);
}

// ============================================================
// REVELAÇÃO POR TEMPOS
//
// Notas do preview somam 1 ao t, para a janela de visibilidade
// atravessar a fronteira do compasso.
// ============================================================

function getEventOpacity(event, isActive) {
  const config = getCurrentLevelConfig();

  if (config.visibleBeatsAhead === null) return 1;

  const globalT = event.t + (isActive ? 0 : 1);
  const beatsAway =
    (globalT - GAME.ballPosition) * config.beatsPerBar;

  const fade = config.revealFadeBeats;

  return constrain(
    (config.visibleBeatsAhead + fade - beatsAway) / fade,
    0,
    1
  );
}

function drawScoreEvents(
  area,
  events,
  resultsMap,
  isActive
) {
  // A revelação multiplica o alpha base do preview.
  const baseAlpha = drawingContext.globalAlpha;

  for (const event of events) {
    const opacity = getEventOpacity(event, isActive);

    if (opacity <= 0) continue;

    drawingContext.globalAlpha = baseAlpha * opacity;

    const lane =
      LANES[event.lane];

    const x =
      getXInArea(
        area,
        event.t
      );

    const y =
      getLaneYInArea(
        area,
        event.lane
      );

    const result =
      resultsMap
        ? resultsMap.get(event.id)
        : null;

    // Evento já resolvido.
    if (result) {
      noStroke();

      fill(
        ...lane.color,
        45
      );

      circle(
        x,
        y,
        8
      );

      continue;
    }

    // Nota ativa.
    noStroke();

    fill(
      ...lane.color
    );

    circle(
      x,
      y,
      13
    );

    // Halo.
    noFill();

    stroke(
      ...lane.color,
      90
    );

    circle(
      x,
      y,
      19
    );
  }

  drawingContext.globalAlpha = baseAlpha;
}

function getScorePathPoints(
  area,
  events
) {
  if (events.length === 0) {
    const centerY =
      area.y +
      area.height / 2;

    return [
      {
        t: 0,
        x: area.x,
        y: centerY
      },

      {
        t: 1,
        x:
          area.x +
          area.width,
        y: centerY
      }
    ];
  }

  const points = [];

  const firstEvent =
    events[0];

  // Começa à esquerda na fila da primeira nota.
  points.push({
    t: 0,

    x: area.x,

    y:
      getLaneYInArea(
        area,
        firstEvent.lane
      )
  });

  for (const event of events) {
    points.push({
      t: event.t,

      x:
        getXInArea(
          area,
          event.t
        ),

      y:
        getLaneYInArea(
          area,
          event.lane
        )
    });
  }

  const lastEvent =
    events[
    events.length - 1
    ];

  // Termina à direita na fila da última nota.
  points.push({
    t: 1,

    x:
      area.x +
      area.width,

    y:
      getLaneYInArea(
        area,
        lastEvent.lane
      )
  });

  return points;
}

function drawScorePath(
  area,
  events,
  isActive
) {
  const points =
    getScorePathPoints(
      area,
      events
    );

  strokeWeight(2);
  noFill();
  stroke(SCORE_PATH.ahead);

  // O preview não tem bola: mostra o caminho todo.
  if (!isActive) {
    drawPolyline(points);
    return;
  }

  // Só o que falta percorrer; atrás da bola fica o rasto.
  drawPolyline(getPathPointsFrom(points, GAME.ballPosition));

  // A cor do rasto vem do gradiente, não de stroke().
  drawFadingPath(points, GAME.ballPosition);
}

function drawPolyline(points) {
  if (points.length < 2) return;

  beginShape();

  for (const point of points) {
    vertex(
      point.x,
      point.y
    );
  }

  endShape();
}

// Percurso até t, com o ponto da bola a fechar.
function getPathPointsUpTo(points, t) {
  const head = getPointOnTimedPath(points, t);
  const travelled = points.filter(point => point.t <= t);

  travelled.push({ t, x: head.x, y: head.y });

  return travelled;
}

// Percurso a partir de t, com o ponto da bola a abrir.
function getPathPointsFrom(points, t) {
  const head = getPointOnTimedPath(points, t);
  const remaining = points.filter(point => point.t > t);

  remaining.unshift({ t, x: head.x, y: head.y });

  return remaining;
}

// ============================================================
// DESENHO — O QUE A BOLA JÁ PERCORREU
//
// A opacidade vem de há quantos tempos cada ponto ficou para
// trás (trailFadeBeats, null = fica). Cada segmento leva um
// gradiente entre as opacidades das duas pontas: com um valor
// só por segmento, o rasto partia-se aos degraus nas notas.
// Igual com e sem linha à frente: atrás da bola é sempre rasto.
// ============================================================

// Sobe-o para o caminho já andado continuar a ler-se.
const TRAIL_MIN_OPACITY = 0;

function getTrailOpacity(ballT, pointT) {
  const config = getCurrentLevelConfig();

  if (config.trailFadeBeats === null) return 1;

  const beatsBehind = (ballT - pointT) * config.beatsPerBar;

  return constrain(
    1 - beatsBehind / config.trailFadeBeats,
    TRAIL_MIN_OPACITY,
    1
  );
}

// Lido uma vez: aceita cinzento ou [r, g, b] na config.
function getLitRGB() {
  const lit = color(SCORE_PATH.lit);

  return [red(lit), green(lit), blue(lit)];
}

function drawFadingPath(points, ballT) {
  const travelled = getPathPointsUpTo(points, ballT);

  if (travelled.length < 2) return;

  // strokeWeight() e o alpha do preview vêm de quem chama.
  const context = drawingContext;
  const [r, g, b] = getLitRGB();

  const litWithOpacity = opacity => `rgba(${r}, ${g}, ${b}, ${opacity})`;

  for (let index = 0; index < travelled.length - 1; index++) {
    const start = travelled[index];
    const end = travelled[index + 1];

    // A bola em cima de uma nota dá um segmento sem comprimento.
    if (start.x === end.x && start.y === end.y) continue;

    const startOpacity = getTrailOpacity(ballT, start.t);
    const endOpacity = getTrailOpacity(ballT, end.t);

    if (startOpacity <= 0 && endOpacity <= 0) continue;

    const gradient = context.createLinearGradient(
      start.x,
      start.y,
      end.x,
      end.y
    );

    gradient.addColorStop(0, litWithOpacity(startOpacity));
    gradient.addColorStop(1, litWithOpacity(endOpacity));

    context.strokeStyle = gradient;

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
}

// ============================================================
// DESENHO — RASTO
// ============================================================

function drawScoreTrail(area, events) {
  const points = getScorePathPoints(area, events);

  strokeWeight(2);
  noFill();

  drawFadingPath(points, GAME.ballPosition);
}

// ============================================================
// DESENHO — BOLA NA PARTITURA ATIVA
// ============================================================

function drawScoreBall(area, events) {
  const points =
    getScorePathPoints(
      area,
      events
    );

  const point =
    getPointOnTimedPath(
      points,
      GAME.ballPosition
    );

  noStroke();
  fill(255);

  circle(
    point.x,
    point.y,
    GAME.ballDiameter
  );
}

// ============================================================
// PONTO DA BOLA NO PERCURSO
//
// Usa o "t" de cada ponto, não o comprimento da linha, para
// as diagonais não alterarem o ritmo.
// ============================================================

function getPointOnTimedPath(points, t) {
  if (points.length === 0) {
    return { x: SCREEN_SIZE.width / 2, y: SCREEN_SIZE.height / 2 };
  }

  const safeT = constrain(t, 0, 1);

  if (safeT <= points[0].t) {
    return points[0];
  }

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    if (safeT >= start.t && safeT <= end.t) {
      const duration = end.t - start.t;
      if (duration <= 0) return end;

      const localT = (safeT - start.t) / duration;

      return {
        x: lerp(start.x, end.x, localT),
        y: lerp(start.y, end.y, localT)
      };
    }
  }

  return points[points.length - 1];
}

// ============================================================
// DESENHO — HEADER
//
// Bloco de altura fixa: progresso | vidas | health.
// ============================================================

const HUD_LAYOUT = {
  margin: 90,

  // bloco
  rowTop: 78,
  rowHeight: 24,

  // barras
  barWidth: 260,
  barHeight: 6,

  // lado de cada "pixel" dos corações.
  // 6 linhas x 4 = 24, a altura do bloco.
  heartPixel: 4,
  heartGap: 10
};

function drawHeader() {
  push();

  // ----------------------------------------------------------
  // TÍTULO
  // ----------------------------------------------------------

  const titleY = 34;

  noStroke();

  // Nome do jogo, centrado e sozinho.
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(FONT_SIZES.headerTitle);
  fill(235);

  text("PRESS START", SCREEN_SIZE.width / 2, titleY);


  // ----------------------------------------------------------
  // PROGRESSO NO NÍVEL
  // ----------------------------------------------------------

  drawHudMeter(
    HUD_LAYOUT.margin,
    `LEVEL ${GAME.level}`,
    LEFT,
    getLevelProgress(),
    [190]
  );

  // ----------------------------------------------------------
  // VIDAS
  // ----------------------------------------------------------

  drawLivesHearts();

  // ----------------------------------------------------------
  // HEALTH
  // ----------------------------------------------------------

  drawHudMeter(
    SCREEN_SIZE.width - HUD_LAYOUT.margin - HUD_LAYOUT.barWidth,
    "HEALTH",
    RIGHT,
    GAME.health / HEALTH.max,
    getHealthColor()
  );

  pop();
}

// Legenda no topo do bloco + barra colada ao fundo.
// labelAlign alinha a legenda pela ponta exterior da barra.
function drawHudMeter(x, label, labelAlign, ratio, color) {
  noStroke();

  textSize(FONT_SIZES.hudLabel);
  textAlign(labelAlign, TOP);
  fill(120);

  text(
    label,
    labelAlign === RIGHT ? x + HUD_LAYOUT.barWidth : x,
    HUD_LAYOUT.rowTop
  );

  drawHudBar(
    x,
    HUD_LAYOUT.rowTop + HUD_LAYOUT.rowHeight - HUD_LAYOUT.barHeight,
    HUD_LAYOUT.barWidth,
    HUD_LAYOUT.barHeight,
    ratio,
    color
  );
}

// Progresso conquistado na tentativa atual do nível.
function getLevelProgress() {
  if (GAME.levelTargetScore <= 0) return 1;

  return constrain(
    GAME.levelScore / GAME.levelTargetScore,
    0,
    1
  );
}

function getHealthColor() {
  const ratio = GAME.health / HEALTH.max;

  if (ratio > 0.5) return [0, 255, 120];
  if (ratio > 0.25) return [255, 220, 40];
  return [255, 70, 70];
}

function drawHudBar(x, y, w, h, ratio, color) {
  const filled = constrain(ratio, 0, 1) * w;

  // Fundo.
  noStroke();
  fill(32);
  rect(x, y, w, h);

  // Preenchimento.
  fill(...color);
  rect(x, y, filled, h);

  // Contorno.
  noFill();
  stroke(70);
  strokeWeight(1);
  rect(x, y, w, h);
}

// ============================================================
// DESENHO — VIDAS
//
// Coração em pixel art, a condizer com a fonte.
// ============================================================

const HEART_PIXELS = [
  "0110110",
  "1111111",
  "1111111",
  "0111110",
  "0011100",
  "0001000"
];

function drawHeart(x, y, pixel, color) {
  noStroke();
  fill(...color);

  for (let row = 0; row < HEART_PIXELS.length; row++) {
    const line = HEART_PIXELS[row];

    for (let col = 0; col < line.length; col++) {
      if (line[col] !== "1") continue;

      rect(
        x + col * pixel,
        y + row * pixel,
        pixel,
        pixel
      );
    }
  }
}

function drawLivesHearts() {
  const pixel = HUD_LAYOUT.heartPixel;

  const heartWidth = HEART_PIXELS[0].length * pixel;
  const heartHeight = HEART_PIXELS.length * pixel;

  const totalWidth =
    GAME.maxLives * heartWidth +
    (GAME.maxLives - 1) * HUD_LAYOUT.heartGap;

  const startX = SCREEN_SIZE.width / 2 - totalWidth / 2;

  // Centrado na altura do bloco.
  const y =
    HUD_LAYOUT.rowTop +
    (HUD_LAYOUT.rowHeight - heartHeight) / 2;

  for (let i = 0; i < GAME.maxLives; i++) {
    const x = startX + i * (heartWidth + HUD_LAYOUT.heartGap);

    // Vida gasta fica como silhueta apagada.
    drawHeart(x, y, pixel, i < GAME.lives ? [255, 70, 70] : [55]);
  }
}

// ============================================================
// DESENHO — FILAS
// ============================================================

function drawScoreLaneGuides(area) {
  for (const laneName of LANE_ORDER) {
    const lane =
      LANES[laneName];

    const y =
      getLaneYInArea(
        area,
        laneName
      );

    stroke(
      ...lane.color,
      35
    );

    strokeWeight(1);

    line(
      area.x,
      y,
      area.x + area.width,
      y
    );

    // Identificador colorido à esquerda.
    noStroke();

    fill(
      ...lane.color
    );

    rect(
      area.x - 30,
      y - 4,
      10,
      8
    );
  }
}

// ============================================================
// DESENHO — GRELHA DE SUBDIVISÕES
//
// Marca curta em cada fila. A subdivisão 0 é o tempo (já
// desenhado); o meio do tempo tem marca maior.
// ============================================================

const SUBDIVISION_TICKS = {
  halfBeat: { length: 12, shade: 80 },
  other: { length: 6, shade: 60 }
};

function drawScoreSubdivisionGrid(area) {
  const config = getCurrentLevelConfig();

  if (!config.showSubdivisionGrid) return;

  const totalSubdivisions =
    config.beatsPerBar * config.subdivisionsPerBeat;

  const halfBeat = config.subdivisionsPerBeat / 2;

  strokeWeight(1);

  for (let index = 0; index < totalSubdivisions; index++) {
    const subIndex = index % config.subdivisionsPerBeat;

    if (subIndex === 0) continue;

    const tick = subIndex === halfBeat
      ? SUBDIVISION_TICKS.halfBeat
      : SUBDIVISION_TICKS.other;

    const x = getXInArea(area, index / totalSubdivisions);
    const half = tick.length / 2;

    stroke(tick.shade);

    for (const laneName of LANE_ORDER) {
      const y = getLaneYInArea(area, laneName);

      line(x, y - half, x, y + half);
    }
  }
}

function drawScoreBeatGrid(area) {
  const config =
    getCurrentLevelConfig();

  for (
    let beat = 0;
    beat <= config.beatsPerBar;
    beat++
  ) {
    const t =
      beat /
      config.beatsPerBar;

    const x =
      getXInArea(
        area,
        t
      );

    stroke(
      beat === 0
        ? 100
        : 45
    );

    strokeWeight(
      beat === 0
        ? 2
        : 1
    );

    line(
      x,
      area.y - 15,
      x,
      area.y + area.height + 15
    );

    if (
      beat <
      config.beatsPerBar
    ) {
      noStroke();
      fill(90);

      textAlign(
        CENTER,
        CENTER
      );

      textSize(FONT_SIZES.beatNumber);

      text(
        beat + 1,
        x + 7,
        area.y - 16
      );
    }
  }
}

// ============================================================
// DESENHO — FEEDBACK
// ============================================================

const JUDGEMENT_COLORS = { PERFECT: [0, 255, 120], GOOD: [255, 220, 40], OK: [200] };

function drawJudgement() {
  if (GAME.judgementTimer <= 0) return;

  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.judgement);

  fill(...(JUDGEMENT_COLORS[GAME.lastJudgement] ?? [255, 70, 70]));

  text(GAME.lastJudgement, SCREEN_SIZE.width / 2, SCREEN_SIZE.height - 70);

}

// ============================================================
// FOOTER
//
// Score e combo, centrados.
// ============================================================

function drawFooter() {
  push();

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.footer);
  fill(200);

  text(
    `SCORE ${GAME.score}   ·   COMBO x${GAME.combo}`,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height - 30
  );

  pop();
}

// ============================================================
// DESENHO — AS DUAS PARTITURAS
//
// O preview passa a ativo sem mudar de sítio. O preview é
// sempre desenhado, mesmo sem notas visíveis.
// ============================================================

function drawGameArea() {
  const areas =
    getScoreAreas();

  const activeArea =
    GAME.activeSide === "left" ? areas.left : areas.right;

  const previewArea =
    GAME.activeSide === "left" ? areas.right : areas.left;

  drawScore(
    activeArea,
    GAME.events,
    true,
    GAME.eventResults
  );

  drawScore(
    previewArea,
    GAME.nextEvents,
    false,
    null
  );
}

// ============================================================
// FUNDO DOS OVERLAYS
//
// Pinta o canvas inteiro, incluindo as barras fora de 16:9.
// ============================================================

function fillVisibleScreen(...color) {
  const area = getVisibleArea();

  noStroke();
  fill(...color);
  rect(area.x, area.y, area.width, area.height);
}

// ============================================================
// COUNTDOWN – OVERLAY
// ============================================================

function drawCountdownOverlay() {
  if (
    GAME.state !== "countdown" ||
    GAME.countdownBeat === null
  ) {
    return;
  }

  const config =
    getCurrentLevelConfig();

  const number =
    config.beatsPerBar -
    GAME.countdownBeat;

  push();

  // Fundo semi-transparente
  fillVisibleScreen(0, 140);

  // Número
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.countdownNumber);

  text(
    number,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height / 2
  );

  pop();
}

// ============================================================
// NEXT LEVEL – OVERLAY
//
//   1. fade para preto opaco (o corte gera o nível novo)
//   2. o fundo alivia e o texto aparece
// ============================================================

function drawNextLevelOverlay() {
  if (GAME.state !== "nextlevel" || GAME.nextLevelAudioTime === null) {
    return;
  }

  const config = getCurrentLevelConfig();

  const number =
    config.beatsPerBar - (GAME.countdownBeat ?? 0);

  const elapsed = audioCtx.currentTime - GAME.nextLevelAudioTime;
  const progress = constrain(elapsed / NEXT_LEVEL_TRANSITION.durationSeconds, 0, 1);
  const cutProgress =
    NEXT_LEVEL_TRANSITION.cutSeconds / NEXT_LEVEL_TRANSITION.durationSeconds;

  let bgAlpha, textAlpha;

  if (progress < cutProgress) {
    // Fase 1
    bgAlpha = map(progress, 0, cutProgress, 0, 255);
    textAlpha = 0;
  } else {
    // Fase 2
    const revealProgress = map(progress, cutProgress, 1, 0, 1);

    bgAlpha = lerp(255, 140, revealProgress);
    textAlpha = 255 * revealProgress;
  }

  push();

  // Fundo
  fillVisibleScreen(0, bgAlpha);

  // Número
  fill(255, textAlpha);
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.overlayLevelLabel);

  const levelText = `LEVEL ${GAME.level}`

  text(
    levelText,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height / 2 - 56
  );

  textSize(FONT_SIZES.countdownNumber);
  text(
    number,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height / 2 + 56
  );


  // HUD — informação do jogo numa única linha

  fill(255, textAlpha);
  textStyle(NORMAL)
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.overlayHud);

  const hudY = SCREEN_SIZE.height / 2 + SCREEN_SIZE.height / 4;

  const items = [
    `${config.bpm} BPM`,
    `LIVES x${GAME.lives}`
  ];

  const left = SCREEN_SIZE.width / 4;
  const right = SCREEN_SIZE.width - SCREEN_SIZE.width / 4;

  for (let i = 0; i < items.length; i++) {
    const x = map(i, 0, items.length - 1, left, right);
    text(items[i], x, hudY);
  }

  pop();
}

// ============================================================
// LIFE LOST – OVERLAY
//
// Entra com zoom. Até o countdown começar mostra o total de tempos.
// ============================================================


function drawLiveLostOverlay() {
  if (GAME.state !== "lifelost") return;

  const config = getCurrentLevelConfig();

  const number =
    config.beatsPerBar - (GAME.countdownBeat ?? 0);

  const zoomScale = getLifeLostZoomScale();

  push();

  translate(SCREEN_SIZE.width / 2, SCREEN_SIZE.height / 2);
  scale(zoomScale);
  translate(-SCREEN_SIZE.width / 2, -SCREEN_SIZE.height / 2);

  // Fundo semi-transparente
  fillVisibleScreen(0, 140);

  // Número
  fill(255, 70, 70);
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.overlayLevelLabel);

  const levelText = `LIFE LOST`

  text(
    levelText,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height / 2 - 56
  );

  textSize(FONT_SIZES.countdownNumber);
  text(
    number,
    SCREEN_SIZE.width / 2,
    SCREEN_SIZE.height / 2 + 56
  );


  // HUD — informação do jogo numa única linha

  textStyle(NORMAL)
  textAlign(CENTER, CENTER);
  textSize(FONT_SIZES.overlaySubHud);

  const hudY = SCREEN_SIZE.height / 2 + SCREEN_SIZE.height / 4;

  text(`LEVEL PROGRESS LOST   ·   LIVES x${GAME.lives}`, SCREEN_SIZE.width / 2, hudY);

  pop();
}

// Subida linear, descida em raiz quadrada.
function getLifeLostZoomScale() {
  const elapsed = audioCtx.currentTime - GAME.lifeLostAudioTime;
  const { attackSeconds, durationSeconds, peakScale } = LIFE_LOST_ZOOM;

  if (elapsed >= durationSeconds) return 1;

  if (elapsed < attackSeconds) {
    return 1 + (peakScale - 1) * (elapsed / attackSeconds);
  }

  const decayProgress =
    (elapsed - attackSeconds) / (durationSeconds - attackSeconds);

  return peakScale - (peakScale - 1) * Math.sqrt(decayProgress);
}


// ============================================================
// GAME OVER – OVERLAY
//
// Pisca 3 vezes e depois fica fixo.
// ============================================================

function drawGameOverOverlay() {
  if (GAME.state !== "gameover") return;

  const blink = floor((frameCount - GAME.gameOverStartFrame) / 12);
  const showTitle = blink >= 6 || blink % 2 === 0;


  if (showTitle) {
    push();

    fillVisibleScreen(0, 200);


    fill(255, 70, 70);
    textAlign(CENTER, CENTER);
    textSize(FONT_SIZES.gameOverTitle);

    // Tremor aleatório por frame.
    const shakeAmount = 5;
    text(
      "GAME OVER",
      SCREEN_SIZE.width / 2 + random(-shakeAmount, shakeAmount),
      SCREEN_SIZE.height / 2 + random(-shakeAmount, shakeAmount)
    );


    // ----------------------------------------------------------
    // HUD — informação do jogo numa única linha
    // ----------------------------------------------------------
    textStyle(NORMAL)
    textAlign(CENTER, CENTER);
    textSize(FONT_SIZES.gameOverHud);

    const hudY = SCREEN_SIZE.height - SCREEN_SIZE.height / 4;

    const items = [
      `LEVEL ${GAME.level}`,
      `BAR ${GAME.barNumber}`,
      `SCORE ${GAME.score}`,
      `BEST COMBOx${GAME.maxCombo}`,
    ];

    const left = 90;
    const right = SCREEN_SIZE.width - 150;

    for (let i = 0; i < items.length; i++) {
      const x = map(i, 0, items.length - 1, left, right);
      text(items[i], x, hudY);
    }

    pop();
  }
}

// ============================================================
// STANDBY — ECRÃ DE ESPERA
//
// Título branco com contorno nas cores das filas.
// ============================================================

const STANDBY_TITLE = "PRESS START";

// O espaço da fonte é estreito de mais para separar as duas
// palavras, por isso vale por si em vez de letra + letterGap.
const STANDBY_TITLE_WORD_GAP = 45;

// A fonte é monoespaçada: o avanço é igual para todas as letras,
// mas a tinta não. O T ocupa a largura toda só na barra de cima
// e por isso abre um buraco que as outras não abrem. Aperta-se
// à mão, letra a letra, em pixels.
const STANDBY_TITLE_KERNING = { T: -10 };

function getStandbyKerning(letter) {
  return STANDBY_TITLE_KERNING[letter] ?? 0;
}

function getStandbyLetterAdvance(letter, letterGap) {
  return letter === " "
    ? STANDBY_TITLE_WORD_GAP
    : textWidth(letter) + letterGap;
}

// "PRESS" e "START" mudam de cor. Espaços feitos em pixels
// (o espaço na string não renderizava).
const STANDBY_PROMPT_PREFIX = "PRESS";
const STANDBY_PROMPT_MIDDLE = "ANY BUTTON TO";
const STANDBY_PROMPT_SUFFIX = "START";
const STANDBY_PROMPT_GAP = 10;

// Ciclo: branco, pisca, vermelho, pisca. O contorno do título
// só aparece na fase branca.
const STANDBY_CYCLE_HOLD_FRAMES = 40;
const STANDBY_CYCLE_GAP_FRAMES = 10;

function drawStandbyOverlay() {
  if (GAME.state !== "standby") return;

  background(12);

  push();

  const cycleLength =
    2 * (STANDBY_CYCLE_HOLD_FRAMES + STANDBY_CYCLE_GAP_FRAMES);
  const cycleT = frameCount % cycleLength;

  const inWhiteHold = cycleT < STANDBY_CYCLE_HOLD_FRAMES;
  const inRedHold =
    cycleT >= STANDBY_CYCLE_HOLD_FRAMES + STANDBY_CYCLE_GAP_FRAMES &&
    cycleT < 2 * STANDBY_CYCLE_HOLD_FRAMES + STANDBY_CYCLE_GAP_FRAMES;

  textAlign(LEFT, CENTER);
  textSize(FONT_SIZES.standbyTitle);

  const titleOutlineWeight = 6;
  strokeWeight(titleOutlineWeight);

  // Folga para o contorno, que textWidth() não mede.
  const letterGap = titleOutlineWeight * 1.5 + 5;

  const titleY = SCREEN_SIZE.height / 2 - 30;

  let totalWidth = -letterGap;
  for (const letter of STANDBY_TITLE) {
    totalWidth +=
      getStandbyKerning(letter) + getStandbyLetterAdvance(letter, letterGap);
  }

  let x = SCREEN_SIZE.width / 2 - totalWidth / 2;

  for (let i = 0; i < STANDBY_TITLE.length; i++) {
    const letter = STANDBY_TITLE[i];
    const lane = LANE_ORDER[i % LANE_ORDER.length];

    if (inWhiteHold) {
      stroke(...LANES[lane].color);
    } else {
      noStroke();
    }

    // O acerto vem antes: encosta esta letra à anterior.
    x += getStandbyKerning(letter);

    fill(255);
    text(letter, x, titleY);
    x += getStandbyLetterAdvance(letter, letterGap);
  }

  noStroke();
  textSize(FONT_SIZES.standbyPrompt);

  const promptY = titleY + 70;

  if (inWhiteHold || inRedHold) {
    const accentColor = inRedHold ? [255, 70, 70] : [255, 255, 255];

    const middleWidth = textWidth(STANDBY_PROMPT_MIDDLE);
    const leftEdge = SCREEN_SIZE.width / 2 - middleWidth / 2 - STANDBY_PROMPT_GAP;
    const rightEdge = SCREEN_SIZE.width / 2 + middleWidth / 2 + STANDBY_PROMPT_GAP;

    textAlign(CENTER, CENTER);
    fill(255);
    text(STANDBY_PROMPT_MIDDLE, SCREEN_SIZE.width / 2, promptY);

    textAlign(RIGHT, CENTER);
    fill(...accentColor);
    text(STANDBY_PROMPT_PREFIX, leftEdge, promptY);

    textAlign(LEFT, CENTER);
    fill(...accentColor);
    text(STANDBY_PROMPT_SUFFIX, rightEdge, promptY);
  }

  pop();
}

// ============================================================
// ROTATE — ECRÃ NA VERTICAL
//
// Centrado na área visível: na vertical o retângulo do jogo é
// só uma faixa estreita.
// ============================================================

function drawRotateOverlay() {
  const area = getVisibleArea();

  push();

  noStroke();
  textAlign(CENTER, CENTER);
  fill(235);
  textSize(FONT_SIZES.rotateTitle);

  text(
    "ROTATE SCREEN",
    area.x + area.width / 2,
    area.y + area.height / 2
  );

  pop();
}

// ============================================================
// SCREEN WIPE
//
// Preto: sobe a opaco até ao corte, desce a zero até ao fim.
// ============================================================

function drawScreenWipe(startFrame) {
  if (startFrame === null) return;

  const elapsedFrames = frameCount - startFrame;

  if (elapsedFrames >= SCREEN_WIPE.durationFrames) return;

  const progress = elapsedFrames / SCREEN_WIPE.durationFrames;
  const cutProgress = SCREEN_WIPE.cutFrames / SCREEN_WIPE.durationFrames;

  const bgAlpha = progress < cutProgress
    ? map(progress, 0, cutProgress, 0, 255)
    : map(progress, cutProgress, 1, 255, 0);

  fillVisibleScreen(0, bgAlpha);
}

function drawStandbyExitOverlay() {
  drawScreenWipe(GAME.standbyExitStartFrame);
}

function drawGameOverExitOverlay() {
  drawScreenWipe(GAME.gameOverExitStartFrame);
}