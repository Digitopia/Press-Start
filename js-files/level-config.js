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
    minNotesPerBar: 4,

    // O primeiro tempo do compasso de introdução fica vazio.
    // Como cada célula deste nível tem uma nota, só cabem três.
    introMinNotesPerBar: 3
  }),

  // ==========================================================
  // LEVEL 2 — DUAS FILAS
  // Introduz mudança de altura / instrumento.
  // ==========================================================

  createLevelRules({
    bpm: 63,
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
  // LEVEL 3 — Três FILAS
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 3,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [2, 3],
    ],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 4 — More Complex Rhythms, Quatro Filas
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [2, 3],
      [0, 1, 3]
    ],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

    // ==========================================================
    // LEVEL 5 — Even More Complex Rhythms
    // ==========================================================

    createLevelRules({
    bpm: 72,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [1],
      [3],
      [0, 2],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3]
    ],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 6 — TERNÁRIO / SUBDIVISÃO EM 6
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
