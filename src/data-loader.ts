/**
 * Data loader — fetches and caches the static breeding data files.
 */

import type { PalData, SpecialCombo } from "./engine.js";

const DATA_BASE = "./data";

let palsData: Record<string, PalData> | null = null;
let specialCombos: SpecialCombo[] | null = null;
let internalIdMap: Record<string, string> | null = null;

export async function loadPals(): Promise<Record<string, PalData>> {
  if (palsData) return palsData;

  const resp = await fetch(`${DATA_BASE}/pals.json`);
  if (!resp.ok) throw new Error(`Failed to load pals.json: ${resp.status}`);
  palsData = await resp.json();
  return palsData!;
}

export async function loadSpecialCombos(): Promise<SpecialCombo[]> {
  if (specialCombos) return specialCombos;

  const resp = await fetch(`${DATA_BASE}/special_combos.json`);
  if (!resp.ok)
    throw new Error(`Failed to load special_combos.json: ${resp.status}`);
  specialCombos = await resp.json();
  return specialCombos!;
}

export async function loadInternalIdMap(): Promise<Record<string, string>> {
  if (internalIdMap) return internalIdMap;

  const resp = await fetch(`${DATA_BASE}/internal_id_map.json`);
  if (!resp.ok)
    throw new Error(`Failed to load internal_id_map.json: ${resp.status}`);
  internalIdMap = await resp.json();
  return internalIdMap!;
}

/** Load all data and return it. */
export async function loadAllData(): Promise<{
  pals: Record<string, PalData>;
  combos: SpecialCombo[];
  idMap: Record<string, string>;
}> {
  const [pals, combos, idMap] = await Promise.all([
    loadPals(),
    loadSpecialCombos(),
    loadInternalIdMap(),
  ]);
  return { pals, combos, idMap };
}

/** Clear caches (for testing). */
export function clearCache(): void {
  palsData = null;
  specialCombos = null;
  internalIdMap = null;
}
