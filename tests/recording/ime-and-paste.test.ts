import { describe, it, expect, beforeEach } from "vitest";
import type { Step } from "../../types";

// 간단 셀렉터 (기존 테스트와 동일 패턴)
const getSimpleSelector = (el: Element): string => {
  if (!(el instanceof Element)) return "";
  if ((el as HTMLElement).id) return `#${CSS.escape((el as HTMLElement).id)}`;
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

describe("Recording - IME & Paste handling", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("IME 조합 입력", () => {
    it("composition 중 Enter는 submit으로 간주되지 않는다", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "ime-input";
      document.body.appendChild(input);

      let composing = false;
      let typingSubmit = false;

      // composition 이벤트 시뮬레이션
      input.addEventListener("compositionstart", () => {
        composing = true;
      });
      input.addEventListener("compositionend", () => {
        composing = false;
      });

      // Enter 처리 로직 시뮬레이션
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (!composing) {
            typingSubmit = true;
          }
        }
      });

      // 조합 시작
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      // 조합 중 Enter
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      // 조합 종료
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));

      const selector = getSimpleSelector(input);
      const step: Step = {
        type: "type",
        selector,
        text: "한",
        submit: typingSubmit || undefined,
        url: window.location.href,
      } as any;

      expect((step as any).submit).toBeUndefined();
    });

    it("compositionend 이후 Enter는 submit으로 설정된다", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "ime-input-2";
      document.body.appendChild(input);

      let composing = false;
      let typingSubmit = false;

      input.addEventListener("compositionstart", () => (composing = true));
      input.addEventListener("compositionend", () => (composing = false));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !composing) typingSubmit = true;
      });

      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      const selector = getSimpleSelector(input);
      const step: Step = {
        type: "type",
        selector,
        text: "테스트",
        submit: typingSubmit || undefined,
        url: window.location.href,
      } as any;

      expect((step as any).submit).toBe(true);
    });
  });

  describe("Paste 이벤트", () => {
    it("paste는 단일 type step으로 디바운스되어야 한다", async () => {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "paste-input";
      document.body.appendChild(input);

      let recordings: Array<{ text: string }> = [];
      let typingTimer: number | null = null;
      let typingValue = "";

      const flushTyping = () => {
        if (typingTimer) {
          window.clearTimeout(typingTimer);
          typingTimer = null;
        }
        recordings.push({ text: typingValue });
      };

      // paste 이벤트 → input 이벤트 (브라우저 동작과 유사하게 2회 연속 발생 가정)
      const handleInput = () => {
        typingValue = input.value;
        if (typingTimer) window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(flushTyping, 300);
      };

      input.addEventListener("input", handleInput);

      // 첫 번째 paste: 값 변경 및 input 발생
      input.value = "Hello ";
      input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));

      // 곧바로 두 번째 paste: 값 변경 및 input 발생
      input.value = "Hello World";
      input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));

      // 디바운스 대기
      await new Promise((r) => setTimeout(r, 400));

      // 한 번만 기록되어야 하며 마지막 값이어야 함
      expect(recordings).toHaveLength(1);
      expect(recordings[0].text).toBe("Hello World");
    });
  });
});


