
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
  MIDI.lightOutput = null;

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

    if (output.name?.toLowerCase().includes(MIDI_LIGHTS.deviceName)) {
      MIDI.lightOutput = output;
      console.log("Luzes (IAC) ligadas.");
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

// ============================================================
// MIDI OUT — LUZES DMX (IAC DRIVER)
//
// Cada fila e o miss são uma nota; a cor é escolhida no QLC+.
// Note on acende, note off apaga — conforme MIDI_LIGHTS,
// quando o texto some ou no próximo acerto/falha.
// ============================================================

let lightOffTimeout = null;
let litLightNote = null;

function sendLightNote(note, isOn) {
  if (!MIDI.lightOutput) return;

  const command = isOn ? 0x90 : 0x80;
  const status = command | ((MIDI_LIGHTS.channel - 1) & 0x0f);

  try {
    MIDI.lightOutput.send([status, note, isOn ? 127 : 0]);
  } catch (error) {
    console.error("Erro ao enviar MIDI para as luzes:", error);
    return;
  }

  console.log(`DMX OUT | ${isOn ? "ACENDE" : "APAGA"} | NOTA ${note}`);
}

function turnOffJudgementLight() {
  if (litLightNote === null) return;

  sendLightNote(litLightNote, false);
  litLightNote = null;
}

// key: a fila do acerto ou "miss".
function sendJudgementLight(key, durationMs) {
  const note = MIDI_LIGHTS.notes[key];

  clearTimeout(lightOffTimeout);
  turnOffJudgementLight();

  sendLightNote(note, true);
  litLightNote = note;

  if (MIDI_LIGHTS.turnOffWithJudgement) {
    lightOffTimeout = setTimeout(turnOffJudgementLight, durationMs);
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
