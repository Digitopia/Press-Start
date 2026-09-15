// ============================================================
// GERAÇÃO DE UM COMPASSO NOVO
//
// 1. Sorteia quais filas (cores) estão ativas neste compasso
//    — sempre `laneCount` filas, escolhidas ao acaso.
// 2. Percorre cada beat e decide, através de `density`, se recebe
//    uma das células definidas em `allowedRhythms`.
// 3. No primeiro compasso de cada nível, o beat 1 pode ser
//    reservado como silêncio através de `allowNotesOnFirstBeat`.
//
// No fim, garante o mínimo de notas configurado, reforçando ou
// acrescentando células sempre que a primeira passagem não chega.
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
// laneChangesWithinCell decide quantas mudanças de fila cabem
// lá dentro:
//
//   "none"   a célula inteira numa fila só
//   "split"  a célula parte-se em dois blocos, um por fila
//   "free"   cada nota escolhe fila
//
// Uma célula de uma nota não tem "dentro": os três modos
// coincidem, e por isso o caso é tratado logo no primeiro ramo.
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
    // Os dois blocos têm de ser contíguos no TEMPO, por isso a
    // célula é lida por ordem, mesmo que venha escrita
    // desordenada na configuração.
    const ordered = [...rhythm].sort((a, b) => a - b);

    // O corte nunca cai na primeira nota: se caísse, não havia
    // primeiro bloco e a célula voltava a ser de uma cor só.
    const splitIndex = 1 + floor(random(ordered.length - 1));

    let lane = pickRandomLane(
      activeLanes,
      lastLane,
      config.avoidConsecutiveRepeat
    );

    for (let index = 0; index < ordered.length; index++) {
      // A mudança é o objetivo deste modo, por isso o segundo
      // bloco troca SEMPRE de fila — independentemente do
      // avoidConsecutiveRepeat, que regula a fronteira entre
      // células e não esta.
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

// Reforça a estrutura rítmica até atingir o mínimo. Uma célula
// já existente pode ser trocada por outra mais densa, evitando
// situações em que todos os beats ficam ocupados mas o mínimo
// continua por cumprir.
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

    // validateGenerationRules() garante que existe sempre uma
    // sequência de upgrades capaz de alcançar o mínimo.
    rhythms[chosen.beatIndex] = chosen.rhythm;
    noteCount += chosen.addedNotes;
  }
}

function generateBar(config, { allowNotesOnFirstBeat = true } = {}) {
  validateGenerationRules(config, allowNotesOnFirstBeat);

  const activeLanes = pickActiveLanes(config.laneCount);
  const rhythms = new Array(config.beatsPerBar).fill(null);

  for (let beatIndex = 0; beatIndex < config.beatsPerBar; beatIndex++) {
    // density decide SE este beat tem ritmo, ou fica em silêncio.
    // No primeiro compasso de cada nível, o primeiro tempo é reservado.
    if ((beatIndex > 0 || allowNotesOnFirstBeat) && random() < config.density) {
      rhythms[beatIndex] =
        config.allowedRhythms[floor(random(config.allowedRhythms.length))];
    }
  }

  ensureMinimumRhythms(rhythms, config, allowNotesOnFirstBeat);

  // Só depois de a estrutura rítmica estar fechada atribuímos
  // as filas, sempre por ordem temporal. Assim, a regra de não
  // repetir uma fila consecutivamente é realmente garantida.
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