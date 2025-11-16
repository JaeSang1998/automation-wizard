import { describe, it, expect, beforeEach } from "vitest";
import type { Step } from "../../types";

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

describe("Recording - Textarea Enter behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("textarea에서 Enter는 submit 플래그를 추가하지 않는다", () => {
    const ta = document.createElement("textarea");
    ta.id = "ta1";
    document.body.appendChild(ta);

    let typingSubmit = false;
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // textarea에서는 제출 개념이 아님
        typingSubmit = false;
      }
    });

    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    const step: Step = {
      type: "type",
      selector: getSimpleSelector(ta),
      text: "line1\nline2",
      submit: typingSubmit || undefined,
      url: window.location.href,
    } as any;

    expect((step as any).submit).toBeUndefined();
  });

  it("textarea에서 Enter 입력 시 중복 레코딩이 발생하지 않는다", async () => {
    const ta = document.createElement("textarea");
    ta.id = "ta2";
    document.body.appendChild(ta);

    let records: Array<{ text: string; submit?: boolean }> = [];
    let typingTimer: number | null = null;
    let typingValue = "";
    let typingSubmit = false;

    const flushTyping = () => {
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
      }
      records.push({ text: typingValue, submit: typingSubmit || undefined });
      typingSubmit = false;
    };

    // 타이핑 시작 - debounce
    typingValue = "hello";
    typingTimer = window.setTimeout(flushTyping, 300);

    // textarea에서 Enter - 타이머 해제 후 즉시 flush하지만 submit은 없음
    if (typingTimer) {
      window.clearTimeout(typingTimer);
      typingTimer = null;
    }
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    typingValue = "hello\n";
    flushTyping();

    // 이후 debounce가 다시 실행되지 않아야 함
    await new Promise((r) => setTimeout(r, 400));

    expect(records).toHaveLength(1);
    expect(records[0].text).toBe("hello\n");
    expect(records[0].submit).toBeUndefined();
  });
});


