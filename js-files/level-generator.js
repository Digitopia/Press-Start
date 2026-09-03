// ============================================================
// GERAÇÃO DE UM COMPASSO NOVO
//
// 1. Sorteia quais filas (cores) estão ativas neste compasso
//    — sempre `laneCount` filas, escolhidas ao acaso.
// 2. Percorre cada beat. O BEAT 1 (índice 0) fica sempre
//    vazio: como a passagem de compasso é instantânea (sem
//    contagem/lead-in), uma nota logo ali seria impossível
//    de acertar a tempo.
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

function collectEmptySlots(beats, config) {
  const slots = [];

  for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
    const pattern = beats[beatIndex].pattern;

    for (const subIndex of config.allowedSubdivisions) {
      if (beatIndex === 0 && subIndex === 0) continue;   
        // continua proibido
      if (!pattern[subIndex]) {
        slots.push({ beatIndex, subIndex });
      }
    }
  }

  return slots;
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

  const emptySlots = shuffleInPlace(collectEmptySlots(beats, config));
  let lane = lastLane;
  let added = 0;

  for (const slot of emptySlots) {
    if (currentCount + added >= target) break;

    lane = pickRandomLane(activeLanes, lane, config.avoidConsecutiveRepeat);
    beats[slot.beatIndex].pattern[slot.subIndex] = lane;
    added++;
  }
}

function generateBar(config) {
  const activeLanes = pickActiveLanes(config.laneCount);
  const beats = [];
  let lastLane = null;
  let noteCount = 0;

  for (let beatIndex = 0; beatIndex < config.beatsPerBar; beatIndex++) {
    const pattern = new Array(config.subdivisionsPerBeat).fill(0);

    for (const subIndex of config.allowedSubdivisions) {

      // Único ponto impossível de acertar: o instante exato
      // da troca de compasso (beat 0, subdivisão 0). Tudo o
      // resto — incluindo as outras subdivisões do beat 0 —
      // já ocorre depois desse instante e tem tempo de reação.
      if (beatIndex === 0 && subIndex === 0) continue;

      if (random() < config.density) {
        const lane = pickRandomLane(activeLanes, lastLane, config.avoidConsecutiveRepeat);
        pattern[subIndex] = lane;
        lastLane = lane;
        noteCount++;
      }
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

// ============================================================
// CONSTRUIR O PERCURSO
//
// O percurso passa exatamente pelos eventos.
// Portanto:
//
// posição vertical = fila
// posição horizontal = tempo
//
// Se o próximo evento está noutra fila,
// aparece automaticamente uma diagonal.
// ============================================================

function buildPath(events) {
  const area = getPlayArea();

  // Sem eventos: linha ao centro.
  if (events.length === 0) {
    const centerY = (area.top + area.bottom) / 2;
    return [
      { t: 0, x: area.left, y: centerY },
      { t: 1, x: area.right, y: centerY }
    ];
  }

  const points = [];
  const firstLane = events[0].lane;

  // Começa já na altura da primeira nota.
  points.push({ t: 0, x: area.left, y: getLaneY(firstLane) });

  for (const event of events) {
    points.push({ t: event.t, x: lerp(area.left, area.right, event.t), y: getLaneY(event.lane) });
  }

  const lastLane = events[events.length - 1].lane;
  points.push({ t: 1, x: area.right, y: getLaneY(lastLane) });

  return removeDuplicateTimes(points);
}

function removeDuplicateTimes(points) {
  const result = [];

  for (const point of points) {
    const previous = result[result.length - 1];

    // Se há dois pontos exatamente
    // no mesmo instante, fica o último.
    if (previous && Math.abs(previous.t - point.t) < 0.000001) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }

  return result;
}