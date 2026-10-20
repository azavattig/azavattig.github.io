// Experience page: role detail dialog and the looping line that draws itself
// through the cards and the list as the visitor scrolls.
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- role dialog ---------------------------------------------------------

  const dialog = document.querySelector(".role-dialog");
  const dialogBody = dialog.querySelector(".role-dialog__body");

  function openRole(key) {
    const template = document.getElementById(`role-${key}`);
    if (!template) {
      console.error(`Experience: no template for role "${key}"`);
      return;
    }
    dialogBody.replaceChildren(template.content.cloneNode(true));
    const title = dialogBody.querySelector(".role__company");
    if (title) title.id = "role-dialog-title";
    dialog.showModal();
  }

  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => openRole(button.dataset.role));
  });
  dialog.querySelector(".role-dialog__close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === dialog) dialog.close();
  });

  // ---- squiggle ------------------------------------------------------------

  const section = document.querySelector(".exp-section");
  const svg = section.querySelector(".squiggle");
  const path = svg.querySelector(".squiggle__path");
  let pathLength = 0;

  function loopPoints(cx, cy, radius, isClockwise) {
    const sign = isClockwise ? 1 : -1;
    return [
      [cx + radius, cy],
      [cx, cy + radius * sign],
      [cx - radius, cy],
      [cx, cy - radius * sign],
      [cx + radius * 0.9, cy + radius * 0.2 * sign],
    ];
  }

  // Waypoints in section coordinates: a loop beside each card, then a zigzag
  // down the list, ending in a loop around the resume link.
  function waypoints() {
    const origin = section.getBoundingClientRect();
    const local = (rect) => ({
      left: rect.left - origin.left,
      right: rect.right - origin.left,
      top: rect.top - origin.top,
      bottom: rect.bottom - origin.top,
      width: rect.width,
      height: rect.height,
    });
    const width = origin.width;
    const points = [];
    const covers = [...section.querySelectorAll(".exp-card__cover")].map((el) => local(el.getBoundingClientRect()));
    if (!covers.length) return points;

    // Enter from the left, pass beside each card through the open corridor,
    // and loop once in the gap after each left-hand card.
    points.push([-40, covers[0].top + covers[0].height * 0.25]);
    covers.forEach((cover, i) => {
      const isLeftCard = cover.left + cover.width / 2 < width / 2;
      if (!isLeftCard) {
        points.push([cover.left - 50, cover.top + cover.height * 0.55]);
        return;
      }
      points.push([cover.right + 50, cover.top + cover.height * 0.2]);
      const next = covers[i + 1];
      const gap = next ? next.left - cover.right : 240;
      if (gap > 120) {
        const radius = Math.min(85, gap / 2 - 20);
        points.push(...loopPoints(cover.right + gap / 2, cover.top + cover.height * 0.6, radius, true));
      }
    });
    const last = covers[covers.length - 1];
    points.push([last.left + last.width * 0.3, last.bottom + 90]);

    // On phones the list rows fill the width, so the line stops above the list.
    if (width < 720) return points;

    const rows = [...section.querySelectorAll(".exp-row")].map((el) => local(el.getBoundingClientRect()));
    rows.forEach((row, i) => {
      points.push([width * (i % 2 ? 0.52 : 0.66), row.top + row.height / 2]);
    });

    const link = section.querySelector(".exp-list__all");
    if (link) {
      const box = local(link.getBoundingClientRect());
      // End with a small loop just after the link, leaving its text readable.
      points.push([box.right + 140, box.top + box.height / 2 - 20]);
      points.push(...loopPoints(box.right + 60, box.top + box.height / 2, 30, false));
    }
    return points;
  }

  // Smooth curve through the points (Catmull-Rom converted to cubic Béziers).
  function smoothPath(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function buildSquiggle() {
    const { width, height } = section.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    path.setAttribute("d", smoothPath(waypoints()));
    pathLength = path.getTotalLength();
    path.style.strokeDasharray = `${pathLength}`;
    drawToScroll();
  }

  function drawToScroll() {
    if (prefersReducedMotion) {
      path.style.strokeDashoffset = "0";
      return;
    }
    const rect = section.getBoundingClientRect();
    // 0 when the section top reaches the bottom of the screen, 1 when its end
    // reaches the middle of the screen.
    const start = window.innerHeight;
    const end = window.innerHeight * 0.5 - rect.height;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
    path.style.strokeDashoffset = `${pathLength * (1 - progress)}`;
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildSquiggle, 150);
  });
  window.addEventListener("scroll", drawToScroll, { passive: true });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSquiggle);
  else buildSquiggle();
})();
