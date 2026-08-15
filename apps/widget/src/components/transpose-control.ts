export interface TransposeControlOptions {
  readonly label: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly initialStep?: number;
  readonly onTranspose?: (semitones: number) => void;
}

export interface TransposeControlHandle {
  readonly element: HTMLDivElement;
  dispose(): void;
}

const MIN_STEP = 1;
const MAX_STEP = 24;

export function createTransposeControl(
  documentObject: Document,
  options: TransposeControlOptions,
): TransposeControlHandle {
  const element = documentObject.createElement("div");
  element.className = "transpose-control";
  element.setAttribute("role", "group");
  element.setAttribute(
    "aria-label",
    options.ariaLabel ?? options.label,
  );

  if (options.title) {
    element.title = options.title;
  }

  const label = documentObject.createElement("span");
  label.className = "transpose-control-label";
  label.textContent = options.label;

  const stepper = documentObject.createElement("div");
  stepper.className = "transpose-stepper";

  const down = documentObject.createElement("button");
  down.type = "button";
  down.className = "transpose-step-button";
  down.textContent = "−";

  const amount = documentObject.createElement("label");
  amount.className = "transpose-step-value";

  const input = documentObject.createElement("input");
  input.type = "number";
  input.className = "transpose-step-input";
  input.min = String(MIN_STEP);
  input.max = String(MAX_STEP);
  input.step = "1";
  input.inputMode = "numeric";
  input.value = String(
    clampStep(options.initialStep ?? 1),
  );
  input.setAttribute(
    "aria-label",
    `${options.ariaLabel ?? options.label} step in semitones`,
  );

  const unit = documentObject.createElement("span");
  unit.textContent = "st";
  unit.setAttribute("aria-hidden", "true");

  const up = documentObject.createElement("button");
  up.type = "button";
  up.className = "transpose-step-button";
  up.textContent = "+";

  const disabled = options.disabled === true;

  down.disabled = disabled;
  input.disabled = disabled;
  up.disabled = disabled;

  element.setAttribute(
    "aria-disabled",
    String(disabled),
  );

  amount.appendChild(input);
  amount.appendChild(unit);

  stepper.appendChild(down);
  stepper.appendChild(amount);
  stepper.appendChild(up);

  element.appendChild(label);
  element.appendChild(stepper);

  const currentStep = (): number => {
    const step = clampStep(input.valueAsNumber);
    input.value = String(step);
    return step;
  };

  const transposeDown = () => {
    options.onTranspose?.(-currentStep());
  };

  const transposeUp = () => {
    options.onTranspose?.(currentStep());
  };

  const normalizeStep = () => {
    currentStep();
  };

  down.setAttribute(
    "aria-label",
    `Transpose ${options.ariaLabel ?? options.label} down`,
  );

  up.setAttribute(
    "aria-label",
    `Transpose ${options.ariaLabel ?? options.label} up`,
  );

  if (!disabled && options.onTranspose) {
    down.addEventListener("click", transposeDown);
    up.addEventListener("click", transposeUp);
    input.addEventListener("change", normalizeStep);
  }

  return {
    element,

    dispose() {
      down.removeEventListener("click", transposeDown);
      up.removeEventListener("click", transposeUp);
      input.removeEventListener("change", normalizeStep);
    },
  };
}

function clampStep(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_STEP;
  }

  return Math.max(
    MIN_STEP,
    Math.min(
      MAX_STEP,
      Math.round(value),
    ),
  );
}