import { describe, expect, it, vi } from "vitest";
import { handleRovingTabKey } from "./keyboard-navigation";

describe("handleRovingTabKey", () => {
  it("seleziona il tab successivo e torna al primo", () => {
    const select = vi.fn();
    const focus = vi.fn();
    const event = {
      key: "ArrowRight",
      preventDefault: vi.fn(),
      currentTarget: { closest: () => ({ querySelectorAll: () => [{ focus }, { focus }] }) },
    } as unknown as import("react").KeyboardEvent<HTMLButtonElement>;

    handleRovingTabKey(event, ["month", "week"] as const, "week", select);

    expect(select).toHaveBeenCalledWith("month");
    expect(focus).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
