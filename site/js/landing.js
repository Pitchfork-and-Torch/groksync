(function () {
  const bar = document.getElementById("sticky");
  const hero = document.getElementById("hero");
  if (bar && hero && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const on = !entries[0].isIntersecting;
        bar.hidden = !on;
        bar.setAttribute("data-open", on ? "true" : "false");
      },
      { threshold: 0.15 }
    );
    io.observe(hero);
    const close = document.getElementById("sticky-close");
    if (close) {
      close.addEventListener("click", () => {
        bar.hidden = true;
        bar.setAttribute("data-open", "false");
        io.disconnect();
      });
    }
  }

  const copyBtn = document.getElementById("copy-setup");
  const setup = document.getElementById("setup-block");
  if (copyBtn && setup) {
    copyBtn.addEventListener("click", async () => {
      const text = setup.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      copyBtn.dataset.state = "copied";
      copyBtn.textContent = "Copied";
      window.setTimeout(() => {
        copyBtn.dataset.state = "";
        copyBtn.textContent = "Copy";
      }, 1600);
    });
  }
})();
