import { createOptionPicker } from "./option-picker.ts";
import { officeStyles, placeKinds, type PlaceKind } from "./places.ts";

function placeSymbol(kind: PlaceKind) {
  if (kind === "studio")
    return '<svg class="picker-symbol" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 5v16c0 4 3 6 7 6h15"/><ellipse cx="18" cy="22" rx="7" ry="2"/></svg>';
  const style = officeStyles[kind];
  return `<svg class="picker-symbol place-symbol" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="5" fill="${style.wall}"/><path d="M1 23h30v3a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5Z" fill="${style.floor}"/><rect x="17" y="4" width="11" height="13" rx="1" fill="${style.sky}"/><path d="M22.5 4v13M17 10.5h11" stroke="${style.frame}" stroke-width=".8"/><path d="M5 20h22v2H5Zm2 2v6m17-6v6" fill="${style.desk}" stroke="${style.frame}" stroke-width="1"/><rect x="8" y="12" width="9" height="6" rx=".8" fill="${style.frame}"/><path d="M12.5 18v2" stroke="${style.frame}"/><circle cx="23" cy="18" r="2" fill="${style.accent}"/></svg>`;
}

export function createPlacePicker(
  container: HTMLElement,
  onChange: (kind: PlaceKind) => void,
  initialValue: PlaceKind = "studio",
) {
  return createOptionPicker(
    container,
    {
      labelId: "place-label",
      initialValue,
      options: placeKinds.map((value) => ({
        value,
        name: value === "studio" ? "Studio" : officeStyles[value].name,
        description:
          value === "studio"
            ? "A clean backdrop for the object"
            : officeStyles[value].description,
        icon: placeSymbol(value),
      })),
    },
    onChange,
  );
}
