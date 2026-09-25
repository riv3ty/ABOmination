// Anmelde-Oberfläche (Profilwahl, Login, Profil anlegen) und Konto-Funktionen in den Einstellungen
import { $, esc } from "./lib/dom.js";
import { Vault, USERS_KEY, LEGACY_KEYS, rget, sleep } from "./vault.js";
import { startApp } from "./app.js";

/* ---------- Anmelde-Oberfläche ---------- */
const root = $("#auth");
let view = { mode: "list" }, busy = false, fails = 0;
const legacyData = () => {                    // unverschlüsselte Daten aus früheren Versionen
  const d = {}; for (const k of LEGACY_KEYS) { const v = rget(k, undefined); if (v !== undefined) d[k] = v; }
  return Object.keys(d).length ? d : null;
};
const avatar = u => `<span class="au-av" style="background:${esc(u.color)}">${esc([...u.name][0].toUpperCase())}</span>`;

function render() {
  const users = rget(USERS_KEY, []);
  if (!users.length) view = { mode: "create" };
  if (view.mode === "login" && !users.find(u => u.id === view.id)) view = { mode: "list" };
  if (view.mode === "list") root.innerHTML = `<div class="au-card"><h1>ABOmination</h1><p class="muted" style="margin:0">Wer bist du?</p>
    <div class="au-users">${users.map(u => `<button class="au-user" data-login="${esc(u.id)}">${avatar(u)}<span>${esc(u.name)}</span></button>`).join("")}</div>
    <button class="btn" data-mode="create">＋ Neues Profil</button></div>`;
  else if (view.mode === "login") {
    const u = users.find(x => x.id === view.id);
    root.innerHTML = `<form class="au-card" id="auLogin"><div style="display:flex;align-items:center;gap:12px">${avatar(u)}<h1 style="margin:0">${esc(u.name)}</h1></div>
      <label>Passwort<input type="password" id="auPw" autocomplete="current-password"></label>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Entsperren</button>
      <div class="au-links">${users.length > 1 ? `<button type="button" data-mode="list">← Anderes Profil</button>` : "<span></span>"}<button type="button" data-forgot="1">Passwort vergessen?</button></div></form>`;
  } else {
    const first = !users.length, legacy = first && legacyData();
    root.innerHTML = `<form class="au-card" id="auCreate"><h1>${first ? "Willkommen" : "Neues Profil"}</h1>
      ${legacy ? `<div class="au-note">Deine bisherigen Abos in diesem Browser werden in dieses Profil übernommen und ab jetzt verschlüsselt gespeichert.</div>` : ""}
      <label>Name<input id="auName" maxlength="40" autocomplete="username" placeholder="z. B. Maciej"></label>
      <label>Passwort (mind. 8 Zeichen)<input type="password" id="auPw" autocomplete="new-password"></label>
      <label>Passwort wiederholen<input type="password" id="auPw2" autocomplete="new-password"></label>
      <div class="au-note">Es gibt keinen Passwort-Reset. Wer das Passwort vergisst, kann die Daten des Profils nicht wiederherstellen.</div>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Profil anlegen</button>
      ${first ? "" : `<div class="au-links"><button type="button" data-mode="list">← Zurück</button></div>`}</form>`;
  }
  root.querySelector("input")?.focus();
}
function setBusy(on) {
  busy = on;
  const b = $("#auGo"); if (!b) return;
  b.disabled = on; b.dataset.label ??= b.textContent; b.textContent = on ? "Bitte warten …" : b.dataset.label;
}
async function doLogin() {
  const pw = $("#auPw").value;
  if (!pw) return;
  setBusy(true);
  try { await Vault.unlock(view.id, pw); enter(); }
  catch (e) { fails++; $("#auErr").textContent = e.message; await sleep(Math.min(fails, 6) * 600); setBusy(false); $("#auPw").select(); }
}
async function doCreate() {
  const name = $("#auName").value.trim(), pw = $("#auPw").value, err = $("#auErr");
  err.textContent = "";
  if (!name) return (err.textContent = "Bitte einen Namen eingeben.");
  if (pw.length < 8) return (err.textContent = "Das Passwort braucht mindestens 8 Zeichen.");
  if (pw !== $("#auPw2").value) return (err.textContent = "Die Passwörter stimmen nicht überein.");
  const first = !rget(USERS_KEY, []).length, initial = first ? legacyData() : null;
  setBusy(true);
  try {
    await Vault.create(name, pw, initial || {});
    if (initial) for (const k of LEGACY_KEYS) localStorage.removeItem(k);      // Klartext-Reste entfernen
    enter();
  } catch (e) { err.textContent = e.message; setBusy(false); }
}
function forgot(id) {
  const u = rget(USERS_KEY, []).find(x => x.id === id); if (!u) return;
  const t = prompt(`Ohne Passwort lassen sich die Daten von „${u.name}“ nicht wiederherstellen.\nProfil endgültig löschen? Zur Bestätigung den Profilnamen eingeben:`);
  if (t !== null && t.trim() === u.name) Vault.removeProfile(id).then(() => { view = { mode: "list" }; render(); });
}
root.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || busy) return;
  if (b.dataset.login) { view = { mode: "login", id: b.dataset.login }; fails = 0; render(); }
  else if (b.dataset.mode) { view = { mode: b.dataset.mode }; render(); }
  else if (b.dataset.forgot) forgot(view.id);
});
root.addEventListener("submit", e => {
  e.preventDefault(); if (busy) return;
  if (e.target.id === "auLogin") doLogin(); else if (e.target.id === "auCreate") doCreate();
});

function enter() {                            // Tresor offen: erst jetzt Daten laden und die App starten
  root.hidden = true; document.body.classList.remove("locked");
  $("#userName").textContent = Vault.name;
  startApp();
  Vault.bump();
}

/* ---------- Konto-Funktionen (Einstellungen) ---------- */
$("#btnLock").onclick = $("#acLock").onclick = () => Vault.lock();
$("#acRename").onclick = () => {
  const n = prompt("Neuer Profilname:", Vault.name); if (n === null) return;
  try { Vault.rename(n); $("#userName").textContent = $("#acName").textContent = Vault.name; } catch (e) { alert(e.message); }
};
let pwMode = null;
function openPw(mode) {
  pwMode = mode;
  const change = mode === "change";
  $("#formPw").reset();
  $("#pwTitle").textContent = change ? "Passwort ändern" : "Profil löschen";
  document.querySelectorAll(".pw-new").forEach(e => e.hidden = !change);
  $("#pwNew").required = $("#pwNew2").required = change;
  $("#pwOk").textContent = change ? "Ändern" : "Endgültig löschen";
  $("#pwOk").className = "btn " + (change ? "primary" : "danger");
  $("#pwErr").textContent = change ? "" : "Alle Daten dieses Profils in diesem Browser werden unwiderruflich gelöscht.";
  $("#dlgPw").showModal();
}
$("#acPw").onclick = () => openPw("change");
$("#acDelete").onclick = () => openPw("delete");
$("#pwCancel").onclick = () => $("#dlgPw").close();
$("#formPw").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#pwErr"), ok = $("#pwOk"), old = $("#pwOld").value;
  err.textContent = "";
  try {
    if (pwMode === "change") {
      const n = $("#pwNew").value;
      if (n.length < 8) throw new Error("Neues Passwort: mindestens 8 Zeichen.");
      if (n !== $("#pwNew2").value) throw new Error("Die neuen Passwörter stimmen nicht überein.");
      ok.disabled = true;
      await Vault.changePassword(old, n);
      document.dispatchEvent(new Event("abo:pwchanged"));
      $("#dlgPw").close(); alert("Passwort geändert.");
    } else {
      if (!confirm(`Profil „${Vault.name}“ wirklich endgültig löschen?`)) return;
      ok.disabled = true;
      await Vault.deleteProfile(old);
      location.reload();
    }
  } catch (x) { err.textContent = x.message; }
  finally { ok.disabled = false; }
});

/* ---------- Start ---------- */
export function startAuth() {
  root.hidden = false;
  if (!(window.crypto && crypto.subtle))
    root.innerHTML = `<div class="au-card"><h1>Nicht unterstützt</h1><p>Dieser Browser bzw. diese Adresse erlaubt keine Verschlüsselung (crypto.subtle). Öffne die App über <b>Abo-Manager-starten.cmd</b> (http://localhost:8765) oder per https.</p></div>`;
  else render();
}
