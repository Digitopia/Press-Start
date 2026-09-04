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
    allowedSubdivisions: [0, 2],
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
    allowedSubdivisions: [0, 2, 3],
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
    allowedSubdivisions: [0, 1, 2, 3],
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
    allowedSubdivisions: [0, 1, 2, 3, 5],
    density: 0.6,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  })
];