// =========================
// Archivo: script.js
// =========================

(function () {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Botón flotante "arriba"
  const fab = document.getElementById("fabTop");
  function onScroll() {
    if (!fab) return;
    if (window.scrollY > 650) fab.classList.add("show");
    else fab.classList.remove("show");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (fab) {
    fab.addEventListener("click", () => {
      window.location.hash = "#inicio";
    });
  }

  // Menú móvil
  const navbtn = document.getElementById("navbtn");
  const nav = document.getElementById("nav");

  function closeNav() {
    if (!navbtn || !nav) return;
    nav.classList.remove("open");
    navbtn.setAttribute("aria-expanded", "false");
  }

  if (navbtn && nav) {
    navbtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      navbtn.setAttribute("aria-expanded", String(open));
    });

    // Cierra el menú al hacer click en un link
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => closeNav());
    });

    // Cierra al presionar ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }
})();
