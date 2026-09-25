// Anmelde-Oberfläche (Server-Konten und lokale Profile) und Konto-Funktionen in den Einstellungen
import { $, esc } from "./lib/dom.js";
import { Vault, USERS_KEY, LEGACY_KEYS, ITER, rget, sleep } from "./vault.js";
import { ServerStore, detectServer, cachedAccounts, validUsername } from "./server/store.js";
import { startApp } from "./app.js";

/* ---------- Anmelde-Oberfläche ---------- */
const root = $("#auth");
let view = { mode: "list" }, busy = false, fails = 0, server = null;   // server = Konfiguration, falls die App auf einem Server läuft
const legacyData = () => {                    // unverschlüsselte Daten aus früheren Versionen
  const d = {}; for (const k of LEGACY_KEYS) { const v = rget(k, undefined); if (v !== undefined) d[k] = v; }
  return Object.keys(d).length ? d : null;
};
const avatar = (name, color) => `<span class="au-av" style="background:${esc(color)}">${esc([...name][0].toUpperCase())}</span>`;
const SERVER_COLOR = "#7c3aed";
const serverHooks = {
  getData: () => Vault.data,
  setData: d => Vault.applyRemote(d),
  isDirty: () => Vault.dirty,
  onStatus: (status, message) => document.dispatchEvent(new CustomEvent("abo:serverstatus", { detail: { status, message } }))
};

function listHtml(users, accounts) {
  const srv = server || accounts.length ? `<div class="eyebrow" style="margin-top:18px">Server-Konten</div>
    <div class="au-users">${accounts.map(a => `<button class="au-user" data-srv="${esc(a.username)}">${avatar(a.username, SERVER_COLOR)}<span>${esc(a.username)}</span><span class="chip" style="margin-left:auto">☁ Server</span></button>`).join("")}
      ${server ? `<button class="au-user" data-mode="srv-login"><span class="au-av" style="background:var(--line-strong)">＋</span><span>${accounts.length ? "Mit anderem Konto anmelden" : "Anmelden"}</span></button>` : ""}</div>
    ${server && server.registration !== "closed" ? `<button class="btn" data-mode="srv-register" style="width:100%">Neues Server-Konto registrieren</button>` : ""}` : "";
  const loc = users.length || !server ? `<div class="eyebrow" style="margin-top:18px">Lokale Profile (nur dieser Browser)</div>
    <div class="au-users">${users.map(u => `<button class="au-user" data-login="${esc(u.id)}">${avatar(u.name, u.color)}<span>${esc(u.name)}</span></button>`).join("")}</div>
    <button class="btn" data-mode="create">＋ Neues lokales Profil</button>` : `<div class="au-links"><span></span><button type="button" data-mode="create">Nur lokal nutzen (ohne Server)</button></div>`;
  return `<div class="au-card"><h1>ABOmination</h1><p class="muted" style="margin:0">Wer bist du?</p>${srv}${loc}</div>`;
}

function render() {
  const users = rget(USERS_KEY, []), accounts = cachedAccounts();
  if (view.mode === "list" && !users.length && !accounts.length) view = server ? { mode: "srv-login" } : { mode: "create" };
  if (view.mode === "login" && !users.find(u => u.id === view.id)) view = { mode: "list" };
  const back = users.length || accounts.length || view.mode !== "srv-login" && server
    ? `<button type="button" data-mode="list">← Zurück</button>` : "<span></span>";

  if (view.mode === "list") root.innerHTML = listHtml(users, accounts);
  else if (view.mode === "login") {
    const u = users.find(x => x.id === view.id);
    root.innerHTML = `<form class="au-card" id="auLogin"><div style="display:flex;align-items:center;gap:12px">${avatar(u.name, u.color)}<h1 style="margin:0">${esc(u.name)}</h1></div>
      <label>Passwort<input type="password" id="auPw" autocomplete="current-password"></label>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Entsperren</button>
      <div class="au-links"><button type="button" data-mode="list">← Anderes Profil</button><button type="button" data-forgot="1">Passwort vergessen?</button></div></form>`;
  } else if (view.mode === "srv-login") {
    root.innerHTML = `<form class="au-card" id="auSrvLogin"><h1>Anmelden</h1>
      <p class="muted" style="margin:0">${server ? "Konto auf diesem ABOmination-Server" : "Server nicht erreichbar – Anmeldung mit der Offline-Kopie"}</p>
      <label>Name<input id="auName" maxlength="32" autocomplete="username" value="${esc(view.username || "")}"></label>
      <label>Passwort<input type="password" id="auPw" autocomplete="current-password"></label>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Anmelden</button>
      <div class="au-links">${back}${server && server.registration !== "closed" ? `<button type="button" data-mode="srv-register">Registrieren</button>` : ""}</div></form>`;
    if (view.username) { root.querySelector("#auPw").focus(); return; }
  } else if (view.mode === "srv-register") {
    const legacy = !users.length && legacyData();
    root.innerHTML = `<form class="au-card" id="auSrvReg"><h1>Registrieren</h1>
      <label>Name (3–32 Zeichen, zum Anmelden)<input id="auName" maxlength="32" autocomplete="username" placeholder="z. B. maciej"></label>
      <label>Passwort (mind. 10 Zeichen)<input type="password" id="auPw" autocomplete="new-password"></label>
      <label>Passwort wiederholen<input type="password" id="auPw2" autocomplete="new-password"></label>
      ${server?.registration === "invite" ? `<label>Einladungscode<input id="auInvite" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX"></label>` : ""}
      ${users.length ? `<label>Daten übernehmen aus
          <select id="auImport"><option value="">– nichts, leer starten –</option>${users.map(u => `<option value="${esc(u.id)}">Lokales Profil „${esc(u.name)}“</option>`).join("")}</select></label>
        <label id="auImportPwWrap" hidden>Passwort des lokalen Profils (leer = dasselbe wie oben)<input type="password" id="auImportPw" autocomplete="off"></label>`
        : legacy ? `<div class="au-note">Deine bisherigen Abos in diesem Browser werden in das neue Konto übernommen.</div>` : ""}
      <div class="au-note">Deine Daten werden auf diesem Gerät verschlüsselt; der Server kann sie nicht lesen. Deshalb gibt es <b>keinen Passwort-Reset</b>.</div>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Konto anlegen</button>
      <div class="au-links">${back}<button type="button" data-mode="srv-login">Schon registriert? Anmelden</button></div></form>`;
  } else {
    const first = !users.length && !accounts.length, legacy = !users.length && legacyData();
    root.innerHTML = `<form class="au-card" id="auCreate"><h1>${first ? "Willkommen" : "Neues lokales Profil"}</h1>
      ${legacy ? `<div class="au-note">Deine bisherigen Abos in diesem Browser werden in dieses Profil übernommen und ab jetzt verschlüsselt gespeichert.</div>` : ""}
      <label>Name<input id="auName" maxlength="40" autocomplete="username" placeholder="z. B. Maciej"></label>
      <label>Passwort (mind. 8 Zeichen)<input type="password" id="auPw" autocomplete="new-password"></label>
      <label>Passwort wiederholen<input type="password" id="auPw2" autocomplete="new-password"></label>
      <div class="au-note">Es gibt keinen Passwort-Reset. Wer das Passwort vergisst, kann die Daten des Profils nicht wiederherstellen.</div>
      <div class="au-err" id="auErr"></div>
      <button class="btn primary" style="width:100%" id="auGo">Profil anlegen</button>
      ${first && !server ? "" : `<div class="au-links">${back}</div>`}</form>`;
  }
  root.querySelector("input")?.focus();
}
function setBusy(on, label) {
  busy = on;
  const b = $("#auGo"); if (!b) return;
  b.disabled = on; b.dataset.label ??= b.textContent; b.textContent = on ? (label || "Bitte warten …") : b.dataset.label;
}
const fail = async (e, input = "#auPw") => {
  fails++; $("#auErr").textContent = e.message || String(e);
  await sleep(Math.min(fails, 6) * 400); setBusy(false); $(input)?.select();
};

async function doLogin() {
  const pw = $("#auPw").value;
  if (!pw) return;
  setBusy(true);
  try { await Vault.unlock(view.id, pw); enter(); }
  catch (e) { fail(e); }
}
async function doCreate() {
  const name = $("#auName").value.trim(), pw = $("#auPw").value, err = $("#auErr");
  err.textContent = "";
  if (!name) return (err.textContent = "Bitte einen Namen eingeben.");
  if (pw.length < 8) return (err.textContent = "Das Passwort braucht mindestens 8 Zeichen.");
  if (pw !== $("#auPw2").value) return (err.textContent = "Die Passwörter stimmen nicht überein.");
  const initial = !rget(USERS_KEY, []).length ? legacyData() : null;
  setBusy(true);
  try {
    await Vault.create(name, pw, initial || {});
    if (initial) for (const k of LEGACY_KEYS) localStorage.removeItem(k);      // Klartext-Reste entfernen
    enter();
  } catch (e) { err.textContent = e.message; setBusy(false); }
}
async function doSrvLogin() {
  const name = $("#auName").value.trim(), pw = $("#auPw").value;
  if (!name || !pw) return;
  setBusy(true, "Anmelden …");
  try {
    const res = await ServerStore.login(name, pw, serverHooks);
    Vault.enterServer(res);
    enter();
    if (res.lostPending) alert("Hinweis: Auf diesem Gerät gab es noch nicht übertragene Änderungen. Da das Passwort inzwischen auf einem anderen Gerät geändert wurde, konnten sie nicht übernommen werden.");
  } catch (e) { fail(e); }
}
async function doSrvRegister() {
  const name = $("#auName").value.trim(), pw = $("#auPw").value, err = $("#auErr");
  err.textContent = "";
  if (!validUsername(name)) return (err.textContent = "Name: 3–32 Zeichen, nur Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich.");
  if (pw.length < 10) return (err.textContent = "Das Passwort braucht mindestens 10 Zeichen.");
  if (pw !== $("#auPw2").value) return (err.textContent = "Die Passwörter stimmen nicht überein.");
  setBusy(true, "Konto wird angelegt …");
  try {
    let initial = {}, legacy = false;
    const imp = $("#auImport")?.value;
    if (imp) initial = (await Vault.readLocal(imp, $("#auImportPw").value || pw)).data;
    else if (!rget(USERS_KEY, []).length && legacyData()) { initial = legacyData(); legacy = true; }
    const res = await ServerStore.register({ username: name, pw, invite: $("#auInvite")?.value.trim(), initial, iter: server?.kdf?.defaultIter || ITER }, serverHooks);
    if (legacy) for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    Vault.enterServer(res);
    enter();
    if (imp) alert("Die Daten wurden übernommen. Das lokale Profil bleibt unverändert erhalten – du kannst es löschen, sobald alles passt.");
  } catch (e) { err.textContent = e.message || String(e); setBusy(false); }
}
function forgot(id) {
  const u = rget(USERS_KEY, []).find(x => x.id === id); if (!u) return;
  const t = prompt(`Ohne Passwort lassen sich die Daten von „${u.name}“ nicht wiederherstellen.\nProfil endgültig löschen? Zur Bestätigung den Profilnamen eingeben:`);
  if (t !== null && t.trim() === u.name) Vault.removeProfile(id).then(() => { view = { mode: "list" }; render(); });
}
root.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || busy) return;
  if (b.dataset.login) { view = { mode: "login", id: b.dataset.login }; fails = 0; render(); }
  else if (b.dataset.srv) { view = { mode: "srv-login", username: b.dataset.srv }; fails = 0; render(); }
  else if (b.dataset.mode) { view = { mode: b.dataset.mode }; render(); }
  else if (b.dataset.forgot) forgot(view.id);
});
root.addEventListener("change", e => {
  if (e.target.id === "auImport") $("#auImportPwWrap").hidden = !e.target.value;
});
root.addEventListener("submit", e => {
  e.preventDefault(); if (busy) return;
  ({ auLogin: doLogin, auCreate: doCreate, auSrvLogin: doSrvLogin, auSrvReg: doSrvRegister })[e.target.id]?.();
});

function enter() {                            // Tresor offen: erst jetzt Daten laden und die App starten
  root.hidden = true; document.body.classList.remove("locked");
  document.body.classList.toggle("server-mode", Vault.mode === "server");
  $("#userName").textContent = Vault.name;
  startApp();
  Vault.bump();
}

/* ---------- Konto-Funktionen (Einstellungen) ---------- */
$("#btnLock").onclick = $("#acLock").onclick = () => Vault.lock();
$("#acLogout").onclick = () => Vault.logout();
$("#acRename").onclick = () => {
  const n = prompt("Neuer Profilname:", Vault.name); if (n === null) return;
  try { Vault.rename(n); $("#userName").textContent = $("#acName").textContent = Vault.name; } catch (e) { alert(e.message); }
};
let pwMode = null;
function openPw(mode) {
  pwMode = mode;
  const change = mode === "change", srv = Vault.mode === "server";
  $("#formPw").reset();
  $("#pwTitle").textContent = change ? "Passwort ändern" : srv ? "Konto löschen" : "Profil löschen";
  document.querySelectorAll(".pw-new").forEach(e => e.hidden = !change);
  $("#pwNew").required = $("#pwNew2").required = change;
  $("#pwOk").textContent = change ? "Ändern" : "Endgültig löschen";
  $("#pwOk").className = "btn " + (change ? "primary" : "danger");
  $("#pwErr").textContent = change ? (srv ? "Andere angemeldete Geräte werden dabei abgemeldet." : "")
    : srv ? "Das Konto und alle Daten auf dem Server werden unwiderruflich gelöscht – auf allen Geräten."
          : "Alle Daten dieses Profils in diesem Browser werden unwiderruflich gelöscht.";
  $("#dlgPw").showModal();
}
$("#acPw").onclick = () => openPw("change");
$("#acDelete").onclick = () => openPw("delete");
$("#pwCancel").onclick = () => $("#dlgPw").close();
$("#formPw").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#pwErr"), ok = $("#pwOk"), old = $("#pwOld").value, srv = Vault.mode === "server";
  err.textContent = "";
  try {
    if (pwMode === "change") {
      const n = $("#pwNew").value, min = srv ? 10 : 8;
      if (n.length < min) throw new Error(`Neues Passwort: mindestens ${min} Zeichen.`);
      if (n !== $("#pwNew2").value) throw new Error("Die neuen Passwörter stimmen nicht überein.");
      ok.disabled = true;
      await Vault.changePassword(old, n);
      document.dispatchEvent(new Event("abo:pwchanged"));
      $("#dlgPw").close(); alert("Passwort geändert.");
    } else {
      if (!confirm(srv ? `Konto „${Vault.name}“ samt allen Daten auf dem Server wirklich löschen?` : `Profil „${Vault.name}“ wirklich endgültig löschen?`)) return;
      ok.disabled = true;
      await Vault.deleteProfile(old);
      location.reload();
    }
  } catch (x) { err.textContent = x.message; }
  finally { ok.disabled = false; }
});

/* ---------- Start ---------- */
export async function startAuth() {
  root.hidden = false;
  if (!(window.crypto && crypto.subtle)) {
    root.innerHTML = `<div class="au-card"><h1>Nicht unterstützt</h1><p>Dieser Browser bzw. diese Adresse erlaubt keine Verschlüsselung (crypto.subtle). Öffne die App über <b>Abo-Manager-starten.cmd</b> (http://localhost:8765) oder per https.</p></div>`;
    return;
  }
  root.innerHTML = `<div class="au-card"><h1>ABOmination</h1><p class="muted">Verbinde …</p></div>`;
  server = await detectServer();
  render();
}
