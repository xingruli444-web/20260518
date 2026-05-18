let hands;
let camera;
let video;
let canvasElement;
let canvasCtx;

let lockProgress = 0;
let lockStartTime = null;
const lockDuration = 1500; // 1.5 秒鎖定時間
let currentGestureLock = null;
let isAwaitingAction = false;
let wins = 0;
let losses = 0;
let ties = 0;

const statusEl = document.getElementById('status');
const progressBarEl = document.getElementById('progressBar');
const progressTextEl = document.getElementById('progressText');
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const restartBtn = document.getElementById('restartBtn');
const closeBtn = document.getElementById('closeBtn');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const winsCountEl = document.getElementById('winsCount');
const lossesCountEl = document.getElementById('lossesCount');
const tiesCountEl = document.getElementById('tiesCount');
const playAgainBtn = document.getElementById('playAgainBtn');

function setup() {
  noCanvas();
  initializeMediaPipe();
}

async function initializeMediaPipe() {
  video = document.getElementById('video');
  canvasElement = document.getElementById('canvas');
  canvasCtx = canvasElement.getContext('2d');

  const resizeCanvas = () => {
    if (video.videoWidth && video.videoHeight) {
      canvasElement.width = video.videoWidth;
      canvasElement.height = video.videoHeight;
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert('相機啟動失敗: ' + err.message);
    updateStatus('相機初始化失敗');
    return;
  }

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  hands.onResults(onHandsResults);

  camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start().catch((err) => {
    alert('相機啟動失敗: ' + err.message);
    updateStatus('相機啟動失敗');
  });

  video.onloadedmetadata = resizeCanvas;
  window.addEventListener('resize', resizeCanvas);
  updateStatus('準備就緒');
}

function onHandsResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const gesture = detectHandGesture(landmarks);
    updateStatus(`偵測到手勢：${formatGestureName(gesture)}`);
    drawHandSkeleton(landmarks, canvasElement.width, canvasElement.height);
    handleLockGesture(gesture);
  } else {
    updateStatus('未偵測到手部');
    resetLockProgress();
  }
}

function detectHandGesture(landmarks) {
  const thumb = isThumbExtended(landmarks);
  const index = isFingerExtended(landmarks, 8, 6);
  const middle = isFingerExtended(landmarks, 12, 10);
  const ring = isFingerExtended(landmarks, 16, 14);
  const pinky = isFingerExtended(landmarks, 20, 18);

  if (!thumb && !index && !middle && !ring && !pinky) {
    return 'rock';
  }

  if (!thumb && index && middle && !ring && !pinky) {
    return 'scissors';
  }

  if (thumb && index && middle && ring && pinky) {
    return 'paper';
  }

  if (thumb && !index && !middle && !ring && pinky) {
    return 'continue';
  }

  if (!thumb && !index && !middle && !ring && pinky) {
    return 'end';
  }

  return 'unknown';
}

function isFingerExtended(landmarks, tipIndex, pipIndex) {
  return landmarks[tipIndex].y < landmarks[pipIndex].y - 0.04;
}

function isThumbExtended(landmarks) {
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const horizontalDistance = Math.abs(thumbTip.x - thumbMcp.x);
  const foldedDistance = Math.abs(thumbIp.x - thumbMcp.x);
  return horizontalDistance > foldedDistance * 1.15 && horizontalDistance > 0.03;
}

function formatGestureName(gesture) {
  switch (gesture) {
    case 'rock':
      return '石頭';
    case 'scissors':
      return '剪刀';
    case 'paper':
      return '布';
    case 'continue':
      return '繼續下一局';
    case 'end':
      return '結束遊戲';
    default:
      return '未知';
  }
}

function drawHandSkeleton(landmarks, width, height) {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17], [0, 13], [0, 9], [5, 13],
  ];

  canvasCtx.strokeStyle = '#00FF41';
  canvasCtx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    const from = landmarks[start];
    const to = landmarks[end];
    canvasCtx.beginPath();
    canvasCtx.moveTo(from.x * width, from.y * height);
    canvasCtx.lineTo(to.x * width, to.y * height);
    canvasCtx.stroke();
  });

  landmarks.forEach((landmark, index) => {
    const x = landmark.x * width;
    const y = landmark.y * height;
    if (index === 0) {
      canvasCtx.fillStyle = '#FF4D4D';
    } else if ([4, 8, 12, 16, 20].includes(index)) {
      canvasCtx.fillStyle = '#FFD700';
    } else {
      canvasCtx.fillStyle = '#00FF41';
    }
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
    canvasCtx.fill();
  });
}

function handleLockGesture(gesture) {
  const menuGestures = ['continue', 'end'];
  const gameGestures = ['rock', 'scissors', 'paper'];
  const canLock = isAwaitingAction ? menuGestures.includes(gesture) : gameGestures.includes(gesture);

  if (!canLock) {
    resetLockProgress();
    return;
  }

  if (currentGestureLock !== gesture) {
    currentGestureLock = gesture;
    lockStartTime = Date.now();
    lockProgress = 0;
  }

  const elapsed = Date.now() - lockStartTime;
  lockProgress = Math.min((elapsed / lockDuration) * 100, 100);
  updateProgressBar(lockProgress);

  if (lockProgress >= 100) {
    if (isAwaitingAction) {
      if (gesture === 'continue') {
        startNextRound();
      } else if (gesture === 'end') {
        endGame();
      }
    } else {
      playRPSGame(gesture);
    }
  }
}

function playRPSGame(playerGesture) {
  resetLockProgress();
  currentGestureLock = null;

  const choices = ['rock', 'paper', 'scissors'];
  const computerGesture = choices[Math.floor(Math.random() * choices.length)];

  let resultMessage = `你: ${formatGestureName(playerGesture)}，電腦: ${formatGestureName(computerGesture)}。`;
  if (playerGesture === computerGesture) {
    ties += 1;
    resultMessage += '平手！';
  } else if (
    (playerGesture === 'rock' && computerGesture === 'scissors') ||
    (playerGesture === 'scissors' && computerGesture === 'paper') ||
    (playerGesture === 'paper' && computerGesture === 'rock')
  ) {
    wins += 1;
    resultMessage += '你贏了！';
  } else {
    losses += 1;
    resultMessage += '你輸了！';
  }

  showRoundEndScreen(resultMessage);
}

function resetLockProgress() {
  currentGestureLock = null;
  lockStartTime = null;
  lockProgress = 0;
  updateProgressBar(0);
}

function updateStatus(status) {
  statusEl.textContent = status;
}

function updateProgressBar(progress) {
  progressBarEl.style.width = `${progress}%`;
  progressTextEl.textContent = `${Math.round(progress)}%`;
}

function showResultModal(title, message) {
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  resultModal.classList.remove('hidden');
  isAwaitingAction = true;
  resetLockProgress();
}

function hideResultModal() {
  resultModal.classList.add('hidden');
  isAwaitingAction = false;
  resetLockProgress();
}

function startNextRound() {
  hideResultModal();
  updateStatus('下一局開始，請出拳！');
  resetLockProgress();
}

function endGame() {
  hideResultModal();
  document.querySelector('.container').classList.add('hidden');
  endScreen.classList.remove('hidden');
  showEndScreen(wins, losses, ties);
}

function showEndScreen(winsValue, lossesValue, tiesValue) {
  endTitle.textContent = '感謝遊戲！';
  winsCountEl.textContent = winsValue;
  lossesCountEl.textContent = lossesValue;
  tiesCountEl.textContent = tiesValue;
}

function hideEndScreen() {
  endScreen.classList.add('hidden');
}

function resetGame() {
  document.querySelector('.container').classList.remove('hidden');
  wins = 0;
  losses = 0;
  ties = 0;
  updateStatus('準備就緒');
  resetLockProgress();
}

function showRoundEndScreen(message) {
  showResultModal('回合結果', message);
}

restartBtn.addEventListener('click', startNextRound);
closeBtn.addEventListener('click', hideResultModal);
playAgainBtn.addEventListener('click', () => {
  hideEndScreen();
  resetGame();
});
resultModal.addEventListener('click', (e) => {
  if (e.target === resultModal) {
    hideResultModal();
  }
});
