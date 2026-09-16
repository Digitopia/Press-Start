// ============================================================
// GERAÇÃO DE UM COMPASSO NOVO
//
// 1. Sorteia `laneCount` filas ativas.
// 2. `density` decide se cada beat recebe uma célula rítmica.
// 3. `allowNotesOnFirstBeat` pode reservar o beat 1 em silêncio.
// 4. Reforça células até atingir o mínimo de notas.
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

  const choices =
    avoidRepeat && lastLane
      ? lanes.filter(lane => lane !== lastLane)
      : lanes;

  return choices[floor(random(choices.length))];
}

// Preenche uma célula rítmica e devolve a última fila usada.
//
//   "none"   a célula inteira numa fila
//   "split"  dois blocos, um por fila
//   "free"   cada nota escolhe fila
function fillRhythmCell(pattern, rhythm, config, activeLanes, lastLane) {
  const mode = config.laneChangesWithinCell;

  if (mode === "none" || rhythm.length === 1) {
    const lane = pickRandomLane(
      activeLanes,
      lastLane,
      config.avoidConsecutiveRepeat
    );

    for (const subIndex of rhythm) {
      pattern[subIndex] = lane;
    }

    return lane;
  }

  if (mode === "split") {
    // Ordena para os blocos serem contíguos no tempo.
    const ordered = [...rhythm].sort((a, b) => a - b);

    // Nunca corta na primeira nota (senão seria uma cor só).
    const splitIndex = 1 + floor(random(ordered.length - 1));

    let lane = pickRandomLane(
      activeLanes,
      lastLane,
      config.avoidConsecutiveRepeat
    );

    for (let index = 0; index < ordered.length; index++) {
      // O segundo bloco troca sempre de fila.
      if (index === splitIndex) {
        lane = pickRandomLane(activeLanes, lane, true);
      }

      pattern[ordered[index]] = lane;
    }

    return lane;
  }

  // "free"
  let lane = lastLane;

  for (const subIndex of rhythm) {
    lane = pickRandomLane(activeLanes, lane, config.avoidConsecutiveRepeat);
    pattern[subIndex] = lane;
  }

  return lane;
}


function getMinimumNotes(config, allowNotesOnFirstBeat) {
  return allowNotesOnFirstBeat
    ? config.minNotesPerBar
    : config.introMinNotesPerBar;
}

function validateGenerationRules(config, allowNotesOnFirstBeat) {
  if (!config.allowedRhythms.length) {
    throw new Error("allowedRhythms must contain at least one rhythm.");
  }

  for (const rhythm of config.allowedRhythms) {
    const uniqueSubdivisions = new Set(rhythm);
    const isValid =
      rhythm.length > 0 &&
      uniqueSubdivisions.size === rhythm.length &&
      rhythm.every(subdivision =>
        Number.isInteger(subdivision) &&
        subdivision >= 0 &&
        subdivision < config.subdivisionsPerBeat
      );

    if (!isValid) {
      throw new Error(`Invalid rhythm: [${rhythm.join(", ")}].`);
    }
  }

  const target = getMinimumNotes(config, allowNotesOnFirstBeat);
  const availableBeats =
    config.beatsPerBar - (allowNotesOnFirstBeat ? 0 : 1);
  const maxNotesPerBeat = Math.max(
    ...config.allowedRhythms.map(rhythm => rhythm.length)
  );

  if (!Number.isInteger(target) || target < 0) {
    throw new Error("The minimum number of notes must be a non-negative integer.");
  }

  if (target > availableBeats * maxNotesPerBeat) {
    throw new Error(
      `Cannot generate ${target} notes in ${availableBeats} available beats.`
    );
  }
}

// Adiciona ou troca células por outras mais densas até
// atingir o mínimo de notas.
function ensureMinimumRhythms(rhythms, config, allowNotesOnFirstBeat) {
  const target = getMinimumNotes(config, allowNotesOnFirstBeat);
  let noteCount = rhythms.reduce(
    (total, rhythm) => total + (rhythm?.length ?? 0),
    0
  );

  while (noteCount < target) {
    const candidates = [];

    for (let beatIndex = 0; beatIndex < rhythms.length; beatIndex++) {
      if (beatIndex === 0 && !allowNotesOnFirstBeat) continue;

      const currentLength = rhythms[beatIndex]?.length ?? 0;

      for (const rhythm of config.allowedRhythms) {
        if (rhythm.length <= currentLength) continue;

        candidates.push({
          beatIndex,
          rhythm,
          addedNotes: rhythm.length - currentLength
        });
      }
    }

    const remaining = target - noteCount;
    const candidatesWithoutOvershoot = candidates.filter(
      candidate => candidate.addedNotes <= remaining
    );
    const pool = candidatesWithoutOvershoot.length
      ? candidatesWithoutOvershoot
      : candidates;
    const chosen = pool[floor(random(pool.length))];

    // validateGenerationRules() garante que o mínimo é possível.
    rhythms[chosen.beatIndex] = chosen.rhythm;
    noteCount += chosen.addedNotes;
  }
}

function generateBar(config, { allowNotesOnFirstBeat = true } = {}) {
  validateGenerationRules(config, allowNotesOnFirstBeat);

  const activeLanes = pickActiveLanes(config.laneCount);
  const rhythms = new Array(config.beatsPerBar).fill(null);

  for (let beatIndex = 0; beatIndex < config.beatsPerBar; beatIndex++) {
    // density decide se o beat tem ritmo ou fica em silêncio.
    if ((beatIndex > 0 || allowNotesOnFirstBeat) && random() < config.density) {
      rhythms[beatIndex] =
        config.allowedRhythms[floor(random(config.allowedRhythms.length))];
    }
  }

  ensureMinimumRhythms(rhythms, config, allowNotesOnFirstBeat);

  // Filas atribuídas por ordem temporal, no fim, para garantir
  // a regra de não repetir filas seguidas.
  const beats = [];
  let lastLane = null;

  for (const rhythm of rhythms) {
    const pattern = new Array(config.subdivisionsPerBeat).fill(0);

    if (rhythm) {
      lastLane = fillRhythmCell(
        pattern,
        rhythm,
        config,
        activeLanes,
        lastLane
      );
    }

    beats.push({ pattern });
  }

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

      // Todos os beats têm a mesma duração.
      const beatProgress = beatIndex / beatCount;
      const subdivisionProgress = (subIndex / subdivisionCount) / beatCount;
      const t = beatProgress + subdivisionProgress;

      events.push({ id: `${beatIndex}-${subIndex}`, lane, t, beatIndex, subIndex });
    }
  }

  return events;
}