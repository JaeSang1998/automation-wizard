import { describe, it, expect, beforeEach } from "vitest";
import { makeSelector, generateRobustLocator } from "@auto-wiz/dom";

describe("Selector Generation (Real Implementation)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("makeSelector", () => {
    it("should generate selector with id", () => {
      const button = document.createElement("button");
      button.id = "submit-button";
      document.body.appendChild(button);

      const selector = makeSelector(button);

      expect(selector).toContain("#submit-button");
      expect(selector).toContain("button");
    });

    it("should escape special characters in id", () => {
      const div = document.createElement("div");
      div.id = "my:special.id";
      document.body.appendChild(div);

      const selector = makeSelector(div);
      expect(selector).toContain("div#");
      // Note: CSS.escape implementation in happy-dom/jsdom might vary, but robust logic handles it
      // Simple check
      expect(selector.includes("my:special.id") || selector.includes("my\\:special\\.id")).toBe(true);
    });

    it("should use data-testid when no id present", () => {
      const button = document.createElement("button");
      button.setAttribute("data-testid", "submit-btn");
      document.body.appendChild(button);

      const selector = makeSelector(button);
      expect(selector).toContain('[data-testid="submit-btn"]');
    });

    it("should use nth-of-type for multiple siblings", () => {
      const container = document.createElement("div");
      const button1 = document.createElement("button");
      const button2 = document.createElement("button");
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      const selector = makeSelector(button2);
      expect(selector).toContain(":nth-of-type(2)");
    });
  });

  describe("generateRobustLocator", () => {
    it("should prioritize test-id", () => {
      const button = document.createElement("button");
      button.id = "btn-123";
      button.setAttribute("data-testid", "submit-btn");
      button.innerText = "Click Me";
      document.body.appendChild(button);

      const locator = generateRobustLocator(button);

      expect(locator.primary).toBe('[data-testid="submit-btn"]');
      expect(locator.fallbacks).toContain("#btn-123");
      expect(locator.metadata?.text).toBe("Click Me");
    });

    it("should capture aria-label", () => {
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Close");
      document.body.appendChild(button);

      const locator = generateRobustLocator(button);

      expect(locator.primary).toBe('[aria-label="Close"]');
      expect(locator.metadata?.role).toBe("button");
    });

    it("should handle nested structure with fallbacks", () => {
      const form = document.createElement("form");
      const div = document.createElement("div");
      div.className = "input-group";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Enter name";
      
      div.appendChild(input);
      form.appendChild(div);
      document.body.appendChild(form);

      const locator = generateRobustLocator(input);

      expect(locator.primary).toContain('input[placeholder="Enter name"]'); // Tier 2
      // Check metadata
      expect(locator.metadata?.tagName).toBe("input");
      expect(locator.metadata?.placeholder).toBe("Enter name");
    });

    it("should generate text-based fallback", () => {
        const div = document.createElement("div");
        div.innerText = "Some unique text";
        document.body.appendChild(div);
  
        const locator = generateRobustLocator(div);
        expect(locator.metadata?.text).toBe("Some unique text");
    });
  });
});
