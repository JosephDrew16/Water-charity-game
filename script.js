const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const highScoreEl = document.getElementById('highScore');
const comboEl = document.getElementById('combo');
const milestoneEl = document.getElementById('milestone');
const bestStreakEl = document.getElementById('bestStreak');
const messageEl = document.getElementById('message');
const gameArea = document.getElementById('gameArea');
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const endOverlay = document.getElementById('endOverlay');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const finalBestStreakEl = document.getElementById('finalBestStreak');
const finalAccuracyEl = document.getElementById('finalAccuracy');
const finalTitle = document.getElementById('finalTitle');
const finalMessage = document.getElementById('finalMessage');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const resumeButton = document.getElementById('resumeButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const difficultySelect = document.getElementById('difficultySelect');
const difficultyLevelEl = document.getElementById('difficultyLevel');
const leaderboardListEl = document.getElementById('leaderboardList');

const BASE_POINTS = 10;
const MAX_ITEMS = 8;
const HIGH_SCORE_KEY = 'water-quest-high-score';
const LEADERBOARD_KEY = 'water-quest-leaderboard';
const DIFFICULTY_SETTINGS = {
  easy: {
    duration: 45,
    spawnDelay: 1100,
    minSpawnDelay: 850,
    hazardDelay: 4000,
    minHazardDelay: 3000,
    maxHazards: 1
  },
  normal: {
    duration: 30,
    spawnDelay: 820,
    minSpawnDelay: 350,
    hazardDelay: 2600,
    minHazardDelay: 1400,
    maxHazards: 2
  },
  hard: {
    duration: 20,
    spawnDelay: 580,
    minSpawnDelay: 300,
    hazardDelay: 1600,
    minHazardDelay: 800,
    maxHazards: 3
  }
};

let score = 0;
let gameDuration = DIFFICULTY_SETTINGS.normal.duration;
let timeLeft = gameDuration;
let combo = 1;
let bestStreak = 0;
let highScore = getStoredHighScore();
let timer = null;
let spawnTimer = null;
let hazardTimer = null;
let gameActive = false;
let isPaused = false;
let activeEntities = [];
let totalHits = 0;
let cleanCatches = 0;
let hazardClicks = 0;
let audioContext = null;
let difficultyLevel = 1;
let spawnDelay = 700;
let hazardDelay = 2500;

function getStoredHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch (error) {
      // Ignore storage errors in private or restricted browsing contexts.
    }
  }
}

function getStoredLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveScoreToLeaderboard() {
  const entries = getStoredLeaderboard();
  entries.push({ score, date: new Date().toLocaleDateString() });
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, 5);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch (error) {
    // Ignore storage errors.
  }
  renderLeaderboard();
}

function renderLeaderboard() {
  const entries = getStoredLeaderboard();
  leaderboardListEl.innerHTML = '';

  if (!entries.length) {
    const item = document.createElement('li');
    item.innerHTML = '<span>No missions yet</span><strong>0</strong>';
    leaderboardListEl.appendChild(item);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>#${index + 1} • ${entry.date}</span><strong>${entry.score}</strong>`;
    leaderboardListEl.appendChild(item);
  });
}

function updateScoreboard() {
  scoreEl.textContent = String(score);
  timeEl.textContent = String(timeLeft);
  highScoreEl.textContent = String(highScore);
  comboEl.textContent = `x${combo}`;
  bestStreakEl.textContent = String(bestStreak);
  milestoneEl.textContent = getMilestoneLabel();
  bestScoreEl.textContent = String(highScore);
  difficultyLevelEl.textContent = String(difficultyLevel);
}

function getMilestoneLabel() {
  if (score < 25) return '10 pts';
  if (score < 60) return '25 pts';
  if (score < 100) return '60 pts';
  return '100 pts';
}

function setMessage(text, isGood = true) {
  messageEl.textContent = text;
  messageEl.style.borderColor = isGood ? 'rgba(114, 240, 166, 0.4)' : 'rgba(255, 109, 109, 0.4)';
  messageEl.style.background = isGood ? 'rgba(114, 240, 166, 0.08)' : 'rgba(255, 109, 109, 0.08)';
  messageEl.classList.remove('flash');
  void messageEl.offsetWidth;
  messageEl.classList.add('flash');
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.05, glide = 0) {
  const context = ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (glide !== 0) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + glide), startTime + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playSuccessSound() {
  playTone(880, 0.08, 'triangle', 0.05, 170);
  setTimeout(() => playTone(660, 0.12, 'triangle', 0.04, -120), 40);
}

function playHazardSound() {
  playTone(220, 0.18, 'sawtooth', 0.045, -160);
}

function playRoundEndSound() {
  playTone(520, 0.1, 'sine', 0.05, 140);
  setTimeout(() => playTone(680, 0.12, 'sine', 0.04, 200), 80);
}

function createFloatingText(x, y, text, kind = 'good') {
  const floatText = document.createElement('div');
  floatText.className = `float-text ${kind}`;
  floatText.textContent = text;
  floatText.style.left = `${x}px`;
  floatText.style.top = `${y}px`;
  gameArea.appendChild(floatText);

  setTimeout(() => {
    floatText.remove();
  }, 800);
}

function clearEntities() {
  activeEntities.forEach((entity) => entity.remove());
  activeEntities = [];
  gameArea.querySelectorAll('.float-text').forEach((text) => text.remove());
}

function getRandomPosition() {
  const rect = gameArea.getBoundingClientRect();
  const x = 50 + Math.random() * (rect.width - 120);
  const y = 70 + Math.random() * (rect.height - 140);
  return { x, y };
}

function spawnCan() {
  if (!gameActive || document.querySelectorAll('.can').length >= MAX_ITEMS) {
    return;
  }

  const can = document.createElement('button');
  can.type = 'button';
  can.className = 'can';
  can.setAttribute('aria-label', 'Water can');

  const label = document.createElement('span');
  label.className = 'can-label';
  label.textContent = 'WATER';
  can.appendChild(label);

  const pos = getRandomPosition();
  can.style.left = `${pos.x}px`;
  can.style.top = `${pos.y}px`;

  const size = 72 + Math.random() * 42;
  can.style.width = `${size}px`;
  can.style.height = `${size * 1.25}px`;

  can.addEventListener('click', () => {
    if (!gameActive) return;

    totalHits += 1;
    cleanCatches += 1;
    combo = Math.min(combo + 1, 10);
    bestStreak = Math.max(bestStreak, combo);
    const points = BASE_POINTS + (combo - 1) * 3;
    score += points;
    saveHighScore();
    updateScoreboard();
    setMessage(`Clean water +${points}! Great catch!`, true);
    createFloatingText(pos.x, pos.y, `+${points}`, 'good');
    playSuccessSound();
    can.remove();
    activeEntities = activeEntities.filter((entity) => entity !== can);

    if (score >= 25 && score < 60) {
      setMessage('Milestone reached: 25 points! Keep the flow going!', true);
    } else if (score >= 60 && score < 100) {
      setMessage('Milestone reached: 60 points! The mission is thriving!', true);
    } else if (score >= 100) {
      setMessage('Milestone reached: 100 points! Clean water mission is a success!', true);
    }
  });

  gameArea.appendChild(can);
  activeEntities.push(can);
}

function spawnHazard() {
  const settings = DIFFICULTY_SETTINGS[difficultySelect.value];
  if (!gameActive || document.querySelectorAll('.hazard').length >= settings.maxHazards) {
    return;
  }

  const hazard = document.createElement('button');
  hazard.type = 'button';
  hazard.className = 'hazard';
  hazard.setAttribute('aria-label', 'Pollution hazard');

  const pos = getRandomPosition();
  hazard.style.left = `${pos.x}px`;
  hazard.style.top = `${pos.y}px`;

  hazard.addEventListener('click', () => {
    if (!gameActive) return;

    combo = 1;
    hazardClicks += 1;
    score = Math.max(0, score - 8);
    saveHighScore();
    updateScoreboard();
    setMessage('Pollution spotted! -8 points.', false);
    createFloatingText(pos.x, pos.y, '-8', 'bad');
    playHazardSound();
    hazard.remove();
    activeEntities = activeEntities.filter((entity) => entity !== hazard);
  });

  gameArea.appendChild(hazard);
  activeEntities.push(hazard);
}

function updateDifficulty(forceRefresh = false) {
  const settings = DIFFICULTY_SETTINGS[difficultySelect.value];
  const nextLevel = Math.min(5, Math.max(1, Math.floor((gameDuration - timeLeft) / 6) + 1));
  const levelChanged = nextLevel !== difficultyLevel;
  difficultyLevel = nextLevel;
  spawnDelay = Math.max(settings.minSpawnDelay, settings.spawnDelay - (difficultyLevel - 1) * 90);
  hazardDelay = Math.max(settings.minHazardDelay, settings.hazardDelay - (difficultyLevel - 1) * 220);

  if (forceRefresh || levelChanged) {
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(() => {
      spawnCan();
      if (difficultyLevel >= 2 && Math.random() > 0.45) {
        spawnCan();
      }
    }, spawnDelay);

    if (hazardTimer) clearInterval(hazardTimer);
    hazardTimer = setInterval(() => {
      spawnHazard();
    }, hazardDelay);
  }

  updateScoreboard();
}

function updateTimer() {
  timeLeft -= 1;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
    return;
  }
  updateDifficulty();
}

function startGame() {
  ensureAudioContext();
  gameDuration = DIFFICULTY_SETTINGS[difficultySelect.value].duration;
  score = 0;
  timeLeft = gameDuration;
  combo = 1;
  bestStreak = 0;
  totalHits = 0;
  cleanCatches = 0;
  hazardClicks = 0;
  difficultyLevel = 1;
  spawnDelay = DIFFICULTY_SETTINGS[difficultySelect.value].spawnDelay;
  hazardDelay = DIFFICULTY_SETTINGS[difficultySelect.value].hazardDelay;
  isPaused = false;
  gameActive = true;
  clearEntities();
  highScore = getStoredHighScore();
  updateScoreboard();
  setMessage('Mission live! Tap every can you can find.', true);
  startOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  pauseButton.textContent = 'Pause';

  if (timer) clearInterval(timer);
  if (spawnTimer) clearInterval(spawnTimer);
  if (hazardTimer) clearInterval(hazardTimer);

  timer = setInterval(updateTimer, 1000);
  updateDifficulty(true);
}

function resetGame() {
  clearInterval(timer);
  clearInterval(spawnTimer);
  clearInterval(hazardTimer);
  clearEntities();

  score = 0;
  gameDuration = DIFFICULTY_SETTINGS[difficultySelect.value].duration;
  timeLeft = gameDuration;
  combo = 1;
  bestStreak = 0;
  totalHits = 0;
  cleanCatches = 0;
  hazardClicks = 0;
  difficultyLevel = 1;
  spawnDelay = DIFFICULTY_SETTINGS[difficultySelect.value].spawnDelay;
  hazardDelay = DIFFICULTY_SETTINGS[difficultySelect.value].hazardDelay;
  gameActive = false;
  isPaused = false;
  highScore = getStoredHighScore();

  updateScoreboard();
  setMessage('Tap the yellow jerry cans to bring clean water to life.', true);
  startOverlay.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  pauseButton.textContent = 'Pause';
}

function getAccuracy() {
  const totalAttempts = cleanCatches + hazardClicks;
  if (totalAttempts === 0) return 0;
  return Math.round((cleanCatches / totalAttempts) * 100);
}

function resumeGame() {
  if (!isPaused) return;

  isPaused = false;
  gameActive = true;
  pauseButton.textContent = 'Pause';
  pauseOverlay.classList.add('hidden');
  timer = setInterval(updateTimer, 1000);
  updateDifficulty(true);
}

function togglePause() {
  if (!gameActive) return;

  if (isPaused) {
    resumeGame();
    return;
  }

  isPaused = true;
  gameActive = true;
  pauseButton.textContent = 'Resume';
  pauseOverlay.classList.remove('hidden');
  clearInterval(timer);
  clearInterval(spawnTimer);
  clearInterval(hazardTimer);
  setMessage('Mission paused. Catch your breath!', true);
}

function endGame() {
  gameActive = false;
  isPaused = false;
  clearInterval(timer);
  clearInterval(spawnTimer);
  clearInterval(hazardTimer);
  clearEntities();
  saveHighScore();
  saveScoreToLeaderboard();
  highScore = getStoredHighScore();

  finalScoreEl.textContent = String(score);
  bestScoreEl.textContent = String(highScore);
  finalBestStreakEl.textContent = String(bestStreak);
  finalAccuracyEl.textContent = `${getAccuracy()}%`;

  if (score >= 100) {
    finalTitle.textContent = 'Water hero!';
    finalMessage.textContent = 'You delivered an incredible cleanup mission.';
  } else if (score >= 60) {
    finalTitle.textContent = 'Strong mission!';
    finalMessage.textContent = 'Your team kept the water flowing all round.';
  } else if (score >= 25) {
    finalTitle.textContent = 'Nice effort!';
    finalMessage.textContent = 'You made a real splash for clean water.';
  } else {
    finalTitle.textContent = 'Keep going!';
    finalMessage.textContent = 'There is always another round to help the mission.';
  }

  pauseButton.textContent = 'Pause';
  playRoundEndSound();
  endOverlay.classList.remove('hidden');
  setMessage(`Round over! Final score: ${score}.`, score >= 25);
  updateScoreboard();
}

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
pauseButton.addEventListener('click', togglePause);
resetButton.addEventListener('click', resetGame);
difficultySelect.addEventListener('change', () => {
  if (gameActive) return;
  gameDuration = DIFFICULTY_SETTINGS[difficultySelect.value].duration;
  timeLeft = gameDuration;
  updateScoreboard();
});

renderLeaderboard();
updateScoreboard();
