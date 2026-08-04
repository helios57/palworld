import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadPals,
  loadSpecialCombos,
  loadInternalIdMap,
  loadAllData,
  clearCache,
} from "../../src/data-loader.js";

// Sample test data
const MOCK_PALS = {
  Cattiva: {
    paldeck: 1,
    elements: ["Neutral"],
    combi_rank: 1490,
    in_generic_pool: true,
    work: { Handiwork: 1, Gathering: 1, Mining: 1, Transporting: 1 },
  },
  Lamball: {
    paldeck: 2,
    elements: ["Neutral"],
    combi_rank: 1470,
    in_generic_pool: true,
    work: { Handiwork: 1, Transporting: 1, Farming: 1 },
  },
};

const MOCK_COMBOS = [{ parent_a: "Blazehowl", parent_b: "Jormuntide", child: "Jormuntide Ignis" }];

const MOCK_ID_MAP = { Kitsunebi: "Foxparks", PinkCat: "Cattiva" };

describe("data-loader", () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  it("loadPals fetches and returns pal data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_PALS),
    } as Response);

    const result = await loadPals();
    expect(result).toEqual(MOCK_PALS);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("loadPals caches on second call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_PALS),
    } as Response);

    await loadPals();
    await loadPals();
    // Should only fetch once
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("loadPals throws on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadPals()).rejects.toThrow("Failed to load pals.json");
  });

  it("loadSpecialCombos fetches and returns combo data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_COMBOS),
    } as Response);

    const result = await loadSpecialCombos();
    expect(result).toEqual(MOCK_COMBOS);
  });

  it("loadInternalIdMap fetches and returns ID mapping", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ID_MAP),
    } as Response);

    const result = await loadInternalIdMap();
    expect(result).toEqual(MOCK_ID_MAP);
  });

  it("loadAllData returns all three datasets", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_PALS),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_COMBOS),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_ID_MAP),
      } as Response);

    const result = await loadAllData();
    expect(result.pals).toEqual(MOCK_PALS);
    expect(result.combos).toEqual(MOCK_COMBOS);
    expect(result.idMap).toEqual(MOCK_ID_MAP);
  });

  it("clearCache resets all caches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PALS),
    } as Response);

    await loadPals();
    clearCache();
    await loadPals();
    // Should fetch twice because cache was cleared
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok response for combos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(loadSpecialCombos()).rejects.toThrow("Failed to load special_combos.json");
  });

  it("throws on non-ok response for id map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(loadInternalIdMap()).rejects.toThrow("Failed to load internal_id_map.json");
  });

  it("loadSpecialCombos uses cache on second call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_COMBOS),
    } as Response);

    await loadSpecialCombos();
    await loadSpecialCombos();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("loadInternalIdMap uses cache on second call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ID_MAP),
    } as Response);

    await loadInternalIdMap();
    await loadInternalIdMap();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("loadAllData uses cache when some data is already loaded", async () => {
    // Load pals first
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_PALS),
    } as Response);
    await loadPals();

    // Now loadAllData — only 2 more fetches needed (combos + idMap)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_COMBOS),
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ID_MAP),
    } as Response);

    const result = await loadAllData();
    expect(result.pals).toEqual(MOCK_PALS);
    expect(result.combos).toEqual(MOCK_COMBOS);
    expect(result.idMap).toEqual(MOCK_ID_MAP);
  });

  it("loadPals throws on network error (fetch rejects)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network failure"),
    );

    await expect(loadPals()).rejects.toThrow("Network failure");
  });

  it("loadAllData throws when any sub-load fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_PALS),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_ID_MAP),
      } as Response);

    await expect(loadAllData()).rejects.toThrow(
      "Failed to load special_combos.json",
    );
  });
});
