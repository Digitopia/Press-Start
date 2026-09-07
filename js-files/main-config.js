const SCREEN_SIZE = { width: 960, height: 540 };

// ============================================================
// CONFIGURAÇÃO PARTITURAS
// margens para configuração com getScoreAreas() - renderer,js
// ============================================================

const SCORE_LAYOUT = {
  marginX: 50,
  top: 150,
  bottom: 430,
  gap: 50
};

// ============================================================
// JANELAS DE ACERTO
// valores em MILISSEGUNDOS
// ============================================================

const DEFAULT_HIT_WINDOWS = { perfect: 55, good: 100, ok: 160 };

// ============================================================
// QUATRO FILAS / INSTRUMENTOS
// A ordem corresponde às quatro filas físicas do MIDI Fighter
// ============================================================

const LANE_ORDER = ["blue", "green", "yellow", "red"];

const LANES = {
  blue: { color: [60, 150, 255], frequency: 1200 },
  green: { color: [0, 255, 120], frequency: 850 },
  yellow: { color: [255, 220, 40], frequency: 550 },
  red: { color: [255, 70, 70], frequency: 220 }
};

// ============================================================
// CONFIGURAÇÃO MIDI
//
// Depois de ligares o Spectra:
// 1. abre a consola
// 2. carrega nos 16 botões
// 3. o código mostra os números MIDI
//
// Depois colocamos aqui os 4 números de cada fila.
// ============================================================

const MIDI_ROW_NOTES = { blue: [], green: [], yellow: [], red: [] };

const MIDI = { access: null, input: null };

// ============================================================
// NÍVEIS — AGORA SÃO "SEMENTES DE REGRAS"
//
// Cada nível já não tem um "beats" fixo. Em vez disso define
// as regras que controlam a dificuldade:
//
//   bpm                    velocidade
//   beatsPerBar            tempos por compasso
//   subdivisionsPerBeat    subdivisões dentro de cada tempo
//   lanes                  filas permitidas neste nível
//   density                probabilidade (0–1) de uma
//                          subdivisão ter nota
//   avoidConsecutiveRepeat evita repetir a mesma fila
//                          duas vezes seguidas
//   allowLaneChangesWithinCell permite que as notas de uma
//                              célula usem filas diferentes
//
// O CONTEÚDO (que fila soa em cada subdivisão) é gerado
// aleatoriamente, de novo, a cada compasso.
// ============================================================

function createLevelRules({
  bpm,
  beatsPerBar,
  subdivisionsPerBeat = 4,

  // Quantas filas distintas entram em jogo neste nível
  // (1 a 4). QUAIS filas (cor) são usadas é sorteado de
  // novo a cada compasso — laneCount controla só a
  // quantidade, não a identidade.
  laneCount = 1,

  // Banco de células rítmicas.
  // Cada célula é um array de subdivisões ativas dentro de UM beat.
  allowedRhythms,

  // density controla a probabilidade de um beat 
  // ter notas ou ficar em silêncio, não cada subdivisão individual.
  density,

  minNotesPerBar = 1,
  avoidConsecutiveRepeat = false,
  allowLaneChangesWithinCell = false,
  hitWindows = DEFAULT_HIT_WINDOWS
}) {
  return {
    bpm,
    beatsPerBar,
    subdivisionsPerBeat,
    laneCount,
    allowedRhythms: allowedRhythms ?? [[...Array(subdivisionsPerBeat).keys()]],
    density,
    avoidConsecutiveRepeat,
    allowLaneChangesWithinCell,
    minNotesPerBar,
    hitWindows,
    crossingDurationMs: (60000 / bpm) * beatsPerBar,
    // preenchido a cada compasso por generateBar()
    beats: []
  };
}
