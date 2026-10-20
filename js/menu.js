// Full-screen site menu. Opens from the "menu." pill, closes on the close
// button, a link click, or Escape.
(function () {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("site-menu");
  if (!toggle || !menu) return;
  const closeButton = menu.querySelector(".site-menu__close");

  function setOpen(isOpen) {
    menu.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-menu-open", isOpen);
    if (isOpen) closeButton.focus();
    else toggle.focus();
  }

  toggle.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) setOpen(false);
  });
})();
