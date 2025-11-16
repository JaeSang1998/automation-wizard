/**
 * CSS Selector 생성 유틸리티
 * 
 * 우선순위:
 * 1. ID
 * 2. data-testid
 * 3. aria-label
 * 4. 구조 기반 (nth-of-type)
 */

/**
 * 단순 selector 생성 (빠른 선택용)
 * ID가 있으면 ID만 사용, 없으면 전체 경로 생성
 */
export function getSimpleSelector(el: Element): string {
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
}

/**
 * 상세한 selector 생성 (안정성 우선)
 * data-testid, aria-label 등 안정적인 속성 우선 사용
 */
export function makeSelector(el: HTMLElement): string {
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
}

/**
 * Selector가 유효한지 검증
 */
export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Selector로 단일 요소 찾기 (안전)
 */
export function querySelector(selector: string): HTMLElement | null {
  try {
    const el = document.querySelector(selector);
    return el instanceof HTMLElement ? el : null;
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Selector로 여러 요소 찾기 (안전)
 */
export function querySelectorAll(selector: string): HTMLElement[] {
  try {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    );
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return [];
  }
}

