// Desk objects for the hero. Each entry: art size (w, h) in base px, the physics
// body box relative to the art centre, and the SVG markup. Gradient ids are prefixed per
// object because every SVG shares the page's id namespace.
(function () {
  const INK = "#15151a";
  const ACCENT = "#ffb38a";
  const WINE = "#7a1a2c";

  // Rows of [width in key units, kind]. kind: "" normal, "mod" modifier, "esc" accent key.
  const KEY_ROWS = [
    [[1, "esc"], ...Array(12).fill([1, ""]), [2, "mod"]],
    [[1.5, "mod"], ...Array(12).fill([1, ""]), [1.5, "mod"]],
    [[1.8, "mod"], ...Array(11).fill([1, ""]), [2.2, "mod"]],
    [[2.3, "mod"], ...Array(10).fill([1, ""]), [2.7, "mod"]],
    [[1.3, "mod"], [1.3, "mod"], [1.3, "mod"], [7.1, ""], [1.3, "mod"], [1.3, "mod"], [1.4, "mod"]],
  ];
  function keyboardKeys() {
    // Every row is 15 key units wide: 15 * unit + 14 * gap = 262 px inside the case.
    const gap = 2.4;
    const unit = (262 - 14 * gap) / 15;
    const top = 12;
    const rowHeight = 15;
    let keys = "";
    KEY_ROWS.forEach((row, r) => {
      let x = 11;
      const y = top + r * rowHeight;
      for (const [units, kind] of row) {
        const w = units * unit + (units - 1) * gap;
        const fill = kind === "esc" ? ACCENT : kind === "mod" ? "#d9d4cc" : "#f4f1ec";
        keys += `<rect x="${x.toFixed(1)}" y="${y + 1.6}" width="${w.toFixed(1)}" height="12" rx="3" fill="#8f8a83"/>`;
        keys += `<rect class="key" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="12" rx="3" fill="${fill}"/>`;
        x += w + gap;
      }
    });
    return keys;
  }

  window.DESK_ITEMS = [
    {
      name: "laptop",
      w: 250, h: 170,
      body: { w: 250, h: 170, ox: 0, oy: 0, chamfer: 10 },
      svg: `<svg viewBox="0 0 250 170">
        <defs>
          <linearGradient id="dl-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#16224d"/><stop offset="1" stop-color="#0b1330"/>
          </linearGradient>
          <linearGradient id="dl-deck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e4e6ec"/><stop offset="1" stop-color="#b9bdc8"/>
          </linearGradient>
        </defs>
        <rect x="20" y="0" width="210" height="136" rx="11" fill="#24252c"/>
        <rect x="20.5" y="0.5" width="209" height="135" rx="10.5" fill="none" stroke="#4a4c57" stroke-width="1"/>
        <circle cx="125" cy="6" r="1.8" fill="#4a4c57"/>
        <rect x="30" y="11" width="190" height="117" rx="4" fill="url(#dl-screen)"/>
        <g stroke="#ffffff" stroke-opacity="0.06" stroke-width="1">
          <path d="M30 40 H220 M30 70 H220 M30 100 H220 M78 11 V128 M126 11 V128 M174 11 V128"/>
        </g>
        <rect x="30" y="11" width="190" height="11" rx="4" fill="#ffffff" fill-opacity="0.07"/>
        <g fill="#ffffff" fill-opacity="0.35"><circle cx="37" cy="16.5" r="1.8"/><circle cx="43" cy="16.5" r="1.8"/><circle cx="49" cy="16.5" r="1.8"/></g>
        <path class="screen-route" d="M52 108 L84 64 L120 88 L150 38 L196 74" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="#ffffff"><circle cx="52" cy="108" r="5"/><circle cx="84" cy="64" r="4"/><circle cx="120" cy="88" r="4"/><circle cx="150" cy="38" r="4"/><circle cx="196" cy="74" r="5"/></g>
        <path d="M30 11 L96 11 L44 128 L30 128 Z" fill="#ffffff" fill-opacity="0.04"/>
        <rect x="18" y="134" width="214" height="5" rx="2" fill="#3a3b44"/>
        <path d="M14 139 H236 L248 158 Q250 162 246 163 H4 Q0 162 2 158 Z" fill="url(#dl-deck)"/>
        <g fill="#9ea2ad">
          <rect x="40" y="142" width="170" height="2.4" rx="1.2"/>
          <rect x="36" y="146" width="178" height="2.4" rx="1.2"/>
          <rect x="32" y="150" width="186" height="2.4" rx="1.2"/>
        </g>
        <rect x="104" y="154.5" width="42" height="6" rx="2" fill="#cdd0d8" stroke="#a9adb8" stroke-width="0.8"/>
        <path d="M0 163 H250 L247 167 Q246 170 242 170 H8 Q4 170 3 167 Z" fill="#a3a7b2"/>
        <rect x="110" y="163" width="30" height="2.4" rx="1.2" fill="#8c909b"/>
      </svg>`,
    },
    {
      name: "keyboard",
      w: 284, h: 98,
      body: { w: 284, h: 98, ox: 0, oy: 0, chamfer: 12 },
      svg: `<svg viewBox="0 0 284 98">
        <defs>
          <linearGradient id="dk-case" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#34353e"/><stop offset="1" stop-color="#1f2026"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="284" height="98" rx="14" fill="url(#dk-case)"/>
        <rect x="0.75" y="0.75" width="282.5" height="96.5" rx="13.25" fill="none" stroke="#50525e" stroke-width="1.5"/>
        <rect x="6" y="7" width="272" height="84" rx="9" fill="#17181d"/>
        ${keyboardKeys()}
        <circle cx="271" cy="4.2" r="1.6" fill="${ACCENT}"/>
      </svg>`,
    },
    {
      name: "controller",
      w: 200, h: 130,
      body: { w: 190, h: 112, ox: 0, oy: 6, chamfer: 40 },
      svg: `<svg viewBox="0 0 200 130">
        <defs>
          <linearGradient id="dc-shell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe1e8"/>
          </linearGradient>
          <radialGradient id="dc-stick" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stop-color="#3c3d47"/><stop offset="1" stop-color="#121217"/>
          </radialGradient>
        </defs>
        <path d="M44 16 Q100 4 156 16 Q192 22 197 74 Q200 123 172 127 Q150 129 138 102 L62 102 Q50 129 28 127 Q0 123 3 74 Q8 22 44 16 Z" fill="url(#dc-shell)"/>
        <path d="M60 30 Q100 22 140 30 L144 82 Q138 98 124 100 L76 100 Q62 98 56 82 Z" fill="${INK}"/>
        <path d="M66 18 Q100 11 134 18 L132 56 Q100 62 68 56 Z" fill="#f2f3f7" stroke="#c9ccd6" stroke-width="1.2"/>
        <path d="M66 20 L68 56" stroke="#6ab0ff" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M134 20 L132 56" stroke="#6ab0ff" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="76" cy="84" r="14" fill="#0b0b0e"/>
        <circle cx="76" cy="84" r="10" fill="url(#dc-stick)"/>
        <circle cx="76" cy="84" r="6.5" fill="none" stroke="#4a4b55" stroke-width="1"/>
        <circle cx="124" cy="84" r="14" fill="#0b0b0e"/>
        <circle cx="124" cy="84" r="10" fill="url(#dc-stick)"/>
        <circle cx="124" cy="84" r="6.5" fill="none" stroke="#4a4b55" stroke-width="1"/>
        <path d="M95 76 h10 l-2 6 h-6 Z" fill="#2c2d35"/>
        <rect x="93.5" y="88" width="13" height="3" rx="1.5" fill="#f4a3b5"/>
        <g fill="#cfd2db" stroke="#b5b9c4" stroke-width="0.8">
          <path d="M36 33 h8 v8 l-4 4 l-4 -4 Z"/>
          <path d="M36 61 h8 v-8 l-4 -4 l-4 4 Z"/>
          <path d="M26 43 v8 h8 l4 -4 l-4 -4 Z"/>
          <path d="M54 43 v8 h-8 l-4 -4 l4 -4 Z"/>
        </g>
        <g fill="#eceef3" stroke="#c4c7d1" stroke-width="1">
          <circle cx="164" cy="35" r="6.5"/><circle cx="164" cy="61" r="6.5"/>
          <circle cx="151" cy="48" r="6.5"/><circle cx="177" cy="48" r="6.5"/>
        </g>
        <g fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M164 31.5 L167.2 37.2 H160.8 Z" stroke="#3fb59b"/>
          <circle cx="177" cy="48" r="3" stroke="#e5687c"/>
          <path d="M161.6 58.6 L166.4 63.4 M166.4 58.6 L161.6 63.4" stroke="#6f8ff0"/>
          <rect x="148.4" y="45.4" width="5.2" height="5.2" stroke="#d687c9"/>
        </g>
        <rect x="58" y="22" width="5" height="9" rx="2" fill="#c9ccd6"/>
        <rect x="137" y="22" width="5" height="9" rx="2" fill="#c9ccd6"/>
      </svg>`,
    },
    {
      name: "coffee",
      w: 100, h: 118,
      body: { w: 78, h: 86, ox: -6, oy: 16, chamfer: 10 },
      svg: `<svg viewBox="0 0 100 118">
        <defs>
          <linearGradient id="dm-glaze" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#e2cfbb"/><stop offset="0.35" stop-color="#fbf0e4"/><stop offset="1" stop-color="#d8c3ad"/>
          </linearGradient>
          <radialGradient id="dm-coffee" cx="0.45" cy="0.4" r="0.6">
            <stop offset="0" stop-color="#9a5a32"/><stop offset="0.6" stop-color="#6b3a1d"/><stop offset="1" stop-color="#4a2410"/>
          </radialGradient>
        </defs>
        <g class="steam" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round">
          <path d="M28 26 q-6 -8 0 -14 q6 -6 0 -12"/>
          <path d="M44 26 q-6 -8 0 -14 q6 -6 0 -12"/>
          <path d="M60 26 q-6 -8 0 -14 q6 -6 0 -12"/>
        </g>
        <path d="M80 48 q21 0 21 21 q0 22 -23 22" fill="none" stroke="#d8c3ad" stroke-width="11"/>
        <path d="M80 48 q21 0 21 21 q0 22 -23 22" fill="none" stroke="#f3e3d3" stroke-width="6"/>
        <path d="M5 38 Q5 32 11 32 H77 Q83 32 83 38 V106 Q83 118 71 118 H17 Q5 118 5 106 Z" fill="url(#dm-glaze)"/>
        <path d="M5 104 H83 V106 Q83 118 71 118 H17 Q5 118 5 106 Z" fill="#cdb69f"/>
        <ellipse cx="44" cy="35" rx="39" ry="6" fill="#fbf2e8"/>
        <ellipse cx="44" cy="36" rx="34" ry="4.6" fill="url(#dm-coffee)"/>
        <ellipse cx="38" cy="35.2" rx="10" ry="1.5" fill="#c58b5c" fill-opacity="0.55"/>
        <rect x="14" y="44" width="6" height="52" rx="3" fill="#ffffff" fill-opacity="0.45"/>
        <text x="44" y="86" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="600" font-size="22" fill="${WINE}">az.</text>
      </svg>`,
    },
    {
      name: "mouse",
      w: 66, h: 100,
      body: { w: 64, h: 98, ox: 0, oy: 0, chamfer: 30 },
      svg: `<svg viewBox="0 0 66 100">
        <defs>
          <radialGradient id="ds-shell" cx="0.38" cy="0.3" r="0.85">
            <stop offset="0" stop-color="#4a4c57"/><stop offset="0.55" stop-color="#2a2b33"/><stop offset="1" stop-color="#18191e"/>
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="64" height="98" rx="32" fill="url(#ds-shell)"/>
        <rect x="1.75" y="1.75" width="62.5" height="96.5" rx="31.25" fill="none" stroke="#5a5c68" stroke-width="1.5" stroke-opacity="0.7"/>
        <path d="M33 2 V42" stroke="#101014" stroke-width="2"/>
        <path d="M3 42 Q33 48 63 42" fill="none" stroke="#101014" stroke-width="2"/>
        <rect x="28.5" y="13" width="9" height="19" rx="4.5" fill="#101014"/>
        <rect x="30" y="14.5" width="6" height="16" rx="3" fill="${ACCENT}"/>
        <g stroke="#c9733f" stroke-width="1"><path d="M30 18 H36 M30 21.5 H36 M30 25 H36 M30 28.5 H36"/></g>
        <path d="M12 20 Q14 10 24 6" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round"/>
        <circle cx="33" cy="86" r="2" fill="${ACCENT}" fill-opacity="0.8"/>
      </svg>`,
    },
  ];
})();
