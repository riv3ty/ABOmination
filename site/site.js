// Website: Sprachwahl merken, Einblenden beim Scrollen, Newsletter-Anmeldung (Brevo, Double-Opt-in)
(function () {
  "use strict";
  var root = document.documentElement;

  // Sprachlink (EN/DE): bewusste Wahl merken, damit die automatische Weiterleitung sie respektiert
  document.querySelectorAll("[data-setlang]").forEach(function (a) {
    a.addEventListener("click", function () { try { localStorage.setItem("abo-site-lang", a.dataset.setlang); } catch (e) {} });
  });

  // Abschnitte sanft einblenden
  var els = document.querySelectorAll(".section, .hero");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.08 });
    els.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }

  // Newsletter: an Brevo senden (no-cors – die Antwort ist nicht lesbar; Brevo schickt die Bestätigungsmail)
  var form = document.getElementById("nlForm");
  if (!form) return;
  var msg = document.getElementById("nlMsg");
  var t = function (en, de) { return root.dataset.lang === "de" ? de : en; };
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.EMAIL.value.trim();
    msg.className = "nl-msg";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className += " err"; msg.textContent = t("Please enter a valid e-mail address.", "Bitte eine gültige E-Mail-Adresse eingeben."); return; }
    if (!form.OPT_IN.checked) { msg.className += " err"; msg.textContent = t("Please confirm the consent checkbox.", "Bitte die Einwilligung bestätigen."); return; }
    if (form.email_address_check.value) return;                                // Honeypot gegen Bots
    document.getElementById("nlLocale").value = root.dataset.lang;
    var btn = form.querySelector("button"); btn.disabled = true;
    fetch(form.action, { method: "POST", mode: "no-cors", body: new FormData(form) })
      .then(function () {
        form.reset(); msg.className += " ok";
        msg.textContent = t("Almost done – please confirm the link in the e-mail we just sent you.", "Fast geschafft – bitte bestätige den Link in der E-Mail, die wir dir gerade geschickt haben.");
      })
      .catch(function () { msg.className += " err"; msg.textContent = t("That didn't work. Please try again later.", "Das hat nicht geklappt. Bitte später erneut versuchen."); })
      .finally(function () { btn.disabled = false; });
  });
})();
