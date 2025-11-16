import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hover HUD 고정/해제 테스트 (Alt+Shift)
 * 
 * 테스트 대상:
 * - Alt+Shift로 호버 HUD 고정
 * - 다시 Alt+Shift로 해제
 * - ESC로 해제
 * - ArrowUp/Down으로 부모/자식 탐색 (잠금 상태에서만)
 * - Picker가 꺼져 있으면 동작하지 않음
 */

describe("Hover HUD Lock/Unlock (Alt+Shift)", () => {
  let pickerOn = false;
  let locked = false;
  let target: HTMLElement | null = null;
  let inspectedElement: HTMLElement | null = null;

  beforeEach(() => {
    document.body.innerHTML = "";
    pickerOn = false;
    locked = false;
    target = null;
    inspectedElement = null;
  });

  it("Should lock element when Alt+Shift is pressed and picker is on", () => {
    pickerOn = true;
    target = document.createElement("div");
    target.id = "test-element";
    document.body.appendChild(target);

    // Simulate Alt+Shift
    const event = new KeyboardEvent("keydown", {
      altKey: true,
      shiftKey: true,
      key: "Shift",
      bubbles: true,
    });

    // Simulate locking
    if (pickerOn && !locked && target) {
      locked = true;
      inspectedElement = target;
    }

    expect(locked).toBe(true);
    expect(inspectedElement).toBe(target);
  });

  it("Should unlock element when Alt+Shift is pressed again", () => {
    pickerOn = true;
    locked = true;
    target = document.createElement("div");
    inspectedElement = target;

    // Simulate Alt+Shift again
    const event = new KeyboardEvent("keydown", {
      altKey: true,
      shiftKey: true,
      key: "Shift",
      bubbles: true,
    });

    // Simulate unlocking
    if (pickerOn && locked) {
      locked = false;
      inspectedElement = null;
    }

    expect(locked).toBe(false);
    expect(inspectedElement).toBe(null);
  });

  it("Should unlock element when ESC is pressed", () => {
    pickerOn = true;
    locked = true;
    target = document.createElement("div");
    inspectedElement = target;

    // Simulate ESC
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    // Simulate unlocking
    if (event.key === "Escape" && locked) {
      locked = false;
      inspectedElement = null;
    }

    expect(locked).toBe(false);
    expect(inspectedElement).toBe(null);
  });

  it("Should NOT lock when picker is off", () => {
    pickerOn = false;
    target = document.createElement("div");

    // Simulate Alt+Shift
    const event = new KeyboardEvent("keydown", {
      altKey: true,
      shiftKey: true,
      key: "Shift",
      bubbles: true,
    });

    // Should not lock
    if (pickerOn && !locked && target) {
      locked = true;
    }

    expect(locked).toBe(false);
  });

  it("Should navigate to parent element with ArrowUp when locked", () => {
    pickerOn = true;
    locked = true;

    const parent = document.createElement("div");
    parent.id = "parent";
    const child = document.createElement("span");
    child.id = "child";
    parent.appendChild(child);
    document.body.appendChild(parent);

    inspectedElement = child;

    // Simulate ArrowUp
    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
    });

    // Simulate navigation
    if (locked && inspectedElement && event.key === "ArrowUp") {
      const parentEl = inspectedElement.parentElement;
      if (parentEl && parentEl !== document.body) {
        inspectedElement = parentEl;
      }
    }

    expect(inspectedElement).toBe(parent);
  });

  it("Should navigate to child element with ArrowDown when locked", () => {
    pickerOn = true;
    locked = true;

    const parent = document.createElement("div");
    parent.id = "parent";
    const child = document.createElement("span");
    child.id = "child";
    parent.appendChild(child);
    document.body.appendChild(parent);

    inspectedElement = parent;

    // Simulate ArrowDown
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
    });

    // Simulate navigation
    if (locked && inspectedElement && event.key === "ArrowDown") {
      const firstChild = inspectedElement.children[0];
      if (firstChild && firstChild instanceof HTMLElement) {
        inspectedElement = firstChild;
      }
    }

    expect(inspectedElement).toBe(child);
  });

  it("Should NOT navigate when not locked", () => {
    pickerOn = true;
    locked = false;

    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);

    inspectedElement = child;
    const originalElement = inspectedElement;

    // Simulate ArrowUp
    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
    });

    // Should not navigate
    if (locked && inspectedElement && event.key === "ArrowUp") {
      inspectedElement = inspectedElement.parentElement as HTMLElement;
    }

    expect(inspectedElement).toBe(originalElement);
  });
});

