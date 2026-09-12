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
//                         máx: (beatsPerBar-1) × célula mais longa
//
// FILAS
//   laneCount             1–4; as cores são sorteadas a cada compasso
//   avoidConsecutiveRepeat      não repete fila seguida
//   allowLaneChangesWithinCell  cada nota da célula muda de fila
//
// VISIBILIDADE (não muda as regras, só a informação dada)
//   showScorePath         linha no compasso ativo
//   showPreviewPath       linha no preview (defeito: = showScorePath)
//   showScoreTrail        rasto atrás da bola quando não há linha
//                         (defeito: = !showScorePath)
//   trailFadeBeats        tempos até o rasto apagar (null = fica)
//   visibleBeatsAhead     tempos visíveis à frente da bola
//                         (null = tudo; atravessa os compassos)
//                         a área do preview fica sempre no ecrã,
//                         só pode ficar sem notas
//   revealFadeBeats       fade de entrada das notas (estético)
//
// TOLERÂNCIA
//   hitWindowRules        { perfect/good/ok: { ratio, maxMs } }
//
// CALCULADO
//   hitWindows            de bpm + subdivisões + allowedRhythms
//   crossingDurationMs    duração do compasso
//
// FORA DAQUI (main-config.js, igual em todos os níveis)
//   HEALTH, FAILURES, LANES, MUSIC
// ============================================================

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
    minNotesPerBar: 4,

    // TO TEST VISIBILITY RULES
    // showPreviewPath: false,
    // showScorePath: false,
    // visibleBeatsAhead: 1
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
  // LEVEL 5 — MAIS UMA CÉLULA
  //
  // Passo curto a partir do 4: entra só a célula [0,2,3].
  // As semicolcheias isoladas em posição ímpar ([1] e [3])
  // ficam para o 7, onde já há mais margem.
  //
  // Janelas: PERFECT 47 / GOOD 86 / OK 103 ms
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
      [0, 2, 3]
    ],
    density: 0.55,
    minNotesPerBar: 6,
    avoidConsecutiveRepeat: true
  }),

  // ==========================================================
  // LEVEL 6 — DENSIDADE, LINHA SÓ NO ATIVO
  //
  // Entra a célula cheia [0,1,2,3], o mínimo por compasso
  // sobe de 6 para 8, e o preview perde a linha.
  //
  // Janelas: PERFECT 43 / GOOD 79 / OK 95 ms
  // 8 notas em 3.2 s = 2.5 notas/segundo
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
      [2, 3],
      [0, 1, 3],
      [0, 2, 3],
      [0, 1, 2, 3]
    ],
    density: 0.7,
    minNotesPerBar: 8,
    introMinNotesPerBar: 6,
    avoidConsecutiveRepeat: true,

    // Mantém-se o contorno do que se está a tocar;
    // perde-se a antecipação do compasso seguinte.
    showPreviewPath: false
  }),

  // ==========================================================
  // LEVEL 7 — A LINHA DESAPARECE
  //
  // Primeira informação retirada. Sem o contorno perde-se a
  // antecipação de para onde a bola vai saltar — em troca, o
  // percurso passa a ser desenhado ATRÁS da bola, como rasto.
  //
  // Entram também [1,3] e allowLaneChangesWithinCell: uma
  // célula de quatro semicolcheias pode mudar de fila em cada
  // uma delas.
  //
  // Janelas: PERFECT 39 / GOOD 71 / OK 86 ms
  // 10 notas em 2.9 s = 3.5 notas/segundo
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
    density: 0.8,
    minNotesPerBar: 10,
    introMinNotesPerBar: 8,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false
  }),

  // ==========================================================
  // LEVEL 8 — DOIS TEMPOS À FRENTE
  //
  // As notas passam a acender-se só quando a bola está a dois
  // tempos de distância. A 96 bpm são 1250 ms de aviso: ainda
  // dá para ler, já não dá para planear o compasso.
  //
  // Deixa de ser leitura à primeira vista e passa a ser reação.
  //
  // Janelas: PERFECT 34 / GOOD 63 / OK 75 ms
  // 12 notas em 2.5 s = 4.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 96,
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
    density: 0.85,
    minNotesPerBar: 12,
    introMinNotesPerBar: 10,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    visibleBeatsAhead: 2
  }),

  // ==========================================================
  // LEVEL 9 — UM TEMPO À FRENTE
  //
  // 536 ms de aviso a 112 bpm. O tempo de reação de escolha
  // entre quatro alternativas anda pelos 350–450 ms — já não
  // sobra margem para errar a fila e corrigir.
  //
  // Janelas: PERFECT 29 / GOOD 54 / OK 64 ms
  // 14 notas em 2.1 s = 6.5 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 112,
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
    introMinNotesPerBar: 11,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    visibleBeatsAhead: 1
  }),

  // ==========================================================
  // LEVEL 10 — SATURAÇÃO
  //
  // density 1.0: nenhum tempo fica em silêncio, e o compasso
  // enche até ao máximo que a grelha permite.
  //
  // 455 ms de aviso, abaixo do tempo de reação de escolha.
  // Não é suposto ganhar-se: é suposto ver-se até onde se vai.
  //
  // O preview passa quase todo o compasso vazio: só acende no
  // último tempo, já com a bola a chegar ao fim.
  //
  // Janelas: PERFECT 25 / GOOD 45 / OK 55 ms
  // 16 notas em 1.8 s = 8.8 notas/segundo
  // ==========================================================

  createLevelRules({
    bpm: 132,
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
    introMinNotesPerBar: 12,
    avoidConsecutiveRepeat: true,
    allowLaneChangesWithinCell: true,

    showScorePath: false,
    visibleBeatsAhead: 1
  })
];