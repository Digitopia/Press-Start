
// ============================================================
// MIDI
// ============================================================

async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    console.log("Web MIDI não está disponível neste browser.");
    return;
  }

  try {
    MIDI.access = await navigator.requestMIDIAccess();
    setupMIDIDevices();
    MIDI.access.onstatechange = setupMIDIDevices;
  } catch (error) {
    console.error("Erro ao iniciar MIDI:", error);
  }
}

function setupMIDIDevices() {
  if (!MIDI.access) return;

  for (const input of MIDI.access.inputs.values()) {
    console.log("MIDI INPUT:", input.name);

    if (input.name.toLowerCase().includes("midi fighter")) {
      MIDI.input = input;
      MIDI.input.onmidimessage = handleMIDIMessage;
      console.log("MIDI Fighter ligado.");
    }
  }
}

function handleMIDIMessage(event) {
  const [status, note, velocity] = event.data;
  const command = status & 0xf0;
  const channel = status & 0x0f;

  // Apenas NOTE ON
  if (command !== 0x90 || velocity === 0) return;

  console.log(`NOTE ${note} | VELOCITY ${velocity} | CHANNEL ${channel + 1}`);

  // No standby, qualquer nota arranca o jogo em vez de bater fila.
  if (GAME.state === "standby") {
    exitStandby();
    return;
  }

  ensureAudioContext();

  const lane = getLaneFromMIDINote(note);
  if (lane) {
    tryLaneHit(lane);
  }
}

function getLaneFromMIDINote(note) {
  for (const lane of LANE_ORDER) {
    if (MIDI_ROW_NOTES[lane].includes(note)) {
      return lane;
    }
  }
  return null;
}

// ============================================================
// TECLADO — TESTE SEM MIDI FIGHTER
// ============================================================

const KEY_TO_LANE = { "1": "blue", "2": "green", "3": "yellow", "4": "red" };

function keyPressed() {

  // No standby, qualquer tecla arranca o jogo.
  if (GAME.state === "standby") {
    exitStandby();
    return false;
  }

  // R
  if (key === "r" || key === "R") {
    resetGame();
    return false;
  }

  // ↑ SETA PARA CIMA — nível anterior
  if (keyCode === 38) {
    handChangeLevel(GAME.level - 1);
    return false;
  }

  // ↓ SETA PARA BAIXO — nível seguinte
  if (keyCode === 40) {
    handChangeLevel(GAME.level + 1);
    return false;
  }

  // ==========================================================
  // FILAS
  // ==========================================================

  if (KEY_TO_LANE[key]) {
    tryLaneHit(KEY_TO_LANE[key]);
    return false;
  }
}