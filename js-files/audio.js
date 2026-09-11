// ============================================================
// AUDIO
// ============================================================

let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playBeep(frequency, durationMs, volume = 0.25) {
  if (!audioCtx) return;

  scheduleTone({
    frequency,
    startTime: audioCtx.currentTime,
    durationSeconds: durationMs / 1000,
    volume,
    oscillator: "sine",
    attackSeconds: 0.004,
    releaseSeconds: durationMs / 1000
  });
}

function midiNoteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function scheduleTone({
  frequency,
  startTime,
  durationSeconds,
  volume,
  oscillator = "sine",
  attackSeconds = 0.01,
  releaseSeconds = 0.08,
  destination = audioCtx?.destination
}) {
  if (!audioCtx || !destination) return null;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const safeStartTime = Math.max(startTime, audioCtx.currentTime);
  const endTime = safeStartTime + durationSeconds;
  const attackEnd = Math.min(
    endTime,
    safeStartTime + attackSeconds
  );
  const releaseStart = Math.max(
    attackEnd,
    endTime - releaseSeconds
  );

  osc.type = oscillator;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, safeStartTime);
  gain.gain.linearRampToValueAtTime(volume, attackEnd);
  gain.gain.setValueAtTime(volume, releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(safeStartTime);
  osc.stop(endTime + 0.02);

  return osc;
}
