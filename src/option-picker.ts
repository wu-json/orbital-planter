interface PickerOption<Value extends string> {
  value: Value;
  name: string;
  description: string;
  icon: string;
}

interface PickerConfiguration<Value extends string> {
  labelId: string;
  initialValue: Value;
  options: readonly PickerOption<Value>[];
}

export function createOptionPicker<Value extends string>(
  container: HTMLElement,
  configuration: PickerConfiguration<Value>,
  onChange: (value: Value) => void,
) {
  const { options, labelId, initialValue } = configuration;
  let selected = options.find((option) => option.value === initialValue)!;
  const prefix = container.id;
  container.innerHTML = `
    <button class="picker-trigger" id="${prefix}-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${prefix}-menu" aria-labelledby="${labelId} ${prefix}-value">
      <span class="picker-current-symbol">${selected.icon}</span>
      <span class="picker-value" id="${prefix}-value">${selected.name}</span>
      <svg class="picker-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="m5 6.5 3 3 3-3"/></svg>
    </button>
    <div class="picker-menu" id="${prefix}-menu" role="listbox" aria-labelledby="${labelId}" hidden>
      ${options
        .map(
          (option) => `
        <button class="picker-option" type="button" role="option" data-value="${option.value}" aria-selected="${option === selected}" tabindex="-1">
          ${option.icon}
          <span class="picker-option-copy"><span class="picker-option-name">${option.name}</span><span class="picker-option-shape">${option.description}</span></span>
          <svg class="picker-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>
        </button>
      `,
        )
        .join("")}
    </div>
  `;

  const trigger =
    container.querySelector<HTMLButtonElement>(".picker-trigger")!;
  const menu = container.querySelector<HTMLElement>(".picker-menu")!;
  const valueLabel = container.querySelector<HTMLElement>(".picker-value")!;
  const currentSymbol = container.querySelector<HTMLElement>(
    ".picker-current-symbol",
  )!;
  const buttons = [
    ...container.querySelectorAll<HTMLButtonElement>(".picker-option"),
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
    const button = buttons[(index + buttons.length) % buttons.length];
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest" });
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionMenu();
    focusOption(options.indexOf(selected));
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

  for (const [index, button] of buttons.entries()) {
    button.addEventListener("click", () => {
      const option = options[index];
      const changed = option !== selected;
      selected = option;
      valueLabel.textContent = option.name;
      currentSymbol.innerHTML = option.icon;
      buttons.forEach((item, optionIndex) =>
        item.setAttribute("aria-selected", String(index === optionIndex)),
      );
      closeMenu();
      if (changed) onChange(option.value);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      } else if (event.key === "Tab") {
        closeMenu();
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        focusOption(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : index + (event.key === "ArrowDown" ? 1 : -1),
        );
      } else if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key !== " "
      ) {
        const match = options.findIndex((option) =>
          option.name.toLowerCase().startsWith(event.key.toLowerCase()),
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
