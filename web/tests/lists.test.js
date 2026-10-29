import { describe, it, expect } from "vitest";
import { emptyLists, addItem, renameItem, removeItem, mergeLists, normalizeLists, seedFromSubs, namesOf, usageCount, renameInSubs, cleanName } from "../src/lib/lists.js";

const NOW = Date.UTC(2026, 9, 30);

describe("Eigene Listen", () => {
  it("legt Einträge an, ohne Dubletten (Groß-/Kleinschreibung egal)", () => {
    let { lists, item } = addItem(emptyLists(), "account", "  Girokonto   Sparkasse ", NOW);
    expect(item).toMatchObject({ type: "account", name: "Girokonto Sparkasse", updatedAt: NOW });
    const again = addItem(lists, "account", "girokonto sparkasse", NOW + 1);
    expect(again.lists).toBe(lists);
    expect(again.item.id).toBe(item.id);
    lists = addItem(lists, "payment", "PayPal", NOW).lists;
    expect(namesOf(lists, "account")).toEqual(["Girokonto Sparkasse"]);
    expect(namesOf(lists, "payment")).toEqual(["PayPal"]);
    expect(addItem(lists, "unbekannt", "X").item).toBeNull();
    expect(addItem(lists, "account", "   ").item).toBeNull();
  });

  it("gleiche Namen auf zwei Geräten ergeben dieselbe ID", () => {
    const a = addItem(emptyLists(), "provider", "Telekom", 1).item, b = addItem(emptyLists(), "provider", "TELEKOM", 2).item;
    expect(a.id).toBe(b.id);
  });

  it("benennt um und verhindert doppelte Namen", () => {
    let { lists, item } = addItem(emptyLists(), "account", "Giro", NOW);
    lists = addItem(lists, "account", "Kreditkarte", NOW).lists;
    lists = renameItem(lists, item.id, "Girokonto", NOW + 5);
    expect(lists.items.find(i => i.id === item.id)).toMatchObject({ name: "Girokonto", updatedAt: NOW + 5 });
    expect(() => renameItem(lists, item.id, "kreditkarte")).toThrow(/schon/);
  });

  it("löscht mit Grabstein; erneutes Anlegen holt den Eintrag zurück", () => {
    let { lists, item } = addItem(emptyLists(), "payment", "Visa", NOW);
    lists = removeItem(lists, item.id, NOW + 1);
    expect(lists.items).toHaveLength(0);
    expect(lists.deleted[item.id]).toBe(NOW + 1);
    lists = addItem(lists, "payment", "Visa", NOW + 2).lists;
    expect(lists.items).toHaveLength(1);
    expect(lists.deleted[item.id]).toBeUndefined();
  });

  it("führt zwei Stände pro Eintrag zusammen", () => {
    const base = addItem(emptyLists(), "account", "Giro", NOW - 10);
    const id = base.item.id;
    const local = renameItem(base.lists, id, "Girokonto", NOW);                 // hier umbenannt
    const remote = addItem(base.lists, "payment", "PayPal", NOW - 5).lists;     // dort ergänzt
    const m = mergeLists(local, remote, NOW);
    expect(namesOf(m, "account")).toEqual(["Girokonto"]);
    expect(namesOf(m, "payment")).toEqual(["PayPal"]);
    const del = removeItem(base.lists, id, NOW - 1);                             // Löschung älter als Umbenennung
    expect(namesOf(mergeLists(local, del, NOW), "account")).toEqual(["Girokonto"]);
    const del2 = removeItem(local, id, NOW + 1);                                 // Löschung jünger
    expect(namesOf(mergeLists(local, del2, NOW + 2), "account")).toEqual([]);
  });

  it("räumt alte Grabsteine auf und verwirft ungültige Daten", () => {
    const old = { items: [], deleted: { "account-abc": NOW - 200 * 86400000 } };
    expect(mergeLists(old, emptyLists(), NOW).deleted).toEqual({});
    const n = normalizeLists({ items: [{ id: "account-1", type: "account", name: "<b>x</b>" }, { id: "bad id", type: "account", name: "y" }, { id: "x-1", type: "nope", name: "z" }, null], deleted: { "account-2": 5, "bad id": 1 } });
    expect(n.items).toHaveLength(1);
    expect(n.deleted).toEqual({ "account-2": 5 });
    expect(normalizeLists("kaputt")).toEqual(emptyLists());
  });

  it("befüllt die Listen aus vorhandenen Abos und zählt die Nutzung", () => {
    const subs = [{ account: "Girokonto", payment: "Lastschrift" }, { account: "girokonto", payment: "" }, { account: "Kreditkarte", provider: "Telekom" }];
    const lists = seedFromSubs(subs, NOW);
    expect(namesOf(lists, "account")).toEqual(["Girokonto", "Kreditkarte"]);
    expect(namesOf(lists, "payment")).toEqual(["Lastschrift"]);
    expect(namesOf(lists, "provider")).toEqual(["Telekom"]);
    expect(usageCount(subs, "account", "GIROKONTO")).toBe(2);
  });

  it("überträgt Umbenennungen in die Abos", () => {
    const subs = [{ id: "a", account: "Giro", updatedAt: 1 }, { id: "b", account: "Andere", updatedAt: 1 }];
    const out = renameInSubs(subs, "account", "giro", "Girokonto", NOW);
    expect(out[0]).toMatchObject({ account: "Girokonto", updatedAt: NOW });
    expect(out[1]).toBe(subs[1]);
    expect(cleanName("x".repeat(80))).toHaveLength(60);
  });
});
