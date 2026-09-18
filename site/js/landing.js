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
    let copyTimer = 0;
    copyBtn.addEventListener("click", async () => {
      const text = (setup.textContent || "").replace(/^\s+|\s+$/g, "");
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
        ta.remove();
      }
      copyBtn.dataset.state = ok ? "copied" : "failed";
      copyBtn.textContent = ok ? "Copied" : "Copy failed";
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copyBtn.dataset.state = "";
        copyBtn.textContent = "Copy";
      }, 1600);
    });
  }
})();
