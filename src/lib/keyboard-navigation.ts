import type { KeyboardEvent } from "react";

export function handleRovingTabKey<T>(
  event: KeyboardEvent<HTMLButtonElement>,
  options: readonly T[],
  current: T,
  onSelect: (value: T) => void,
) {
  if (!options.length) return;
  const currentIndex = Math.max(0, options.indexOf(current));
  let nextIndex: number | undefined;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = options.length - 1;
  if (nextIndex === undefined) return;

  event.preventDefault();
  onSelect(options[nextIndex]);
  const tabs = event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs?.[nextIndex]?.focus();
}
