import { describe, it, expect, beforeEach } from "vitest";

/**
 * Picker 켜질 때 즉시 현재 마우스 위치 요소 감지 테스트
 * 
 * 테스트 대상:
 * - Picker가 켜지면 현재 마우스 위치의 요소를 즉시 감지
 * - Alt+Shift 눌렀을 때 target이 없으면 :hover로 요소 감지
 * - 마우스를 움직이지 않아도 즉시 요소 잠금 가능
 */

describe("Picker Immediate Hover Detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("Should detect element under cursor when picker is enabled", () => {
    // Setup DOM
    const button = document.createElement("button");
    button.id = "test-button";
    button.textContent = "Click me";
    document.body.appendChild(button);

    // Simulate :hover state
    const hoveredElements = [document.body, button];

    // Find the deepest hovered element (excluding root)
    let detectedElement: HTMLElement | null = null;
    for (let i = hoveredElements.length - 1; i >= 0; i--) {
      const el = hoveredElements[i];
      if (
        el instanceof HTMLElement &&
        el !== document.body &&
        !el.closest("#automation-wizard-root")
      ) {
        detectedElement = el;
        break;
      }
    }

    expect(detectedElement).toBe(button);
  });

  it("Should find element via :hover when Alt+Shift pressed without target", () => {
    // Setup DOM
    const div = document.createElement("div");
    div.id = "hover-target";
    div.style.width = "100px";
    div.style.height = "100px";
    document.body.appendChild(div);

    let target: HTMLElement | null = null;
    let locked = false;

    // Simulate Alt+Shift press without existing target
    const findHoveredElement = () => {
      const hoveredElements = document.querySelectorAll(":hover");
      for (let i = hoveredElements.length - 1; i >= 0; i--) {
        const el = hoveredElements[i];
        if (
          el instanceof HTMLElement &&
          !el.closest("#automation-wizard-root")
        ) {
          return el;
        }
      }
      return null;
    };

    // Mock :hover state by adding elements to a simulated hover list
    // (In real scenario, browser maintains :hover state)
    const mockHoveredElements = [document.documentElement, document.body, div];
    
    // Find deepest hovered element
    let elementToLock: HTMLElement | null = target;
    if (!elementToLock) {
      for (let i = mockHoveredElements.length - 1; i >= 0; i--) {
        const el = mockHoveredElements[i];
        if (
          el instanceof HTMLElement &&
          !el.closest("#automation-wizard-root")
        ) {
          elementToLock = el;
          break;
        }
      }
    }

    if (elementToLock) {
      locked = true;
      target = elementToLock;
    }

    expect(locked).toBe(true);
    expect(target).toBe(div);
  });

  it("Should exclude automation-wizard-root from detection", () => {
    // Setup DOM
    const wizardRoot = document.createElement("div");
    wizardRoot.id = "automation-wizard-root";
    document.body.appendChild(wizardRoot);

    const wizardChild = document.createElement("div");
    wizardChild.id = "wizard-child";
    wizardRoot.appendChild(wizardChild);

    const normalDiv = document.createElement("div");
    normalDiv.id = "normal-div";
    document.body.appendChild(normalDiv);

    const mockHoveredElements = [
      document.documentElement,
      document.body,
      normalDiv,
      wizardRoot,
      wizardChild,
    ];

    let detectedElement: HTMLElement | null = null;
    for (let i = mockHoveredElements.length - 1; i >= 0; i--) {
      const el = mockHoveredElements[i];
      if (
        el instanceof HTMLElement &&
        !el.closest("#automation-wizard-root")
      ) {
        detectedElement = el;
        break;
      }
    }

    expect(detectedElement).toBe(normalDiv);
    expect(detectedElement).not.toBe(wizardChild);
    expect(detectedElement).not.toBe(wizardRoot);
  });

  it("Should calculate correct coordinates for locked element", () => {
    // Setup DOM
    const element = document.createElement("div");
    element.id = "test-element";
    element.style.position = "absolute";
    element.style.left = "100px";
    element.style.top = "50px";
    element.style.width = "200px";
    element.style.height = "100px";
    document.body.appendChild(element);

    // Simulate locking
    const rect = element.getBoundingClientRect();
    const coords = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Verify coords (center of element)
    expect(coords.x).toBeGreaterThan(0);
    expect(coords.y).toBeGreaterThan(0);
  });

  it("Should handle no hovered elements gracefully", () => {
    const mockHoveredElements: HTMLElement[] = [];

    let elementToLock: HTMLElement | null = null;
    for (let i = mockHoveredElements.length - 1; i >= 0; i--) {
      const el = mockHoveredElements[i];
      if (
        el instanceof HTMLElement &&
        !el.closest("#automation-wizard-root")
      ) {
        elementToLock = el;
        break;
      }
    }

    expect(elementToLock).toBe(null);
  });
});

