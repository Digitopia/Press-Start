// ============================================================
// createLevelRules() — PARÂMETROS
//
// OBRIGATÓRIOS
//   bpm                   velocidade (afeta também as janelas)
//   beatsPerBar           tempos por compasso (4 binário, 3 ternário)
//   density               0–1, hipótese de UM TEMPO ter notas
//
// RITMO
//   subdivisionsPerBeat   4 semicolcheias / 8 fusas / 6 ternário
//                         (duplicar = janelas a metade)
//   allowedRhythms        banco de células, ex. [0], [0,2], [0,1,2,3]
//                         (se omitido: rajada cheia — define sempre)
//   minNotesPerBar        mínimo por compasso
//                         máx: beatsPerBar × célula mais longa
//   introMinNotesPerBar   mínimo no 1.º compasso (tempo 1 vazio)
//                         defeito: proporcional ao minNotesPerBar
//                         máx: (beatsPerBar-1) × célula mais longa
//
// FILAS
//   laneCount             1–4; as cores são sorteadas a cada compasso
//   avoidConsecutiveRepeat      não repete fila seguida
//   laneChangesWithinCell       mudanças de fila DENTRO da célula
//                               "none"  uma cor por célula
//                               "split" a célula parte-se em dois
//                               "free"  cada nota escolhe fila
//
// VISIBILIDADE (não muda as regras, só a informação dada)
//   showSubdivisionGrid   riscos finos nas subdivisões do tempo
//   showScorePath         linha no compasso ativo
//   showPreviewPath       linha no preview (defeito: = showScorePath)
//   showScoreTrail        rasto atrás da bola quando não há linha
//                         (defeito: = !showScorePath)
//   trailFadeBeats        tempos até o rasto apagar (null = fica)
//   visibleBeatsAhead     tempos visíveis à frente da bola
//                         (null = tudo; atravessa os compassos)
//   revealFadeBeats       fade de entrada das notas (estético)
//
// TOLERÂNCIA
//   hitWindowRules        { perfect/good/ok: { ratio, maxMs } }
//
// CALCULADO
//   hitWindows            de bpm + subdivisões + allowedRhythms
//   crossingDurationMs    duração do compasso
//
// NOTA: as flags de visibilidade não são cumulativas entre níveis.
//
// FORA DAQUI (main-config.js, igual em todos os níveis)
//   HEALTH, FAILURES, LANES, MUSIC
// ============================================================

const LEVEL_CONFIGS = [

  // ==========================================================
  // LEVEL 1 — UMA SÓ FILA
  //
  // Aprender QUANDO bater.
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 4 notas em 4.0 s = 1.0 nota/segundo
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 1,
    allowedRhythms: [
      [0],     // semínima
      [2]      // colcheia no contratempo
    ],
    density: 0.3,
    minNotesPerBar: 4,

    // Tempo 1 vazio: só cabem três notas.
    introMinNotesPerBar: 3
  }),

  // ==========================================================
  // LEVEL 2 — DUAS FILAS
  //
  // Novidade: escolher a fila, e a célula [0,2].
  //
  // Janelas: PERFECT 55 / GOOD 100 / OK 160 ms
  // 4 notas em 4.0 s = 1.0 nota/segundo
  // ==========================================================

  createLevelRules({
    bpm: 60,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 2,
    allowedRhythms: [
      [0],
      [0, 2],
      [2]
    ],
    density: 0.4,
    minNotesPerBar: 4
  }),

  // ==========================================================
  // LEVEL 3 — O SALTO DE PRECISÃO
  //
  // Entra [2,3], duas notas coladas: o maior salto de precisão.
  // Duas filas sem repetição alternam sempre, foco no ritmo.
  //
  // Janelas: PERFECT 52 / GOOD 95 / OK 114 ms
  // 6 notas em 3.8 s = 1.6 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 63,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 2,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [2, 3]
    ],
    density: 0.5,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 4 — TRÊS FILAS
  //
  // Terceira fila. Sai [0,2], entra [0,3].
  //
  // Janelas: PERFECT 50 / GOOD 91 / OK 109 ms
  // 6 notas em 3.6 s = 1.7 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 3,
    allowedRhythms: [
      [0],
      [2],
      [0, 3],
      [2, 3]
    ],
    density: 0.5,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 5 — QUATRO FILAS, CÉLULAS DE TRÊS NOTAS
  //
  // Quarta fila e células de três notas: [0,2,3], [0,1,3].
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 6 notas em 3.4 s = 1.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 66,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 3],
      [0, 2],
      [2, 3],
      [0, 2, 3],
      [0, 1, 3]
    ],
    density: 0.55,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 6 — O TEMPO CHEIO, E A LINHA DESAPARECE
  //
  // Entra [0,1,2,3] (rajada numa cor). Sai a linha, que
  // ajudava a antecipar o salto da bola.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 8 notas em 3.4 s = 2.3 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.6,
    minNotesPerBar: 8,
    avoidConsecutiveRepeat: true,

    showScorePath: false,
    showPreviewPath: false
  }),

  // ==========================================================
  // LEVEL 7 — A CÉLULA PARTE-SE
  //
  // "split": a célula parte-se em dois blocos de cor.
  // Mesmo bpm do 6; o degrau é só a mudança de fila.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
  // 10 notas em 3.4 s = 2.9 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 70,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.7,
    minNotesPerBar: 10,
    avoidConsecutiveRepeat: true,
    laneChangesWithinCell: "split",

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false
  }),

  // ==========================================================
  // LEVEL 8 — DOIS TEMPOS À FRENTE
  //
  // Notas só visíveis a dois tempos: passa a ser reação.
  // Entra [1,3] (sem tempo forte) e "free" (fila por nota).
  // A partir daqui não é suposto ganhar-se.
  //
  // Janelas: PERFECT 43 / GOOD 79 / OK 95 ms
  // 12 notas em 3.2 s = 3.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 76,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.8,
    minNotesPerBar: 12,
    avoidConsecutiveRepeat: true,
    laneChangesWithinCell: "free",

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    visibleBeatsAhead: 2
  }),

  // ==========================================================
  // LEVEL 9 — UM TEMPO À FRENTE
  //
  // Reação a 4 escolhas ~350–450 ms: sem margem para corrigir.
  //
  // Janelas: PERFECT 41 / GOOD 75 / OK 90 ms
  // 14 notas em 3.0 s = 4.7 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 80,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.9,
    minNotesPerBar: 14,
    avoidConsecutiveRepeat: true,
    laneChangesWithinCell: "free",

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    visibleBeatsAhead: 1
  }),

  // ==========================================================
  // LEVEL 10 — SATURAÇÃO
  //
  // Densidade máxima (16 notas). Sai também o rasto.
  // É suposto ver-se até onde se vai.
  //
  // Janelas: PERFECT 39 / GOOD 71 / OK 86 ms
  // 16 notas em 2.9 s = 5.6 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 84,
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    laneCount: 4,
    allowedRhythms: [
      [0],
      [2],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 1.0,
    minNotesPerBar: 16,

    // O proporcional daria 12 (máximo), sempre saturado.
    introMinNotesPerBar: 10,

    avoidConsecutiveRepeat: true,
    laneChangesWithinCell: "free",

    showScorePath: false,
    showPreviewPath: false,
    showSubdivisionGrid: false,
    showScoreTrail: false, // tira o rasto da bola
    visibleBeatsAhead: 1
  })
];