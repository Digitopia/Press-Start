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
  createCanvas(SCREEN_SIZE.width, SCREEN_SIZE.height);

  textFont(pixelFont);

  resetGame();

  initMIDI();
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  background(12);

  updateGame();

  if (GAME.state === "standby") {
    drawStandbyOverlay();
  } else {
    drawHeader();

    drawGameArea();

    drawJudgement();
    drawFooter();

    drawCountdownOverlay();
    drawNextLevelOverlay();
    drawLiveLostOverlay();
    drawGameOverOverlay();
  }

  // Independentes do ramo acima: continuam a desenhar-se por
  // cima mesmo depois de o estado já ter mudado (ver
  // drawScreenWipe() em renderer.js).
  drawStandbyExitOverlay();
  drawGameOverExitOverlay();
}
