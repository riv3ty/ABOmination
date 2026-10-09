import { describe, it, expect } from "vitest";
import { buildBackup, parseBackup, sanitizeSettings, sanitizeAchievements, BACKUP_VERSION } from "../src/lib/backup.js";

const sub = { id: "a1", name: "Netflix", price: 12.99, cycle: "monthly", nextDate: "2026-10-01" };

describe("Sicherung (JSON)", () => {
  it("enthält Abos, Einstellungen und Errungenschaften – aber keine Sync-Zugangsdaten", () => {
    const b = buildBackup({ subs: [sub], meta: { updatedAt: 5 },
      settings: { base: "CHF", remindDays: 2, noticeRemind: 7, notif: true, autoLock: 30, changedAt: 9 },
      achievements: { unlocked: { "first-sub": 100 }, cancelled: 2 } }, 1000);
    expect(b).toMatchObject({ app: "abo-manager", version: BACKUP_VERSION, exportedAt: 1000, updatedAt: 5,
      settings: { base: "CHF", remindDays: 2, noticeRemind: 7, notif: true, autoLock: 30 },
      achievements: { unlocked: { "first-sub": 100 }, cancelled: 2 } });
    expect(b.settings.changedAt).toBeUndefined();
    expect(JSON.stringify(b)).not.toMatch(/nextcloud|pass|clientId/);
  });

  it("liest Rundreise und ältere Formate", () => {
    const b = parseBackup(JSON.parse(JSON.stringify(buildBackup({ subs: [sub], meta: {}, settings: { base: "USD" }, achievements: { cancelled: 1 } }))));
    expect(b).toMatchObject({ version: 3, settings: { base: "USD" }, achievements: { cancelled: 1 } });
    expect(b.subs[0]).toMatchObject({ id: "a1", name: "Netflix" });
    expect(parseBackup({ app: "abo-manager", version: 2, subs: [sub] })).toMatchObject({ version: 2, settings: null, achievements: null });
    expect(parseBackup([sub]).subs).toHaveLength(1);                         // Version 1: reines Array
    expect(() => parseBackup({ foo: 1 })).toThrow(/Abo-Liste/);
  });

  it("nimmt Gehaltsangaben bereinigt mit", () => {
    const b = buildBackup({ subs: [], meta: {}, income: { gross: 4200, stkl: 3, changedAt: 7, evil: "<b>" } });
    expect(b.income).toMatchObject({ gross: 4200, stkl: 3 });
    expect(b.income.changedAt).toBeUndefined();
    expect(b.income.evil).toBeUndefined();
    expect(parseBackup(JSON.parse(JSON.stringify(b))).income).toMatchObject({ gross: 4200, stkl: 3 });
    expect(buildBackup({ subs: [], meta: {} }).income).toBeNull();
    expect(parseBackup({ subs: [], income: { gross: 0 } }).income).toBeNull();
  });

  it("verwirft ungültige Einstellungen", () => {
    expect(sanitizeSettings({ base: "XXX", remindDays: 99, noticeRemind: -1, notif: "ja", autoLock: 7, evil: "<script>" })).toBeNull();
    expect(sanitizeSettings({ base: "EUR", remindDays: 3.5, autoLock: 0 })).toEqual({ base: "EUR", autoLock: 0 });
    expect(sanitizeSettings([1, 2])).toBeNull();
  });

  it("bereinigt Errungenschaften", () => {
    const a = sanitizeAchievements({ cancelled: 3, importedBank: true, doneInstallmentIds: ["r1", 5, "x".repeat(99)],
      unlocked: { "first-sub": 100, "<bad>": 5, neg: -1 }, "__proto__": { x: 1 }, "bad key": 1, savedYearly: NaN });
    expect(a).toEqual({ cancelled: 3, importedBank: true, doneInstallmentIds: ["r1"], unlocked: { "first-sub": 100 } });
  });
});
