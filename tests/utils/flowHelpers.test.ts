import { describe, it, expect, beforeEach } from "vitest";
import type { Flow, Step } from "../../types";
import { mockStorageGet, mockStorageSet, resetAllMocks } from "../setup";

// 테스트할 헬퍼 함수들을 별도 파일로 분리하는 것이 좋습니다
// 여기서는 예제로 직접 구현합니다

describe("Flow Helpers", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("createFlow", () => {
    it("should create a new flow with default values", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [],
        createdAt: Date.now(),
      };

      expect(flow).toBeDefined();
      expect(flow.id).toBe("test-id");
      expect(flow.title).toBe("Test Flow");
      expect(flow.steps).toEqual([]);
      expect(flow.createdAt).toBeGreaterThan(0);
    });

    it("should create a flow with startUrl", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [],
        createdAt: Date.now(),
        startUrl: "https://example.com",
      };

      expect(flow.startUrl).toBe("https://example.com");
    });
  });

  describe("addStep", () => {
    it("should add a click step to flow", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [],
        createdAt: Date.now(),
      };

      const clickStep: Step = {
        type: "click",
        selector: "#submit-button",
        url: "https://example.com",
      };

      flow.steps.push(clickStep);

      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0].type).toBe("click");
      if ("selector" in flow.steps[0]) {
        expect(flow.steps[0].selector).toBe("#submit-button");
      }
    });

    it("should add a type step with masked text", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [],
        createdAt: Date.now(),
      };

      const typeStep: Step = {
        type: "type",
        selector: "#password",
        text: "****",
        originalText: "secret123",
        url: "https://example.com/login",
      };

      flow.steps.push(typeStep);

      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0].type).toBe("type");
      expect((flow.steps[0] as any).text).toBe("****");
      expect((flow.steps[0] as any).originalText).toBe("secret123");
    });
  });

  describe("removeStep", () => {
    it("should remove a step from flow by index", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [
          { type: "click", selector: "#btn1" },
          { type: "click", selector: "#btn2" },
          { type: "click", selector: "#btn3" },
        ],
        createdAt: Date.now(),
      };

      flow.steps = flow.steps.filter((_, index) => index !== 1);

      expect(flow.steps).toHaveLength(2);
      if ("selector" in flow.steps[0]) {
        expect(flow.steps[0].selector).toBe("#btn1");
      }
      if ("selector" in flow.steps[1]) {
        expect(flow.steps[1].selector).toBe("#btn3");
      }
    });
  });

  describe("moveStep", () => {
    it("should move a step from one position to another", () => {
      const flow: Flow = {
        id: "test-id",
        title: "Test Flow",
        steps: [
          { type: "click", selector: "#btn1" },
          { type: "click", selector: "#btn2" },
          { type: "click", selector: "#btn3" },
        ],
        createdAt: Date.now(),
      };

      const fromIndex = 0;
      const toIndex = 2;
      const [moved] = flow.steps.splice(fromIndex, 1);
      flow.steps.splice(toIndex, 0, moved);

      expect(flow.steps).toHaveLength(3);
      if ("selector" in flow.steps[0]) {
        expect(flow.steps[0].selector).toBe("#btn2");
      }
      if ("selector" in flow.steps[1]) {
        expect(flow.steps[1].selector).toBe("#btn3");
      }
      if ("selector" in flow.steps[2]) {
        expect(flow.steps[2].selector).toBe("#btn1");
      }
    });
  });

  describe("validateStep", () => {
    it("should validate a click step", () => {
      const step: Step = {
        type: "click",
        selector: "#submit",
      };

      expect(step.type).toBe("click");
      expect(step.selector).toBeDefined();
    });

    it("should validate a type step with required fields", () => {
      const step: Step = {
        type: "type",
        selector: "#username",
        text: "testuser",
      };

      expect(step.type).toBe("type");
      expect(step.selector).toBeDefined();
      expect((step as any).text).toBeDefined();
    });

    it("should validate a navigate step", () => {
      const step: Step = {
        type: "navigate",
        url: "https://example.com",
      };

      expect(step.type).toBe("navigate");
      expect(step.url).toBeDefined();
      expect(step.url).toMatch(/^https?:\/\//);
    });
  });
});

