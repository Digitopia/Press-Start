// ============================================================
// PRESS START — PROTÓTIPO RÍTMICO
// ============================================================


// ============================================================
// SETUP
// ============================================================

function setup() {
  createCanvas(SCREEN_SIZE.width, SCREEN_SIZE.height);
  noSmooth();
  textFont("monospace");

  buildCurrentLevel();
  resetGame();
  initMIDI();
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  background(12);

  updateGame();

  drawHeader();

  drawGameArea();

  drawJudgement();
  drawFooter();
}
