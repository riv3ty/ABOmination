import { describe, it, expect } from "vitest";
import { slugify, groupsForSubs, pickDeals, searchDeals, searchLinks } from "../src/lib/deals.js";

const NOW = Date.UTC(2026, 9, 30);
const sub = (name, extra = {}) => ({ name, state: "active", inst: false, monthly: 10, category: "", provider: "", ...extra });

describe("Angebote & Preissuche", () => {
  it("bildet Namen auf MyDealz-Gruppen ab", () => {
    expect(slugify("Disney+")).toBe("disney-plus");
    expect(slugify("Amazon Prime")).toBe("amazon-prime");
    expect(slugify("Sky Ticket")).toBe("sky-ticket");
    expect(slugify("Fitnessstudio Müller & Co.")).toBe("fitnessstudio-mueller-und-co");
    expect(slugify("  ")).toBe("");
  });

  it("wählt Gruppen aus aktiven Abos (teuerste zuerst) und Kategorien", () => {
    const g = groupsForSubs([
      sub("Netflix", { monthly: 13.99, category: "Streaming" }),
      sub("Handyvertrag", { monthly: 25, provider: "Telekom", category: "Mobilfunk/Internet" }),
      sub("Gekündigt", { state: "cancelled" }),
      sub("Sofa", { inst: true })
    ]);
    expect(g.map(x => x.slug)).toEqual(["telekom", "handyvertrag", "netflix", "handyvertraege", "dsl", "streaming-dienste"]);
    expect(g.find(x => x.slug === "telekom")).toMatchObject({ label: "Telekom", kind: "name" });
    expect(g.find(x => x.slug === "dsl").kind).toBe("cat");
    expect(groupsForSubs(Array.from({ length: 20 }, (_, i) => sub("Abo " + i)))).toHaveLength(12);
  });

  it("stellt Deals zusammen: Anbieter vor Kategorien, neueste zuerst, ohne Doppelte und alte", () => {
    const resp = { groups: {
      netflix: [{ url: "u1", title: "Netflix 3 Monate", date: NOW - 86400000 }, { url: "u0", title: "Alt", date: NOW - 40 * 86400000 }],
      "streaming-dienste": [{ url: "u1", title: "Netflix 3 Monate", date: NOW - 86400000 }, { url: "u2", title: "Disney+ Jahr", date: NOW - 3600000 }]
    } };
    const d = pickDeals(resp, [{ slug: "netflix", label: "Netflix", kind: "name" }, { slug: "streaming-dienste", label: "Streaming", kind: "cat" }, { slug: "fehlt", label: "X", kind: "name" }], NOW);
    expect(d.map(x => [x.url, x.for])).toEqual([["u1", "Netflix"], ["u2", "Streaming"]]);   // Anbieter zuerst, obwohl älter
    expect(searchDeals(d, "disney jahr").map(x => x.url)).toEqual(["u2"]);
    expect(searchDeals(d, " ")).toEqual([]);
  });

  it("baut Vergleichslinks mit kodiertem Suchbegriff", () => {
    const l = searchLinks("AirPods Pro 2 & Case");
    expect(l.map(x => x.label)).toEqual(["Idealo", "Geizhals", "MyDealz"]);
    expect(l[0].url).toBe("https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=AirPods%20Pro%202%20%26%20Case");
  });
});
