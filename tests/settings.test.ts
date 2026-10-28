import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  loadViewerSettings,
  saveViewerSettings,
  type ViewerSettings,
} from "../src/settings.ts";

const finishes = ["#d8d3c6", "#080808"];
const defaults = loadViewerSettings(finishes, { getItem: () => null });

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("all selected settings survive a save and reload", () => {
  const storage = memoryStorage();
  storage.setItem("unrelated", "preserved");
  const settings: ViewerSettings = {
    finish: "#080808",
    background: "light",
    plant: "oxalis",
    place: "night",
    opening: "diagonal",
    view: "exploded",
    rotate: true,
  };
  saveViewerSettings(settings, storage);
  assert.deepEqual(loadViewerSettings(finishes, storage), settings);
  assert.equal(storage.getItem("unrelated"), "preserved");
  const changed = {
    ...settings,
    plant: "empty",
    opening: "top",
    rotate: false,
  } as const;
  saveViewerSettings(changed, storage);
  assert.deepEqual(loadViewerSettings(finishes, storage), changed);
});

test("invalid or removed options fall back without discarding valid selections", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        finish: "#ffffff",
        background: "sepia",
        plant: "monstera",
        place: "removed",
        opening: "side",
        view: "section",
        rotate: "false",
      }),
  };
  assert.deepEqual(loadViewerSettings(finishes, storage), {
    ...defaults,
    plant: "monstera",
    view: "section",
  });
});

test("malformed saved data falls back to defaults", () => {
  for (const value of ["broken JSON", "null", "[]", "42", '"hello"', "true"]) {
    assert.deepEqual(
      loadViewerSettings(finishes, { getItem: () => value }),
      defaults,
    );
  }
});

test("blocked storage and quota errors do not break the viewer", () => {
  const blockedStorage = {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  };
  assert.deepEqual(loadViewerSettings(finishes, blockedStorage), defaults);
  assert.doesNotThrow(() => saveViewerSettings(defaults, blockedStorage));
});
