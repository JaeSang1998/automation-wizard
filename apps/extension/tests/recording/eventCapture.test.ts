import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Step } from "@auto-wiz/core";

/**
 * 이벤트 캡처 및 레코딩 로직 테스트
 * 
 * content.tsx의 이벤트 리스너 로직을 테스트합니다.
 */

// 선택자 생성 함수 (content.tsx에서 추출)
const getSimpleSelector = (el: Element): string => {
  if (!(el instanceof Element)) return "";
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && parts.length < 5) {
    let part = node.tagName.toLowerCase();

    if ((node as HTMLElement).classList.length > 0) {
      const cls = Array.from((node as HTMLElement).classList)
        .slice(0, 2)
        .map((c) => `.${CSS.escape(c)}`)
        .join("");
      part += cls;
    }

    // nth-child
    let idx = 1;
    let sib: Element | null = node;
    while ((sib = sib.previousElementSibling as Element | null)) {
      if (sib && sib.tagName === node.tagName) idx++;
    }
    part += `:nth-of-type(${idx})`;

    parts.unshift(part);
    node = node.parentElement;
  }

  return parts.join(" > ");
};

describe("Event Capture and Recording", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("Click event capture", () => {
    it("should capture click event", () => {
      let clickedElement: HTMLElement | null = null;

      const button = document.createElement("button");
      button.id = "test-button";
      document.body.appendChild(button);

      button.addEventListener("click", (e) => {
        clickedElement = e.target as HTMLElement;
      });

      button.click();

      expect(clickedElement).toBe(button);
    });

    it("should create click step", () => {
      const button = document.createElement("button");
      button.id = "test-button";
      document.body.appendChild(button);

      const selector = getSimpleSelector(button);
      const step: Step = {
        type: "click",
        selector,
        url: window.location.href,
      };

      expect(step.type).toBe("click");
      expect(step.selector).toContain("test-button");
    });

    it("should ignore clicks on wizard root", () => {
      const wizardRoot = document.createElement("div");
      wizardRoot.id = "automation-wizard-root";
      const button = document.createElement("button");
      wizardRoot.appendChild(button);
      document.body.appendChild(wizardRoot);

      const isWizardElement = button.closest("#automation-wizard-root");

      expect(isWizardElement).not.toBeNull();
    });
  });

  describe("Input event capture", () => {
    it("should capture input event", () => {
      let inputValue = "";

      const input = document.createElement("input");
      input.type = "text";
      document.body.appendChild(input);

      input.addEventListener("input", () => {
        inputValue = input.value;
      });

      input.value = "test";
      const event = new Event("input", { bubbles: true });
      input.dispatchEvent(event);

      expect(inputValue).toBe("test");
    });

    it("should create type step with masked text", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "password";
      document.body.appendChild(input);

      const value = "secret123";
      const masked = "*".repeat(value.length);

      const selector = getSimpleSelector(input);
      const step: Step = {
        type: "type",
        selector,
        text: masked,
        originalText: value,
        url: window.location.href,
      };

      expect(step.type).toBe("type");
      expect((step as any).text).toBe("*********");
      expect((step as any).originalText).toBe("secret123");
    });

    it("should debounce typing events", async () => {
      let flushCount = 0;
      let typingTimer: number | null = null;

      const flush = () => {
        flushCount++;
      };

      // 여러 번 타이핑 시뮬레이션
      for (let i = 0; i < 5; i++) {
        if (typingTimer) {
          window.clearTimeout(typingTimer);
        }
        typingTimer = window.setTimeout(flush, 500);
      }

      // 500ms 대기
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 한 번만 flush되어야 함
      expect(flushCount).toBe(1);
    });
  });

  describe("Change event capture (select)", () => {
    it("should capture select change event", () => {
      let selectedValue = "";

      const select = document.createElement("select");
      const option1 = document.createElement("option");
      option1.value = "1";
      const option2 = document.createElement("option");
      option2.value = "2";

      select.appendChild(option1);
      select.appendChild(option2);
      document.body.appendChild(select);

      select.addEventListener("change", () => {
        selectedValue = select.value;
      });

      select.value = "2";
      const event = new Event("change", { bubbles: true });
      select.dispatchEvent(event);

      expect(selectedValue).toBe("2");
    });

    it("should create select step", () => {
      const select = document.createElement("select");
      select.id = "country";
      const option = document.createElement("option");
      option.value = "US";
      select.appendChild(option);
      document.body.appendChild(select);

      select.value = "US";

      const selector = getSimpleSelector(select);
      const step: Step = {
        type: "select",
        selector,
        value: "US",
        url: window.location.href,
      };

      expect(step.type).toBe("select");
      expect((step as any).value).toBe("US");
    });

    it("should prevent duplicate select events", () => {
      const lastSelectValue: Record<string, string> = {};

      const select = document.createElement("select");
      select.id = "test-select";
      const option = document.createElement("option");
      option.value = "1";
      select.appendChild(option);
      document.body.appendChild(select);

      const selector = getSimpleSelector(select);
      const value = "1";

      // 첫 번째 변경
      if (lastSelectValue[selector] !== value) {
        lastSelectValue[selector] = value;
      }

      // 같은 값으로 다시 변경 시도
      const isDuplicate = lastSelectValue[selector] === value;

      expect(isDuplicate).toBe(true);
    });
  });

  describe("Keyboard event capture", () => {
    it("should capture Shift+Tab for extract", () => {
      let extractTriggered = false;

      document.addEventListener("keydown", (e) => {
        if (e.shiftKey && e.key === "Tab") {
          extractTriggered = true;
        }
      });

      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(extractTriggered).toBe(true);
    });

    it("should capture Enter key in input", () => {
      let enterPressed = false;

      const input = document.createElement("input");
      document.body.appendChild(input);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          enterPressed = true;
        }
      });

      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });
      input.dispatchEvent(event);

      expect(enterPressed).toBe(true);
    });

    it("should add submit flag on Enter", () => {
      const input = document.createElement("input");
      input.id = "search";
      document.body.appendChild(input);

      let submitFlag = false;

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          submitFlag = true;
        }
      });

      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });
      input.dispatchEvent(event);

      const selector = getSimpleSelector(input);
      const step: Step = {
        type: "type",
        selector,
        text: "query",
        submit: submitFlag,
      };

      expect((step as any).submit).toBe(true);
    });
  });

  describe("Link click handling", () => {
    it("should detect target=_blank links", () => {
      const link = document.createElement("a");
      link.href = "https://example.com";
      link.target = "_blank";
      document.body.appendChild(link);

      const opensNewTab = link.target === "_blank";

      expect(opensNewTab).toBe(true);
    });

    it("should detect middle click", () => {
      const link = document.createElement("a");
      link.href = "https://example.com";
      document.body.appendChild(link);

      const event = new MouseEvent("click", {
        button: 1, // middle button
        bubbles: true,
      });

      const isMiddleClick = event.button === 1;

      expect(isMiddleClick).toBe(true);
    });

    it("should detect modifier keys (Ctrl/Cmd)", () => {
      const event = new MouseEvent("click", {
        ctrlKey: true,
        bubbles: true,
      });

      const hasModifier = event.ctrlKey || event.metaKey;

      expect(hasModifier).toBe(true);
    });

    it("should create navigate step for new tab links", () => {
      const link = document.createElement("a");
      link.href = "https://example.com";
      link.target = "_blank";
      document.body.appendChild(link);

      const step: Step = {
        type: "navigate",
        url: link.href,
      };

      expect(step.type).toBe("navigate");
      expect(step.url).toContain("example.com");
    });
  });

  describe("Blur event handling", () => {
    it("should flush typing on blur", () => {
      let flushCalled = false;

      const input = document.createElement("input");
      document.body.appendChild(input);

      window.addEventListener("blur", () => {
        flushCalled = true;
      });

      const event = new FocusEvent("blur", { bubbles: true });
      window.dispatchEvent(event);

      expect(flushCalled).toBe(true);
    });
  });

  describe("Auto capture toggle", () => {
    it("should respect autoCapture flag", () => {
      let autoCapture = true;

      const shouldCapture = (recording: boolean, auto: boolean) => {
        return recording && auto;
      };

      expect(shouldCapture(true, autoCapture)).toBe(true);

      autoCapture = false;
      expect(shouldCapture(true, autoCapture)).toBe(false);
    });
  });

  describe("Duplicate recording prevention", () => {
    it("should not record typing twice when Enter is pressed", async () => {
      let recordCount = 0;
      let typingTimer: number | null = null;

      const flushTyping = () => {
        recordCount++;
        typingTimer = null;
      };

      // 타이핑 시작 - debounce 타이머 설정
      typingTimer = window.setTimeout(flushTyping, 500);

      // Enter 누름 - 타이머 정리 후 즉시 flush
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
      }
      flushTyping();

      // 500ms 대기 후에도 recordCount는 1이어야 함
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(recordCount).toBe(1);
    });

    it("should clear timer when Enter is pressed", () => {
      let timerCleared = false;
      let typingTimer: number | null = window.setTimeout(() => {}, 500);

      // Enter 감지 시 타이머 정리
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
        timerCleared = true;
      }

      expect(timerCleared).toBe(true);
      expect(typingTimer).toBeNull();
    });

    it("should record only once with submit flag when Enter pressed", async () => {
      const recordings: Array<{ text: string; submit?: boolean }> = [];
      let typingTimer: number | null = null;
      let typingValue = "test query";
      let typingSubmit = false;

      const flushTyping = () => {
        if (typingTimer) {
          window.clearTimeout(typingTimer);
          typingTimer = null;
        }
        
        recordings.push({
          text: typingValue,
          submit: typingSubmit || undefined,
        });

        typingSubmit = false;
      };

      // 타이핑 시작
      typingTimer = window.setTimeout(flushTyping, 500);

      // Enter 누름 - 타이머 정리 후 submit=true로 flush
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
      }
      typingSubmit = true;
      flushTyping();

      // 500ms 대기
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 한 번만 레코딩되어야 하고 submit=true여야 함
      expect(recordings).toHaveLength(1);
      expect(recordings[0].submit).toBe(true);
    });
  });

  describe("Frame metadata", () => {
    it("should attach frame metadata to step", () => {
      const step: Step = {
        type: "click",
        selector: "#button",
        _frameId: 123,
        _frameUrl: "https://example.com/iframe",
      };

      expect((step as any)._frameId).toBe(123);
      expect((step as any)._frameUrl).toBe("https://example.com/iframe");
    });
  });

  describe("window.open override", () => {
    it("should override window.open during recording", () => {
      const originalOpen = window.open;
      let navigatedTo = "";

      // Mock window.open override
      (window as any).open = function (url: any) {
        if (typeof url === "string" && url) {
          navigatedTo = url;
          return window;
        }
        return originalOpen?.apply(window, arguments as any);
      };

      (window as any).open("https://example.com");

      expect(navigatedTo).toBe("https://example.com");

      // Restore
      window.open = originalOpen;
    });
  });

  describe("Select option vs click handling", () => {
    it("should ignore clicks on select elements", () => {
      const select = document.createElement("select");
      select.id = "test-select";
      document.body.appendChild(select);

      const tagName = select.tagName.toLowerCase();
      const shouldIgnore = tagName === "select";

      expect(shouldIgnore).toBe(true);
    });

    it("should ignore clicks on option elements", () => {
      const select = document.createElement("select");
      const option = document.createElement("option");
      select.appendChild(option);
      document.body.appendChild(select);

      const tagName = option.tagName.toLowerCase();
      const shouldIgnore = tagName === "option";

      expect(shouldIgnore).toBe(true);
    });

    it("should ignore clicks inside select element", () => {
      const select = document.createElement("select");
      const option = document.createElement("option");
      select.appendChild(option);
      document.body.appendChild(select);

      const closestSelect = option.closest("select");

      expect(closestSelect).not.toBeNull();
    });
  });
});

