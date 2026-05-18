// Canvas 尺寸完全匹配 Video
canvasElement.width = video.videoWidth;
canvasElement.height = video.videoHeight;

// 座標轉換：正規化座標 × 實際尺寸
const x = landmark.x * width;
const y = landmark.y * height;// MediaPipe 手部追蹤應用
let hands;
let camera;
let video;
let canvasElement;
let canvasCtx;

let detectionStatus = '初始化中...';
let lockProgress = 0;
let isGameActive = false;
let lockStartTime = null;
let lockDuration = 3000; // 3秒鎖定時間
let handsDetected = 0;

const statusEl = document.getElementById('status');
const progressBarEl = document.getElementById('progressBar');
const progressTextEl = document.getElementById('progressText');
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const restartBtn = document.getElementById('restartBtn');
const closeBtn = document.getElementById('closeBtn');

function setup() {
  // 隱藏 p5 canvas
  noCanvas();
  initializeMediaPipe();
}

function initializeMediaPipe() {
  video = document.getElementById('video');
  canvasElement = document.getElementById('canvas');
  canvasCtx = canvasElement.getContext('2d');

  // 設置畫布尺寸與視訊相同
  const resizeCanvas = () => {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
  };

  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onHandsResults);

  camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();
  resizeCanvas();
  video.onloadedmetadata = resizeCanvas;
  window.addEventListener('resize', resizeCanvas);

  isGameActive = true;
  updateStatus('準備就緒');
}

function onHandsResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handsDetected = results.multiHandLandmarks.length;
    updateStatus(`偵測到 ${handsDetected} 隻手`);

    // 繪製每隻手的骨架
    results.multiHandLandmarks.forEach((landmarks, handIndex) => {
      drawHandSkeleton(landmarks, canvasElement.width, canvasElement.height);
    });

    // 更新鎖定進度
    updateLockProgress();
  } else {
    handsDetected = 0;
    updateStatus('未偵測到手部');
    resetLockProgress();
  }

  canvasCtx.restore();
}

function drawHandSkeleton(landmarks, width, height) {
  // 手部連接點
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],           // 大拇指
    [0, 5], [5, 6], [6, 7], [7, 8],           // 食指
    [5, 9], [9, 10], [10, 11], [11, 12],      // 中指
    [9, 13], [13, 14], [14, 15], [15, 16],    // 無名指
    [13, 17], [17, 18], [18, 19], [19, 20],   // 小指
    [0, 17], [0, 13], [0, 9], [5, 13],        // 手掌連接
  ];

  // 繪製連接線
  canvasCtx.strokeStyle = '#00FF41';
  canvasCtx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    if (landmarks[start] && landmarks[end]) {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      canvasCtx.beginPath();
      canvasCtx.moveTo(startPoint.x * width, startPoint.y * height);
      canvasCtx.lineTo(endPoint.x * width, endPoint.y * height);
      canvasCtx.stroke();
    }
  });

  // 繪製關鍵點
  landmarks.forEach((landmark, index) => {
    const x = landmark.x * width;
    const y = landmark.y * height;

    // 不同關鍵點使用不同顏色
    if (index === 0) {
      canvasCtx.fillStyle = '#FF0000'; // 手腕 - 紅色
    } else if ([4, 8, 12, 16, 20].includes(index)) {
      canvasCtx.fillStyle = '#FFD700'; // 指尖 - 金色
    } else {
      canvasCtx.fillStyle = '#00FF41'; // 其他 - 綠色
    }

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
    canvasCtx.fill();
  });
}

function updateLockProgress() {
  if (!lockStartTime) {
    lockStartTime = Date.now();
  }

  const elapsed = Date.now() - lockStartTime;
  lockProgress = Math.min((elapsed / lockDuration) * 100, 100);

  updateProgressBar(lockProgress);

  if (lockProgress >= 100) {
    completeGame();
  }
}

function resetLockProgress() {
  lockStartTime = null;
  lockProgress = 0;
  updateProgressBar(0);
}

function updateStatus(status) {
  detectionStatus = status;
  statusEl.textContent = status;
}

function updateProgressBar(progress) {
  progressBarEl.style.width = progress + '%';
  progressTextEl.textContent = Math.round(progress) + '%';
}

function completeGame() {
  if (!isGameActive) return;
  isGameActive = false;

  showResultModal(
    '遊戲完成！',
    `成功追蹤 ${handsDetected} 隻手 ${lockDuration / 1000} 秒！`
  );
}

function showResultModal(title, message) {
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  resultModal.classList.remove('hidden');
}

function hideResultModal() {
  resultModal.classList.add('hidden');
}

function restartGame() {
  hideResultModal();
  resetLockProgress();
  updateStatus('準備就緒');
  isGameActive = true;
  handsDetected = 0;
}

// 事件監聽
restartBtn.addEventListener('click', restartGame);
closeBtn.addEventListener('click', hideResultModal);

// 點擊模態框背景關閉
resultModal.addEventListener('click', (e) => {
  if (e.target === resultModal) {
    hideResultModal();
  }
});
