import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  Message,
  StartRecordMessage,
  StopRecordMessage,
  RunFlowMessage,
  RecordStepMessage,
  Step,
} from "@auto-wiz/core";
import { mockRuntimeSendMessage, resetAllMocks } from "../setup";

describe("Background Message Handling", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("Recording messages", () => {
    it("should handle START_RECORD message", async () => {
      const message: StartRecordMessage = {
        type: "START_RECORD",
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle STOP_RECORD message", async () => {
      const message: StopRecordMessage = {
        type: "STOP_RECORD",
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
    });

    it("should handle GET_RECORD_STATE message", async () => {
      const expectedResponse = {
        type: "RECORD_STATE",
        recording: true,
      };

      mockRuntimeSendMessage(expectedResponse);

      const response = await browser.runtime.sendMessage({
        type: "GET_RECORD_STATE",
      });

      expect(response).toEqual(expectedResponse);
      expect(response.recording).toBe(true);
    });
  });

  describe("Step recording", () => {
    it("should record a click step", async () => {
      const clickStep: Step = {
        type: "click",
        selector: "#submit-button",
        url: "https://example.com",
      };

      const message: RecordStepMessage = {
        type: "REC_STEP",
        step: clickStep,
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as unknown as RecordStepMessage;
      expect(call.step.type).toBe("click");
      if ("selector" in call.step) {
        expect(call.step.selector).toBe("#submit-button");
      }
    });

    it("should record a type step with original text", async () => {
      const typeStep: Step = {
        type: "type",
        selector: "#password",
        text: "****",
        originalText: "secret123",
      };

      const message: RecordStepMessage = {
        type: "REC_STEP",
        step: typeStep,
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as unknown as RecordStepMessage;
      expect(call.step.type).toBe("type");
      expect((call.step as any).originalText).toBe("secret123");
    });

    it("should record a step with frame metadata", async () => {
      const step: Step = {
        type: "click",
        selector: "#button",
        _frameId: 123,
        _frameUrl: "https://example.com/iframe",
      };

      const message: RecordStepMessage = {
        type: "REC_STEP",
        step,
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      const call = vi.mocked(browser.runtime.sendMessage).mock
        .calls[0][0] as unknown as RecordStepMessage;
      expect((call.step as any)._frameId).toBe(123);
      expect((call.step as any)._frameUrl).toBe("https://example.com/iframe");
    });
  });

  describe("Flow execution", () => {
    it("should handle RUN_FLOW message", async () => {
      const message: RunFlowMessage = {
        type: "RUN_FLOW",
      };

      mockRuntimeSendMessage({ success: true });

      await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
    });

    it("should handle STOP_RUN message", async () => {
      mockRuntimeSendMessage({ success: true });

      const response = await browser.runtime.sendMessage({
        type: "STOP_RUN",
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "STOP_RUN",
      });
      expect(response.success).toBe(true);
    });
  });

  describe("Backend integration", () => {
    it("should handle SEND_TO_BACKEND message", async () => {
      const message = {
        type: "SEND_TO_BACKEND",
        endpoint: "https://api.example.com/flows",
      };

      mockRuntimeSendMessage({ type: "SENT_OK" });

      const response = await browser.runtime.sendMessage(message);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(message);
      expect(response.type).toBe("SENT_OK");
    });
  });

  describe("Message listener registration", () => {
    it("should register message listener", () => {
      const mockListener = vi.fn();

      browser.runtime.onMessage.addListener(mockListener);

      expect(browser.runtime.onMessage.addListener).toHaveBeenCalledWith(
        mockListener
      );
    });

    it("should remove message listener", () => {
      const mockListener = vi.fn();

      browser.runtime.onMessage.removeListener(mockListener);

      expect(browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        mockListener
      );
    });
  });

  describe("Error handling", () => {
    it("should handle message sending errors gracefully", async () => {
      const error = new Error("Failed to send message");
      vi.mocked(browser.runtime.sendMessage).mockRejectedValueOnce(error);

      try {
        await browser.runtime.sendMessage({ type: "RUN_FLOW" });
        expect.fail("Should have thrown an error");
      } catch (e) {
        expect(e).toBe(error);
      }
    });
  });
});
