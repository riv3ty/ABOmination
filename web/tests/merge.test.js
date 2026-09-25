import { describe, it, expect } from "vitest";
import { mergeData, KEYS } from "../src/lib/merge.js";

const { SUBS, META, SETTINGS, ACH } = KEYS;
const NOW = Date.UTC(2026, 8, 25);
const s = (id, updatedAt, extra = {}) => ({ id, name: id, updatedAt, ...extra });
const data = (subs, meta = {}, extra = {}) => ({ [SUBS]: subs, [META]: { updatedAt: 0, ...meta }, ...extra });
const ids = d => d[SUBS].map(x => x.id).sort();

describe("mergeData", () => {
  it("vereinigt Einträge beider Seiten", () => {
    const m = mergeData(data([s("a", 1), s("b", 1)]), data([s("b", 1), s("c", 1)]), NOW);
    expect(ids(m)).toEqual(["a", "b", "c"]);
  });

  it("neuere Änderung gewinnt pro Eintrag, Gleichstand = lokal", () => {
    const m = mergeData(data([s("a", 5, { price: 1 }), s("b", 5, { price: 1 })]), data([s("a", 9, { price: 2 }), s("b", 5, { price: 3 })]), NOW);
    expect(m[SUBS].find(x => x.id === "a").price).toBe(2);
    expect(m[SUBS].find(x => x.id === "b").price).toBe(1);
  });

  it("Grabsteine löschen ältere Stände, später geänderte bleiben", () => {
    const t = n => NOW - n * 1000;
    const local = data([s("a", t(100)), s("b", t(10))]);
    const remote = data([], { deleted: { a: t(50), b: t(30) } });
    const m = mergeData(local, remote, NOW);
    expect(ids(m)).toEqual(["b"]);                          // b wurde nach der Löschung noch bearbeitet
    expect(m[META].deleted).toEqual({ a: t(50), b: t(30) });
  });

  it("alte Grabsteine werden aufgeräumt", () => {
    const old = NOW - 200 * 86400000;
    const m = mergeData(data([], { deleted: { x: old, y: NOW - 1000 } }), data([]), NOW);
    expect(m[META].deleted).toEqual({ y: NOW - 1000 });
  });

  it("Einstellungen: neuere Seite nach changedAt; fehlende Seite ergänzt", () => {
    const m = mergeData(data([], {}, { [SETTINGS]: { base: "EUR", changedAt: 5 } }), data([], {}, { [SETTINGS]: { base: "CHF", changedAt: 7 } }), NOW);
    expect(m[SETTINGS].base).toBe("CHF");
    expect(mergeData(data([]), data([], {}, { [SETTINGS]: { base: "USD" } }), NOW)[SETTINGS].base).toBe("USD");
  });

  it("Errungenschaften werden vereinigt", () => {
    const a = { unlocked: { x: 100, y: 300 }, cancelled: 2, importedBank: false, doneInstallmentIds: ["r1"] };
    const b = { unlocked: { y: 200, z: 400 }, cancelled: 5, importedBank: true, doneInstallmentIds: ["r2"] };
    const m = mergeData(data([], {}, { [ACH]: a }), data([], {}, { [ACH]: b }), NOW)[ACH];
    expect(m.unlocked).toEqual({ x: 100, y: 200, z: 400 });
    expect(m).toMatchObject({ cancelled: 5, importedBank: true });
    expect(m.doneInstallmentIds.sort()).toEqual(["r1", "r2"]);
  });

  it("verträgt leere Stände und übernimmt die jüngste Änderungszeit", () => {
    const m = mergeData({}, data([s("a", 1)], { updatedAt: 42 }), NOW);
    expect(ids(m)).toEqual(["a"]);
    expect(m[META].updatedAt).toBe(42);
  });
});
