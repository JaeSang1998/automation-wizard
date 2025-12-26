import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Flow } from "@auto-wiz/core";
import { mockStorageGet, mockStorageSet, resetAllMocks } from "../setup";

describe("Background Storage Operations", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("getFlow", () => {
    it("should return existing flow from storage", async () => {
      const mockFlow: Flow = {
        id: "test-flow-id",
        title: "Test Flow",
        steps: [{ type: "click", selector: "#test" }],
        createdAt: 1234567890,
      };

      mockStorageGet({ flow: mockFlow });

      const result = await browser.storage.local.get("flow");

      expect(result.flow).toEqual(mockFlow);
      expect(result.flow.id).toBe("test-flow-id");
      expect(result.flow.steps).toHaveLength(1);
    });

    it("should return empty object when no flow exists", async () => {
      mockStorageGet({});

      const result = await browser.storage.local.get("flow");

      expect(result).toEqual({});
      expect(result.flow).toBeUndefined();
    });

    it("should handle multiple storage keys", async () => {
      const mockData = {
        flow: {
          id: "test-id",
          title: "Test",
          steps: [],
          createdAt: 123,
        },
        settings: {
          theme: "dark",
        },
      };

      mockStorageGet(mockData);

      const result = await browser.storage.local.get(["flow", "settings"]);

      expect(result.flow).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.settings.theme).toBe("dark");
    });
  });

  describe("saveFlow", () => {
    it("should save flow to storage", async () => {
      const newFlow: Flow = {
        id: "new-flow-id",
        title: "New Flow",
        steps: [],
        createdAt: Date.now(),
      };

      await browser.storage.local.set({ flow: newFlow });

      expect(browser.storage.local.set).toHaveBeenCalledWith({ flow: newFlow });
      expect(browser.storage.local.set).toHaveBeenCalledTimes(1);
    });

    it("should update existing flow", async () => {
      const existingFlow: Flow = {
        id: "existing-id",
        title: "Existing Flow",
        steps: [{ type: "click", selector: "#old" }],
        createdAt: 1000,
      };

      const updatedFlow: Flow = {
        ...existingFlow,
        steps: [
          ...existingFlow.steps,
          { type: "click", selector: "#new" },
        ],
      };

      await browser.storage.local.set({ flow: updatedFlow });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        flow: updatedFlow,
      });
      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as {
        flow: Flow;
      };
      expect(call.flow.steps).toHaveLength(2);
    });
  });

  describe("clearFlow", () => {
    it("should clear flow from storage", async () => {
      await browser.storage.local.remove("flow");

      expect(browser.storage.local.remove).toHaveBeenCalledWith("flow");
      expect(browser.storage.local.remove).toHaveBeenCalledTimes(1);
    });

    it("should clear all storage", async () => {
      await browser.storage.local.clear();

      expect(browser.storage.local.clear).toHaveBeenCalled();
      expect(browser.storage.local.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe("Flow persistence", () => {
    it("should persist flow with startUrl", async () => {
      const flowWithUrl: Flow = {
        id: "url-flow",
        title: "Flow with URL",
        steps: [],
        createdAt: Date.now(),
        startUrl: "https://example.com",
      };

      await browser.storage.local.set({ flow: flowWithUrl });

      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as {
        flow: Flow;
      };
      expect(call.flow.startUrl).toBe("https://example.com");
    });

    it("should handle flows with complex steps", async () => {
      const complexFlow: Flow = {
        id: "complex-flow",
        title: "Complex Flow",
        steps: [
          { type: "navigate", url: "https://example.com" },
          { type: "waitFor", selector: "#content", timeoutMs: 5000 },
          { type: "click", selector: "#button" },
          {
            type: "type",
            selector: "#input",
            text: "test",
            submit: true,
          },
          { type: "extract", selector: "#result", prop: "innerText" },
        ],
        createdAt: Date.now(),
      };

      await browser.storage.local.set({ flow: complexFlow });

      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as {
        flow: Flow;
      };
      expect(call.flow.steps).toHaveLength(5);
      expect(call.flow.steps[0].type).toBe("navigate");
      expect(call.flow.steps[4].type).toBe("extract");
    });
  });
});

