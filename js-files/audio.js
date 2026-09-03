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

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const duration = durationMs / 1000;

  osc.type = "sine";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration);
}