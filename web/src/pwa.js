// Installierbare Web-App (PWA): Manifest + Service Worker, nur über http(s) (nicht per Doppelklick/file://)
const WEB = /^https?:$/.test(location.protocol);
let installEvent = null;

export function setupPwa() {
  if (!WEB) return;
  // Manifest erst hier einhängen: bei file:// würde der Browser sonst einen Ladefehler melden
  const link = document.createElement("link");
  link.rel = "manifest"; link.href = "./manifest.webmanifest";
  document.head.appendChild(link);

  if ("serviceWorker" in navigator && import.meta.env.PROD)
    addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(e => console.warn("Service Worker:", e.message)));

  // „App installieren“ anbieten, sobald der Browser es erlaubt (Chrome/Edge/Android)
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); installEvent = e;
    document.querySelector("#secInstall")?.removeAttribute("hidden");
  });
  addEventListener("appinstalled", () => { installEvent = null; document.querySelector("#secInstall")?.setAttribute("hidden", ""); });
  document.querySelector("#btnInstall")?.addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    document.querySelector("#secInstall")?.setAttribute("hidden", "");
  });
}
