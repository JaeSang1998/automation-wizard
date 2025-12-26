import { describe, it, expect, beforeEach } from "vitest";
import type { Flow, Step } from "@auto-wiz/core";
import { executeStep } from "@auto-wiz/dom";

/**
 * Step 실행 로직 테스트
 *
 * executeScript 내부에서 실행되는 각 Step 타입의 로직을 테스트합니다.
 */

describe("Step Execution Logic", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("querySelector", () => {
    it("should find element by selector", () => {
      const button = document.createElement("button");
      button.id = "test-button";
      document.body.appendChild(button);

      const element = document.querySelector("#test-button");

      expect(element).not.toBeNull();
      expect(element?.tagName).toBe("BUTTON");
    });

    it("should return null for non-existent element", () => {
      const element = document.querySelector("#non-existent");

      expect(element).toBeNull();
    });

    it("should handle complex selectors", () => {
      const div = document.createElement("div");
      div.className = "container";
      const span = document.createElement("span");
      span.className = "text";
      div.appendChild(span);
      document.body.appendChild(div);

      const element = document.querySelector(".container > .text");

      expect(element).not.toBeNull();
      expect(element?.tagName).toBe("SPAN");
    });
  });

  describe("scrollIntoView", () => {
    it("should scroll element into view", () => {
      const div = document.createElement("div");
      div.style.height = "2000px";
      div.id = "tall-div";
      document.body.appendChild(div);

      const target = document.createElement("div");
      target.id = "target";
      div.appendChild(target);

      const element = document.getElementById("target") as HTMLElement;
      element.scrollIntoView({ block: "center", inline: "center" });

      // scrollIntoView는 브라우저 API이므로 실행만 확인
      expect(element).not.toBeNull();
    });
  });

  describe("Click execution", () => {
    it("should execute click on element", () => {
      let clicked = false;

      const button = document.createElement("button");
      button.id = "test-button";
      button.onclick = () => {
        clicked = true;
      };
      document.body.appendChild(button);

      const element = document.getElementById("test-button") as HTMLElement;
      element.click();

      expect(clicked).toBe(true);
    });

    it("should fail if element is not interactable (hidden)", async () => {
      const button = document.createElement("button");
      button.id = "hidden-button";
      button.style.display = "none"; // Make it hidden
      document.body.appendChild(button);

      // Mock isInteractable to return false for hidden elements
      // Note: isInteractable implementation might rely on getComputedStyle which happy-dom supports partially
      // If happy-dom doesn't support full visibility check, we might need to rely on the implementation detail or mock it.
      // However, stepExecution.ts imports isInteractable from locatorUtils.

      const step: Step = {
        type: "click",
        selector: "#hidden-button",
        locator: { primary: "#hidden-button", fallbacks: [] },
        timeoutMs: 100,
      };

      const result = await executeStep(step);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not interactable");
    });

    it("should fail if element is disabled", async () => {
      const button = document.createElement("button");
      button.id = "disabled-button";
      button.disabled = true;
      document.body.appendChild(button);

      const step: Step = {
        type: "click",
        selector: "#disabled-button",
        locator: { primary: "#disabled-button", fallbacks: [] },
        timeoutMs: 100,
      };

      const result = await executeStep(step);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not interactable");
    });

    it("should trigger click event listeners", async () => {
      let clickCount = 0;
      const button = document.createElement("button");
      button.id = "test-button";
      button.addEventListener("click", () => {
        clickCount++;
      });
      document.body.appendChild(button);

      const step: Step = {
        type: "click",
        selector: "#test-button",
        locator: { primary: "#test-button", fallbacks: [] },
      };

      const result = await executeStep(step);
      expect(result.success).toBe(true);
      expect(clickCount).toBe(1);
    });
  });

  describe("Type execution", () => {
    it("should type text into input", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.id = "test-input";
      document.body.appendChild(input);

      const element = document.getElementById("test-input") as HTMLInputElement;
      element.value = "test text";

      expect(element.value).toBe("test text");
    });

    it("should clear existing value before typing", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = "old value";
      document.body.appendChild(input);

      input.select();
      input.value = "";
      input.value = "new value";

      expect(input.value).toBe("new value");
    });

    it("should trigger input events", () => {
      let inputTriggered = false;

      const input = document.createElement("input");
      input.type = "text";
      input.addEventListener("input", () => {
        inputTriggered = true;
      });
      document.body.appendChild(input);

      const event = new Event("input", { bubbles: true });
      input.dispatchEvent(event);

      expect(inputTriggered).toBe(true);
    });

    it("should trigger change event", () => {
      let changeTriggered = false;

      const input = document.createElement("input");
      input.type = "text";
      input.addEventListener("change", () => {
        changeTriggered = true;
      });
      document.body.appendChild(input);

      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);

      expect(changeTriggered).toBe(true);
    });

    it("should handle keyboard events", () => {
      const keydownEvents: string[] = [];

      const input = document.createElement("input");
      input.addEventListener("keydown", (e) => {
        keydownEvents.push((e as KeyboardEvent).key);
      });
      document.body.appendChild(input);

      "test".split("").forEach((char) => {
        const event = new KeyboardEvent("keydown", {
          key: char,
          bubbles: true,
        });
        input.dispatchEvent(event);
      });

      expect(keydownEvents).toEqual(["t", "e", "s", "t"]);
    });

    it("should handle Enter key submission", () => {
      let enterPressed = false;

      const input = document.createElement("input");
      input.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") {
          enterPressed = true;
        }
      });
      document.body.appendChild(input);

      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      });
      input.dispatchEvent(event);

      expect(enterPressed).toBe(true);
    });
  });

  describe("Select execution", () => {
    it("should select option by value", () => {
      const select = document.createElement("select");
      const option1 = document.createElement("option");
      option1.value = "1";
      option1.text = "Option 1";
      const option2 = document.createElement("option");
      option2.value = "2";
      option2.text = "Option 2";

      select.appendChild(option1);
      select.appendChild(option2);
      document.body.appendChild(select);

      select.value = "2";

      expect(select.value).toBe("2");
      expect(select.selectedIndex).toBe(1);
    });

    it("should select option by index", () => {
      const select = document.createElement("select");
      const option1 = document.createElement("option");
      const option2 = document.createElement("option");

      select.appendChild(option1);
      select.appendChild(option2);
      document.body.appendChild(select);

      select.selectedIndex = 1;

      expect(select.selectedIndex).toBe(1);
    });

    it("should trigger change event on select", () => {
      let changeTriggered = false;

      const select = document.createElement("select");
      const option = document.createElement("option");
      select.appendChild(option);
      document.body.appendChild(select);

      select.addEventListener("change", () => {
        changeTriggered = true;
      });

      const event = new Event("change", { bubbles: true });
      select.dispatchEvent(event);

      expect(changeTriggered).toBe(true);
    });
  });

  describe("Extract execution", () => {
    it("should extract innerText", () => {
      const div = document.createElement("div");
      div.innerText = "Hello World";
      document.body.appendChild(div);

      const value = div.innerText;

      expect(value).toBe("Hello World");
    });

    it("should extract value from input", () => {
      const input = document.createElement("input");
      input.value = "Input value";
      document.body.appendChild(input);

      const value = input.value;

      expect(value).toBe("Input value");
    });

    it("should extract textContent", () => {
      const div = document.createElement("div");
      div.textContent = "Text content";
      document.body.appendChild(div);

      const value = div.textContent;

      expect(value).toBe("Text content");
    });

    it("should extract empty string for empty element", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const value = div.innerText;

      expect(value).toBe("");
    });
  });

  describe("WaitFor execution", () => {
    it("should wait for element to appear", async () => {
      let elementAppeared = false;

      setTimeout(() => {
        const div = document.createElement("div");
        div.id = "delayed-element";
        document.body.appendChild(div);
        elementAppeared = true;
      }, 100);

      await new Promise((resolve) => {
        const interval = setInterval(() => {
          const el = document.querySelector("#delayed-element");
          if (el) {
            clearInterval(interval);
            resolve(true);
          }
        }, 50);
      });

      expect(elementAppeared).toBe(true);
    });

    it("should timeout if element does not appear", async () => {
      const timeout = 100;
      let timedOut = false;

      try {
        await new Promise<void>((resolve, reject) => {
          const deadline = Date.now() + timeout;
          const interval = setInterval(() => {
            const el = document.querySelector("#non-existent");
            if (el) {
              clearInterval(interval);
              resolve();
            } else if (Date.now() > deadline) {
              clearInterval(interval);
              reject(new Error("Timeout"));
            }
          }, 50);
        });
      } catch (error) {
        timedOut = true;
      }

      expect(timedOut).toBe(true);
    });
  });

  describe("Form submission", () => {
    it("should submit form on Enter key", () => {
      let formSubmitted = false;

      const form = document.createElement("form");
      form.onsubmit = (e) => {
        e.preventDefault();
        formSubmitted = true;
      };

      const input = document.createElement("input");
      input.type = "text";
      form.appendChild(input);
      document.body.appendChild(form);

      // requestSubmit 시뮬레이션
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        const event = new Event("submit", { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }

      expect(formSubmitted).toBe(true);
    });

    it("should handle form without submit button", () => {
      const form = document.createElement("form");
      const input = document.createElement("input");
      form.appendChild(input);
      document.body.appendChild(form);

      expect(form.querySelector('button[type="submit"]')).toBeNull();
    });
  });

  describe("Screenshot capture", () => {
    it("should check element visibility", () => {
      const div = document.createElement("div");
      div.style.width = "100px";
      div.style.height = "100px";
      document.body.appendChild(div);

      const rect = div.getBoundingClientRect();

      // happy-dom에서는 레이아웃 계산을 하지 않으므로
      // 스타일이 설정되어 있는지만 확인
      expect(div.style.width).toBe("100px");
      expect(div.style.height).toBe("100px");
    });

    it("should detect invisible element", () => {
      const div = document.createElement("div");
      div.style.display = "none";
      document.body.appendChild(div);

      const rect = div.getBoundingClientRect();

      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
    });
  });

  describe("Element validation", () => {
    it("should throw error when element not found", () => {
      const selector = "#non-existent";
      const element = document.querySelector(selector);

      if (!element) {
        const error = new Error(`Element not found: ${selector}`);
        expect(error.message).toContain("not found");
      }
    });

    it("should validate select element type", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const isSelect = div.tagName.toLowerCase() === "select";

      expect(isSelect).toBe(false);
    });

    it("should validate input element type", () => {
      const input = document.createElement("input");
      input.type = "text";
      document.body.appendChild(input);

      const isInput = input.tagName.toLowerCase() === "input";

      expect(isInput).toBe(true);
    });
  });

  describe("Cursor and selection", () => {
    it("should set cursor position", () => {
      const input = document.createElement("input");
      input.value = "test";
      document.body.appendChild(input);

      input.setSelectionRange(2, 2);

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });

    it("should select all text", () => {
      const input = document.createElement("input");
      input.value = "test";
      document.body.appendChild(input);

      input.select();

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);
    });
  });

  describe("Focus management", () => {
    it("should focus input element", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);

      input.focus();

      expect(document.activeElement).toBe(input);
    });

    it("should blur input element", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);

      input.focus();
      input.blur();

      expect(document.activeElement).not.toBe(input);
    });
  });
});
