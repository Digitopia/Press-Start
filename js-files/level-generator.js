// ============================================================
// GERAÇÃO DE UM COMPASSO NOVO
//
// 1. Sorteia quais filas (cores) estão ativas neste compasso
//    — sempre `laneCount` filas, escolhidas ao acaso.
// 2. Percorre cada beat. O BEAT 1 (índice 0) fica sempre
//    vazio: como a passagem de compasso é instantânea (sem
//    contagem/lead-in), uma nota logo ali seria impossível
//    de acertar a tempo. ---- ISTO ESTÁ INATIVO (COMENTADO)
// 3. Nos restantes beats, só as posições em
//    `allowedSubdivisions` podem ter nota, e só com
//    probabilidade `density`.
//
// Garante sempre pelo menos uma nota no compasso.
// ============================================================

function pickActiveLanes(laneCount) {
  const pool = [...LANE_ORDER];
  const chosen = [];
  const count = constrain(laneCount, 1, pool.length);

  while (chosen.length < count) {
    const index = floor(random(pool.length));
    chosen.push(pool.splice(index, 1)[0]);
  }

  return chosen;
}

function pickRandomLane(lanes, lastLane, avoidRepeat) {
  if (lanes.length === 1) return lanes[0];

  let choice;
  let attempts = 0;

  do {
    choice = lanes[floor(random(lanes.length))];
    attempts++;
  } while (avoidRepeat && choice === lastLane && attempts < 8);

  return choice;
}

// Preenche uma célula rítmica e devolve a última fila usada.
// Por defeito, todas as notas da célula ficam na mesma fila.
// Níveis futuros podem permitir mudanças dentro da célula com
// allowLaneChangesWithinCell: true.
function fillRhythmCell(pattern, rhythm, config, activeLanes, lastLane) {
  let lane = lastLane;

  if (!config.allowLaneChangesWithinCell) {
    lane = pickRandomLane(activeLanes, lastLane, config.avoidConsecutiveRepeat);

    for (const subIndex of rhythm) {
      pattern[subIndex] = lane;
    }

    return lane;
  }

  for (const subIndex of rhythm) {
    lane = pickRandomLane(activeLanes, lane, config.avoidConsecutiveRepeat);
    pattern[subIndex] = lane;
  }

  return lane;
}


// Devolve os índices dos beats ainda completamente vazios
// (nenhuma subdivisão preenchida) — só esses podem receber
// uma célula rítmica nova, para nunca misturar duas células
// diferentes no mesmo beat.
function getEmptyBeatIndexes(beats) {
  const indexes = [];

  for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
    const isEmpty = beats[beatIndex].pattern.every(cell => !cell);
    if (isEmpty) indexes.push(beatIndex);
  }

  return indexes;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function fillUntilMinimum(beats, config, activeLanes, lastLane, currentCount) {
  const target = config.minNotesPerBar;
  if (currentCount >= target) return;

  const emptyBeats = shuffleInPlace(getEmptyBeatIndexes(beats));
  let lane = lastLane;
  let added = 0;

  for (const beatIndex of emptyBeats) {
    if (currentCount + added >= target) break;

    // Escolhe uma célula rítmica inteira para este beat,
    // tal como a fase principal de generateBar() já faz.
    const rhythm = config.allowedRhythms[floor(random(config.allowedRhythms.length))];

    lane = fillRhythmCell(
      beats[beatIndex].pattern,
      rhythm,
      config,
      activeLanes,
      lane
    );

    added += rhythm.length;
  }
}

function generateBar(config) {
  const activeLanes = pickActiveLanes(config.laneCount);
  const beats = [];
  let lastLane = null;
  let noteCount = 0;

  for (let beatIndex = 0; beatIndex < config.beatsPerBar; beatIndex++) {
    const pattern = new Array(config.subdivisionsPerBeat).fill(0);

    // density decide SE este beat tem ritmo, ou fica em silêncio.
    if (random() < config.density) {
      const rhythm = config.allowedRhythms[floor(random(config.allowedRhythms.length))];

      lastLane = fillRhythmCell(
        pattern,
        rhythm,
        config,
        activeLanes,
        lastLane
      );

      noteCount += rhythm.length;
    }

    beats.push({ pattern });
  }

  fillUntilMinimum(beats, config, activeLanes, lastLane, noteCount);

  return beats;
}


// ============================================================
// CONSTRUIR EVENTOS MUSICAIS
// ============================================================

function buildEvents(config) {
  const events = [];
  const beatCount = config.beats.length;

  for (let beatIndex = 0; beatIndex < beatCount; beatIndex++) {
    const beat = config.beats[beatIndex];
    const subdivisionCount = beat.pattern.length;

    for (let subIndex = 0; subIndex < subdivisionCount; subIndex++) {
      const lane = beat.pattern[subIndex];
      if (!lane) continue;

      // Cada beat ocupa exatamente a mesma
      // quantidade de tempo.
      const beatProgress = beatIndex / beatCount;
      const subdivisionProgress = (subIndex / subdivisionCount) / beatCount;
      const t = beatProgress + subdivisionProgress;

      events.push({ id: `${beatIndex}-${subIndex}`, lane, t, beatIndex, subIndex });
    }
  }

  return events;
}
