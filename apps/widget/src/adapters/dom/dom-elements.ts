export function requiredElement<T extends HTMLElement>(
  documentObject: Document,
  id: string,
): T {
  const element = documentObject.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}.`);
  return element as T;
}

export function requiredInside<T extends Element>(
  parent: Element,
  selector: string,
): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element ${selector}.`);
  return element;
}
