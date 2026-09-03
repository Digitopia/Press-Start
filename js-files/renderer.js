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

function drawScore(area, events, isActive) {
  push();

  // Preview mais discreto.
  drawingContext.globalAlpha =
    isActive ? 1.0 : 0.35;

  drawScoreLabel(area, isActive);
  drawScoreLaneGuides(area);
  drawScoreBeatGrid(area);
  drawScorePath(area, events);
  drawScoreEvents(area, events);

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

function drawScoreEvents(area, events) {
  for (const event of events) {
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
      GAME.eventResults.get(
        event.id
      );

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

function drawScoreBall(
  area,
  events
) {
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
// GEOMETRIA DAS QUATRO FILAS
// ============================================================

function getPlayArea() {
  return { left: 65, right: width - 45, top: 145, bottom: height - 110 };
}

function getLaneY(lane) {
  const area = getPlayArea();
  const index = LANE_ORDER.indexOf(lane);

  if (index === -1) {
    return (area.top + area.bottom) / 2;
  }

  const spacing = (area.bottom - area.top) / (LANE_ORDER.length - 1);
  return area.top + index * spacing;
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
// ============================================================

function drawHeader() {
  const config = getCurrentLevelConfig();

  // ----------------------------------------------------------
  // TÍTULO
  // ----------------------------------------------------------

  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(22);
  fill(235);

  text(
    "PRESS START",
    width / 2,
    28
  );

  // ----------------------------------------------------------
  // HUD — informação do jogo numa única linha
  // ----------------------------------------------------------

  textStyle(NORMAL);
  textSize(11);
  fill(145);

  const hudY = 65;

  const items = [
    `LEVEL ${GAME.level}`,
    `${config.bpm} BPM`,
    `BAR ${GAME.barNumber}`,
    `SCORE ${GAME.score}`,
    `COMBO x${GAME.combo}`,
    `BEST x${GAME.maxCombo}`
  ];

  // Distribuir uniformemente pela largura do ecrã.
  const left = 90;
  const right = width - 90;

  for (let i = 0; i < items.length; i++) {
    const x = map(
      i,
      0,
      items.length - 1,
      left,
      right
    );

    text(
      items[i],
      x,
      hudY
    );
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
      area.x - 18,
      y - 4,
      10,
      8
    );
  }
}
// ============================================================
// DESENHO — GRELHA DE TEMPOS
// ============================================================

function drawBeatGrid() {
  const config = getCurrentLevelConfig();
  const area = getPlayArea();

  for (let beat = 0; beat <= config.beatsPerBar; beat++) {
    const t = beat / config.beatsPerBar;
    const x = lerp(area.left, area.right, t);

    stroke(beat === 0 ? 100 : 45);
    strokeWeight(beat === 0 ? 2 : 1);
    line(x, area.top - 25, x, area.bottom + 25);

    if (beat < config.beatsPerBar) {
      noStroke();
      fill(90);
      textAlign(CENTER, CENTER);
      textSize(9);
      text(beat + 1, x + 7, area.top - 16);
    }
  }
}

// ============================================================
// DESENHO — PERCURSO
// ============================================================

function drawPath() {
  stroke(75);
  strokeWeight(2);
  noFill();

  beginShape();
  for (const point of GAME.pathPoints) {
    vertex(point.x, point.y);
  }
  endShape();
}

// ============================================================
// DESENHO — NOTAS
// ============================================================

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
// DESENHO — BOLA
// ============================================================

function drawBall() {
  const point = getPointOnTimedPath(GAME.pathPoints, GAME.ballPosition);

  noStroke();
  fill(255);
  circle(point.x, point.y, GAME.ballDiameter);
}

// ============================================================
// DESENHO — FEEDBACK
// ============================================================

const JUDGEMENT_COLORS = { PERFECT: [255], GOOD: [200], OK: [150] };

function drawJudgement() {
  if (GAME.judgementTimer <= 0) return;

  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(24);

  fill(...(JUDGEMENT_COLORS[GAME.lastJudgement] ?? [255, 80, 80]));

  text(GAME.lastJudgement, width / 2, height - 70);

  textStyle(NORMAL);
}

// ============================================================
// FOOTER / LEGENDA DE TESTE
// ============================================================

function drawFooter() {
  textAlign(CENTER, CENTER);
  textSize(10);
  fill(100);
  text("1 BLUE   2 GREEN   3 YELLOW   4 RED   ·   SPACE START/PAUSE   ·   ↑↓ LEVEL", width / 2, height - 25);
}

function drawGameArea() {
  const areas =
    getScoreAreas();

  // Por enquanto ambos mostram
  // exatamente o mesmo compasso.
  drawScore(
    areas.left,
    GAME.events,
    true
  );

  drawScore(
    areas.right,
    GAME.events,
    false
  );
}