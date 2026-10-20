// Jump buttons for the embedded DealNexa app: point the frame (and the full-screen link)
// at the chosen screen.
(function () {
  const frame = document.getElementById("dn-frame");
  const open = document.getElementById("dn-open");
  const buttons = document.querySelectorAll(".dn-jump [data-view]");
  if (!frame || !open) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const url = `dealnexa-app/index.html#/${button.dataset.view}`;
      try {
        frame.contentWindow.location.hash = `#/${button.dataset.view}`;
      } catch (err) {
        console.warn("dealnexa-window: could not set the frame hash, reloading it instead", err);
        frame.src = url;
      }
      open.href = url;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
  });
})();
