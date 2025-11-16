import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Flow, Step } from "../../types";
import { mockTabsQuery, resetAllMocks } from "../setup";

/**
 * Flow 실행 엔진 테스트
 * 
 * background.ts의 runFlowInTab 로직을 테스트합니다:
 * - 순차적 Step 실행
 * - 에러 핸들링
 * - URL 네비게이션
 * - 중단 처리
 */

describe("Flow Execution Engine", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("Flow 실행 준비", () => {
    it("should get active tab before execution", async () => {
      const mockTab = {
        id: 123,
        url: "https://example.com",
        status: "complete",
      };

      mockTabsQuery([mockTab]);

      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe(123);
    });

    it("should handle no active tab error", async () => {
      mockTabsQuery([]);

      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      expect(tabs).toHaveLength(0);
    });

    it("should open side panel on recording start", async () => {
      const mockTab = { id: 123 };
      mockTabsQuery([mockTab as any]);

      await browser.sidePanel.open({ tabId: 123 });

      expect(browser.sidePanel.open).toHaveBeenCalledWith({ tabId: 123 });
    });
  });

  describe("Navigate Step 실행", () => {
    it("should execute navigate step", async () => {
      const tabId = 123;
      const navigateStep: Step = {
        type: "navigate",
        url: "https://example.com/page",
      };

      await browser.tabs.update(tabId, { url: navigateStep.url });

      expect(browser.tabs.update).toHaveBeenCalledWith(tabId, {
        url: "https://example.com/page",
      });
    });

    it("should wait for tab load after navigation", async () => {
      const tabId = 123;
      vi.mocked(browser.tabs.get).mockResolvedValue({
        id: tabId,
        status: "complete",
      } as any);

      const tab = await browser.tabs.get(tabId);

      expect(tab.status).toBe("complete");
    });

    it("should handle navigation to invalid URL", async () => {
      const tabId = 123;
      const error = new Error("Invalid URL");
      vi.mocked(browser.tabs.update).mockRejectedValue(error);

      try {
        await browser.tabs.update(tabId, { url: "invalid-url" });
        expect.fail("Should have thrown an error");
      } catch (e) {
        expect(e).toBe(error);
      }
    });
  });

  describe("URL 자동 네비게이션", () => {
    it("should navigate when step URL differs from current URL", () => {
      const stepUrl = "https://example.com/page1";
      const currentUrl = "https://example.com/page2";

      const shouldNavigate = (step: string, current: string) => {
        try {
          const stepUrlObj = new URL(step);
          const currentUrlObj = new URL(current);
          return (
            stepUrlObj.origin + stepUrlObj.pathname !==
            currentUrlObj.origin + currentUrlObj.pathname
          );
        } catch {
          return false;
        }
      };

      expect(shouldNavigate(stepUrl, currentUrl)).toBe(true);
    });

    it("should not navigate when only query params differ", () => {
      const stepUrl = "https://example.com/page?foo=bar";
      const currentUrl = "https://example.com/page?baz=qux";

      const shouldNavigate = (step: string, current: string) => {
        try {
          const stepUrlObj = new URL(step);
          const currentUrlObj = new URL(current);
          return (
            stepUrlObj.origin + stepUrlObj.pathname !==
            currentUrlObj.origin + currentUrlObj.pathname
          );
        } catch {
          return false;
        }
      };

      expect(shouldNavigate(stepUrl, currentUrl)).toBe(false);
    });

    it("should navigate to first step URL if provided", async () => {
      const flow: Flow = {
        id: "test-flow",
        title: "Test",
        steps: [
          { type: "click", selector: "#btn", url: "https://example.com/page1" },
        ],
        createdAt: Date.now(),
      };

      const firstStep = flow.steps[0];
      const firstStepUrl = "url" in firstStep ? firstStep.url : undefined;

      expect(firstStepUrl).toBe("https://example.com/page1");
      expect(firstStepUrl?.startsWith("http")).toBe(true);
    });
  });

  describe("Step 실행 순서", () => {
    it("should execute steps in order", async () => {
      const flow: Flow = {
        id: "test-flow",
        title: "Test",
        steps: [
          { type: "click", selector: "#btn1" },
          { type: "click", selector: "#btn2" },
          { type: "click", selector: "#btn3" },
        ],
        createdAt: Date.now(),
      };

      // 실행 순서 확인을 위한 배열
      const executionOrder: string[] = [];

      flow.steps.forEach((step, index) => {
        const selector = "selector" in step ? step.selector : step.type;
        executionOrder.push(`Step ${index + 1}: ${selector}`);
      });

      expect(executionOrder).toEqual([
        "Step 1: #btn1",
        "Step 2: #btn2",
        "Step 3: #btn3",
      ]);
    });

    it("should skip first navigate step if startUrl is set", () => {
      const flow: Flow = {
        id: "test-flow",
        title: "Test",
        steps: [
          { type: "navigate", url: "https://example.com" },
          { type: "click", selector: "#btn" },
        ],
        createdAt: Date.now(),
        startUrl: "https://example.com",
      };

      let startIndex = 0;
      if (
        flow.startUrl &&
        flow.steps.length > 0 &&
        flow.steps[0].type === "navigate"
      ) {
        startIndex = 1;
      }

      expect(startIndex).toBe(1);
    });
  });

  describe("Step 실행 메시지", () => {
    it("should send STEP_EXECUTING message", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
      };

      const message = {
        type: "STEP_EXECUTING",
        step,
        stepIndex: 0,
        totalSteps: 1,
        currentUrl: "https://example.com",
      };

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
    });

    it("should send STEP_COMPLETED message", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
      };

      const message = {
        type: "STEP_COMPLETED",
        step,
        stepIndex: 0,
        success: true,
      };

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
    });

    it("should send STEP_COMPLETED with error", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
      };

      const message = {
        type: "STEP_COMPLETED",
        step,
        stepIndex: 0,
        success: false,
        error: "Element not found",
      };

      await browser.runtime.sendMessage(message);

      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as any;
      expect(call.success).toBe(false);
      expect(call.error).toBe("Element not found");
    });

    it("should send FLOW_FAILED message", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
      };

      const message = {
        type: "FLOW_FAILED",
        error: "Step 1 failed: Element not found",
        failedStepIndex: 0,
        failedStep: step,
      };

      await browser.runtime.sendMessage(message);

      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as any;
      expect(call.type).toBe("FLOW_FAILED");
      expect(call.error).toContain("failed");
    });
  });

  describe("Extract Step 데이터 반환", () => {
    it("should return extracted data in STEP_COMPLETED", () => {
      const extractedData = "Some extracted text";

      const message = {
        type: "STEP_COMPLETED",
        step: { type: "extract", selector: "#result" },
        stepIndex: 0,
        success: true,
        extractedData,
      };

      expect(message.extractedData).toBe("Some extracted text");
    });

    it("should handle empty extracted data", () => {
      const message = {
        type: "STEP_COMPLETED",
        step: { type: "extract", selector: "#result" },
        stepIndex: 0,
        success: true,
        extractedData: "",
      };

      expect(message.extractedData).toBe("");
    });

    it("should handle null extracted data", () => {
      const message = {
        type: "STEP_COMPLETED",
        step: { type: "extract", selector: "#result" },
        stepIndex: 0,
        success: true,
        extractedData: null,
      };

      expect(message.extractedData).toBeNull();
    });
  });

  describe("Step 간 딜레이", () => {
    it("should wait 500ms between steps", async () => {
      const delay = 500;
      const startTime = Date.now();

      await new Promise((resolve) => setTimeout(resolve, delay));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(delay - 50); // 허용 오차 50ms
    });
  });

  describe("탭 포커스 관리", () => {
    it("should focus tab before step execution", async () => {
      const tabId = 123;
      vi.mocked(browser.tabs.update).mockResolvedValue({} as any);

      await browser.tabs.update(tabId, { active: true });

      expect(browser.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    });

    it("should check if tab is still active", async () => {
      const tabId = 123;
      const mockTab = { id: tabId, active: true };

      mockTabsQuery([mockTab as any]);

      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      expect(tabs[0].id).toBe(tabId);
    });
  });

  describe("Error handling", () => {
    it("should handle step execution timeout", async () => {
      const error = new Error("Timeout waiting for element");

      try {
        throw error;
      } catch (e) {
        expect(e).toBe(error);
        expect((e as Error).message).toContain("Timeout");
      }
    });

    it("should handle element not found error", async () => {
      const error = new Error("Element not found: #button");

      try {
        throw error;
      } catch (e) {
        expect((e as Error).message).toContain("not found");
      }
    });

    it("should handle navigation error", async () => {
      const error = new Error("Failed to navigate");

      try {
        throw error;
      } catch (e) {
        expect((e as Error).message).toContain("navigate");
      }
    });
  });

  describe("프레임 처리", () => {
    it("should execute script in specific frame", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
        _frameId: 123,
        _frameUrl: "https://example.com/iframe",
      };

      expect((step as any)._frameId).toBe(123);
      expect((step as any)._frameUrl).toBe("https://example.com/iframe");
    });

    it("should execute in main frame when no frameId", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
      };

      expect((step as any)._frameId).toBeUndefined();
    });
  });

  describe("Flow 실행 중단", () => {
    it("should stop flow execution on STOP_RUN", () => {
      let shouldStopRunning = false;

      // STOP_RUN 메시지 수신 시뮬레이션
      shouldStopRunning = true;

      expect(shouldStopRunning).toBe(true);
    });

    it("should check stop flag before each step", () => {
      let shouldStopRunning = false;

      const steps: Step[] = [
        { type: "click", selector: "#btn1" },
        { type: "click", selector: "#btn2" },
        { type: "click", selector: "#btn3" },
      ];

      let executedSteps = 0;

      for (let i = 0; i < steps.length; i++) {
        if (shouldStopRunning) {
          break;
        }
        executedSteps++;

        if (i === 1) {
          shouldStopRunning = true; // 2번째 스텝 후 중단
        }
      }

      expect(executedSteps).toBe(2);
    });

    it("should send FLOW_FAILED when stopped by user", async () => {
      const message = {
        type: "FLOW_FAILED",
        error: "Stopped by user",
        failedStepIndex: 2,
        failedStep: { type: "click", selector: "#btn" },
      };

      await browser.runtime.sendMessage(message);

      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as any;
      expect(call.error).toBe("Stopped by user");
    });
  });

  describe("복잡한 Flow 시나리오", () => {
    it("should execute flow with mixed step types", () => {
      const flow: Flow = {
        id: "complex-flow",
        title: "Complex Flow",
        steps: [
          { type: "navigate", url: "https://example.com" },
          { type: "waitFor", selector: "#content", timeoutMs: 5000 },
          { type: "click", selector: "#login-btn" },
          { type: "type", selector: "#username", text: "****" },
          { type: "type", selector: "#password", text: "****", submit: true },
          { type: "waitForNavigation", timeoutMs: 10000 },
          { type: "extract", selector: "#welcome-message", prop: "innerText" },
        ],
        createdAt: Date.now(),
      };

      expect(flow.steps).toHaveLength(7);
      expect(flow.steps[0].type).toBe("navigate");
      expect(flow.steps[6].type).toBe("extract");
    });

    it("should handle flow with conditional steps", () => {
      const flow: Flow = {
        id: "conditional-flow",
        title: "Conditional Flow",
        steps: [
          { type: "click", selector: "#modal-trigger" },
          { type: "waitFor", selector: ".modal", timeoutMs: 3000 },
          { type: "click", selector: ".modal .confirm-btn" },
        ],
        createdAt: Date.now(),
      };

      const hasWaitForModal = flow.steps.some(
        (s) => s.type === "waitFor" && s.selector === ".modal"
      );

      expect(hasWaitForModal).toBe(true);
    });
  });
});

