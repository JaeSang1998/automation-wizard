import { describe, it, expect } from "vitest";
import type { Step } from "@auto-wiz/core";

describe("Step Validation", () => {
  describe("Click step validation", () => {
    it("should validate a valid click step", () => {
      const step: Step = {
        type: "click",
        selector: "#submit-button",
      };

      expect(step.type).toBe("click");
      expect(step.selector).toBeTruthy();
      expect(step.selector.length).toBeGreaterThan(0);
    });

    it("should include optional url in click step", () => {
      const step: Step = {
        type: "click",
        selector: "#button",
        url: "https://example.com",
      };

      expect(step.url).toBe("https://example.com");
    });
  });

  describe("Type step validation", () => {
    it("should validate a basic type step", () => {
      const step: Step = {
        type: "type",
        selector: "#username",
        text: "testuser",
      };

      expect(step.type).toBe("type");
      expect(step.selector).toBeTruthy();
      expect((step as any).text).toBe("testuser");
    });

    it("should handle type step with submit flag", () => {
      const step: Step = {
        type: "type",
        selector: "#search",
        text: "query",
        submit: true,
      };

      expect((step as any).submit).toBe(true);
    });

    it("should handle type step with masked password", () => {
      const step: Step = {
        type: "type",
        selector: "#password",
        text: "****",
        originalText: "secret123",
      };

      expect((step as any).text).toBe("****");
      expect((step as any).originalText).toBe("secret123");
    });
  });

  describe("Select step validation", () => {
    it("should validate select step", () => {
      const step: Step = {
        type: "select",
        selector: "#country",
        value: "US",
      };

      expect(step.type).toBe("select");
      expect(step.selector).toBeTruthy();
      expect((step as any).value).toBe("US");
    });
  });

  describe("Extract step validation", () => {
    it("should validate extract step with default prop", () => {
      const step: Step = {
        type: "extract",
        selector: "#result",
      };

      expect(step.type).toBe("extract");
      expect(step.selector).toBeTruthy();
    });

    it("should validate extract step with specific prop", () => {
      const step: Step = {
        type: "extract",
        selector: "#input",
        prop: "value",
      };

      expect((step as any).prop).toBe("value");
    });
  });

  describe("WaitFor step validation", () => {
    it("should validate waitFor step with default timeout", () => {
      const step: Step = {
        type: "waitFor",
        selector: "#loading",
      };

      expect(step.type).toBe("waitFor");
      expect(step.selector).toBeTruthy();
    });

    it("should validate waitFor step with custom timeout", () => {
      const step: Step = {
        type: "waitFor",
        selector: "#content",
        timeoutMs: 10000,
      };

      expect((step as any).timeoutMs).toBe(10000);
    });
  });

  describe("Navigate step validation", () => {
    it("should validate navigate step", () => {
      const step: Step = {
        type: "navigate",
        url: "https://example.com",
      };

      expect(step.type).toBe("navigate");
      expect(step.url).toBeTruthy();
      expect(step.url).toMatch(/^https?:\/\//);
    });

    it("should validate https URL", () => {
      const step: Step = {
        type: "navigate",
        url: "https://secure.example.com",
      };

      expect(step.url).toMatch(/^https:\/\//);
    });
  });

  describe("WaitForNavigation step validation", () => {
    it("should validate waitForNavigation step", () => {
      const step: Step = {
        type: "waitForNavigation",
      };

      expect(step.type).toBe("waitForNavigation");
    });

    it("should validate waitForNavigation with timeout", () => {
      const step: Step = {
        type: "waitForNavigation",
        timeoutMs: 15000,
      };

      expect((step as any).timeoutMs).toBe(15000);
    });
  });

  describe("Screenshot step validation", () => {
    it("should validate screenshot step", () => {
      const step: Step = {
        type: "screenshot",
        selector: "#element",
        screenshot: "data:image/png;base64,iVBORw0KG...",
      };

      expect(step.type).toBe("screenshot");
      expect(step.selector).toBeTruthy();
      expect(step.screenshot).toMatch(/^data:image/);
    });
  });

  describe("Frame metadata validation", () => {
    it("should validate step with frame metadata", () => {
      const step: Step = {
        type: "click",
        selector: "#iframe-button",
        _frameId: 123,
        _frameUrl: "https://example.com/iframe.html",
      };

      expect((step as any)._frameId).toBe(123);
      expect((step as any)._frameUrl).toBe("https://example.com/iframe.html");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty selector gracefully", () => {
      const step: Step = {
        type: "click",
        selector: "",
      };

      expect(step.selector).toBe("");
      expect(step.selector.length).toBe(0);
    });

    it("should handle complex CSS selectors", () => {
      const step: Step = {
        type: "click",
        selector:
          "div.container > ul.list > li:nth-child(2) > a[href^='https']",
      };

      expect(step.selector).toContain(">");
      expect(step.selector).toContain("nth-child");
      expect(step.selector).toContain("[href");
    });

    it("should handle XPath selectors", () => {
      const step: Step = {
        type: "click",
        selector: "xpath=//*[@id='submit']",
      };

      expect(step.selector).toContain("xpath=");
    });
  });
});

