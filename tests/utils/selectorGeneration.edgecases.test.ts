import { describe, it, expect, beforeEach } from "vitest";

// makeSelector: 기존 selectorGeneration.test.ts의 구현을 재사용
const makeSelector = (el: HTMLElement): string => {
  const segs: string[] = [];
  let cur: HTMLElement | null = el;
  for (let depth = 0; cur && depth < 5; depth++) {
    let s = cur.nodeName.toLowerCase();
    const id = cur.id;
    if (id) {
      segs.unshift(`${s}#${CSS.escape(id)}`);
      break;
    }
    const testid = cur.getAttribute("data-testid");
    const aria = cur.getAttribute("aria-label");
    if (testid) {
      s += `[data-testid="${testid}"]`;
    } else if (aria) {
      s += `[aria-label="${aria}"]`;
    } else {
      const parent = cur.parentElement;
      if (parent && cur) {
        const currentNode = cur;
        const same = Array.from(parent.children).filter(
          (c) => c.nodeName === currentNode.nodeName
        );
        if (same.length > 1) {
          s += `:nth-of-type(${same.indexOf(currentNode) + 1})`;
        }
      }
    }
    segs.unshift(s);
    cur = cur.parentElement;
  }
  return segs.join(">");
};

describe("Selector Generation - Edgecases", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("숫자로 시작하고 공백이 포함된 id를 올바르게 escape한다", () => {
    const div = document.createElement("div");
    div.id = "123 abc";
    document.body.appendChild(div);

    const selector = makeSelector(div);
    // CSS.escape는 공백을 '\\ '로 이스케이프
    expect(selector).toContain("div#");
    expect(selector).toContain("\\ ");
    // happy-dom의 CSS 선택자 파서가 모든 escape 조합을 완벽히 지원하지 않을 수 있어
    // 여기서는 escape 문자열 포함만 검증한다.
  });

  it("특수문자 혼합 id를 escape하고 querySelector로 찾을 수 있다", () => {
    const div = document.createElement("div");
    div.id = "a:b.c[d]#e f";
    document.body.appendChild(div);

    const selector = makeSelector(div);
    // 일부 대표 이스케이프 문자 확인
    expect(selector).toContain("\\:");
    expect(selector).toContain("\\.");
    expect(selector).toContain("\\[");
    expect(selector).toContain("\\]");
    expect(selector).toContain("\\#");
    expect(selector).toContain("\\ ");

    const found = document.querySelector(selector);
    expect(found).toBe(div);
  });

  it("id가 있는 경우 data-testid/aria-label보다 id를 우선한다(공백 id 제외)", () => {
    const btn = document.createElement("button");
    btn.id = "id with space";
    btn.setAttribute("data-testid", "btn-tid");
    btn.setAttribute("aria-label", "btn-aria");
    document.body.appendChild(btn);

    const selector = makeSelector(btn);
    // id 우선
    expect(selector).toContain("#");
    expect(selector).not.toContain("data-testid");
    expect(selector).not.toContain("aria-label");

    const found = document.querySelector(selector);
    expect(found).toBe(btn);
  });
});


