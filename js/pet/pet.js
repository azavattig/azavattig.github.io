// The site cat. A pixel-art pet that lives on the page: it walks along card
// edges, the hero desk and the bottom of the screen, jumps between them,
// knocks desk objects around, chases a wiggling cursor, reacts to typing,
// scrolling and hovered links, naps when the visitor is idle, purrs when
// petted, and can be picked up and dropped (never thrown).
(function () {
  const WALK_SPEED = 0.045;      // px per ms
  const CHASE_SPEED = 0.17;
  const GRAVITY = 0.0025;        // px per ms^2
  const CROUCH_MS = 260;
  const JUMP_MS = 560;
  const MAX_JUMP_UP = 320;
  const MAX_JUMP_ACROSS = 380;
  const NAP_AFTER_MS = 20000;
  const PET_HOLD_MS = 1600;
  const CHASE_TRIGGER_SPEED = 0.6;   // cursor px per ms
  const CHASE_RANGE = 420;
  const CHASE_RANGE_Y = 240;
  const CHASE_MS = 5000;
  const CHASE_COOLDOWN_MS = 3000;
  const WATCH_RECENT_MS = 4000;      // a sitting cat looks at a cursor moved this recently
  const WATCH_DEAD_ZONE = 24;        // px either side of the cat where it doesn't turn
  const FAST_SCROLL_SPEED = 3;       // px per ms
  const DRAG_START_PX = 6;
  const OFFSCREEN_MARGIN = 150;
  const STORAGE_KEY = "site-pet";
  const WALK_CYCLE = ["walk1", "walk2", "walk3", "walk4"];

  const Sprites = window.PetSprites;
  const Surfaces = window.PetSurfaces;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = document.createElement("div");
  el.className = "site-pet";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<canvas class="site-pet__sprite"></canvas><span class="site-pet__bubble"></span>';
  document.body.appendChild(el);
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const bubble = el.querySelector(".site-pet__bubble");

  let scale = 0;
  let frames = {};
  let width = 0;
  let height = 0;

  let x = 0;
  let y = 0;
  let vy = 0;
  let direction = -1;
  let surface = null;
  let state = "fall";
  let stateEndsAt = Infinity;
  let jump = null;
  let pawTarget = null;
  let lastPetAt = 0;
  let lastInputAt = performance.now();
  let chaseCooldownUntil = 0;
  let pointer = { x: 0, y: 0, time: 0, speed: 0 };
  let lastScroll = { y: window.scrollY, time: performance.now() };
  let bubbleTimer = null;
  let drawnFrame = "";

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pageWidth() {
    return document.documentElement.clientWidth;
  }

  function clampX(value) {
    return Math.min(Math.max(value, width / 2), pageWidth() - width / 2);
  }

  function setupScale() {
    const nextScale = window.innerWidth < 720 ? 2 : 3;
    if (nextScale === scale) return;
    scale = nextScale;
    frames = Sprites.buildFrames(scale);
    width = Sprites.width(scale);
    height = Sprites.height(scale);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    drawnFrame = "";
  }

  function setState(next, durationMs = Infinity) {
    state = next;
    stateEndsAt = performance.now() + durationMs;
  }

  function say(text, durationMs = 2200) {
    bubble.textContent = text;
    el.classList.add("is-talking");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => el.classList.remove("is-talking"), durationMs);
  }

  function isGrounded() {
    return ["sit", "walk", "chase", "nap", "petted", "paw", "alert", "grip"].includes(state);
  }

  function isOnScreen() {
    return y > window.scrollY && y - height < window.scrollY + window.innerHeight;
  }

  function startFall() {
    vy = 0;
    surface = null;
    setState("fall");
  }

  function dropInFromTop() {
    y = window.scrollY - height;
    startFall();
  }

  function land(target) {
    surface = target;
    y = target.top;
    vy = 0;
    setState("sit", randomBetween(900, 2200));
  }

  // ---- decisions -------------------------------------------------------

  function findJumpTarget() {
    let best = null;
    for (const candidate of Surfaces.all()) {
      if (surface && candidate.id === surface.id) continue;
      if (!Surfaces.isInViewport(candidate)) continue;
      if (candidate.right - candidate.left < width) continue;
      const rise = y - candidate.top;
      if (rise < 30 || rise > MAX_JUMP_UP) continue;
      const landingX = Math.min(Math.max(x, candidate.left + width / 2), candidate.right - width / 2);
      const across = Math.abs(landingX - x);
      if (across > MAX_JUMP_ACROSS) continue;
      if (!best || across < best.across) best = { surface: candidate, landingX, across };
    }
    return best;
  }

  function startJump(target, now) {
    jump = { fromX: x, fromY: y, toX: target.landingX, target: target.surface, start: now + CROUCH_MS };
    if (target.landingX !== x) direction = Math.sign(target.landingX - x);
    setState("crouch", CROUCH_MS);
  }

  function chooseNext(now) {
    if (prefersReducedMotion) {
      setState("sit", 4000);
      return;
    }
    if (now - lastInputAt > NAP_AFTER_MS) {
      setState("nap", randomBetween(8000, 15000));
      return;
    }
    if (Math.random() < 0.3) {
      const target = findJumpTarget();
      if (target) {
        startJump(target, now);
        return;
      }
    }
    if (state === "walk") {
      setState("sit", randomBetween(2000, 5000));
    } else {
      if (Math.random() < 0.4) direction *= -1;
      setState("walk", randomBetween(3000, 7000));
    }
  }

  // ---- per-state updates -----------------------------------------------

  function updateFall(dt) {
    vy += GRAVITY * dt;
    const nextY = y + vy * dt;
    const target = Surfaces.landingBetween(x, y + 0.5, prefersReducedMotion ? Infinity : nextY);
    if (target) land(target);
    else y = nextY;
  }

  function updateJump(now) {
    const target = Surfaces.refresh(jump.target);
    if (!target) {
      startFall();
      return;
    }
    const t = Math.min(1, (now - jump.start) / JUMP_MS);
    const arc = Math.max(70, jump.fromY - target.top + 50);
    x = jump.fromX + (jump.toX - jump.fromX) * t;
    y = jump.fromY + (target.top - jump.fromY) * t - arc * 4 * t * (1 - t);
    if (t >= 1) land(target);
  }

  function walkStep(dt, speed) {
    const nextX = x + direction * speed * dt;
    const isAtEdge = nextX < surface.left || nextX > surface.right;
    if (isAtEdge) {
      if (state === "chase") {
        setState("sit", 1200);
        return;
      }
      // The floor has walls; on a card the cat either turns back or walks off.
      if (surface.id === "floor" || Math.random() < 0.5) {
        direction *= -1;
        return;
      }
    }
    x = clampX(nextX);
  }

  function checkDeskObject() {
    if (surface.id !== "desk" || !window.HeroDesk) return false;
    const item = window.HeroDesk.objectAhead(x, y, direction, width * 0.5 + 6);
    if (!item) return false;
    pawTarget = item;
    setState("paw", 450);
    return true;
  }

  // A sitting cat turns to face a mouse cursor that moved recently, without leaving its spot.
  function watchPointer(now) {
    if (now - pointer.time > WATCH_RECENT_MS) return;
    const dx = pointer.x - x;
    if (Math.abs(dx) > WATCH_DEAD_ZONE) direction = Math.sign(dx);
  }

  function updateGrounded(dt, now) {
    surface = Surfaces.refresh(surface);
    if (!surface) {
      startFall();
      return;
    }
    const isFarOffscreen =
      surface.top < window.scrollY - OFFSCREEN_MARGIN ||
      surface.top > window.scrollY + window.innerHeight + OFFSCREEN_MARGIN;
    if (surface.id !== "floor" && isFarOffscreen) {
      dropInFromTop();
      return;
    }
    y = surface.top;
    if (!Surfaces.isOver(surface, x)) {
      startFall();
      return;
    }

    switch (state) {
      case "walk":
        if (!checkDeskObject()) walkStep(dt, WALK_SPEED);
        if (now > stateEndsAt) chooseNext(now);
        break;
      case "chase": {
        const dx = pointer.x - x;
        if (Math.abs(dx) < 14) {
          pawTarget = null;
          setState("paw", 450);
        } else {
          direction = Math.sign(dx);
          walkStep(dt, CHASE_SPEED);
          if (now > stateEndsAt) setState("sit", 1500);
        }
        break;
      }
      case "paw":
        if (now > stateEndsAt) {
          if (pawTarget && window.HeroDesk) window.HeroDesk.bat(pawTarget, direction);
          pawTarget = null;
          setState("sit", randomBetween(600, 1400));
        }
        break;
      case "petted":
        if (now - lastPetAt > PET_HOLD_MS) setState("sit", randomBetween(800, 1800));
        break;
      case "sit":
        watchPointer(now);
        if (now > stateEndsAt) chooseNext(now);
        break;
      case "nap":
      case "alert":
      case "grip":
        if (now > stateEndsAt) chooseNext(now);
        break;
    }
  }

  function update(dt, now) {
    if (state === "held") return;
    if (state === "fall") updateFall(dt);
    else if (state === "crouch") {
      if (now > stateEndsAt) setState("jump");
    } else if (state === "jump") updateJump(now);
    else updateGrounded(dt, now);
  }

  // ---- drawing -----------------------------------------------------------

  function frameName(now) {
    switch (state) {
      case "walk": return WALK_CYCLE[Math.floor(now / 130) % WALK_CYCLE.length];
      case "chase": return WALK_CYCLE[Math.floor(now / 70) % WALK_CYCLE.length];
      case "crouch":
      case "grip": return "crouch";
      case "jump":
      case "fall": return "jump";
      case "nap": return Math.floor(now / 900) % 2 ? "sleep1" : "sleep2";
      case "petted": return "sitHappy";
      case "held": return "held";
      case "paw": return "sitPaw";
      case "alert": return "sitAlert";
      default: return now % 3800 < 140 ? "sitBlink" : "sit";
    }
  }

  function draw(now) {
    const name = frameName(now);
    if (name !== drawnFrame) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(frames[name], 0, 0);
      drawnFrame = name;
    }
    // Feet sit on the last sprite row, one outline pixel above the canvas bottom.
    el.style.transform = `translate(${x - width / 2}px, ${y - height + scale}px)`;
    el.classList.toggle("is-facing-right", direction > 0 && state !== "held");
    if (el.classList.contains("is-talking")) keepBubbleOnScreen();
  }

  function keepBubbleOnScreen() {
    const edge = 8;
    const bubbleWidth = bubble.offsetWidth;
    const left = x - window.scrollX - bubbleWidth / 2;
    const right = left + bubbleWidth;
    const shift = Math.max(edge - left, 0) + Math.min(pageWidth() - edge - right, 0);
    bubble.style.setProperty("--shift", `${shift}px`);
  }

  let lastTime = performance.now();
  function tick(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;
    update(dt, now);
    draw(now);
    requestAnimationFrame(tick);
  }

  // ---- interaction -------------------------------------------------------

  function pet() {
    lastPetAt = performance.now();
    if (state !== "petted" && isGrounded()) setState("petted");
    say("prrr ♥", PET_HOLD_MS);
  }

  function wake() {
    setState("alert", 900);
    say("!", 900);
  }

  function noteInput() {
    lastInputAt = performance.now();
    if (state === "nap") wake();
  }

  let press = null;
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    try {
      el.setPointerCapture(event.pointerId);
    } catch (error) {
      console.debug("Site pet: pointer capture skipped", error.message);
    }
    press = { startX: event.clientX, startY: event.clientY, isDragging: false };
  });

  el.addEventListener("pointermove", (event) => {
    if (press) {
      const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
      if (!press.isDragging && moved > DRAG_START_PX) {
        press.isDragging = true;
        surface = null;
        setState("held");
        say("mrrp?", 1200);
      }
      if (press.isDragging) {
        // Held by the scruff: the cursor is near the top of the head.
        x = clampX(event.clientX + window.scrollX);
        y = event.clientY + window.scrollY + height * 0.82;
      }
      return;
    }
    if (event.pointerType === "mouse" && Math.abs(event.movementX) + Math.abs(event.movementY) > 2) pet();
  });

  function release() {
    if (!press) return;
    if (press.isDragging) startFall();
    else pet();
    press = null;
  }
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);

  window.addEventListener("pointermove", (event) => {
    noteInput();
    if (event.pointerType !== "mouse") return;
    const now = performance.now();
    const docX = event.clientX + window.scrollX;
    const docY = event.clientY + window.scrollY;
    const elapsed = Math.max(1, now - pointer.time);
    pointer = { x: docX, y: docY, time: now, speed: Math.hypot(docX - pointer.x, docY - pointer.y) / elapsed };

    const isNearby = Math.abs(docX - x) < CHASE_RANGE && Math.abs(docY - (y - height / 2)) < CHASE_RANGE_Y;
    const isFree = state === "sit" || state === "walk";
    if (!prefersReducedMotion && isFree && isNearby && pointer.speed > CHASE_TRIGGER_SPEED && now > chaseCooldownUntil) {
      chaseCooldownUntil = now + CHASE_COOLDOWN_MS;
      setState("chase", CHASE_MS);
    }
  });

  window.addEventListener("keydown", (event) => {
    noteInput();
    if (event.target.closest && event.target.closest("input, textarea, [contenteditable]")) return;
    if (state === "sit" || state === "walk") {
      setState("alert", 1100);
      if (Math.random() < 0.25) say("?", 900);
    }
  });

  window.addEventListener("touchstart", noteInput, { passive: true });

  window.addEventListener("scroll", () => {
    noteInput();
    const now = performance.now();
    const speed = Math.abs(window.scrollY - lastScroll.y) / Math.max(1, now - lastScroll.time);
    lastScroll = { y: window.scrollY, time: now };
    if (speed > FAST_SCROLL_SPEED && surface && surface.id === "floor" && isGrounded() && state !== "petted") {
      setState("grip", 450);
    }
  }, { passive: true });

  let lastSayTarget = null;
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-pet-say]");
    if (!target || target === lastSayTarget) {
      if (!target) lastSayTarget = null;
      return;
    }
    lastSayTarget = target;
    if (!isOnScreen() || state === "nap" || state === "held") return;
    const rect = target.getBoundingClientRect();
    direction = Math.sign(rect.left + rect.width / 2 + window.scrollX - x) || direction;
    say(target.dataset.petSay);
  });

  new MutationObserver(() => {
    const isMenuOpen = document.body.classList.contains("is-menu-open");
    el.classList.toggle("is-above-menu", isMenuOpen);
    if (isMenuOpen) say("where to?", 1800);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // ---- start -------------------------------------------------------------

  function savePosition() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ xRatio: x / pageWidth(), direction }));
    } catch (error) {
      console.debug("Site pet: position not saved", error.message);
    }
  }

  function restoreX() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Number.isFinite(saved.xRatio)) {
        direction = saved.direction === 1 ? 1 : -1;
        return saved.xRatio * pageWidth();
      }
    } catch (error) {
      console.debug("Site pet: no saved position", error.message);
    }
    return pageWidth() * 0.62;
  }

  setupScale();
  x = clampX(restoreX());
  dropInFromTop();
  requestAnimationFrame(tick);

  window.addEventListener("resize", () => {
    setupScale();
    x = clampX(x);
  });
  window.addEventListener("pagehide", savePosition);
})();
