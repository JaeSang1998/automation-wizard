/**
 * Locator Performance 테스트
 * 성능과 효율성 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateRobustLocator } from "@auto-wiz/dom";
import { findByLocator, findByText } from "@auto-wiz/dom";

describe("Locator Performance", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("Large DOM performance", () => {
    it("should handle large number of elements efficiently", () => {
      // 1000개 요소 생성
      const elements: string[] = [];
      for (let i = 0; i < 1000; i++) {
        elements.push(`<div data-testid="item-${i}">Item ${i}</div>`);
      }
      container.innerHTML = elements.join("");

      const startTime = performance.now();

      // 중간 요소 찾기
      const target = container.querySelector('[data-testid="item-500"]') as HTMLElement;
      const locator = generateRobustLocator(target);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(locator.primary).toBe('[data-testid="item-500"]');
      // 100ms 이내에 완료되어야 함
      expect(duration).toBeLessThan(100);
    });

    it("should handle deeply nested structure efficiently", () => {
      // 깊은 중첩 구조 생성
      let html = "<div>";
      for (let i = 0; i < 50; i++) {
        html += "<div>";
      }
      html += '<button data-testid="deep-button">Deep</button>';
      for (let i = 0; i < 50; i++) {
        html += "</div>";
      }
      html += "</div>";

      container.innerHTML = html;

      const startTime = performance.now();

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(locator.primary).toBe('[data-testid="deep-button"]');
      // 깊은 중첩에도 빠르게 처리되어야 함
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Selector generation performance", () => {
    it("should generate locator quickly for simple element", () => {
      container.innerHTML = `
        <button data-testid="simple">Simple Button</button>
      `;

      const button = container.querySelector("button") as HTMLElement;

      const startTime = performance.now();
      const locator = generateRobustLocator(button);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(locator.primary).toBeTruthy();
      // 10ms 이내
      expect(duration).toBeLessThan(10);
    });

    it("should generate locator quickly for complex element", () => {
      container.innerHTML = `
        <button 
          id="complex-btn"
          data-testid="complex"
          data-test="complex-test"
          aria-label="Complex button"
          class="btn btn-primary btn-large"
          title="Click me"
          name="action">
          Click Me
        </button>
      `;

      const button = container.querySelector("button") as HTMLElement;

      const startTime = performance.now();
      const locator = generateRobustLocator(button);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(locator.primary).toBeTruthy();
      expect(locator.fallbacks.length).toBeGreaterThan(0);
      // 20ms 이내
      expect(duration).toBeLessThan(20);
    });
  });

  describe("Element finding performance", () => {
    it("should find element quickly using primary selector", () => {
      container.innerHTML = `
        <button data-testid="target">Target</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      const startTime = performance.now();
      const found = findByLocator(locator);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(found).not.toBeNull();
      // 5ms 이내
      expect(duration).toBeLessThan(5);
    });

    it("should handle fallback efficiently", () => {
      // Primary가 없고 fallback만 있는 경우
      container.innerHTML = `
        <button class="action-btn">Action</button>
      `;

      const locator = {
        primary: "[data-testid='nonexistent']",
        fallbacks: [".action-btn", "button"],
        metadata: {},
      };

      const startTime = performance.now();
      const found = findByLocator(locator);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(found).not.toBeNull();
      // Fallback도 빠르게 처리되어야 함
      expect(duration).toBeLessThan(10);
    });

    it("should handle text search in large DOM", () => {
      // 많은 요소 중에서 텍스트로 찾기
      const elements: string[] = [];
      for (let i = 0; i < 500; i++) {
        elements.push(`<div>Item ${i}</div>`);
      }
      elements.push('<div>Target Text</div>');
      for (let i = 501; i < 1000; i++) {
        elements.push(`<div>Item ${i}</div>`);
      }
      container.innerHTML = elements.join("");

      const startTime = performance.now();
      const found = findByText("Target Text", { exact: true });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(found.length).toBe(1);
      // 큰 DOM에서도 합리적인 시간 내에
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Memory efficiency", () => {
    it("should not create excessive fallback selectors", () => {
      container.innerHTML = `
        <button 
          data-testid="btn"
          id="button-id"
          name="button-name"
          aria-label="Button label">
          Button
        </button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      // Fallback이 너무 많으면 메모리 낭비
      expect(locator.fallbacks.length).toBeLessThan(20);
    });

    it("should not store excessively long text in metadata", () => {
      const longText = "A".repeat(1000);
      container.innerHTML = `
        <div>${longText}</div>
      `;

      const div = container.querySelector("div") as HTMLElement;
      const locator = generateRobustLocator(div);

      // 텍스트가 50자로 제한되어야 함
      expect(locator.metadata?.text?.length || 0).toBeLessThanOrEqual(50);
    });
  });

  describe("Batch operations", () => {
    it("should handle multiple selector generations efficiently", () => {
      const elements: string[] = [];
      for (let i = 0; i < 100; i++) {
        elements.push(`<button data-testid="btn-${i}">Button ${i}</button>`);
      }
      container.innerHTML = elements.join("");

      const buttons = Array.from(container.querySelectorAll("button"));

      const startTime = performance.now();

      const locators = buttons.map((btn) => generateRobustLocator(btn as HTMLElement));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(locators.length).toBe(100);
      // 100개 생성에 1초 이내
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Caching and optimization", () => {
    it("should handle repeated lookups efficiently", () => {
      container.innerHTML = `
        <button data-testid="repeated">Repeated</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      // 같은 locator로 여러 번 찾기
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const found = findByLocator(locator);
        expect(found).not.toBeNull();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 100번 반복해도 빠르게 처리되어야 함
      expect(duration).toBeLessThan(100);
    });
  });
});


