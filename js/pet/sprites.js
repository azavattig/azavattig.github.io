// Pixel-art frames for the site cat, built from parts (head, body, legs,
// tail) on a 40x28 grid. Characters map to the palette below; "." is
// transparent. Frames face left and are bottom-aligned so the feet stay on
// one line. Two passes add detail automatically: fur with nothing above it
// gets a highlight, and every shape gets a one-pixel outline so the black cat
// stays visible on dark backgrounds.
(function () {
  const GRID_W = 40;
  const GRID_H = 28;
  const MARGIN = 1;

  const PALETTE = {
    K: "#17151b", // fur
    H: "#3a3542", // fur highlight (added automatically)
    G: "#2a2630", // fur shade, paws, closed eyes
    Y: "#d9ee52", // iris
    D: "#0b0a0d", // pupil
    S: "#ffffff", // eye shine
    P: "#e98aa0", // inner ears, nose
    M: "#5a5262", // mouth
    W: "#c9c2cf", // whiskers
  };
  const OUTLINE = "#6d6474";

  const EYES = {
    open: ["SDY", "YDY"],
    blink: ["KKK", "GGG"],
    happy: ["KYK", "YKY"],
    alert: ["SDD", "YDD"],
  };

  function head(eyes) {
    const [top, bottom] = EYES[eyes];
    return [
      "..K.........K..",
      "..KK.......KK..",
      "..KPK.....KPK..",
      "..KPPKKKKKPPK..",
      ".KKKKKKKKKKKKK.",
      ".KKKKKKKKKKKKK.",
      `KK${top}KKKKK${top}KK`,
      `KK${bottom}KKKKK${bottom}KK`,
      "KKKKKKKKKKKKKKK",
      "WKKKKKKPKKKKKKW",
      ".WKKKKMKMKKKKW.",
      ".KKKKKKKKKKKKK.",
      "..KKKKKKKKKKK..",
    ];
  }

  const SIT_BODY = [
    "...KKKKKKKKK",
    "..KKKKKKKKKKKK",
    ".KKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKKK.......KK",
    ".KKKKKKKKKKKKKKKKK.......K",
    ".KKKKKKKKKKKKKKKKK.......K",
    ".KKKKKKKKKKKKKKKKK......KK",
    ".KKKKKKKKKKKKKKKKKK....KK",
    ".KKGKKKGKKKKKKKKKKKKKKKK",
    ".KKGKKKGKKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKKKKKKK",
  ];

  const WALK_BODY = [
    "...KKKKKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKKKKKKKKKK",
  ];

  const LEGS = {
    stride: [
      "..KKK..KKK......KKK..KKK",
      ".KKK....KKK....KKK....KKK",
      ".KKK.....KKK..KKK.....KKK",
      "KKK......KKK..KKK......KKK",
      "GGG......GGG..GGG......GGG",
    ],
    pass: [
      "...KKKKKK.......KKKKKK",
      "...KKKKKK.......KKKKKK",
      "....KKKK.........KKKK",
      "....KKKK.........KKKK",
      "....GGGG.........GGGG",
    ],
    crouch: [
      "...KKKKKK.......KKKKKK",
      "...GGGGGG.......GGGGGG",
    ],
    leap: [
      "..KKK..................KKK",
      ".KKK....................KKK",
      "KKK.......................KKK",
    ],
  };

  const TAILS = {
    up: [
      "....KK",
      "...KK.",
      "...KK.",
      "..KK..",
      "..KK..",
      ".KK...",
      "KK....",
      "K.....",
    ],
    swish: [
      "......",
      "......",
      ".....K",
      "....KK",
      "...KK.",
      "..KK..",
      "KKK...",
      "K.....",
    ],
  };

  const SLEEP = [
    "......K.......K",
    "......KK.....KK",
    "......KPK...KPK",
    ".....KKKKKKKKKKKKKKKKKKKK",
    "....KKKKKKKKKKKKKKKKKKKKKKK",
    "...KKGGGKKKGGGKKKKKKKKKKKKKK",
    "..WKKKKKKPKKKKKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "..KKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "...KKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    ".KKKKKKKKKKKKKKKKKKKKKKKKKK",
  ];

  const HELD_BODY = [
    "...KKKKKKKKK",
    "..KKKKKKKKKKK",
    ".K.KKKKKKKKK.K",
    "K..KKKKKKKKK..K",
    "...KKKKKKKKK",
    "...KKKKKKKKK",
    "...KKK...KKK",
    "...KKK...KKK",
    "...GGG...GGG",
    "......KK",
    ".......KK",
    "........K",
  ];

  function blankGrid(width, height) {
    return Array.from({ length: height }, () => Array(width).fill("."));
  }

  function stamp(grid, rows, offsetX, offsetY) {
    rows.forEach((row, dy) => {
      [...row].forEach((char, dx) => {
        const y = offsetY + dy;
        const x = offsetX + dx;
        if (char !== "." && grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = char;
      });
    });
    return grid;
  }

  function trimmed(grid) {
    const rows = grid.map((cells) => cells.join(""));
    while (rows.length && !/[^.]/.test(rows[0])) rows.shift();
    return rows;
  }

  // Sitting poses start 3 cells in, leaving room for the raised paw.
  function sit(eyes, isPawUp = false) {
    const grid = blankGrid(31, 25);
    stamp(grid, SIT_BODY, 3, 13);
    stamp(grid, head(eyes), 3, 0);
    if (isPawUp) {
      stamp(grid, ["KKKK", "KKKKK", ".KKK"], 0, 14);
      stamp(grid, ["K", "K"], 6, 22);
    }
    return trimmed(grid);
  }

  function walk(legs, tail, headDrop) {
    const grid = blankGrid(GRID_W, 20);
    stamp(grid, TAILS[tail], 32, 0);
    stamp(grid, WALK_BODY, 10, 4);
    stamp(grid, LEGS[legs], 10, 13);
    stamp(grid, head("open"), 0, headDrop);
    return trimmed(grid);
  }

  function crouch() {
    const grid = blankGrid(GRID_W, 20);
    stamp(grid, TAILS.swish, 32, 3);
    stamp(grid, WALK_BODY, 10, 7);
    stamp(grid, LEGS.crouch, 10, 16);
    stamp(grid, head("alert"), 0, 4);
    return trimmed(grid);
  }

  function leap() {
    const grid = blankGrid(GRID_W, 20);
    stamp(grid, TAILS.up, 32, 0);
    stamp(grid, WALK_BODY, 10, 4);
    stamp(grid, LEGS.leap, 8, 13);
    stamp(grid, head("alert"), 0, 0);
    return trimmed(grid);
  }

  function sleep(isBreathingIn) {
    const rows = [...SLEEP];
    if (isBreathingIn) rows.splice(9, 0, rows[9]);
    return rows;
  }

  function held() {
    const grid = blankGrid(GRID_W, 27);
    stamp(grid, head("alert"), 12, 0);
    stamp(grid, HELD_BODY, 13, 13);
    return trimmed(grid);
  }

  const FRAMES = {
    sit: sit("open"),
    sitBlink: sit("blink"),
    sitHappy: sit("happy"),
    sitAlert: sit("alert"),
    sitPaw: sit("open", true),
    walk1: walk("stride", "up", 0),
    walk2: walk("pass", "swish", 1),
    walk3: walk("stride", "swish", 0),
    walk4: walk("pass", "up", 1),
    crouch: crouch(),
    jump: leap(),
    sleep1: sleep(false),
    sleep2: sleep(true),
    held: held(),
  };

  function charAt(rows, x, y) {
    if (y < 0 || y >= rows.length || x < 0) return ".";
    return rows[y][x] || ".";
  }

  function isFilled(rows, x, y) {
    return charAt(rows, x, y) !== ".";
  }

  function renderFrame(rows, scale) {
    const canvas = document.createElement("canvas");
    canvas.width = (GRID_W + MARGIN * 2) * scale;
    canvas.height = (GRID_H + MARGIN * 2) * scale;
    const ctx = canvas.getContext("2d");
    const top = GRID_H - rows.length;
    const width = Math.max(...rows.map((row) => row.length));

    for (let y = -1; y <= rows.length; y++) {
      for (let x = -1; x <= width; x++) {
        const px = (x + MARGIN) * scale;
        const py = (top + y + MARGIN) * scale;
        let char = charAt(rows, x, y);
        if (char === "K" && !isFilled(rows, x, y - 1)) char = "H";
        if (char !== ".") {
          ctx.fillStyle = PALETTE[char];
        } else if (
          isFilled(rows, x - 1, y) || isFilled(rows, x + 1, y) ||
          isFilled(rows, x, y - 1) || isFilled(rows, x, y + 1)
        ) {
          ctx.fillStyle = OUTLINE;
        } else {
          continue;
        }
        ctx.fillRect(px, py, scale, scale);
      }
    }
    return canvas;
  }

  // Pre-renders every frame at the given pixel scale.
  function buildFrames(scale) {
    const rendered = {};
    for (const [name, rows] of Object.entries(FRAMES)) rendered[name] = renderFrame(rows, scale);
    return rendered;
  }

  window.PetSprites = {
    buildFrames,
    width: (scale) => (GRID_W + MARGIN * 2) * scale,
    height: (scale) => (GRID_H + MARGIN * 2) * scale,
  };
})();
