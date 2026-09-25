// localStorage-Zugriff mit JSON und Fehlertoleranz
export const rget = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
export const rset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
