import { describe, it, expect } from "vitest";
import { buildPushPlan } from "../src/lib/pushplan.js";
import { computeView, normalizeSub } from "../src/lib/model.js";

const T = new Date(2026, 9, 30, 12, 0);                       // 30.10.2026, 12 Uhr
const day = new Date(2026, 9, 30);
const view = subs => computeView(subs.map(normalizeSub), (v) => v, day);
const S = { remindDays: 3, noticeRemind: 7, pushHour: 9 };
const fmt = ms => { const d = new Date(ms); return `${d.getDate()}.${d.getMonth() + 1}. ${d.getHours()}:00`; };

describe("Push-Erinnerungsplan", () => {
  it("plant Zahlungen X Tage vorher zur gewählten Uhrzeit, auch Folgetermine", () => {
    const plan = buildPushPlan(view([{ id: "n", name: "Netflix", price: 13.99, cycle: "monthly", nextDate: "2026-11-10" }]), S, T);
    expect(plan.map(p => fmt(p.at))).toEqual(["7.11. 9:00", "7.12. 9:00"]);
    expect(plan[0]).toMatchObject({ title: "Netflix: Zahlung in 3 Tagen", tag: "pay-n-2026-11-10" });
    expect(plan[0].body).toMatch(/13,99.*10\.11\.2026/);
  });

  it("überspringt Zeitpunkte in der Vergangenheit", () => {
    const plan = buildPushPlan(view([{ id: "a", name: "A", price: 1, cycle: "monthly", nextDate: "2026-11-01" }]), S, T);
    expect(plan.map(p => fmt(p.at))[0]).toBe("28.11. 9:00");                // 29.10. ist vorbei, nächster Termin 1.12.
  });

  it("Kündigungsfristen und eigene Uhrzeit", () => {
    const plan = buildPushPlan(view([{ id: "z", name: "Zeitung", price: 14.99, cycle: "monthly", nextDate: "2026-11-30", noticeDays: 14 }]), { ...S, pushHour: 18 }, T);
    const c = plan.find(p => p.tag.startsWith("cancel"));
    expect(fmt(c.at)).toBe("9.11. 18:00");                                   // Frist 16.11., 7 Tage vorher
    expect(c.title).toBe("Zeitung: Kündigungsfrist endet in 7 Tagen");
  });

  it("Ratenzahlung endet mit der letzten Rate; pausierte Abos fehlen", () => {
    const plan = buildPushPlan(view([
      { id: "r", name: "Sofa", kind: "installment", price: 100, cycle: "monthly", nextDate: "2026-11-05", totalPayments: 3, paidCount: 2 },
      { id: "p", name: "Pause", price: 5, cycle: "monthly", nextDate: "2026-11-05", status: "paused" }
    ]), S, T, 120);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ title: "Sofa: Rate in 3 Tagen" });
    expect(plan[0].body).toMatch(/Rate 3 von 3/);
  });

  it("„am selben Tag“ und begrenzter Zeitraum", () => {
    const plan = buildPushPlan(view([{ id: "w", name: "Woche", price: 2, cycle: "weekly", nextDate: "2026-11-02" }]), { ...S, remindDays: 0 }, T, 14);
    expect(plan.map(p => fmt(p.at))).toEqual(["2.11. 9:00", "9.11. 9:00"]);
    expect(plan[0].title).toBe("Woche: Zahlung heute");
  });
});
