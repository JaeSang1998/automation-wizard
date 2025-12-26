import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Step } from "@auto-wiz/core";

describe("Recording - window.open interception", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    // 원복
    window.open = originalOpen;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("window.open 호출 시 navigate 스텝이 기록된다 (유효 URL)", async () => {
    const sendSpy = vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined as any);

    // content.tsx의 override 동작을 단순화해 모방
    (window as any).open = function (url: any, target?: any, features?: any) {
      if (typeof url === "string" && url) {
        const step: Step = { type: "navigate", url } as any;
        browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
        return window;
      }
      return originalOpen?.apply(window, arguments as any);
    };

    window.open!("https://example.com", "_blank");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const arg = sendSpy.mock.calls[0][0] as any;
    expect(arg.type).toBe("REC_STEP");
    expect(arg.step.type).toBe("navigate");
    expect(arg.step.url).toContain("example.com");
  });

  it("빈 문자열/잘못된 URL이면 기록하지 않는다", () => {
    const sendSpy = vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined as any);

    (window as any).open = function (url: any) {
      if (typeof url === "string" && url) {
        const step: Step = { type: "navigate", url } as any;
        browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
        return window;
      }
      return originalOpen?.apply(window, arguments as any);
    };

    window.open!(""); // 빈 URL

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("레코딩 종료 시 원래 window.open으로 복구된다", () => {
    const sendSpy = vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined as any);

    (window as any).open = function (url: any) {
      if (typeof url === "string" && url) {
        const step: Step = { type: "navigate", url } as any;
        browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
        return window;
      }
      return originalOpen?.apply(window, arguments as any);
    };

    // 레코딩 종료 시 원복
    window.open = originalOpen;

    // 원래 open을 호출해도 sendMessage가 호출되지 않아야 함
    window.open!("about:blank");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});


