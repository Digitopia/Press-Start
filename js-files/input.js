
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

  MIDI.input = null;
  MIDI.output = null;

  for (const input of MIDI.access.inputs.values()) {
    console.log("MIDI INPUT:", input.name);

    if (input.name?.toLowerCase().includes(MIDI_SPECTRA.deviceName)) {
      MIDI.input = input;
      MIDI.input.onmidimessage = handleMIDIMessage;
      console.log("MIDI Fighter ligado.");
    }
  }

  for (const output of MIDI.access.outputs.values()) {
    console.log("MIDI OUTPUT:", output.name);

    if (output.name?.toLowerCase().includes(MIDI_SPECTRA.deviceName)) {
      MIDI.output = output;
      console.log("MIDI Fighter LEDs ligados.");
    }
  }

  syncSpectraLaneColors();
}

function handleMIDIMessage(event) {
  const [status, note, velocity] = event.data;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const isNoteOn = command === 0x90 && velocity > 0;
  const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

  if (!isNoteOn && !isNoteOff) return;

  console.log(`NOTE ${note} | VELOCITY ${velocity} | CHANNEL ${channel + 1}`);

  const lane = getLaneFromMIDINote(note);

  if (lane) {
    setSpectraPadPressed(note, isNoteOn);
  }

  // NOTE OFF serve apenas para voltar a acender o LED.
  if (!isNoteOn) return;

  // No standby, qualquer nota arranca o jogo em vez de bater fila.
  if (GAME.state === "standby") {
    exitStandby();
    return;
  }

  ensureAudioContext();

  if (lane) {
    tryLaneHit(lane);
  }
}

// ============================================================
// MIDI OUT — LEDS DO SPECTRA
// ============================================================

function sendMIDINote(channel, note, velocity) {
  if (!MIDI.output) return;

  const status = 0x90 | ((channel - 1) & 0x0f);

  try {
    MIDI.output.send([status, note, velocity]);
  } catch (error) {
    console.error("Erro ao enviar MIDI:", error);
  }
}

function setSpectraPadColor(note, lane) {
  sendMIDINote(
    MIDI_SPECTRA.colorChannel,
    note,
    MIDI_LED_COLOR_VELOCITIES[lane]
  );
}

function setSpectraPadPressed(note, isPressed) {
  sendMIDINote(
    MIDI_SPECTRA.animationChannel,
    note,
    isPressed
      ? MIDI_SPECTRA.ledOffVelocity
      : MIDI_SPECTRA.ledOnVelocity
  );
}

function syncSpectraLaneColors() {
  if (!MIDI.output) return;

  for (const lane of LANE_ORDER) {
    for (const note of MIDI_ROW_NOTES[lane]) {
      setSpectraPadColor(note, lane);
      setSpectraPadPressed(note, false);
    }
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
