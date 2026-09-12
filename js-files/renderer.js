// ============================================================
// ÁREAS DAS PARTITURAS
// ============================================================

function getScoreAreas() {
  const totalWidth =
    width -
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
  drawScoreBeatGrid(area);

  // A linha é decidida por ÁREA: dá um degrau intermédio em
  // que se mantém o contorno do compasso que se está a tocar
  // e se perde só a antecipação do seguinte.
  const config = getCurrentLevelConfig();

  if (isActive ? config.showScorePath : config.showPreviewPath) {
    drawScorePath(area, events);
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
  textSize(11);
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
// A bola avança de 0 a 1 dentro do compasso ativo. Para medir
// a distância a uma nota do PREVIEW somamos 1 ao seu t, o que
// coloca os dois compassos numa linha temporal contínua.
//
// Assim a janela de visibilidade atravessa a fronteira do
// compasso sem caso especial: no fim do compasso ativo já se
// acendem os primeiros tempos do preview.
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
  // drawScore() já definiu o alpha base do preview (0.35).
  // A revelação multiplica-o em vez de o substituir.
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
  events
) {
  const points =
    getScorePathPoints(
      area,
      events
    );

  stroke(75);
  strokeWeight(2);
  noFill();

  beginShape();

  for (const point of points) {
    vertex(
      point.x,
      point.y
    );
  }

  endShape();
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
// IMPORTANTE:
// usamos o valor "t" de cada ponto,
// não o comprimento geométrico da linha.
//
// Assim, uma diagonal não altera o ritmo.
// ============================================================

function getPointOnTimedPath(points, t) {
  if (points.length === 0) {
    return { x: width / 2, y: height / 2 };
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
// A linha do HUD é um bloco de altura fixa com três elementos
// alinhados: progresso do nível à esquerda, vidas ao centro,
// health à direita.
//
// Cada barra tem a legenda no topo do bloco e a barra colada
// ao fundo. Os corações ocupam a altura toda do bloco, para os
// três conjuntos ficarem alinhados em cima e em baixo.
//
// Os números vivem no footer e nos overlays.
// ============================================================

const HUD_LAYOUT = {
  margin: 90,

  // bloco
  rowTop: 78,
  rowHeight: 24,

  // barras
  barWidth: 260,
  barHeight: 6,
  labelSize: 7,

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
  textSize(22);
  fill(235);

  text("PRESS START", width / 2, titleY);


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
    width - HUD_LAYOUT.margin - HUD_LAYOUT.barWidth,
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

  textSize(HUD_LAYOUT.labelSize);
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

  const startX = width / 2 - totalWidth / 2;

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

      textSize(9);

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
  textSize(24);

  fill(...(JUDGEMENT_COLORS[GAME.lastJudgement] ?? [255, 70, 70]));

  text(GAME.lastJudgement, width / 2, height - 70);

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
  textSize(10);
  fill(200);

  text(
    `SCORE ${GAME.score}   ·   COMBO x${GAME.combo}`,
    width / 2,
    height - 30
  );

  pop();
}

// ============================================================
// DESENHO — AS DUAS PARTITURAS
//
// O compasso ativo não muda de sítio quando passa a preview:
// a área que era preview torna-se a ativa, e o preview novo
// nasce na área que acabou de ser tocada.
// ============================================================

// O preview é uma área fixa do ecrã: está sempre lá, com a
// etiqueta, as guias de fila e a grelha de tempos. O que pode
// acontecer é ficar SEM NOTAS — quando visibleBeatsAhead ainda
// não chegou ao compasso seguinte. A moldura vazia é, ela
// própria, informação.
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
  noStroke();
  fill(0, 140);
  rect(
    0,
    0,
    width,
    height
  );

  // Número
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(72);

  text(
    number,
    width / 2,
    height / 2
  );

  pop();
}

// ============================================================
// NEXT LEVEL – OVERLAY
// ============================================================

function drawNextLevelOverlay() {
  if (GAME.state !== "nextlevel" || GAME.countdownBeat === null) {
    return;
  }

  const config = getCurrentLevelConfig();

  const number =
    config.beatsPerBar - GAME.countdownBeat;

  push();

  // Fundo semi-transparente
  noStroke();
  fill(0, 140);
  rect(
    0,
    0,
    width,
    height
  );

  // Número
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(56);

  const levelText = `LEVEL ${GAME.level}`

  text(
    levelText,
    width / 2,
    height / 2 - 56
  );

  textSize(72);
  text(
    number,
    width / 2,
    height / 2 + 56
  );


  // HUD — informação do jogo numa única linha

  textStyle(NORMAL)
  textAlign(CENTER, CENTER);
  textSize(26);

  const hudY = height / 2 + height / 4;

  const items = [
    `${config.bpm} BPM`,
    `LIVES x${GAME.lives}`
  ];

  const left = width / 4;
  const right = width - width / 4;

  for (let i = 0; i < items.length; i++) {
    const x = map(i, 0, items.length - 1, left, right);
    text(items[i], x, hudY);
  }

  pop();
}

// ============================================================
// LIFE LOST – OVERLAY
// ============================================================


function drawLiveLostOverlay() {
  if (GAME.state !== "lifelost" || GAME.countdownBeat === null) {
    return;
  }

  const config = getCurrentLevelConfig();

  const number =
    config.beatsPerBar - GAME.countdownBeat;

  push();

  // Fundo semi-transparente
  noStroke();
  fill(0, 140);
  rect(
    0,
    0,
    width,
    height
  );

  // Número
  fill(255, 70, 70);
  textAlign(CENTER, CENTER);
  textSize(56);

  const levelText = `LIFE LOST`

  text(
    levelText,
    width / 2,
    height / 2 - 56
  );

  textSize(72);
  text(
    number,
    width / 2,
    height / 2 + 56
  );


  // HUD — informação do jogo numa única linha

  textStyle(NORMAL)
  textAlign(CENTER, CENTER);
  textSize(16);

  const hudY = height / 2 + height / 4;

  text(`LEVEL PROGRESS LOST   ·   LIVES x${GAME.lives}`, width / 2, hudY);

  pop();
}


// ============================================================
// GAME OVER – OVERLAY
//
// Sem countdown: pisca 3 vezes (fica invisível nas fases
// ímpares) e depois fica visível de forma sólida.
// ============================================================

function drawGameOverOverlay() {
  if (GAME.state !== "gameover") return;

  const blink = floor((frameCount - GAME.gameOverStartFrame) / 12);
  const showTitle = blink >= 6 || blink % 2 === 0; // true nas fases "acesas" ou depois de acabar de piscar


  if (showTitle) {
    push();

    noStroke();
    fill(0, 140);
    rect(0, 0, width, height);


    fill(255, 70, 70);
    textAlign(CENTER, CENTER);
    textSize(56);
    text("GAME OVER", width / 2, height / 2);


    // ----------------------------------------------------------
    // HUD — informação do jogo numa única linha
    // ----------------------------------------------------------
    textStyle(NORMAL)
    textAlign(CENTER, CENTER);
    textSize(14);

    const hudY = height - height / 4;

    const items = [
      `LEVEL ${GAME.level}`,
      `BAR ${GAME.barNumber}`,
      `SCORE ${GAME.score}`,
      `BEST COMBOx${GAME.maxCombo}`,
    ];

    const left = 90;
    const right = width - 150;

    for (let i = 0; i < items.length; i++) {
      const x = map(i, 0, items.length - 1, left, right);
      text(items[i], x, hudY);
    }

    pop();
  }
}