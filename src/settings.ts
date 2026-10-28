import { openingKinds, type OpeningKind } from "./model.ts";
import { plantKinds, type PlantKind } from "./plants.ts";
import { placeKinds, type PlaceKind } from "./places.ts";

const backgroundModes = ["auto", "dark", "light"] as const;
const modelViews = ["assembled", "exploded", "section"] as const;
export type BackgroundMode = (typeof backgroundModes)[number];
export type ModelView = (typeof modelViews)[number];

export interface ViewerSettings {
  finish: string;
  background: BackgroundMode;
  plant: PlantKind;
  place: PlaceKind;
  opening: OpeningKind;
  view: ModelView;
  rotate: boolean;
}

const storageKey = "orbital-planter.settings.v1";
const defaultSettings: Readonly<ViewerSettings> = {
  finish: "#d8d3c6",
  background: "auto",
  plant: "empty",
  place: "studio",
  opening: "top",
  view: "assembled",
  rotate: false,
};

function validOption<Value extends string>(
  value: unknown,
  options: readonly Value[],
  fallback: Value,
): Value {
  return options.find((option) => option === value) ?? fallback;
}

export function loadViewerSettings(
  finishes: readonly string[],
  storage?: Pick<Storage, "getItem">,
): ViewerSettings {
  const defaults = {
    ...defaultSettings,
    finish: finishes[0] ?? defaultSettings.finish,
  };
  try {
    const saved: unknown = JSON.parse(
      (storage ?? window.localStorage).getItem(storageKey) ?? "null",
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return defaults;
    const values = saved as Record<string, unknown>;
    return {
      finish: validOption(values.finish, finishes, defaults.finish),
      background: validOption(
        values.background,
        backgroundModes,
        defaults.background,
      ),
      plant: validOption(values.plant, plantKinds, defaults.plant),
      place: validOption(values.place, placeKinds, defaults.place),
      opening: validOption(values.opening, openingKinds, defaults.opening),
      view: validOption(values.view, modelViews, defaults.view),
      rotate:
        typeof values.rotate === "boolean" ? values.rotate : defaults.rotate,
    };
  } catch {
    return defaults;
  }
}

export function saveViewerSettings(
  settings: ViewerSettings,
  storage?: Pick<Storage, "setItem">,
) {
  try {
    (storage ?? window.localStorage).setItem(
      storageKey,
      JSON.stringify(settings),
    );
  } catch {
    return;
  }
}
