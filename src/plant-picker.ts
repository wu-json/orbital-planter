import { plantKinds, type PlantKind } from "./plants.ts";

const plants: Record<
  PlantKind,
  { name: string; silhouette: string; drawing: string }
> = {
  empty: {
    name: "Empty",
    silhouette: "Just the planter",
    drawing:
      '<path d="M6 13c-2 9 1 15 10 15s12-6 10-15"/><ellipse cx="16" cy="13" rx="10" ry="3"/>',
  },
  pothos: {
    name: "Pothos",
    silhouette: "Trailing heart-shaped leaves",
    drawing:
      '<path d="M15 4c-5 5 6 9 2 15s-9 4-7 10M17 12l6-3M15 21l6 3"/><path d="M14 8C4 1 3 13 11 15l3-7ZM22 9c8-5 10 4 3 7l-3-7ZM21 23c8-4 10 5 3 7l-3-7Z"/>',
  },
  snake: {
    name: "Snake plant",
    silhouette: "Tall, architectural blades",
    drawing:
      '<path d="M12 29 7 8c8 4 8 14 8 21M15 29 16 2c6 7 5 20 3 27M20 29l6-19c2 9-1 15-3 19"/>',
  },
  monstera: {
    name: "Monstera",
    silhouette: "Broad, split leaves",
    drawing:
      '<path d="M14 29 20 9M17 8C8 2 2 9 5 18l6-2-4 6c4 6 9 6 14 2l-1-5 5 2c5-8 3-17-3-17-3 0-5 2-5 4Z"/><path d="m10 10 3 2m8 0 2 3"/>',
  },
  succulent: {
    name: "Succulent",
    silhouette: "A low, sculptural rosette",
    drawing:
      '<path d="M16 25C7 23 4 17 4 12c6 0 10 4 12 13ZM16 25c9-2 12-8 12-13-6 0-10 4-12 13Z"/><path d="M16 24C8 16 10 8 16 3c6 5 8 13 0 21ZM16 25c-3-6-6-10-9-11m9 11c3-6 6-10 9-11"/>',
  },
  oxalis: {
    name: "Oxalis triangularis",
    silhouette: "Purple butterfly-like foliage",
    drawing:
      '<path d="m16 17-11-1 3-11 8 12Zm0 0 11-1-3-11-8 12Zm0 0-7 8h14l-7-8Zm0 0v13"/>',
  },
  asparagus: {
    name: "Asparagus fern",
    silhouette: "Fine, feathery fronds",
    drawing:
      '<path d="M15 29c0-12 2-20 8-26M16 23l-8-5m9 1 8-2m-7-2-8-6m9 2 8-2M14 27C9 19 6 16 3 15m13 11c5-5 9-6 13-6"/><path d="m9 18-3-6m4 8-7-1m18-3 7-3M19 8l-3-5"/>',
  },
};

function plantSymbol(drawing: string) {
  return `<svg class="plant-symbol" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing}</svg>`;
}

export function createPlantPicker(
  container: HTMLElement,
  onChange: (kind: PlantKind) => void,
) {
  let selected: PlantKind = "empty";
  container.innerHTML = `
    <button class="plant-trigger" id="plant-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="plant-menu" aria-labelledby="plant-label plant-value">
      <span class="plant-current-symbol">${plantSymbol(plants.empty.drawing)}</span>
      <span id="plant-value">Empty</span>
      <svg class="plant-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="m5 6.5 3 3 3-3"/></svg>
    </button>
    <div class="plant-menu" id="plant-menu" role="listbox" aria-labelledby="plant-label" hidden>
      ${plantKinds
        .map(
          (kind) => `
        <button class="plant-option" type="button" role="option" data-plant="${kind}" aria-selected="${kind === selected}" tabindex="-1">
          ${plantSymbol(plants[kind].drawing)}
          <span class="plant-option-copy"><span class="plant-option-name">${plants[kind].name}</span><span class="plant-option-shape">${plants[kind].silhouette}</span></span>
          <svg class="plant-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>
        </button>
      `,
        )
        .join("")}
    </div>
  `;

  const trigger = container.querySelector<HTMLButtonElement>(".plant-trigger")!;
  const menu = container.querySelector<HTMLElement>(".plant-menu")!;
  const value = container.querySelector<HTMLElement>("#plant-value")!;
  const currentSymbol = container.querySelector<HTMLElement>(
    ".plant-current-symbol",
  )!;
  const options = [
    ...container.querySelectorAll<HTMLButtonElement>(".plant-option"),
  ];

  function positionMenu() {
    const anchor = trigger.getBoundingClientRect();
    const spaceAbove = anchor.top - 16;
    const spaceBelow = innerHeight - anchor.bottom - 16;
    const openAbove = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      100,
      Math.min(390, openAbove ? spaceAbove : spaceBelow),
    );
    const width = Math.min(280, innerWidth - 24);
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - width - 12))}px`;
    menu.style.top = openAbove ? "auto" : `${anchor.bottom + 7}px`;
    menu.style.bottom = openAbove
      ? `${innerHeight - anchor.top + 7}px`
      : "auto";
  }

  function focusOption(index: number) {
    const option = options[(index + options.length) % options.length];
    option.focus({ preventScroll: true });
    option.scrollIntoView({ block: "nearest" });
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionMenu();
    focusOption(plantKinds.indexOf(selected));
  }

  function closeMenu(restoreFocus = true) {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener("click", () =>
    menu.hidden ? openMenu() : closeMenu(),
  );
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  });

  for (const [index, option] of options.entries()) {
    option.addEventListener("click", () => {
      const kind = plantKinds[index];
      const changed = kind !== selected;
      selected = kind;
      value.textContent = plants[kind].name;
      currentSymbol.innerHTML = plantSymbol(plants[kind].drawing);
      options.forEach((button, optionIndex) =>
        button.setAttribute("aria-selected", String(index === optionIndex)),
      );
      closeMenu();
      if (changed) onChange(kind);
    });
    option.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      } else if (event.key === "Tab") {
        closeMenu();
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const target =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : index + (event.key === "ArrowDown" ? 1 : -1);
        focusOption(target);
      } else if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key !== " "
      ) {
        const match = plantKinds.findIndex((kind) =>
          plants[kind].name.toLowerCase().startsWith(event.key.toLowerCase()),
        );
        if (match >= 0) focusOption(match);
      }
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (
      !menu.hidden &&
      event.target instanceof Node &&
      !container.contains(event.target)
    )
      closeMenu(false);
  });
  container.addEventListener("focusout", (event) => {
    if (
      !menu.hidden &&
      event.relatedTarget instanceof Node &&
      !container.contains(event.relatedTarget)
    )
      closeMenu(false);
  });
  window.addEventListener("resize", () => {
    if (!menu.hidden) positionMenu();
  });
  window.addEventListener(
    "scroll",
    (event) => {
      if (
        !menu.hidden &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      )
        closeMenu(false);
    },
    true,
  );
}
