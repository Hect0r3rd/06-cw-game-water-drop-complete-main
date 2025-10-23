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

// Per-difficulty milestone configurations (can be extended)
const milestoneConfigs = {
  Easy: [
    { score: 3, message: 'Nice start! 3 points!' },
    { score: 6, message: 'Keep going — 6 points!' },
    { score: 12, message: 'You reached 12 — great job!' }
  ],
  Normal: [
    { score: 5, message: 'Nice start! 5 points!' },
    { score: 10, message: 'Halfway there!' },
    { score: 20, message: 'Great work — 20 points!' }
  ],
  Hard: [
    { score: 5, message: 'Brave start — 5 points!' },
    { score: 15, message: 'On fire — 15 points!' },
    { score: 28, message: 'Unstoppable — 28 points!' }
  ]
};
let activeMilestones = milestoneConfigs['Normal'];
let nextMilestoneIndex = 0;

// Helper: play a sound if the element exists
// Simple beep fallback using Web Audio API. Creates a short tone so users still get feedback
function playBeep(frequency = 880, duration = 0.12, type = 'sine') {
  try {
    // Create AudioContext on demand (most browsers require a user gesture to resume it)
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playBeep._ctx) playBeep._ctx = new AC();
    const ctx = playBeep._ctx;
    // Ensure context is resumed if it's suspended
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = frequency;
    g.gain.value = 0.12;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    // ramp down quickly to avoid clicks
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    setTimeout(() => {
      try { o.stop(); } catch (e) {}
      try { o.disconnect(); g.disconnect(); } catch (e) {}
    }, duration * 1000 + 50);
  } catch (err) {
    // ignore audio fallback errors
  }
}

function playSfx(el) {
  try {
    // Prefer the provided element; if missing or has no src, fall back to the win sound element
    let audioEl = el;
    if (!audioEl || !audioEl.src) audioEl = sfxWin;
    // If still no element or no src, use WebAudio beep fallback
    if (!audioEl || !audioEl.src) {
      playBeep(880, 0.14, 'sine');
      return;
    }
    // Clone the node to allow overlapping playback
    const clone = audioEl.cloneNode();
    // Attempt to play; if it rejects (file missing, autoplay blocked), fallback to beep
    const p = clone.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        playBeep(880, 0.14, 'sine');
      });
    }
  } catch (err) {
    // If anything goes wrong, play a short beep as a last-resort fallback
    playBeep(880, 0.14, 'sine');
  }
}

// ---------------
// DOM References
// ---------------
const startBtn = document.getElementById("start-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const difficultySelect = document.getElementById("difficulty-select");
const gameContainer = document.getElementById("game-container");
const overlay = document.getElementById("message-overlay");
const endMessageEl = document.getElementById("end-message");
const resetBtn = document.getElementById("reset-btn");
const winGoalEl = document.getElementById('win-goal');
const difficultyBadge = document.getElementById('difficulty-badge');
const tryNewModeBtn = document.getElementById('try-new-mode-btn');

// Audio elements (optional files in audio/ folder)
const sfxCollect = document.getElementById('sfx-collect');
const sfxMiss = document.getElementById('sfx-miss');
const sfxButton = document.getElementById('sfx-button');
const sfxWin = document.getElementById('sfx-win');
// Milestone banner element
const milestoneBanner = document.getElementById('milestone-banner');

// Water can movement logic
const waterCan = document.getElementById("water-can");
let canX = 370; // Start centered for 800px width
const canWidth = 80;
const gameWidth = 800;
// Difficulty config (will be updated on start)
let difficulty = 'Normal';
let winScore = 20;
let timeLimit = 45;
let spawnInterval = null; // ms - configured on start
// Maximum active drops allowed (adjusted per-difficulty in startGame)
let maxActiveDrops = 20;
// Probability a new drop is a bad drop (0.0 - 1.0). Set per-difficulty in startGame.
let badDropChance = 0.2;
// Dynamic scaling: increases from milestones and as time runs out
let milestoneBadIncrease = 0;
const milestoneBumpPerDifficulty = { Easy: 0.02, Normal: 0.04, Hard: 0.06 };
const timeScaleMaxPerDifficulty = { Easy: 0.04, Normal: 0.08, Hard: 0.14 };

// Load persisted difficulty if available
const savedDifficulty = localStorage.getItem('wd_difficulty');
if (savedDifficulty) {
  difficulty = savedDifficulty;
  if (difficultySelect) difficultySelect.value = difficulty;
}
// Update displayed goal initial value
if (winGoalEl) winGoalEl.textContent = winScore;

// If a saved difficulty exists, set timeLimit and show it immediately
if (savedDifficulty) {
  if (difficulty === 'Easy') timeLimit = 60;
  else if (difficulty === 'Normal') timeLimit = 45;
  else if (difficulty === 'Hard') timeLimit = 35;
  timeLeft = timeLimit;
  timeEl.textContent = timeLeft;
  // update displayed win goal
  if (winGoalEl) {
    if (difficulty === 'Easy') winGoalEl.textContent = 12;
    else if (difficulty === 'Normal') winGoalEl.textContent = 20;
    else if (difficulty === 'Hard') winGoalEl.textContent = 28;
  }
}

// Persist difficulty when user changes it and update goal display immediately
if (difficultySelect) {
  difficultySelect.addEventListener('change', (e) => {
    const val = e.target.value;
    localStorage.setItem('wd_difficulty', val);
    if (winGoalEl) {
      if (val === 'Easy') winGoalEl.textContent = 12;
      else if (val === 'Normal') winGoalEl.textContent = 20;
      else if (val === 'Hard') winGoalEl.textContent = 28;
    }
    // Update time display and timeLimit immediately so user sees mode effect before starting
    if (val === 'Easy') timeLimit = 60;
    else if (val === 'Normal') timeLimit = 45;
    else if (val === 'Hard') timeLimit = 35;
    timeLeft = timeLimit;
    timeEl.textContent = timeLeft;
    // update badge color
    setDifficultyBadge(val);
  });
}

// helper to set badge color class
function setDifficultyBadge(val) {
  if (!difficultyBadge) return;
  difficultyBadge.classList.remove('easy','normal','hard');
  if (val === 'Easy') difficultyBadge.classList.add('easy');
  else if (val === 'Normal') difficultyBadge.classList.add('normal');
  else if (val === 'Hard') difficultyBadge.classList.add('hard');
}

// initialize badge on load
setDifficultyBadge(difficulty);

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
  // Read difficulty and set parameters
  difficulty = difficultySelect ? difficultySelect.value : 'Normal';
  // Tune spawn interval and caps per difficulty for better balance
  if (difficulty === 'Easy') {
    spawnInterval = 1400; winScore = 12; timeLimit = 60; maxActiveDrops = 12; activeMilestones = milestoneConfigs.Easy; badDropChance = 0.08;
  } else if (difficulty === 'Normal') {
    spawnInterval = 900; winScore = 20; timeLimit = 45; maxActiveDrops = 18; activeMilestones = milestoneConfigs.Normal; badDropChance = 0.18;
  } else if (difficulty === 'Hard') {
    spawnInterval = 600; winScore = 28; timeLimit = 35; maxActiveDrops = 28; activeMilestones = milestoneConfigs.Hard; badDropChance = 0.28;
  }
  // Reset milestone progress for the new run
  nextMilestoneIndex = 0;
  // reset milestone-based bad-drop increases for fresh run
  milestoneBadIncrease = 0;

  // Apply time limit
  timeLeft = timeLimit;
  timeEl.textContent = timeLeft;
  if (winGoalEl) winGoalEl.textContent = winScore;

  canX = (gameWidth - canWidth) / 2;
  waterCan.style.left = canX + "px";
  dropMaker = setInterval(createDrop, spawnInterval);
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
  // Respect max active-drop cap: don't create more than allowed
  try {
    const activeCount = gameContainer.querySelectorAll('.water-drop, .bad-drop').length;
    if (typeof maxActiveDrops === 'number' && activeCount >= maxActiveDrops) return;
  } catch (err) {
    // If query fails, allow creation (fallback)
  }
  // Randomly decide if this is a bad drop (obstacle) based on per-difficulty chance
  // Compute a dynamic bad-drop chance: base + milestone increases + time-scaling
  const maxTimeScale = timeScaleMaxPerDifficulty[difficulty] || 0.08;
  const timeProgress = Math.max(0, Math.min(1, 1 - timeLeft / timeLimit)); // 0 at start, 1 at end
  const timeScale = maxTimeScale * timeProgress;
  const dynamicChance = Math.min(0.95, badDropChance + milestoneBadIncrease + timeScale);
  const isBad = Math.random() < dynamicChance;
  // Create a new IMG element that will be our water drop (uses Drop.png)
  const drop = document.createElement("img");
  // Use a different image for bad drops
  if (isBad) {
    drop.src = "img/Bad_Drop.png";
    drop.className = "water-drop bad-drop";
  } else {
    drop.src = "img/Drop.png";
    drop.className = "water-drop";
  }

  // Make drops different sizes for visual variety
  const initialSize = 60;
  // Wider size range so we get noticeably bigger drops (0.5x to 1.8x)
  const sizeMultiplier = Math.random() * 1.3 + 0.5; // 0.5 to 1.8
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;
  // Images shouldn't have the extra padding/margin used for divs
  drop.style.padding = "0";
  drop.style.margin = "0";

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = gameContainer.offsetWidth;
  // Use the actual size so the drop stays fully inside the container
  const maxX = Math.max(0, gameWidth - size);
  const xPosition = Math.random() * maxX;
  drop.style.left = xPosition + "px";

  // Make drops fall for 2 seconds
  // Larger drops fall faster: duration inversely proportional to size
  const baseDuration = 2.4; // seconds for base size
  const duration = Math.max(0.8, baseDuration * (initialSize / size));
  drop.style.animationDuration = duration + "s";

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  // Make drops clickable so players can collect them directly
  drop.addEventListener('click', function collectDrop(e) {
    if (!gameRunning) return;
    // Points already computed on animationend logic, so reuse that calculation here
    const dropLeft = parseFloat(drop.style.left);
    const dropRight = dropLeft + size;
    let points = 1;
    if (size > initialSize * 1.3) points = 3;
    else if (size > initialSize * 0.9) points = 2;
    // Update score and show popup
    score += (isBad ? -points : points);
    score = Math.max(0, score);
    scoreEl.textContent = score;
  // play collect/miss sound and check milestones
  if (isBad) playSfx(sfxMiss); else playSfx(sfxCollect);
  checkMilestone();
  showScorePopup(e.clientX, e.clientY, (isBad ? `-${points}` : `+${points}`));
    // Remove the drop element
    drop.removeEventListener('click', collectDrop);
    drop.remove();
  });

  // Check for catch when drop reaches bottom
  drop.addEventListener("animationend", () => {
    const canLeft = canX;
    const canRight = canX + canWidth;
    const dropLeft = parseFloat(drop.style.left);
    const dropRight = dropLeft + size;
  // Points based on size: small=1, medium=2, large=3
  let points = 1;
  if (size > initialSize * 1.3) points = 3; // biggest
  else if (size > initialSize * 0.9) points = 2; // medium
    if (gameRunning && dropRight > canLeft && dropLeft < canRight) {
      if (isBad) {
        score = Math.max(0, score - points);
        waterCan.style.filter = "brightness(0.7)";
        playSfx(sfxMiss);
      } else {
        score += points;
        waterCan.style.filter = "brightness(1.2)";
        playSfx(sfxCollect);
      }
      scoreEl.textContent = score;
      checkMilestone();
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

// Show a floating score popup at client coordinates
function showScorePopup(clientX, clientY, text) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = text;
  document.body.appendChild(popup);
  // Position the popup slightly above the cursor
  popup.style.left = (clientX - 10) + 'px';
  popup.style.top = (clientY - 20) + 'px';
  // Remove after animation
  setTimeout(() => popup.remove(), 900);
}

// Show a temporary milestone banner (advances nextMilestoneIndex)
function showMilestone(message) {
  if (!milestoneBanner) return;
  milestoneBanner.textContent = message;
  milestoneBanner.classList.remove('hidden');
  // force reflow for transition
  void milestoneBanner.offsetWidth;
  milestoneBanner.classList.add('show');
  // Hide after 2.2s
  setTimeout(() => {
    milestoneBanner.classList.remove('show');
    setTimeout(() => milestoneBanner.classList.add('hidden'), 260);
  }, 2200);
}

function checkMilestone() {
  if (!activeMilestones || nextMilestoneIndex >= activeMilestones.length) return;
  const m = activeMilestones[nextMilestoneIndex];
  if (score >= m.score) {
    showMilestone(m.message);
    playSfx(sfxButton); // playful chime
    // bump the bad-drop chance slightly when players hit milestones
    const bump = milestoneBumpPerDifficulty[difficulty] || 0.04;
    milestoneBadIncrease = Math.min(0.5, milestoneBadIncrease + bump);
    nextMilestoneIndex++;
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
  const didWin = score >= winScore;
  const messages = didWin ? winMessages : loseMessages;
  const randomIndex = Math.floor(Math.random() * messages.length);
  const messageText = messages[randomIndex];

  // Update overlay UI
  // Build a prominent result line showing score / goal and difficulty
  if (didWin) {
    endMessageEl.innerHTML = `<div class="result-line">You reached ${score}/${winScore} — ${difficulty} mode!</div><div class="message-detail">${messageText}</div>`;
  } else {
    endMessageEl.innerHTML = `<div class="result-line">You scored ${score}/${winScore} — ${difficulty} mode</div><div class="message-detail">${messageText}</div>`;
  }
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.style.display = "flex";
  playAgainBtn.focus();

  // Show confetti if win
  if (didWin) showConfetti();
  // Play win sound (try element, then fetch, then synth fallback)
  if (didWin) playWinAudio();
}

// Try to play the win audio element, fall back to fetching a local file, then to a synth chime
async function playWinAudio() {
  try {
    // First, try the audio element directly
    if (sfxWin && sfxWin.src) {
      try {
        // load in case it wasn't loaded
        if (typeof sfxWin.load === 'function') sfxWin.load();
        const p = sfxWin.play();
        if (p && typeof p.catch === 'function') {
          await p.catch(async () => { throw new Error('element-play-failed'); });
        }
        return;
      } catch (err) {
        // fall through to fetch
      }
    }
    // Next, try to fetch the file directly (if it exists on the server)
    try {
      const resp = await fetch('audio/win.mp3');
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        try { await a.play(); } catch (e) {}
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      // fetch failed; continue to synth fallback
    }
  } catch (err) {
    // ignore and fallback
  }
  // Last resort: play a short celebratory chime using WebAudio
  playBeepSequence();
}

// Play a short sequence of beeps as a chime
function playBeepSequence() {
  try {
    playBeep(880, 0.12, 'sine');
    setTimeout(() => playBeep(1100, 0.12, 'sine'), 160);
    setTimeout(() => playBeep(1320, 0.16, 'sine'), 320);
  } catch (err) {}
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
  nextMilestoneIndex = 0;
  // Reset time to the current difficulty's timeLimit
  timeLeft = timeLimit;
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
  playSfx(sfxButton);
  resetAndStart();
};

// Play Again button
playAgainBtn.onclick = function() {
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.display = "none";
  playSfx(sfxButton);
  resetAndStart();
};

// Try a New Mode: reset UI to allow picking a mode without starting the game
if (tryNewModeBtn) {
  tryNewModeBtn.onclick = function() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.display = "none";
    // Remove existing drops
    const leftovers = gameContainer.querySelectorAll('.water-drop, .bad-drop');
    leftovers.forEach(el => el.remove());
    // Reset score and display time to selected mode but don't start
    score = 0;
    scoreEl.textContent = score;
    // Read selected difficulty and set time/goal accordingly
    const selected = difficultySelect ? difficultySelect.value : 'Normal';
    if (selected === 'Easy') { timeLimit = 60; winScore = 12; }
    else if (selected === 'Normal') { timeLimit = 45; winScore = 20; }
    else if (selected === 'Hard') { timeLimit = 35; winScore = 28; }
    timeLeft = timeLimit;
    timeEl.textContent = timeLeft;
    if (winGoalEl) winGoalEl.textContent = winScore;
  // Update milestone set & caps for the selected mode (don't start yet)
  activeMilestones = milestoneConfigs[selected] || milestoneConfigs['Normal'];
  // set sensible caps for preview
  if (selected === 'Easy') { maxActiveDrops = 12; badDropChance = 0.08; }
  else if (selected === 'Normal') { maxActiveDrops = 18; badDropChance = 0.18; }
  else if (selected === 'Hard') { maxActiveDrops = 28; badDropChance = 0.28; }
  nextMilestoneIndex = 0;
  // reset any dynamic difficulty increases for preview
  milestoneBadIncrease = 0;
    // Focus the difficulty select so the user can change mode if desired
    if (difficultySelect) difficultySelect.focus();
  };
}
