/**
 * Palworld Breeding Calculator — UI
 *
 * Three input methods for owned pals:
 * 1. Drag-and-drop save file (PlZ decompression in-browser)
 * 2. CSV file upload or paste
 * 3. Typeahead search + click to add
 *
 * Select target pals → get optimized consolidated breeding plan.
 */

import { initEngine, verifyEngine, getAllPalNames, getWork } from "./engine.js";
import { loadAllData } from "./data-loader.js";
import { parsePlZSave } from "./save-parser.js";
import { reachable, consolidatePlan, type ConsolidatedPlan } from "./solver.js";

// ---- State ----
let ownedPals: Set<string> = new Set();
let targetPals: Set<string> = new Set();
let allPalNames: string[] = [];
let idMap: Record<string, string> = {};
// ---- DOM helpers ----
function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

function $$(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector);
}

function el(tag: string, classes: string[] = [], attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  for (const c of classes) e.classList.add(c);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// ---- localStorage ----
function saveState(): void {
  localStorage.setItem("palworld_owned", JSON.stringify(Array.from(ownedPals)));
  localStorage.setItem("palworld_targets", JSON.stringify(Array.from(targetPals)));
}

function loadState(): void {
  try {
    const owned = JSON.parse(localStorage.getItem("palworld_owned") || "[]");
    const targets = JSON.parse(localStorage.getItem("palworld_targets") || "[]");
    if (Array.isArray(owned)) ownedPals = new Set(owned);
    if (Array.isArray(targets)) targetPals = new Set(targets);
  } catch {
    ownedPals = new Set();
    targetPals = new Set();
  }
}

// ---- Render ----
function renderOwnedTags(): void {
  const container = $("#owned-tags");
  if (!container) return;
  container.innerHTML = "";

  if (ownedPals.size === 0) {
    container.innerHTML =
      '<span class="muted">No pals added yet. Drop a save file, paste CSV, or search below.</span>';
    return;
  }

  for (const name of Array.from(ownedPals).sort()) {
    const tag = el("span", ["tag", "tag-owned"]);
    tag.textContent = name;
    const removeBtn = el("button", ["tag-remove"]);
    removeBtn.textContent = "×";
    removeBtn.title = `Remove ${name}`;
    removeBtn.addEventListener("click", () => {
      ownedPals.delete(name);
      saveState();
      renderOwnedTags();
      updateTargetAvailability();
    });
    tag.appendChild(removeBtn);
    container.appendChild(tag);
  }

  const count = el("span", ["badge"]);
  count.textContent = `${ownedPals.size} owned`;
  container.prepend(count);
}

function renderTargetTags(): void {
  const container = $("#target-tags");
  if (!container) return;
  container.innerHTML = "";

  if (targetPals.size === 0) {
    container.innerHTML =
      '<span class="muted">No targets selected. Search and click pals to add them as breeding targets.</span>';
    return;
  }

  for (const name of Array.from(targetPals).sort()) {
    const tag = el("span", ["tag", "tag-target"]);
    tag.textContent = name;
    const removeBtn = el("button", ["tag-remove"]);
    removeBtn.textContent = "×";
    removeBtn.title = `Remove ${name}`;
    removeBtn.addEventListener("click", () => {
      targetPals.delete(name);
      saveState();
      renderTargetTags();
    });
    tag.appendChild(removeBtn);
    container.appendChild(tag);
  }
}

function updateTargetAvailability(): void {
  // Grey out target options that are already owned
  const items = $$(".pal-select-item");
  for (const item of items) {
    const name = item.getAttribute("data-name") || "";
    if (ownedPals.has(name)) {
      item.classList.add("already-owned");
    } else {
      item.classList.remove("already-owned");
    }
  }
}

function renderPalList(filter: string = ""): void {
  const container = $("#pal-select-list");
  if (!container) return;
  container.innerHTML = "";

  const lower = filter.toLowerCase();
  const filtered = allPalNames
    .filter((n) => n.toLowerCase().includes(lower))
    .sort()
    .slice(0, 100); // Limit for performance

  for (const name of filtered) {
    const item = el("div", ["pal-select-item"], { "data-name": name });
    if (ownedPals.has(name)) item.classList.add("already-owned");

    const nameSpan = el("span", ["pal-name"]);
    nameSpan.textContent = name;

    const work = getWork(name);
    const workStr = Object.entries(work)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([j, v]) => `${j.replace(/_/g, " ")} ${v}`)
      .join(" · ");
    const workSpan = el("span", ["pal-work"]);
    workSpan.textContent = workStr || "—";

    item.appendChild(nameSpan);
    if (workStr) item.appendChild(workSpan);

    // Click to add as owned
    item.addEventListener("click", (e) => {
      e.preventDefault();
      if (ownedPals.has(name)) {
        ownedPals.delete(name);
      } else {
        ownedPals.add(name);
      }
      saveState();
      renderOwnedTags();
      updateTargetAvailability();
      item.classList.toggle("owned", ownedPals.has(name));
    });

    // Right-click or Ctrl+click to add as target
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (targetPals.has(name)) {
        targetPals.delete(name);
      } else {
        targetPals.add(name);
      }
      saveState();
      renderTargetTags();
      item.classList.toggle("targeted", targetPals.has(name));
    });

    item.classList.toggle("owned", ownedPals.has(name));
    item.classList.toggle("targeted", targetPals.has(name));

    container.appendChild(item);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<span class="muted">No pals found matching your search.</span>';
  }

  if (filtered.length >= 100) {
    const note = el("div", ["note"]);
    note.textContent = "Showing first 100 matches — narrow your search for more.";
    container.appendChild(note);
  }
}

function renderResults(plan: ConsolidatedPlan): void {
  const container = $("#results");
  if (!container) return;
  container.innerHTML = "";

  if (plan.steps.length === 0) {
    container.innerHTML =
      '<div class="box info">All selected targets are already owned! No breeding needed.</div>';
    return;
  }

  const header = el("div", ["results-header"]);
  header.innerHTML = `
    <h2>Breeding Plan</h2>
    <p>${plan.targets.length} targets · ${plan.steps.length} unique breeds · ${plan.reachableCount} reachable pals (of ${plan.totalPals})</p>
  `;
  container.appendChild(header);

  // Check for missing targets
  const ownedSet = new Set(plan.owned);
  const missing = plan.targets.filter((t: string) => !ownedSet.has(t) && !plan.steps.find((s: { child: string }) => s.child === t));
  if (missing.length > 0) {
    const warning = el("div", ["box", "warning"]);
    warning.textContent = `⚠ Some targets could not be reached within the depth limit: ${missing.join(", ")}`;
    container.appendChild(warning);
  }

  const ol = el("ol", ["build-steps"]);
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const li = el("li", ["build-step"]);

    const [a, b] = step.parents;
    const ownedA = ownedSet.has(a);
    const ownedB = ownedSet.has(b);
    const isTarget = plan.targets.includes(step.child);

    const stepNum = el("span", ["step-num"]);
    stepNum.textContent = `${i + 1}.`;

    const stepText = el("span", ["step-formula"]);
    stepText.innerHTML = `
      <span class="parent ${ownedA ? "parent-owned" : ""}">${a}</span>
      <span class="sep">+</span>
      <span class="parent ${ownedB ? "parent-owned" : ""}">${b}</span>
      <span class="sep">=</span>
      <span class="child ${isTarget ? "child-target" : ""}">${step.child}</span>
    `;

    // Tags
    const tags: string[] = [];
    if (step.type === "special") tags.push('<span class="tag tag-special">★ special</span>');
    else if (step.type === "same-species") tags.push('<span class="tag tag-info">same-species</span>');
    if (step.tieDependent) tags.push('<span class="tag tag-warning">⚠ tie</span>');
    if (isTarget) tags.push('<span class="tag tag-goal">🎯 target</span>');

    li.appendChild(stepNum);
    li.appendChild(stepText);

    if (tags.length > 0) {
      const tagsSpan = el("span", ["step-tags"]);
      tagsSpan.innerHTML = tags.join(" ");
      li.appendChild(tagsSpan);
    }

    ol.appendChild(li);
  }

  container.appendChild(ol);

  // Print button
  const actions = el("div", ["results-actions"]);
  const printBtn = el("button", ["btn", "btn-primary"]);
  printBtn.textContent = "🖨 Print Plan";
  printBtn.addEventListener("click", () => window.print());
  actions.appendChild(printBtn);
  container.appendChild(actions);
}

function renderError(message: string): void {
  const container = $("#results");
  if (!container) return;
  container.innerHTML = `<div class="box error">${message}</div>`;
}

// ---- Compute plan ----
function computePlan(): void {
  if (targetPals.size === 0) {
    renderError("Select at least one target pal to generate a breeding plan.");
    return;
  }

  if (ownedPals.size === 0) {
    renderError("Add at least one owned pal first (save file, CSV, or manual selection).");
    return;
  }

  const { depth, recipe } = reachable(Array.from(ownedPals), 8);

  const reachableTargets = Array.from(targetPals).filter((t) => t in depth);
  const unreachable = Array.from(targetPals).filter((t) => !(t in depth));

  if (reachableTargets.length === 0) {
    renderError(
      `None of your target pals are reachable from your owned pals within 8 breeding generations. ` +
      `Try catching more pals with different CombiRanks.`,
    );
    return;
  }

  const plan = consolidatePlan(
    reachableTargets,
    recipe,
    depth,
    Array.from(ownedPals),
    allPalNames.length,
  );

  if (unreachable.length > 0) {
    const warning = el("div", ["box", "warning"]);
    warning.textContent = `⚠ Could not reach: ${unreachable.join(", ")}. Try adding more owned pals with different ranks.`;
    const results = $("#results");
    if (results) {
      results.innerHTML = "";
      results.appendChild(warning);
    }
  }

  renderResults(plan);
}

// ---- Save file handling ----
function setupDropZone(): void {
  const dropZone = $("#drop-zone");
  const fileInput = $("#file-input") as HTMLInputElement | null;

  if (!dropZone || !fileInput) return;

  // Click to browse
  dropZone.addEventListener("click", () => fileInput.click());

  // File input change
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleSaveFile(file);
  });

  // Drag events
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSaveFile(file);
  });
}

async function handleSaveFile(file: File): Promise<void> {
  const status = $("#drop-status");
  if (status) status.textContent = "Processing save file...";

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await parsePlZSave(bytes, idMap);

    if (result.error) {
      if (status) status.textContent = result.error;
      renderError(result.error);
      return;
    }

    if (result.palNames.length === 0) {
      if (status) status.textContent = "No pals found in this save file.";
      return;
    }

    for (const name of result.palNames) {
      // Only add if it's a valid pal name
      if (allPalNames.includes(name)) {
        ownedPals.add(name);
      }
    }

    saveState();
    renderOwnedTags();
    updateTargetAvailability();

    if (status) {
      status.textContent = `✅ Found ${result.palNames.length} pals (${ownedPals.size} recognized).`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (status) status.textContent = `Error: ${msg}`;
    renderError(`Failed to read save file: ${msg}`);
  }
}

// ---- CSV handling ----
function setupCsvInput(): void {
  const textarea = $("#csv-input") as HTMLTextAreaElement | null;
  const fileBtn = $("#csv-file-btn");
  const csvFileInput = $("#csv-file-input") as HTMLInputElement | null;
  const loadBtn = $("#csv-load-btn");

  if (!textarea) return;

  // File upload button
  fileBtn?.addEventListener("click", () => csvFileInput?.click());
  csvFileInput?.addEventListener("change", () => {
    const file = csvFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (textarea) textarea.value = reader.result as string;
    };
    reader.readAsText(file);
  });

  // Load button
  loadBtn?.addEventListener("click", () => {
    const raw = textarea?.value || "";
    const names = parseCsvText(raw);
    if (names.length === 0) {
      renderError("No valid pal names found in the CSV text.");
      return;
    }

    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const name of names) {
      // Try exact match first, then case-insensitive
      if (allPalNames.includes(name)) {
        matched.push(name);
      } else {
        const found = allPalNames.find(
          (n) => n.toLowerCase() === name.toLowerCase(),
        );
        if (found) matched.push(found);
        else unmatched.push(name);
      }
    }

    for (const m of matched) ownedPals.add(m);
    saveState();
    renderOwnedTags();
    updateTargetAvailability();

    if (unmatched.length > 0) {
      renderError(
        `Added ${matched.length} pals. Unrecognized names: ${unmatched.join(", ")}`,
      );
    } else {
      const status = $("#csv-status");
      if (status) status.textContent = `✅ Added ${matched.length} pals.`;
    }
  });
}

function parseCsvText(raw: string): string[] {
  // Split by newline, comma, or semicolon
  const lines = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Remove header row if it looks like one
  if (lines[0] && /^(name|pal|owned|pals?)$/i.test(lines[0])) {
    lines.shift();
  }

  return lines;
}

// ---- Preset buttons ----
const PRESETS: Record<string, string[]> = {
  "Base Workers": [
    "Jormuntide Ignis", "Jormuntide", "Anubis", "Astegon", "Blazamut",
    "Carnibora", "Venusa", "Wistella", "Wumpo", "Celesdir",
  ],
  "Flyers": [
    "Eidrolon", "Beakon", "Ragnahawk", "Suzaku", "Helzephyr",
    "Faleris", "Quivern", "Astegon",
  ],
  "Fighters": [
    "Blazamut", "Jormuntide Ignis", "Anubis", "Incineram",
    "Warsect", "Mammorest",
  ],
};

function setupPresets(): void {
  const container = $("#preset-buttons");
  if (!container) return;

  for (const [label, pals] of Object.entries(PRESETS)) {
    const btn = el("button", ["btn", "btn-sm", "btn-preset"]);
    btn.textContent = label;
    btn.addEventListener("click", () => {
      for (const p of pals) {
        if (allPalNames.includes(p)) targetPals.add(p);
      }
      saveState();
      renderTargetTags();
    });
    container.appendChild(btn);
  }
}

// ---- Search ----
function setupSearch(): void {
  const input = $("#pal-search") as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener("input", () => {
    renderPalList(input.value);
  });

  // Initial render
  renderPalList();
}

// ---- Main ----
function setupButtons(): void {
  const computeBtn = $("#compute-btn");
  computeBtn?.addEventListener("click", computePlan);

  const clearOwnedBtn = $("#clear-owned-btn");
  clearOwnedBtn?.addEventListener("click", () => {
    ownedPals.clear();
    saveState();
    renderOwnedTags();
    updateTargetAvailability();
  });

  const clearTargetsBtn = $("#clear-targets-btn");
  clearTargetsBtn?.addEventListener("click", () => {
    targetPals.clear();
    saveState();
    renderTargetTags();
  });
}

async function init(): Promise<void> {
  try {
    // Load state from localStorage
    loadState();

    // Load breeding data
    const { pals, combos, idMap: loadedIdMap } = await loadAllData();
    idMap = loadedIdMap;
    initEngine(pals, combos);
    allPalNames = getAllPalNames();

    // Verify engine
    if (!verifyEngine()) {
      console.warn("Engine verification failed — data may be outdated.");
    }

    // Setup UI
    setupDropZone();
    setupCsvInput();
    setupSearch();
    setupPresets();
    setupButtons();
    renderOwnedTags();
    renderTargetTags();

    // Enable compute button
    const computeBtn = $("#compute-btn") as HTMLButtonElement | null;
    if (computeBtn) computeBtn.disabled = false;

  } catch (err) {
    console.error("Initialization failed:", err);
    const app = $("#app");
    if (app) {
      app.innerHTML = `<div class="box error">Failed to initialize: ${err instanceof Error ? err.message : String(err)}</div>`;
    }
  }
}

// Start
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
