// -----------------------------
// Water Drop Game – Main Script
// -----------------------------
// This file implements the core game features:
// - Score updates when you click a drop
// - 30 second timer that ends the game
// - Random end-of-game message (win or try again)
// - Play Again button to reset the game

// ===============
// Game Variables
// ===============
let gameRunning = false; // Is the game currently active?
let dropMaker;           // Interval that creates drops
let timerInterval;       // Interval that counts down time
let score = 0;           // Player score
let timeLeft = 45;       // Seconds remaining

// Pre-made messages to show at the end
const winMessages = [
  "Amazing! You brought clean water to the village!",
  "You did it! Every drop counts!",
  "Hydration hero! The community thanks you!",
  "Way to go! You made waves of impact!"
];

const loseMessages = [
  "So close! Try again and catch a few more drops.",
  "Don't give up! Every try brings more clean water.",
  "Keep at it! You're learning fast.",
  "Almost there—give it another go!"
];

// ---------------
// DOM References
// ---------------
const startBtn = document.getElementById("start-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const gameContainer = document.getElementById("game-container");
const overlay = document.getElementById("message-overlay");
const endMessageEl = document.getElementById("end-message");
const resetBtn = document.getElementById("reset-btn");

// Water can movement logic
const waterCan = document.getElementById("water-can");
let canX = 370; // Start centered for 800px width
const canWidth = 80;
const gameWidth = 800;

// Move can left/right with arrow keys
window.addEventListener("keydown", function(e) {
  if (!gameRunning) return;
  if (e.key === "ArrowLeft") {
    canX = Math.max(0, canX - 30);
    waterCan.style.left = canX + "px";
  } else if (e.key === "ArrowRight") {
    canX = Math.min(gameWidth - canWidth, canX + 30);
    waterCan.style.left = canX + "px";
  }
});

// Reset can position on game start
function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  startBtn.disabled = true;
  canX = (gameWidth - canWidth) / 2;
  waterCan.style.left = canX + "px";
  dropMaker = setInterval(createDrop, 1000);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;
    if (timeLeft === 2) {
      clearInterval(dropMaker); // Stop spawning drops 1s before end
    }
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// Ensure only one startGame function exists and event listener is set
startBtn.onclick = startGame;

// =====================
// Create a falling drop
// =====================
function createDrop() {
  // Randomly decide if this is a bad drop (obstacle)
  const isBad = Math.random() < 0.2; // 20% chance
  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = isBad ? "water-drop bad-drop" : "water-drop";

  // Make drops different sizes for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5; // 0.5 to 1.3
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = gameContainer.offsetWidth;
  const maxX = Math.max(0, gameWidth - 60);
  const xPosition = Math.random() * maxX;
  drop.style.left = xPosition + "px";

  // Make drops fall for 2 seconds
  drop.style.animationDuration = "2s";

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  // Check for catch when drop reaches bottom
  drop.addEventListener("animationend", () => {
    const canLeft = canX;
    const canRight = canX + canWidth;
    const dropLeft = parseFloat(drop.style.left);
    const dropRight = dropLeft + size;
    // Points based on size: small=1, medium=2, large=3
    let points = 1;
    if (size > 80) points = 3;
    else if (size > 60) points = 2;
    if (gameRunning && dropRight > canLeft && dropLeft < canRight) {
      if (isBad) {
        score = Math.max(0, score - points);
        waterCan.style.filter = "brightness(0.7)";
      } else {
        score += points;
        waterCan.style.filter = "brightness(1.2)";
      }
      scoreEl.textContent = score;
      setTimeout(() => waterCan.style.filter = "", 150);
    }
    drop.remove();
  });
}

// Simple confetti effect for win
function showConfetti() {
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement("div");
    confetti.style.position = "fixed";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.top = "-20px";
    confetti.style.width = "12px";
    confetti.style.height = "12px";
    confetti.style.background = `hsl(${Math.random()*360},80%,60%)`;
    confetti.style.borderRadius = "50%";
    confetti.style.zIndex = 9999;
    confetti.style.pointerEvents = "none";
    confetti.style.transition = "top 1.2s linear";
    document.body.appendChild(confetti);
    setTimeout(() => {
      confetti.style.top = "100vh";
    }, 10);
    setTimeout(() => confetti.remove(), 1300);
  }
}

// End the game
function endGame() {
  // Stop all intervals
  clearInterval(dropMaker);
  clearInterval(timerInterval);

  // Update state
  gameRunning = false;
  startBtn.disabled = false;

  // Show message overlay with random text
  const didWin = score >= 20;
  const messages = didWin ? winMessages : loseMessages;
  const randomIndex = Math.floor(Math.random() * messages.length);
  const messageText = messages[randomIndex];

  // Update overlay UI
  endMessageEl.textContent = `${messageText} Your score: ${score}.`;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.style.display = "flex";
  playAgainBtn.focus();

  // Show confetti if win
  if (score >= 20) showConfetti();
}

// ============================
// Reset everything and restart
// ============================
function resetAndStart() {
  // Always hide overlay and allow game play
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.display = "none";

  // Reset score and timer
  score = 0;
  timeLeft = 45;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;

  // Remove any leftover drops from the container
  const leftovers = gameContainer.querySelectorAll(".water-drop, .bad-drop");
  leftovers.forEach(el => el.remove());

  // Start the game
  startGame();
}

// Make water can follow mouse horizontally
gameContainer.addEventListener("mousemove", function(e) {
  if (!gameRunning) return;
  // Get mouse X relative to game container
  const rect = gameContainer.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  // Clamp can position so it stays inside the game area
  canX = Math.max(0, Math.min(gameWidth - canWidth, mouseX - canWidth / 2));
  waterCan.style.left = canX + "px";
});

// Reset button
resetBtn.onclick = function() {
  resetAndStart();
};

// Play Again button
playAgainBtn.onclick = function() {
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.display = "none";
  resetAndStart();
};
