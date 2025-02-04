// AI assisted in the creation of code

let shared;
let guests;
let me;
let scoreFont; // Add font variable

// Game constants
const PRISM_LENGTH = 1000;
const PRISM_WIDTH = 800;
const PRISM_HEIGHT = 500;
const PADDLE_SIZE = 60;
const BALL_SIZE = 20; // Size of the ball (20 units); used as the radius when drawing a sphere.
const BALL_SPEED = 5; // Base speed for the ball's movement (5 units per frame).

function preload() {
  // Load font
  scoreFont = loadFont(
    "https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf"
  );

  // Connect to the party server
  partyConnect("wss://demoserver.p5party.org", "3d_pong");

  // Load shared game state
  shared = partyLoadShared("shared", {
    ball: {
      x: 0,
      y: 0,
      z: 0,
      vx: BALL_SPEED,
      vy: 1,
      vz: 1,
    },
    score: {
      player1: 0,
      player2: 0,
    },
    // Add contact times to shared state
    player1ContactTime: 0,
    player2ContactTime: 0,
  });

  // Load player data
  me = partyLoadMyShared({
    paddle: { x: 0, y: 0 },
    isPlayer1: false,
    role: "observer",
  });

  // Load all guests
  guests = partyLoadGuestShareds();
}

function setup() {
  // Calculate canvas size based on perspective view of prism end
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.style("border", "1px solid white");
  setAttributes("alpha", true);

  // Set perspective settings for better depth perception
  perspective(PI / 3, width / height, 1, PRISM_LENGTH * 2);

  // Assign player positions
  if (guests.length === 1) {
    me.isPlayer1 = true;
    me.role = "player1";
  }
}

function draw() {
  background(0);

  // Calculate camera distance to show full prism end
  let cameraZ = PRISM_HEIGHT / 2 / tan(PI / 6); // Based on FOV of PI/3

  // Set camera position based on player
  if (me.isPlayer1) {
    camera(0, 0, -PRISM_LENGTH / 2 - cameraZ, 0, 0, 0, 0, 1, 0);
  } else {
    camera(0, 0, PRISM_LENGTH / 2 + cameraZ, 0, 0, 0, 0, 1, 0);
  }

  // Update paddle position with improved mouse mapping
  let viewScale = PRISM_HEIGHT / 2 / (height / 2); // Scale factor between screen and game coordinates

  me.paddle.x = constrain(
    (me.isPlayer1 ? -1 : 1) * (mouseX - width / 2) * viewScale,
    -PRISM_WIDTH / 2 + PADDLE_SIZE / 2,
    PRISM_WIDTH / 2 - PADDLE_SIZE / 2
  );

  me.paddle.y = constrain(
    (mouseY - height / 2) * viewScale,
    -PRISM_HEIGHT / 2 + PADDLE_SIZE / 2,
    PRISM_HEIGHT / 2 - PADDLE_SIZE / 2
  );

  drawGameEnvironment();

  if (guests.length === 2) {
    updateBall();
    drawBall();
  }

  drawPaddles();

  drawScore();
}

function drawGameEnvironment() {
  stroke(255);
  noFill();
  push();
  translate(0, 0, 0);
  box(PRISM_WIDTH, PRISM_HEIGHT, PRISM_LENGTH);
  pop();
}

function drawPaddles() {
  push();
  noStroke();

  // Draw all players' paddles
  for (let guest of guests) {
    push();
    // Base paddle (always solid white)
    fill(255, 255, 255, 100);
    translate(
      guest.paddle.x,
      guest.paddle.y,
      guest.isPlayer1 ? -PRISM_LENGTH / 2 : PRISM_LENGTH / 2
    );
    box(PADDLE_SIZE, PADDLE_SIZE, 10);

    // Draw contact indicator if active
    if (
      (guest.isPlayer1 && shared.player1ContactTime > 0) ||
      (!guest.isPlayer1 && shared.player2ContactTime > 0)
    ) {
      push();
      fill(100, 100, 255, 100); // Blue indicator
      box(PADDLE_SIZE + 5, PADDLE_SIZE + 5, 12); // Slightly larger than paddle
      pop();
    }
    pop();
  }

  // Draw my paddle
  push();
  // Base paddle
  fill(255, 255, 255, 100);
  translate(
    me.paddle.x,
    me.paddle.y,
    me.isPlayer1 ? -PRISM_LENGTH / 2 : PRISM_LENGTH / 2
  );
  box(PADDLE_SIZE, PADDLE_SIZE, 10);

  // Draw contact indicator if active
  if (
    (me.isPlayer1 && shared.player1ContactTime > 0) ||
    (!me.isPlayer1 && shared.player2ContactTime > 0)
  ) {
    push();
    fill(100, 100, 255, 100); // Blue indicator
    box(PADDLE_SIZE + 5, PADDLE_SIZE + 5, 12); // Slightly larger than paddle
    pop();
  }
  pop();

  pop();
}

function drawBall() {
  push();
  fill(255);
  stroke(0, 0, 255);
  translate(shared.ball.x, shared.ball.y, shared.ball.z);
  sphere(BALL_SIZE);
  pop();
}

function updateBall() {
  if (me.isPlayer1) {
    // Only player 1 updates ball position to avoid conflicts
    // Update contact times
    if (shared.player1ContactTime > 0) shared.player1ContactTime--;
    if (shared.player2ContactTime > 0) shared.player2ContactTime--;

    shared.ball.x += shared.ball.vx;
    shared.ball.y += shared.ball.vy;
    shared.ball.z += shared.ball.vz;

    // Check wall collisions
    if (
      shared.ball.x > PRISM_WIDTH / 2 - BALL_SIZE ||
      shared.ball.x < -PRISM_WIDTH / 2 + BALL_SIZE
    ) {
      shared.ball.vx *= -1;
    }
    if (
      shared.ball.y > PRISM_HEIGHT / 2 - BALL_SIZE ||
      shared.ball.y < -PRISM_HEIGHT / 2 + BALL_SIZE
    ) {
      shared.ball.vy *= -1;
    }

    // Check paddle collisions and scoring
    if (shared.ball.z < -PRISM_LENGTH / 2 + BALL_SIZE) {
      // Check collision with player 1's paddle
      let player1 =
        guests.find((p) => p.isPlayer1) || (me.isPlayer1 ? me : null);
      if (player1 && isColliding(player1.paddle, shared.ball)) {
        shared.ball.vz *= -1;
        shared.ball.vx = random(-BALL_SPEED / 2, BALL_SPEED / 2);
        shared.ball.vy = random(-BALL_SPEED / 2, BALL_SPEED / 2);
        // Set contact indicator timer in shared state
        shared.player1ContactTime = 30;
        console.log("Player 1 hit the ball!");
      } else if (shared.ball.z < -PRISM_LENGTH / 2) {
        // Player 2 scores
        shared.score.player2++;
        console.log(
          "SCORE! Player 2 scored. Current score:",
          shared.score.player1,
          "-",
          shared.score.player2
        );
        resetBall(false);
      }
    } else if (shared.ball.z > PRISM_LENGTH / 2 - BALL_SIZE) {
      // Check collision with player 2's paddle
      let player2 =
        guests.find((p) => !p.isPlayer1) || (!me.isPlayer1 ? me : null);
      if (player2 && isColliding(player2.paddle, shared.ball)) {
        shared.ball.vz *= -1;
        shared.ball.vx = random(-BALL_SPEED / 2, BALL_SPEED / 2);
        shared.ball.vy = random(-BALL_SPEED / 2, BALL_SPEED / 2);
        // Set contact indicator timer in shared state
        shared.player2ContactTime = 30;
        console.log("Player 2 hit the ball!");
      } else if (shared.ball.z > PRISM_LENGTH / 2) {
        // Player 1 scores
        shared.score.player1++;
        console.log(
          "SCORE! Player 1 scored. Current score:",
          shared.score.player1,
          "-",
          shared.score.player2
        );
        resetBall(true);
      }
    }
  }
}

function isColliding(paddle, ball) {
  return (
    abs(paddle.x - ball.x) < PADDLE_SIZE / 2 + BALL_SIZE &&
    abs(paddle.y - ball.y) < PADDLE_SIZE / 2 + BALL_SIZE
  );
}

function resetBall(towardsPlayer2) {
  shared.ball.x = 0;
  shared.ball.y = 0;
  shared.ball.z = 0;
  shared.ball.vx = random(-BALL_SPEED / 2, BALL_SPEED / 2);
  shared.ball.vy = random(-BALL_SPEED / 2, BALL_SPEED / 2);
  shared.ball.vz = towardsPlayer2 ? BALL_SPEED : -BALL_SPEED;
}

function drawScore() {
  // Update the score display div
  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) {
    scoreDisplay.textContent = `${shared.score.player1} - ${shared.score.player2}`;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Update perspective on resize
  perspective(PI / 3, width / height, 1, PRISM_LENGTH * 2);
}
