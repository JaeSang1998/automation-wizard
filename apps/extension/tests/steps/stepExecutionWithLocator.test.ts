/**
 * Step Execution with Locator 통합 테스트
 * 실제 step 실행에서 locator 시스템이 올바르게 동작하는지 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  executeStep,
  executeClickStep,
  executeTypeStep,
  executeSelectStep,
  executeExtractStep,
  executeWaitForStep,
  generateRobustLocator,
} from "@auto-wiz/dom";
import { Step } from "@auto-wiz/core";

describe("Step Execution with Locator Integration", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("executeClickStep with locator", () => {
    it("should execute click using primary selector", async () => {
      let clicked = false;
      container.innerHTML = `
        <button data-testid="click-btn" onclick="this.clicked = true">Click Me</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      button.addEventListener("click", () => {
        clicked = true;
      });

      const locator = generateRobustLocator(button);
      const step: Step = {
        type: "click",
        selector: locator.primary,
        locator,
      };

      const result = await executeClickStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it("should fallback when primary selector fails", async () => {
      let clicked = false;
      container.innerHTML = `
        <button class="action-btn">Action</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      button.addEventListener("click", () => {
        clicked = true;
      });

      const step: Step = {
        type: "click",
        selector: "[data-testid='nonexistent']", // 존재하지 않는 primary
        locator: {
          primary: "[data-testid='nonexistent']",
          fallbacks: [".action-btn", "button"],
          metadata: {
            tagName: "button",
          },
        },
      };

      const result = await executeClickStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
      expect(result.usedSelector).toBe("[data-testid='nonexistent']"); // primary selector used in locator
    });

    it("should fail when element is not interactable", async () => {
      container.innerHTML = `
        <button data-testid="disabled-btn" disabled>Disabled</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      const step: Step = {
        type: "click",
        selector: locator.primary,
        locator,
      };

      const result = await executeClickStep(step);

      // waitForLocator가 interactable 체크를 하므로 타임아웃될 수 있음
      // 또는 찾았지만 interactable 체크에서 실패
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 10000); // timeout 증가
  });

  describe("executeTypeStep with locator", () => {
    it("should type into input using locator", async () => {
      container.innerHTML = `
        <input type="text" data-testid="username" placeholder="Username" />
      `;

      const input = container.querySelector("input") as HTMLInputElement;
      const locator = generateRobustLocator(input);

      const step: Step = {
        type: "type",
        selector: locator.primary,
        locator,
        text: "***",
        originalText: "john",
      };

      const result = await executeTypeStep(step);

      expect(result.success).toBe(true);
      expect(input.value).toBe("john");
    });

    it("should fallback to placeholder selector", async () => {
      container.innerHTML = `
        <input type="text" placeholder="Enter email" />
      `;

      const input = container.querySelector("input") as HTMLInputElement;

      const step: Step = {
        type: "type",
        selector: "[data-testid='nonexistent']",
        locator: {
          primary: "[data-testid='nonexistent']",
          fallbacks: ['input[placeholder="Enter email"]', "input"],
          metadata: {
            placeholder: "Enter email",
            tagName: "input",
          },
        },
        text: "test@example.com",
      };

      const result = await executeTypeStep(step);

      expect(result.success).toBe(true);
      expect(input.value).toBe("test@example.com");
    });

    it("should handle submit flag", async () => {
      let formSubmitted = false;

      container.innerHTML = `
        <form id="test-form">
          <input type="text" data-testid="search" />
        </form>
      `;

      const form = container.querySelector("form") as HTMLFormElement;
      form.onsubmit = (e) => {
        e.preventDefault();
        formSubmitted = true;
      };

      const input = container.querySelector("input") as HTMLInputElement;
      const locator = generateRobustLocator(input);

      const step: Step = {
        type: "type",
        selector: locator.primary,
        locator,
        text: "search query",
        submit: true,
      };

      const result = await executeTypeStep(step);

      expect(result.success).toBe(true);
      expect(input.value).toBe("search query");
      expect(formSubmitted).toBe(true);
    });
  });

  describe("executeSelectStep with locator", () => {
    it("should select option using locator", async () => {
      container.innerHTML = `
        <select data-testid="country">
          <option value="us">United States</option>
          <option value="kr">Korea</option>
          <option value="jp">Japan</option>
        </select>
      `;

      const select = container.querySelector("select") as HTMLSelectElement;
      const locator = generateRobustLocator(select);

      const step: Step = {
        type: "select",
        selector: locator.primary,
        locator,
        value: "kr",
      };

      const result = await executeSelectStep(step);

      expect(result.success).toBe(true);
      expect(select.value).toBe("kr");
    });

    it("should fallback when primary fails", async () => {
      container.innerHTML = `
        <select name="language">
          <option value="en">English</option>
          <option value="ko">Korean</option>
        </select>
      `;

      const select = container.querySelector("select") as HTMLSelectElement;

      const step: Step = {
        type: "select",
        selector: "[data-testid='nonexistent']",
        locator: {
          primary: "[data-testid='nonexistent']",
          fallbacks: ['select[name="language"]', "select"],
          metadata: {
            tagName: "select",
          },
        },
        value: "ko",
      };

      const result = await executeSelectStep(step);

      expect(result.success).toBe(true);
      expect(select.value).toBe("ko");
    });
  });

  describe("executeExtractStep with locator", () => {
    it("should extract text using locator", async () => {
      container.innerHTML = `
        <div data-testid="result">Success!</div>
      `;

      const div = container.querySelector("div") as HTMLElement;
      const locator = generateRobustLocator(div);

      const step: Step = {
        type: "extract",
        selector: locator.primary,
        locator,
      };

      const result = await executeExtractStep(step);

      expect(result.success).toBe(true);
      expect(result.extractedData).toBe("Success!");
    });

    it("should extract value from input", async () => {
      container.innerHTML = `
        <input type="text" data-testid="output" value="42" />
      `;

      const input = container.querySelector("input") as HTMLElement;
      const locator = generateRobustLocator(input);

      const step: Step = {
        type: "extract",
        selector: locator.primary,
        locator,
        prop: "value",
      };

      const result = await executeExtractStep(step);

      expect(result.success).toBe(true);
      expect(result.extractedData).toBe("42");
    });

    it("should use text metadata for fuzzy matching", async () => {
      container.innerHTML = `
        <div>Expected Result Text</div>
      `;

      const step: Step = {
        type: "extract",
        selector: "[data-testid='nonexistent']",
        locator: {
          primary: "[data-testid='nonexistent']",
          fallbacks: [],
          metadata: {
            text: "Expected Result Text",
            tagName: "div",
          },
        },
      };

      const result = await executeExtractStep(step);

      expect(result.success).toBe(true);
      expect(result.extractedData).toContain("Expected Result");
    });
  });

  describe("executeWaitForStep with locator", () => {
    it("should wait for element to appear", async () => {
      const step: Step = {
        type: "waitFor",
        selector: "[data-testid='delayed']",
        locator: {
          primary: "[data-testid='delayed']",
          fallbacks: [],
        },
        timeoutMs: 1000,
      };

      // 100ms 후에 요소 추가
      setTimeout(() => {
        container.innerHTML = `
          <div data-testid="delayed">Delayed Content</div>
        `;
      }, 100);

      const result = await executeWaitForStep(step);

      expect(result.success).toBe(true);
    });

    it("should timeout if element doesn't appear", async () => {
      const step: Step = {
        type: "waitFor",
        selector: "[data-testid='never-appears']",
        locator: {
          primary: "[data-testid='never-appears']",
          fallbacks: [],
        },
        timeoutMs: 100,
      };

      const result = await executeWaitForStep(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Timeout");
    });
  });

  describe("Backward compatibility", () => {
    it("should work with selector only (no locator)", async () => {
      let clicked = false;
      container.innerHTML = `
        <button id="old-style">Old Style</button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      button.addEventListener("click", () => {
        clicked = true;
      });

      const step: Step = {
        type: "click",
        selector: "#old-style",
        // locator 없음 (하위 호환성)
      };

      const result = await executeClickStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle nested elements", async () => {
      container.innerHTML = `
        <div class="container">
          <div class="wrapper">
            <button data-testid="nested-btn">Nested Button</button>
          </div>
        </div>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);
      let clicked = false;

      button.addEventListener("click", () => {
        clicked = true;
      });

      const step: Step = {
        type: "click",
        selector: locator.primary,
        locator,
      };

      const result = await executeClickStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it("should handle elements with dynamic classes", async () => {
      container.innerHTML = `
        <button 
          class="btn btn-primary btn-12345-random" 
          data-testid="dynamic">
          Dynamic Classes
        </button>
      `;

      const button = container.querySelector("button") as HTMLElement;
      const locator = generateRobustLocator(button);

      // data-testid가 primary여야 함 (stable)
      expect(locator.primary).toBe('[data-testid="dynamic"]');

      let clicked = false;
      button.addEventListener("click", () => {
        clicked = true;
      });

      const step: Step = {
        type: "click",
        selector: locator.primary,
        locator,
      };

      const result = await executeClickStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it("should handle form with multiple inputs", async () => {
      container.innerHTML = `
        <form>
          <input type="text" name="username" placeholder="Username" />
          <input type="password" name="password" placeholder="Password" />
          <button type="submit" data-testid="submit">Submit</button>
        </form>
      `;

      const usernameInput = container.querySelector(
        'input[name="username"]'
      ) as HTMLInputElement;
      const passwordInput = container.querySelector(
        'input[name="password"]'
      ) as HTMLInputElement;

      const usernameLoc = generateRobustLocator(usernameInput);
      const passwordLoc = generateRobustLocator(passwordInput);

      // Username 입력
      await executeTypeStep({
        type: "type",
        selector: usernameLoc.primary,
        locator: usernameLoc,
        text: "john",
      });

      // Password 입력
      await executeTypeStep({
        type: "type",
        selector: passwordLoc.primary,
        locator: passwordLoc,
        text: "secret",
      });

      expect(usernameInput.value).toBe("john");
      expect(passwordInput.value).toBe("secret");
    });
  });
});
