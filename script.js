(() => {
  const CELL = 40;
  const COLS = 10; // 400 / 40
  const ROWS = 15; // 600 / 40
  const HIGH_SCORE_KEY = "snakeHighScore";
  const FOOD_LIFETIME_MS = 6000; // 사과가 사라지기까지 걸리는 시간
  const FADE_DURATION_MS = 2000; // 사라지기 직전 페이드아웃 구간
  const DIET_MIN_DELAY_MS = 3000; // 파란 사과가 랜덤하게 나타나기까지 최소 대기
  const DIET_MAX_DELAY_MS = 8000; // 파란 사과가 랜덤하게 나타나기까지 최대 대기
  let tickMs = 150; // 보통(기본값)

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("highScore");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMsg = document.getElementById("overlayMsg");
  const startBtn = document.getElementById("startBtn");

  const MAX_QUEUED_TURNS = 2; // 한 틱 안에 여러 번 방향키를 눌러도 다음 두 번까지는 순서대로 반영

  let snake, direction, directionQueue, food, dietFood, score, timer, dietTimer, running, paused;

  function loadHighScore() {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  }

  function saveHighScore(value) {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  }

  highScoreEl.textContent = loadHighScore();

  function randomCell(avoid) {
    if (avoid.length >= COLS * ROWS) return null; // 보드가 가득 찼을 때 안전장치
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (avoid.some((p) => p.x === pos.x && p.y === pos.y));
    return pos;
  }

  function spawnFood() {
    const pos = randomCell(dietFood ? snake.concat([dietFood]) : snake);
    if (pos) food = { ...pos, spawnedAt: Date.now() };
  }

  function spawnDietFood() {
    const pos = randomCell(snake.concat([food]));
    if (pos) dietFood = { ...pos, spawnedAt: Date.now() };
  }

  function scheduleDietSpawn() {
    clearTimeout(dietTimer);
    const delay = DIET_MIN_DELAY_MS + Math.random() * (DIET_MAX_DELAY_MS - DIET_MIN_DELAY_MS);
    dietTimer = setTimeout(() => {
      if (running && !dietFood) spawnDietFood();
    }, delay);
  }

  function checkFoodExpiry() {
    const now = Date.now();
    if (now - food.spawnedAt > FOOD_LIFETIME_MS) spawnFood();
    if (dietFood && now - dietFood.spawnedAt > FOOD_LIFETIME_MS) {
      dietFood = null;
      scheduleDietSpawn();
    }
  }

  function foodOpacity(item) {
    const remaining = FOOD_LIFETIME_MS - (Date.now() - item.spawnedAt);
    if (remaining >= FADE_DURATION_MS) return 1;
    return Math.max(0, remaining / FADE_DURATION_MS);
  }

  function resetGame() {
    snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ];
    direction = { x: 1, y: 0 };
    directionQueue = [];
    score = 0;
    scoreEl.textContent = score;
    dietFood = null;
    spawnFood();
  }

  function startGame() {
    resetGame();
    running = true;
    paused = false;
    startBtn.style.display = "";
    overlay.classList.add("hidden");
    clearInterval(timer);
    timer = setInterval(tick, tickMs);
    scheduleDietSpawn();
  }

  function endGame() {
    running = false;
    paused = false;
    clearInterval(timer);
    clearTimeout(dietTimer);
    scoreEl.textContent = score;
    const best = Math.max(score, loadHighScore());
    saveHighScore(best);
    highScoreEl.textContent = best;

    overlayTitle.textContent = "GAME OVER";
    overlayMsg.textContent = `점수: ${score}`;
    startBtn.textContent = "RESTART";
    startBtn.style.display = "";
    overlay.classList.remove("hidden");
  }

  function winGame() {
    running = false;
    paused = false;
    clearInterval(timer);
    clearTimeout(dietTimer);
    scoreEl.textContent = score;
    const best = Math.max(score, loadHighScore());
    saveHighScore(best);
    highScoreEl.textContent = best;

    overlayTitle.textContent = "YOU WIN!";
    overlayMsg.textContent = `점수: ${score} · 뱀이 보드를 가득 채웠습니다!`;
    startBtn.textContent = "RESTART";
    startBtn.style.display = "";
    overlay.classList.remove("hidden");
  }

  function pauseGame() {
    running = false;
    paused = true;
    clearInterval(timer);
    clearTimeout(dietTimer);
    overlayTitle.textContent = "PAUSED";
    overlayMsg.textContent = "스페이스바를 눌러 계속하기";
    startBtn.style.display = "none";
    overlay.classList.remove("hidden");
  }

  function resumeGame() {
    running = true;
    paused = false;
    overlay.classList.add("hidden");
    timer = setInterval(tick, tickMs);
    if (!dietFood) scheduleDietSpawn();
  }

  function togglePause() {
    startBtn.blur();
    if (paused) {
      resumeGame();
    } else if (running) {
      pauseGame();
    } else {
      startGame();
    }
  }

  function tick() {
    if (directionQueue.length > 0) direction = directionQueue.shift();
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      endGame();
      return;
    }

    snake.unshift(head);

    const ateFood = head.x === food.x && head.y === food.y;
    const ateDiet = dietFood && head.x === dietFood.x && head.y === dietFood.y;

    if (ateFood) {
      score += 1;
      if (snake.length >= COLS * ROWS) {
        winGame();
        return;
      }
      spawnFood();
    } else {
      snake.pop();
    }

    if (ateDiet) {
      score = Math.max(0, score - 1);
      if (snake.length > 1) {
        snake.pop();
        dietFood = null;
        scheduleDietSpawn();
      } else {
        endGame();
        return;
      }
    }

    scoreEl.textContent = score;
  }

  function draw() {
    // board
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#9bbc0f" : "#93b50c";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // apples
    drawApple(food.x, food.y, "#c21807", foodOpacity(food));
    if (dietFood) drawApple(dietFood.x, dietFood.y, "#1f6fd6", foodOpacity(dietFood));

    // snake body (gradient, tail lightest)
    const pad = 2;
    const bodyStart = [58, 122, 25];
    const bodyEnd = [190, 235, 120];
    for (let i = 1; i < snake.length; i++) {
      const t = snake.length > 2 ? (i - 1) / (snake.length - 2) : 0;
      ctx.fillStyle = lerpColor(bodyStart, bodyEnd, t);
      const seg = snake[i];
      ctx.fillRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    }

    drawHead(snake[0], direction);
  }

  function lerpColor(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawHead(seg, dir) {
    const pad = 2;
    ctx.fillStyle = "#1f3d0c";
    ctx.fillRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);

    const cx = seg.x * CELL + CELL / 2;
    const cy = seg.y * CELL + CELL / 2;
    const dx = dir.x;
    const dy = dir.y;
    const px = -dy;
    const py = dx;

    // eyes
    [1, -1].forEach((side) => {
      const ex = cx + dx * 6 + px * 8 * side;
      const ey = cy + dy * 6 + py * 8 * side;
      ctx.fillStyle = "#f4fff0";
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a1806";
      ctx.beginPath();
      ctx.arc(ex + dx * 1.5, ey + dy * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // tongue
    const baseX = cx + dx * (CELL / 2 - pad);
    const baseY = cy + dy * (CELL / 2 - pad);
    const tipX = baseX + dx * 9;
    const tipY = baseY + dy * 9;
    ctx.strokeStyle = "#d81c3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + dx * 4 + px * 3, tipY + dy * 4 + py * 3);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + dx * 4 - px * 3, tipY + dy * 4 - py * 3);
    ctx.stroke();
  }

  function drawApple(gx, gy, color, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    const cx = gx * CELL + CELL / 2;
    const cy = gy * CELL + CELL / 2 + 2;
    const r = CELL * 0.32;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#4b2e0c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + 2, cy - r - 6);
    ctx.stroke();

    ctx.fillStyle = "#3d7a1e";
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy - r - 4, 5, 3, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  const KEY_DIRS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  function setDirection(dir) {
    if (!running) return;
    // 이미 대기 중인 턴이 있다면 그 다음 기준으로 반전/중복 여부를 판단
    const last = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : direction;
    if (dir.x === last.x && dir.y === last.y) return; // 같은 방향 중복 큐잉 방지
    if (dir.x === -last.x && dir.y === -last.y) return; // 즉시 반전 불가
    if (directionQueue.length >= MAX_QUEUED_TURNS) return; // 과도한 선입력은 무시
    directionQueue.push(dir);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      togglePause();
      return;
    }
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    setDirection(dir);
  });

  const DPAD_DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => setDirection(DPAD_DIRS[btn.dataset.dir]));
  });

  const diffBtns = document.querySelectorAll(".diff-btn");
  diffBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tickMs = Number(btn.dataset.ms);
      diffBtns.forEach((b) => b.classList.toggle("active", b === btn));
      if (running) {
        clearInterval(timer);
        timer = setInterval(tick, tickMs);
      }
    });
  });

  startBtn.addEventListener("click", startGame);

  function renderLoop() {
    if (running) checkFoodExpiry();
    draw();
    requestAnimationFrame(renderLoop);
  }

  resetGame();
  requestAnimationFrame(renderLoop);
})();
