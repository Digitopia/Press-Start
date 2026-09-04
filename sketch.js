// ============================================================
// PRESS START — PROTÓTIPO RÍTMICO
// ============================================================

let pixelFont;

// ============================================================
// SETUP
// ============================================================

async function setup() {
  pixelFont = await loadFont(
    "assets/fonts/PressStart2P-Regular.ttf"
  );
  console.log(pixelFont);
  createCanvas(SCREEN_SIZE.width, SCREEN_SIZE.height);

  textFont(pixelFont);

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

  drawCountdownOverlay();
  drawNextLevelOverlay();
  drawGameOverOverlay()
}
