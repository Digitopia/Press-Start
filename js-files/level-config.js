const LEVEL_CONFIGS = [

  // ==========================================================
  // LEVEL 1 — UMA SÓ FILA
  // Aprender simplesmente QUANDO bater.
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 1,
    allowedRhythms: [
      [0],     // semínima
      [2]     // colcheia no contratempo
    ],
    density: 0.3,
    minNotesPerBar: 4
  }),

  // ==========================================================
  // LEVEL 2 — DUAS FILAS
  // Introduz mudança de altura / instrumento.
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 2,
    allowedRhythms: [
      [0],
      [0, 2],
      [2, 3]
    ],
    density: 0.4,
    minNotesPerBar: 4
  }),

  // ==========================================================
  // LEVEL 3 — QUATRO FILAS
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 3,
    allowedRhythms: [
      [0],
      [2],
      [2, 4],
      [0, 2],
      [0, 1, 3]
    ],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 4 — TERNÁRIO / SUBDIVISÃO EM 6
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 3,
    subdivisionsPerBeat: 6,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [0, 3],
      [0, 2, 3],
      [0, 4, 5]
    ],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  })
];