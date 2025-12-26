/**
 * Locator 유틸리티 - 고급 요소 검색 기능
 * Playwright/Maestro 스타일의 텍스트 기반, role 기반 매칭
 */

import type { ElementLocator } from "@auto-wiz/core";

/**
 * 텍스트 정규화 (공백, 대소문자 무시)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 요소의 접근 가능한 이름(accessible name) 계산
 * ARIA 명세에 따른 우선순위
 */
function getAccessibleName(element: HTMLElement): string {
  // 1. aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // 2. aria-labelledby
  const labelledby = element.getAttribute("aria-labelledby");
  if (labelledby) {
    const labelEl = document.getElementById(labelledby);
    if (labelEl) return labelEl.textContent?.trim() || "";
  }

  // 3. label 요소 (form controls)
  if (element instanceof HTMLInputElement || 
      element instanceof HTMLTextAreaElement || 
      element instanceof HTMLSelectElement) {
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || "";
    }
    
    // 부모 label
    const parentLabel = element.closest("label");
    if (parentLabel) return parentLabel.textContent?.trim() || "";
  }

  // 4. alt (이미지)
  if (element instanceof HTMLImageElement) {
    return element.alt;
  }

  // 5. placeholder
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder;

  // 6. title
  const title = element.getAttribute("title");
  if (title) return title;

  // 7. 텍스트 내용
  return element.textContent?.trim() || "";
}

/**
 * Role로 요소 찾기 (ARIA role)
 */
export function findByRole(
  role: string,
  options?: {
    name?: string;        // accessible name
    exact?: boolean;      // 정확히 일치
    level?: number;       // heading level (h1=1, h2=2, ...)
  }
): HTMLElement[] {
  const allElements = Array.from(document.querySelectorAll("*"));
  const results: HTMLElement[] = [];

  for (const el of allElements) {
    if (!(el instanceof HTMLElement)) continue;

    // Role 확인
    const explicitRole = el.getAttribute("role");
    const implicitRole = getImplicitRole(el);
    const elementRole = explicitRole || implicitRole;

    if (elementRole !== role) continue;

    // Level 확인 (heading용)
    if (options?.level !== undefined) {
      const tagName = el.tagName.toLowerCase();
      const headingLevel = parseInt(tagName.charAt(1), 10);
      if (headingLevel !== options.level) continue;
    }

    // Name 확인
    if (options?.name !== undefined) {
      const accessibleName = getAccessibleName(el);
      if (options.exact) {
        if (accessibleName !== options.name) continue;
      } else {
        if (!accessibleName.includes(options.name)) continue;
      }
    }

    results.push(el);
  }

  return results;
}

/**
 * 텍스트로 찾기 (공백/대소문자 무시)
 */
export function findByCleanText(text: string): HTMLElement[] {
  return findByText(text, { normalize: true });
}

/**
 * 텍스트로 찾기 (부분 일치)
 */
export function findByFuzzyText(text: string): HTMLElement[] {
  return findByText(text, { exact: false });
}

/**
 * 암시적 ARIA role 추론
 */
function getImplicitRole(element: HTMLElement): string | null {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute("type");

  const roleMap: Record<string, string> = {
    a: element.hasAttribute("href") ? "link" : "",
    button: "button",
    input: type === "text" || !type ? "textbox" : 
           type === "checkbox" ? "checkbox" :
           type === "radio" ? "radio" :
           type === "button" || type === "submit" ? "button" : "",
    textarea: "textbox",
    select: "combobox",
    img: "img",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    nav: "navigation",
    main: "main",
    aside: "complementary",
    header: "banner",
    footer: "contentinfo",
    section: "region",
    article: "article",
    form: "form",
    table: "table",
    ul: "list",
    ol: "list",
    li: "listitem",
  };

  return roleMap[tagName] || null;
}

/**
 * 텍스트로 요소 찾기 (Playwright 스타일)
 */
export function findByText(
  text: string,
  options?: {
    exact?: boolean;      // 정확히 일치
    normalize?: boolean;  // 공백/대소문자 무시
    selector?: string;    // 특정 selector 내에서만 찾기
    role?: string;        // 특정 role만
  }
): HTMLElement[] {
  const container = options?.selector 
    ? document.querySelector(options.selector) 
    : document.body;

  if (!container) return [];

  const allElements = Array.from(container.querySelectorAll("*"));
  const results: HTMLElement[] = [];

  for (const el of allElements) {
    if (!(el instanceof HTMLElement)) continue;

    // Role 필터
    if (options?.role) {
      const elementRole = el.getAttribute("role") || getImplicitRole(el);
      if (elementRole !== options.role) continue;
    }

    // 텍스트 내용 가져오기
    let elementText = getAccessibleName(el);
    if (!elementText) {
      elementText = el.textContent || "";
    }

    // 자식 요소의 텍스트는 제외 (직접 텍스트만)
    if (el.children.length > 0) {
      let directText = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          directText += node.textContent || "";
        }
      }
      if (directText.trim()) {
        elementText = directText;
      }
    }

    // 매칭
    if (options?.normalize) {
      if (normalizeText(elementText) === normalizeText(text)) {
        results.push(el);
      }
    } else if (options?.exact) {
      if (elementText.trim() === text) {
        results.push(el);
      }
    } else {
      if (elementText.includes(text)) {
        results.push(el);
      }
    }
  }

  return results;
}

/**
 * Placeholder로 요소 찾기
 */
export function findByPlaceholder(
  text: string,
  options?: { exact?: boolean }
): HTMLElement[] {
  const selector = options?.exact
    ? `[placeholder="${text}"]`
    : `[placeholder*="${text}"]`;

  return Array.from(document.querySelectorAll(selector)).filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  );
}

/**
 * Label로 요소 찾기 (form inputs)
 */
export function findByLabelText(
  text: string,
  options?: { exact?: boolean }
): HTMLElement[] {
  const labels = Array.from(document.querySelectorAll("label"));
  const results: HTMLElement[] = [];

  for (const label of labels) {
    const labelText = label.textContent?.trim() || "";
    const matches = options?.exact
      ? labelText === text
      : labelText.includes(text);

    if (!matches) continue;

    // label[for] 참조
    const forAttr = label.getAttribute("for");
    if (forAttr) {
      const input = document.getElementById(forAttr);
      if (input instanceof HTMLElement) {
        results.push(input);
      }
    } else {
      // label 내부의 input
      const input = label.querySelector("input, textarea, select");
      if (input instanceof HTMLElement) {
        results.push(input);
      }
    }
  }

  return results;
}

/**
 * TestID로 요소 찾기
 */
export function findByTestId(testId: string): HTMLElement | null {
  const selectors = [
    `[data-testid="${testId}"]`,
    `[data-test="${testId}"]`,
    `[data-cy="${testId}"]`,
    `[data-test-id="${testId}"]`,
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) return el;
  }

  return null;
}

/**
 * ElementLocator로 요소 찾기 (fallback 지원)
 * 
 * Primary selector부터 시도하고, 실패하면 fallback들을 순차적으로 시도
 */
export function findByLocator(locator: ElementLocator): HTMLElement | null {
  // 1. Primary selector 시도
  try {
    const el = document.querySelector(locator.primary);
    if (el instanceof HTMLElement && isVisible(el)) {
      return el;
    }
  } catch (error) {
    console.warn(`Primary selector failed: ${locator.primary}`, error);
  }

  // 2. Fallback selectors 순차 시도
  for (const selector of locator.fallbacks) {
    try {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement && isVisible(el)) {
        return el;
      }
    } catch (error) {
      console.warn(`Fallback selector failed: ${selector}`, error);
    }
  }

  // 3. Metadata 기반 fuzzy matching
  if (!locator.metadata) return null;

  // TestID로 시도
  if (locator.metadata.testId) {
    const el = findByTestId(locator.metadata.testId);
    if (el && isVisible(el)) return el;
  }

  // 텍스트로 시도 (role 필터링)
  if (locator.metadata.text) {
    const elements = findByText(locator.metadata.text, {
      normalize: true,
      role: locator.metadata.role,
    });
    
    // tagName도 일치하는 것 우선
    if (locator.metadata.tagName) {
      const matchingTag = elements.find(
        (el) => el.tagName.toLowerCase() === locator.metadata!.tagName
      );
      if (matchingTag) return matchingTag;
    }

    if (elements.length > 0 && isVisible(elements[0])) {
      return elements[0];
    }
  }

  // Placeholder로 시도
  if (locator.metadata.placeholder) {
    const elements = findByPlaceholder(locator.metadata.placeholder, {
      exact: true,
    });
    if (elements.length > 0 && isVisible(elements[0])) {
      return elements[0];
    }
  }

  // Label로 시도
  if (locator.metadata.ariaLabel) {
    const elements = findByLabelText(locator.metadata.ariaLabel, {
      exact: true,
    });
    if (elements.length > 0 && isVisible(elements[0])) {
      return elements[0];
    }
  }

  return null;
}

/**
 * 요소가 화면에 보이는지 확인
 */
function isVisible(element: HTMLElement): boolean {
  // BODY와 HTML은 항상 visible로 간주
  if (element.tagName === "BODY" || element.tagName === "HTML") {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return false;
  }

  // offsetParent는 happy-dom에서 제대로 동작하지 않을 수 있음
  // 위의 스타일 체크만으로 충분
  return true;
}

/**
 * 요소가 상호작용 가능한지 확인 (enabled + visible)
 */
export function isInteractable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;

  if (element instanceof HTMLInputElement || 
      element instanceof HTMLTextAreaElement || 
      element instanceof HTMLSelectElement || 
      element instanceof HTMLButtonElement) {
    if (element.disabled) return false;
  }

  const style = window.getComputedStyle(element);
  if (style.pointerEvents === "none") return false;

  return true;
}

/**
 * Smart waiting: 요소가 나타날 때까지 대기
 */
export async function waitForLocator(
  locator: ElementLocator,
  options?: {
    timeout?: number;       // 기본 5000ms
    visible?: boolean;      // 보이는 요소만
    interactable?: boolean; // 상호작용 가능한 요소만
  }
): Promise<HTMLElement> {
  const timeout = options?.timeout || 5000;
  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const element = findByLocator(locator);

    if (element) {
      // visible 체크
      if (options?.visible && !isVisible(element)) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      // interactable 체크
      if (options?.interactable && !isInteractable(element)) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      return element;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Timeout waiting for element. Primary selector: ${locator.primary}`
  );
}

