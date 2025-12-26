/**
 * Robust Locator 시스템 테스트
 * generateRobustLocator, findByLocator, 텍스트 기반 매칭 등
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateRobustLocator,
  findByLocator,
  findByRole,
  findByTestId,
  findByCleanText,
  findByPlaceholder,
  findByText,
  isInteractable,
  waitForLocator,
} from "@auto-wiz/dom";
import type { ElementLocator } from "@auto-wiz/core";

describe("generateRobustLocator", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should generate locator with data-testid as primary", () => {
    container.innerHTML = `
      <button data-testid="submit-btn" class="btn-primary">Submit</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    const locator = generateRobustLocator(button);

    expect(locator.primary).toBe('[data-testid="submit-btn"]');
    expect(locator.metadata?.testId).toBe("submit-btn");
    expect(locator.metadata?.tagName).toBe("button");
  });

  it("should use id as high priority selector", () => {
    container.innerHTML = `
      <input id="email-input" type="text" />
    `;

    const input = container.querySelector("input") as HTMLElement;
    const locator = generateRobustLocator(input);

    // testid가 없으면 id가 primary일 수 있음
    expect(locator.primary).toContain("email-input");
  });

  it("should capture aria-label in metadata", () => {
    container.innerHTML = `
      <button aria-label="Close dialog">X</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    const locator = generateRobustLocator(button);

    expect(locator.metadata?.ariaLabel).toBe("Close dialog");
    // aria-label은 primary 또는 fallback 중 하나에 있어야 함
    const allSelectors = [locator.primary, ...locator.fallbacks];
    expect(allSelectors.some(s => s.includes('aria-label="Close dialog"'))).toBe(true);
  });

  it("should capture placeholder in metadata", () => {
    container.innerHTML = `
      <input type="text" placeholder="Enter email" />
    `;

    const input = container.querySelector("input") as HTMLElement;
    const locator = generateRobustLocator(input);

    expect(locator.metadata?.placeholder).toBe("Enter email");
    // placeholder는 primary 또는 fallback 중 하나에 있어야 함
    const allSelectors = [locator.primary, ...locator.fallbacks];
    expect(allSelectors.some(s => s.includes('placeholder="Enter email"'))).toBe(true);
  });

  it("should capture text content", () => {
    container.innerHTML = `
      <button>Click Me</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    const locator = generateRobustLocator(button);

    expect(locator.metadata?.text).toBe("Click Me");
  });

  it("should generate multiple fallback selectors", () => {
    container.innerHTML = `
      <button 
        data-testid="action-btn" 
        aria-label="Perform action" 
        class="btn btn-primary">
        Action
      </button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    const locator = generateRobustLocator(button);

    expect(locator.primary).toBe('[data-testid="action-btn"]');
    expect(locator.fallbacks.length).toBeGreaterThan(0);
    expect(locator.fallbacks).toContain('[aria-label="Perform action"]');
  });

  it("should handle elements with name attribute", () => {
    container.innerHTML = `
      <input type="text" name="username" />
    `;

    const input = container.querySelector("input") as HTMLElement;
    const locator = generateRobustLocator(input);

    // name 속성은 primary 또는 fallback 중 하나에 있어야 함
    const allSelectors = [locator.primary, ...locator.fallbacks];
    expect(allSelectors.some(s => s.includes('name="username"'))).toBe(true);
  });
});

describe("findByLocator", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should find element by primary selector", () => {
    container.innerHTML = `
      <button data-testid="submit">Submit</button>
    `;

    const locator: ElementLocator = {
      primary: '[data-testid="submit"]',
      fallbacks: [],
    };

    const element = findByLocator(locator);
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe("BUTTON");
  });

  it("should fallback to secondary selectors if primary fails", () => {
    container.innerHTML = `
      <button class="submit-btn">Submit</button>
    `;

    const locator: ElementLocator = {
      primary: '[data-testid="submit"]', // 존재하지 않음
      fallbacks: [".submit-btn", "button"],
    };

    const element = findByLocator(locator);
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe("BUTTON");
  });

  it("should use metadata text matching as last resort", () => {
    container.innerHTML = `
      <button>Submit Form</button>
    `;

    const locator: ElementLocator = {
      primary: '[data-testid="nonexistent"]',
      fallbacks: ['[class="nonexistent"]'],
      metadata: {
        text: "Submit Form",
        tagName: "button",
      },
    };

    const element = findByLocator(locator);
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain("Submit Form");
  });

  it("should use testId from metadata if selectors fail", () => {
    container.innerHTML = `
      <button data-testid="action">Action</button>
    `;

    const locator: ElementLocator = {
      primary: ".nonexistent",
      fallbacks: [],
      metadata: {
        testId: "action",
      },
    };

    const element = findByLocator(locator);
    expect(element).not.toBeNull();
    expect(element?.getAttribute("data-testid")).toBe("action");
  });

  it("should prefer visible elements", () => {
    container.innerHTML = `
      <button data-testid="btn" style="display: none;">Hidden</button>
      <button data-testid="btn-visible">Visible</button>
    `;

    // 첫 번째 버튼은 안 보임
    const locator: ElementLocator = {
      primary: '[data-testid="btn"]',
      fallbacks: [],
    };

    // findByLocator는 isVisible 체크를 하므로 보이지 않는 요소는 스킵
    const element = findByLocator(locator);
    // 첫 번째 버튼은 display:none이므로 찾지 못함
    expect(element).toBeNull();
  });
});

describe("findByText", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should find element by exact text", () => {
    container.innerHTML = `
      <button>Submit</button>
      <button>Cancel</button>
    `;

    const elements = findByText("Submit", { exact: true });
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]?.textContent?.trim()).toBe("Submit");
  });

  it("should find element by partial text", () => {
    container.innerHTML = `
      <p>This is a long paragraph with some text</p>
    `;

    const elements = findByText("long paragraph");
    expect(elements.length).toBeGreaterThan(0);
  });

  it("should find with normalized text matching", () => {
    container.innerHTML = `
      <button>   Submit   Form   </button>
    `;

    const elements = findByText("submit form", { normalize: true });
    expect(elements.length).toBeGreaterThan(0);
  });

  it("should filter by role", () => {
    container.innerHTML = `
      <button>Submit</button>
      <a href="#">Submit</a>
    `;

    const buttons = findByText("Submit", { role: "button" });
    expect(buttons.length).toBe(1);
    expect(buttons[0]?.tagName).toBe("BUTTON");
  });
});

describe("findByTestId", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should find element by data-testid", () => {
    container.innerHTML = `
      <button data-testid="submit">Submit</button>
    `;

    const element = findByTestId("submit");
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe("BUTTON");
  });

  it("should support data-test attribute", () => {
    container.innerHTML = `
      <button data-test="action">Action</button>
    `;

    const element = findByTestId("action");
    expect(element).not.toBeNull();
  });

  it("should support data-cy attribute", () => {
    container.innerHTML = `
      <button data-cy="cypress-btn">Cypress</button>
    `;

    const element = findByTestId("cypress-btn");
    expect(element).not.toBeNull();
  });
});

describe("findByPlaceholder", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should find input by exact placeholder", () => {
    container.innerHTML = `
      <input type="text" placeholder="Enter email" />
    `;

    const elements = findByPlaceholder("Enter email", { exact: true });
    expect(elements.length).toBe(1);
    expect(elements[0]?.getAttribute("placeholder")).toBe("Enter email");
  });

  it("should find input by partial placeholder", () => {
    container.innerHTML = `
      <input type="text" placeholder="Enter your email address" />
    `;

    const elements = findByPlaceholder("email");
    expect(elements.length).toBe(1);
  });
});

describe("isInteractable", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should return true for visible, enabled button", () => {
    container.innerHTML = `
      <button>Click me</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    expect(isInteractable(button)).toBe(true);
  });

  it("should return false for disabled button", () => {
    container.innerHTML = `
      <button disabled>Click me</button>
    `;

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(isInteractable(button)).toBe(false);
  });

  it("should return false for hidden element", () => {
    container.innerHTML = `
      <button style="display: none;">Hidden</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    expect(isInteractable(button)).toBe(false);
  });

  it("should return false for element with pointer-events: none", () => {
    container.innerHTML = `
      <button style="pointer-events: none;">Unclickable</button>
    `;

    const button = container.querySelector("button") as HTMLElement;
    expect(isInteractable(button)).toBe(false);
  });
});

describe("waitForLocator", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should wait for element to appear", async () => {
    const locator: ElementLocator = {
      primary: '[data-testid="delayed"]',
      fallbacks: [],
    };

    // 100ms 후에 요소 추가
    setTimeout(() => {
      container.innerHTML = `
        <button data-testid="delayed">Delayed Button</button>
      `;
    }, 100);

    const element = await waitForLocator(locator, { timeout: 1000 });
    expect(element).not.toBeNull();
    expect(element.textContent).toBe("Delayed Button");
  });

  it("should timeout if element doesn't appear", async () => {
    const locator: ElementLocator = {
      primary: '[data-testid="never-appears"]',
      fallbacks: [],
    };

    await expect(
      waitForLocator(locator, { timeout: 100 })
    ).rejects.toThrow(/Timeout/);
  });

  it("should wait for element to become visible", async () => {
    container.innerHTML = `
      <button data-testid="will-show" style="display: none;">Hidden</button>
    `;

    const locator: ElementLocator = {
      primary: '[data-testid="will-show"]',
      fallbacks: [],
    };

    // 100ms 후에 보이게 함
    setTimeout(() => {
      const button = container.querySelector("button") as HTMLElement;
      button.style.display = "block";
    }, 100);

    const element = await waitForLocator(locator, {
      timeout: 1000,
      visible: true,
    });
    expect(element).not.toBeNull();
  });

  it("should wait for element to become interactable", async () => {
    container.innerHTML = `
      <button data-testid="will-enable" disabled>Disabled</button>
    `;

    const locator: ElementLocator = {
      primary: '[data-testid="will-enable"]',
      fallbacks: [],
    };

    // 100ms 후에 활성화
    setTimeout(() => {
      const button = container.querySelector("button") as HTMLButtonElement;
      button.disabled = false;
    }, 100);

    const element = await waitForLocator(locator, {
      timeout: 1000,
      interactable: true,
    });
    expect(element).not.toBeNull();
    expect((element as HTMLButtonElement).disabled).toBe(false);
  });
});

