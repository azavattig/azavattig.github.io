// Physics hero: desk objects (laptop, keyboard, controller, coffee, mouse)
// that the visitor can grab and fling. Matter.js runs the simulation; each object is a DOM
// element whose transform follows its body, so the art stays crisp at any size.
(function () {
  const { Engine, Bodies, Body, Composite, Constraint } = Matter;

  const hero = document.getElementById("hero");
  const layer = document.getElementById("desk");
  const bottomStrip = hero.querySelector(".hero__bottom");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const WALL = 200;
  const MAX_SPEED = 38;
  const TAP_MAX_MOVE = 6;
  const TAP_MAX_MS = 280;

  const engine = Engine.create({ gravity: { y: 1.1 } });
  let walls = [];
  let items = [];
  let isRunning = true;

  function heroSize() {
    return { width: hero.clientWidth, height: hero.clientHeight };
  }

  function floorY() {
    return bottomStrip.offsetTop;
  }

  function objectScale(width) {
    return Math.min(1, Math.max(0.46, width / 1400));
  }

  function buildWalls() {
    Composite.remove(engine.world, walls);
    const { width } = heroSize();
    const floor = floorY();
    const opts = { isStatic: true, friction: 0.8 };
    walls = [
      Bodies.rectangle(width / 2, floor + WALL / 2, width + WALL * 2, WALL, opts),
      Bodies.rectangle(-WALL / 2, floor / 2 - 600, WALL, floor + 1200, opts),
      Bodies.rectangle(width + WALL / 2, floor / 2 - 600, WALL, floor + 1200, opts),
      Bodies.rectangle(width / 2, -1200 - WALL / 2, width + WALL * 2, WALL, opts),
    ];
    Composite.add(engine.world, walls);
  }

  function startPosition(index, count, def, scale) {
    const { width } = heroSize();
    const slot = width / count;
    const x = slot * index + slot / 2;
    if (prefersReducedMotion) {
      return { x, y: floorY() - (def.body.h * scale) / 2 - 1 };
    }
    return { x, y: -def.h * scale - 120 - Math.random() * 520 };
  }

  function createItem(def, index, count, scale) {
    const el = document.createElement("div");
    el.className = `desk__item desk__item--${def.name}`;
    el.style.width = `${def.w * scale}px`;
    el.style.height = `${def.h * scale}px`;
    el.innerHTML = `<div class="desk__art">${def.svg}</div>`;
    layer.appendChild(el);

    const pos = startPosition(index, count, def, scale);
    const body = Bodies.rectangle(pos.x, pos.y, def.body.w * scale, def.body.h * scale, {
      chamfer: { radius: def.body.chamfer * scale },
      restitution: 0.22,
      friction: 0.55,
      frictionAir: 0.012,
      density: 0.0018,
      angle: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.8,
    });
    Composite.add(engine.world, body);

    const item = {
      def,
      el,
      body,
      offsetX: def.body.ox * scale,
      offsetY: def.body.oy * scale,
      width: def.w * scale,
      height: def.h * scale,
    };
    el.style.transformOrigin = `${item.width / 2 + item.offsetX}px ${item.height / 2 + item.offsetY}px`;
    attachDrag(item, { onTap: hop });
    return item;
  }

  function pointerInHero(event) {
    const rect = hero.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // hooks: onGrab(), onRelease(), onTap().
  function attachDrag(item, hooks) {
    let constraint = null;
    let downAt = null;

    item.el.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      try {
        item.el.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer already gone (e.g. released before this ran); drag still works via bubbling events.
        console.debug("setPointerCapture skipped:", error.message);
      }
      const point = pointerInHero(event);
      downAt = { ...point, time: performance.now() };
      constraint = Constraint.create({
        pointA: point,
        bodyB: item.body,
        pointB: { x: point.x - item.body.position.x, y: point.y - item.body.position.y },
        stiffness: 0.18,
        damping: 0.08,
        length: 0,
      });
      Composite.add(engine.world, constraint);
      if (hooks.onGrab) hooks.onGrab();
    });

    item.el.addEventListener("pointermove", (event) => {
      if (!constraint) return;
      constraint.pointA = pointerInHero(event);
    });

    const release = (event) => {
      if (!constraint) return;
      Composite.remove(engine.world, constraint);
      constraint = null;
      const point = pointerInHero(event);
      const moved = Math.hypot(point.x - downAt.x, point.y - downAt.y);
      const isTap = moved < TAP_MAX_MOVE && performance.now() - downAt.time < TAP_MAX_MS;
      if (hooks.onRelease) hooks.onRelease();
      if (isTap && hooks.onTap) hooks.onTap(item);
    };
    item.el.addEventListener("pointerup", release);
    item.el.addEventListener("pointercancel", release);
  }

  function hop(item) {
    // Prototype: every object hops when tapped. Later the laptop opens the
    // Pavind demo and the controller scrolls to the routing toy.
    Body.setVelocity(item.body, { x: (Math.random() - 0.5) * 4, y: -11 });
    Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.2);
  }

  function capSpeed(body, maxSpeed) {
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > maxSpeed) {
      const k = maxSpeed / speed;
      Body.setVelocity(body, { x: body.velocity.x * k, y: body.velocity.y * k });
    }
  }

  function render() {
    for (const item of items) {
      const { position, angle } = item.body;
      const x = position.x - item.width / 2 - item.offsetX;
      const y = position.y - item.height / 2 - item.offsetY;
      item.el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    }
  }

  // Fixed 60 Hz steps so the simulation runs at the same speed on 60 and 120 Hz screens.
  const STEP_MS = 1000 / 60;
  let lastTime = performance.now();
  let pendingMs = 0;
  function tick(now) {
    if (isRunning) {
      pendingMs = Math.min(pendingMs + (now - lastTime), STEP_MS * 4);
      while (pendingMs >= STEP_MS) {
        Engine.update(engine, STEP_MS);
        for (const item of items) capSpeed(item.body, MAX_SPEED);
        pendingMs -= STEP_MS;
      }
      render();
    }
    lastTime = now;
    requestAnimationFrame(tick);
  }

  function keepItemsInside() {
    const { width } = heroSize();
    const floor = floorY();
    for (const item of items) {
      const { x, y } = item.body.position;
      const clampedX = Math.min(Math.max(x, item.width / 2), width - item.width / 2);
      const clampedY = Math.min(y, floor - item.height / 2);
      if (clampedX !== x || clampedY !== y) {
        Body.setPosition(item.body, { x: clampedX, y: clampedY });
        Body.setVelocity(item.body, { x: 0, y: 0 });
      }
    }
  }

  function lightRandomKey() {
    const keyboard = items.find((item) => item.def.name === "keyboard");
    if (!keyboard) return;
    const keys = keyboard.el.querySelectorAll(".key");
    const key = keys[Math.floor(Math.random() * keys.length)];
    key.classList.add("is-lit");
    setTimeout(() => key.classList.remove("is-lit"), 140);
  }

  // Lets the site pet stand on the desk line and bat objects around.
  // Coordinates are document pixels.
  function heroOrigin() {
    const rect = hero.getBoundingClientRect();
    return { left: rect.left + window.scrollX, top: rect.top + window.scrollY, right: rect.right + window.scrollX };
  }

  window.HeroDesk = {
    surface() {
      const origin = heroOrigin();
      return { top: origin.top + floorY(), left: origin.left, right: origin.right };
    },
    objectAhead(docX, docY, direction, reach) {
      const origin = heroOrigin();
      const probeX = docX - origin.left;
      const feetY = docY - origin.top;
      const minX = direction > 0 ? probeX : probeX - reach;
      const maxX = direction > 0 ? probeX + reach : probeX;
      return items.find(({ body }) => {
        const { min, max } = body.bounds;
        return max.x > minX && min.x < maxX && max.y > feetY - 40 && min.y < feetY - 2;
      }) || null;
    },
    bat(item, direction) {
      Body.setVelocity(item.body, { x: direction * 7, y: -6 });
      Body.setAngularVelocity(item.body, direction * 0.15);
    },
  };

  function init() {
    const { width } = heroSize();
    const scale = objectScale(width);
    buildWalls();
    items = window.DESK_ITEMS.map((def, i) => createItem(def, i, window.DESK_ITEMS.length, scale));
    render();
    requestAnimationFrame(tick);

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        buildWalls();
        keepItemsInside();
      }, 150);
    });

    document.addEventListener("keydown", lightRandomKey);

    new IntersectionObserver(([entry]) => {
      isRunning = entry.isIntersecting;
    }).observe(hero);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    init();
  }
})();
