import { describe, it, expect } from "vitest";
import { TILES, defaultLayout, normalizeLayout, move, moveBefore, toggleHidden, cycleSize, sizeOf, isDefault } from "../src/lib/layout.js";

const ids = TILES.map(t => t.id);

describe("Dashboard-Layout", () => {
  it("Standard enthält alle Kacheln in der Ausgangsreihenfolge", () => {
    expect(defaultLayout().order).toEqual(ids);
    expect(isDefault(defaultLayout())).toBe(true);
    expect(normalizeLayout(null)).toEqual(defaultLayout());
  });

  it("ergänzt fehlende Kacheln an ihrer Standardposition und verwirft Unbekanntes", () => {
    const l = normalizeLayout({ order: ["achTile", "tHero", "foo", "tHero"], hidden: ["tCats", "bar"], size: { tHero: 12, tYear: 5, nope: 6, tCats: 5 } });
    expect(l.order).toHaveLength(ids.length);
    expect(l.order[0]).toBe("achTile");
    expect(l.order.indexOf("tYear")).toBe(l.order.indexOf("tHero") + 1);         // hinter seinem Vorgänger
    expect(l.hidden).toEqual(["tCats"]);
    expect(l.size).toEqual({ tHero: 12 });                                       // 5 ist keine Stufe, Standardbreiten fallen weg
  });

  it("verschiebt Kacheln schrittweise und per Ziehen", () => {
    let l = move(defaultLayout(), "tYear", -1);
    expect(l.order.slice(0, 2)).toEqual(["tYear", "tHero"]);
    expect(move(l, "tYear", -1)).toBe(l);                                        // schon ganz oben
    l = moveBefore(defaultLayout(), "instCard", "tHero");
    expect(l.order[0]).toBe("instCard");
    l = moveBefore(l, "instCard", null);
    expect(l.order.at(-1)).toBe("instCard");
  });

  it("blendet aus und ein", () => {
    const l = toggleHidden(defaultLayout(), "achTile");
    expect(l.hidden).toEqual(["achTile"]);
    expect(toggleHidden(l, "achTile").hidden).toEqual([]);
  });

  it("schaltet die Breite in Stufen um", () => {
    let l = defaultLayout();
    expect(sizeOf(l, "tCats")).toBe(5);
    l = cycleSize(l, "tCats"); expect(sizeOf(l, "tCats")).toBe(6);
    l = cycleSize(l, "tCats"); expect(sizeOf(l, "tCats")).toBe(8);
    l = cycleSize(l, "tCats"); expect(sizeOf(l, "tCats")).toBe(12);
    l = cycleSize(l, "tCats"); expect(sizeOf(l, "tCats")).toBe(4);
    l = cycleSize(defaultLayout(), "tYear");                                     // 4 → 6
    expect(l.size).toEqual({ tYear: 6 });
    l = cycleSize(cycleSize(cycleSize(l, "tYear"), "tYear"), "tYear");           // 8 → 12 → 4 = Standard
    expect(l.size).toEqual({});
  });
});
