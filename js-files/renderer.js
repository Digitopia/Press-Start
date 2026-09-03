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

  fill(230);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(15);
  textStyle(BOLD);
  text("PRESS START", width / 2, 25);

  textStyle(NORMAL);
  textSize(11);
  fill(160);
  text(`LEVEL ${GAME.level}   ·   ${config.bpm} BPM   ·   BAR ${GAME.barNumber}`, width / 2, 50);
  text(`SCORE ${GAME.score}   ·   COMBO x${GAME.combo}   ·   BEST x${GAME.maxCombo}`, width / 2, 70);

  fill(110);
  text(GAME.state.toUpperCase(), width / 2, 91);
}

// ============================================================
// DESENHO — FILAS
// ============================================================

function drawLaneGuides() {
  const area = getPlayArea();

  for (const laneName of LANE_ORDER) {
    const lane = LANES[laneName];
    const y = getLaneY(laneName);

    stroke(...lane.color, 35);
    strokeWeight(1);
    line(area.left, y, area.right, y);

    // Pequeno indicador à esquerda
    noStroke();
    fill(...lane.color);
    rect(area.left - 25, y - 4, 12, 8);
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

function drawEvents() {
  const area = getPlayArea();

  for (const event of GAME.events) {
    const lane = LANES[event.lane];
    const x = lerp(area.left, area.right, event.t);
    const y = getLaneY(event.lane);
    const result = GAME.eventResults.get(event.id);

    // Já foi resolvida:
    // fica muito mais discreta.
    if (result) {
      noStroke();
      fill(...lane.color, 45);
      circle(x, y, 8);
      continue;
    }

    noStroke();
    fill(...lane.color);
    circle(x, y, 13);

    // halo subtil
    noFill();
    stroke(...lane.color, 90);
    circle(x, y, 19);
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