// Desk objects for the hero. Each entry: art size (w, h) in base px, the physics
// body box relative to the art centre, and the SVG markup.
(function () {
  const INK = "#15151a";
  const ACCENT = "#ffb38a";
  const WINE = "#7a1a2c";
  const MUG = "#f3e3d3";

  function keyboardKeys() {
    let keys = "";
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 12; col++) {
        keys += `<rect class="key" x="${12 + col * 21.5}" y="${12 + row * 16}" width="18" height="12" rx="3" fill="#ffffff"/>`;
      }
    }
    keys += `<rect class="key" x="76" y="76" width="128" height="10" rx="3" fill="#ffffff"/>`;
    return keys;
  }

  window.DESK_ITEMS = [
    {
      name: "laptop",
      w: 250, h: 170,
      body: { w: 250, h: 170, ox: 0, oy: 0, chamfer: 10 },
      svg: `<svg viewBox="0 0 250 170">
        <rect x="22" y="0" width="206" height="138" rx="10" fill="#2a2b33"/>
        <rect x="32" y="10" width="186" height="116" rx="4" fill="#0d1636"/>
        <path class="screen-route" d="M52 104 L84 60 L120 84 L150 34 L196 70" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="#ffffff"><circle cx="52" cy="104" r="5"/><circle cx="84" cy="60" r="4"/><circle cx="120" cy="84" r="4"/><circle cx="150" cy="34" r="4"/><circle cx="196" cy="70" r="5"/></g>
        <path d="M0 140 H250 L238 162 Q236 170 226 170 H24 Q14 170 12 162 Z" fill="#c9ccd5"/>
        <rect x="100" y="140" width="50" height="6" rx="3" fill="#a9adb8"/>
      </svg>`,
    },
    {
      name: "keyboard",
      w: 284, h: 98,
      body: { w: 284, h: 98, ox: 0, oy: 0, chamfer: 12 },
      svg: `<svg viewBox="0 0 284 98">
        <rect x="0" y="0" width="284" height="98" rx="14" fill="#2a2b33"/>
        ${keyboardKeys()}
      </svg>`,
    },
    {
      name: "controller",
      w: 200, h: 130,
      body: { w: 190, h: 112, ox: 0, oy: 6, chamfer: 40 },
      svg: `<svg viewBox="0 0 200 130">
        <path d="M42 18 Q100 6 158 18 Q190 24 196 72 Q200 122 172 127 Q150 129 138 100 L62 100 Q50 129 28 127 Q0 122 4 72 Q10 24 42 18 Z" fill="#f4f4f7"/>
        <path d="M64 20 Q100 14 136 20 L134 66 Q100 74 66 66 Z" fill="${INK}"/>
        <path d="M70 24 Q100 19 130 24 L129 58 Q100 64 71 58 Z" fill="#2c2c34"/>
        <circle cx="76" cy="84" r="13" fill="${INK}"/><circle cx="76" cy="84" r="7" fill="#3a3a44"/>
        <circle cx="124" cy="84" r="13" fill="${INK}"/><circle cx="124" cy="84" r="7" fill="#3a3a44"/>
        <g fill="#c4c6d0"><rect x="29" y="47" width="22" height="7" rx="2"/><rect x="36.5" y="39.5" width="7" height="22" rx="2"/></g>
        <g fill="#c4c6d0"><circle cx="163" cy="40" r="5"/><circle cx="163" cy="62" r="5"/><circle cx="152" cy="51" r="5"/><circle cx="174" cy="51" r="5"/></g>
      </svg>`,
    },
    {
      name: "coffee",
      w: 100, h: 118,
      body: { w: 78, h: 86, ox: -6, oy: 16, chamfer: 10 },
      svg: `<svg viewBox="0 0 100 118">
        <g class="steam" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round">
          <path d="M28 26 q-6 -8 0 -14 q6 -6 0 -12"/>
          <path d="M44 26 q-6 -8 0 -14 q6 -6 0 -12"/>
          <path d="M60 26 q-6 -8 0 -14 q6 -6 0 -12"/>
        </g>
        <path d="M80 50 q20 0 20 20 q0 20 -22 20" fill="none" stroke="${MUG}" stroke-width="9"/>
        <rect x="5" y="32" width="78" height="86" rx="12" fill="${MUG}"/>
        <ellipse cx="44" cy="38" rx="33" ry="5" fill="#5a2e16"/>
        <text x="44" y="88" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="600" font-size="22" fill="${WINE}">az.</text>
      </svg>`,
    },
    {
      name: "mouse",
      w: 66, h: 100,
      body: { w: 64, h: 98, ox: 0, oy: 0, chamfer: 30 },
      svg: `<svg viewBox="0 0 66 100">
        <rect x="1" y="1" width="64" height="98" rx="32" fill="#2a2b33"/>
        <path d="M33 1 V40 M1 40 H65" stroke="#15151a" stroke-width="2.5"/>
        <rect x="29" y="14" width="8" height="16" rx="4" fill="${ACCENT}"/>
      </svg>`,
    },
  ];
})();
