// Where the cat can stand. All values are document coordinates (page pixels,
// not viewport pixels), so a cat standing on a card scrolls with the card.
// Surfaces: the top edge of each card, the hero desk line, and the bottom
// edge of the screen ("floor"), which follows the viewport.
(function () {
  const PERCH_SELECTOR = ".card, .exp-card__cover, .exp-list, .skills-card, .pv-card, .pv-demo";
  const EDGE_PADDING = 18;
  const FLOOR_GAP = 2;

  function elementSurface(el) {
    const rect = el.getBoundingClientRect();
    return {
      id: el,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX + EDGE_PADDING,
      right: rect.right + window.scrollX - EDGE_PADDING,
    };
  }

  function deskSurface() {
    if (!window.HeroDesk) return null;
    const desk = window.HeroDesk.surface();
    return { id: "desk", top: desk.top, left: desk.left + EDGE_PADDING, right: desk.right - EDGE_PADDING };
  }

  function floor() {
    return {
      id: "floor",
      top: window.scrollY + window.innerHeight - FLOOR_GAP,
      left: window.scrollX,
      right: window.scrollX + document.documentElement.clientWidth,
    };
  }

  function all() {
    const surfaces = [...document.querySelectorAll(PERCH_SELECTOR)].map(elementSurface);
    const desk = deskSurface();
    if (desk) surfaces.push(desk);
    return surfaces;
  }

  // Re-reads a surface by id (layout or scroll may have moved it).
  function refresh(surface) {
    if (surface.id === "floor") return floor();
    if (surface.id === "desk") return deskSurface();
    return document.contains(surface.id) ? elementSurface(surface.id) : null;
  }

  function isOver(surface, x) {
    return x >= surface.left && x <= surface.right;
  }

  // First surface the cat would hit falling at x from fromY down to toY.
  function landingBetween(x, fromY, toY) {
    const candidates = [...all(), floor()].filter(
      (surface) => isOver(surface, x) && surface.top >= fromY && surface.top <= toY
    );
    candidates.sort((a, b) => a.top - b.top);
    return candidates[0] || null;
  }

  function isInViewport(surface) {
    return surface.top > window.scrollY + 40 && surface.top < window.scrollY + window.innerHeight - 10;
  }

  window.PetSurfaces = { all, floor, refresh, isOver, landingBetween, isInViewport };
})();
