import type { Step } from "@auto-wiz/core";
import { querySelector } from "../selectors/selectorGenerator";
import { waitForLocator, isInteractable } from "../selectors/locatorUtils";

/**
 * Step execution 유틸리티
 * 각 Step 타입별 실행 로직
 * 
 * 새로운 locator 시스템 지원:
 * - step.locator가 있으면 다중 selector fallback 사용
 * - 없으면 기존 step.selector 사용 (하위 호환성)
 */

export interface ExecutionResult {
  success: boolean;
  error?: string;
  extractedData?: any;
  usedSelector?: string; // 실제로 사용된 selector (디버깅용)
}

/**
 * Step에서 요소 찾기 (locator 우선, fallback to selector)
 */
async function findElement(step: Step): Promise<{
  element: HTMLElement | null;
  usedSelector: string;
}> {
  // 1. 새로운 locator 시스템 시도
  if ("locator" in step && step.locator) {
    try {
      const element = await waitForLocator(step.locator, {
        timeout: (step as any).timeoutMs || 5000,
        visible: true,
        interactable: true,
      });
      return { element, usedSelector: step.locator.primary };
    } catch (error) {
      // Locator로 찾지 못하면 selector로 폴백
      console.warn("Locator failed, falling back to selector", error);
    }
  }

  // 2. 기존 selector 사용 (하위 호환성)
  if ("selector" in step && step.selector) {
    const element = querySelector(step.selector);
    return { element, usedSelector: step.selector };
  }

  return { element: null, usedSelector: "none" };
}

/**
 * Click step 실행
 */
export async function executeClickStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "click") {
    return { success: false, error: "Invalid click step" };
  }

  const { element, usedSelector } = await findElement(step);
  if (!element) {
    return {
      success: false,
      error: `Element not found with selector: ${usedSelector}`,
    };
  }

  // 상호작용 가능 여부 확인
  if (!isInteractable(element)) {
    return {
      success: false,
      error: `Element is not interactable: ${usedSelector}`,
    };
  }

  try {
    element.click();
    return { success: true, usedSelector };
  } catch (error) {
    return {
      success: false,
      error: `Failed to click element: ${(error as Error).message}`,
      usedSelector,
    };
  }
}

/**
 * Type step 실행
 */
export async function executeTypeStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "type") {
    return { success: false, error: "Invalid type step" };
  }

  const { element, usedSelector } = await findElement(step);
  if (!element) {
    return {
      success: false,
      error: `Element not found with selector: ${usedSelector}`,
    };
  }

  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return {
      success: false,
      error: "Element is not a text input",
      usedSelector,
    };
  }

  if (!isInteractable(element)) {
    return {
      success: false,
      error: `Element is not interactable: ${usedSelector}`,
    };
  }

  try {
    const text = step.originalText || step.text || "";
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    // Submit 플래그가 있으면 Enter 키 입력
    if (step.submit) {
      const form = element.form;
      if (form) {
        // 폼이 있으면 submit
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
      } else {
        // 폼이 없으면 Enter 키 이벤트 발생
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }

    return { success: true, usedSelector };
  } catch (error) {
    return {
      success: false,
      error: `Failed to type into element: ${(error as Error).message}`,
      usedSelector,
    };
  }
}

/**
 * Select step 실행
 */
export async function executeSelectStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "select" || step.value === undefined) {
    return { success: false, error: "Invalid select step" };
  }

  const { element, usedSelector } = await findElement(step);
  if (!element) {
    return {
      success: false,
      error: `Element not found with selector: ${usedSelector}`,
    };
  }

  if (!(element instanceof HTMLSelectElement)) {
    return {
      success: false,
      error: "Element is not a select element",
      usedSelector,
    };
  }

  if (!isInteractable(element)) {
    return {
      success: false,
      error: `Element is not interactable: ${usedSelector}`,
    };
  }

  try {
    element.value = step.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, usedSelector };
  } catch (error) {
    return {
      success: false,
      error: `Failed to select option: ${(error as Error).message}`,
      usedSelector,
    };
  }
}

/**
 * Extract step 실행
 */
export async function executeExtractStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "extract") {
    return { success: false, error: "Invalid extract step" };
  }

  const { element, usedSelector } = await findElement(step);
  if (!element) {
    return {
      success: false,
      error: `Element not found with selector: ${usedSelector}`,
    };
  }

  try {
    let extractedData: any;

    // prop에 따라 다른 데이터 추출 (기본값: innerText)
    const prop = step.prop || "innerText";

    if (prop === "value" && "value" in element) {
      extractedData = (element as HTMLInputElement).value;
    } else if (prop === "innerText") {
      extractedData = element.textContent?.trim() || "";
    } else {
      extractedData = element.textContent?.trim() || "";
    }

    return { success: true, extractedData, usedSelector };
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract data: ${(error as Error).message}`,
      usedSelector,
    };
  }
}

/**
 * WaitFor step 실행
 */
export async function executeWaitForStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "waitFor") {
    return { success: false, error: "Invalid waitFor step" };
  }

  // 단순 timeout인 경우
  if (!("selector" in step) && !("locator" in step) && step.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, step.timeoutMs));
    return { success: true };
  }

  const timeout = step.timeoutMs || 5000; // 기본 5초

  try {
    // locator가 있으면 waitForLocator 사용 (자동 대기 기능)
    if ("locator" in step && step.locator) {
      await waitForLocator(step.locator, {
        timeout,
        visible: true,
      });
      return { success: true, usedSelector: step.locator.primary };
    }

    // selector가 있으면 기존 방식 (하위 호환성)
    if ("selector" in step && step.selector) {
      const startTime = Date.now();
      const pollInterval = 100;

      while (Date.now() - startTime < timeout) {
        const element = querySelector(step.selector);
        if (element) {
          return { success: true, usedSelector: step.selector };
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      return {
        success: false,
        error: `Timeout waiting for element: ${step.selector}`,
      };
    }

    return {
      success: false,
      error: "WaitFor step requires selector, locator, or timeoutMs",
    };
  } catch (error) {
    return {
      success: false,
      error: `WaitFor failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Step 실행 (타입에 따라 자동 분기)
 */
export async function executeStep(step: Step): Promise<ExecutionResult> {
  try {
    switch (step.type) {
      case "click":
        return await executeClickStep(step);
      case "type":
        return await executeTypeStep(step);
      case "select":
        return await executeSelectStep(step);
      case "extract":
        return await executeExtractStep(step);
      case "waitFor":
        return await executeWaitForStep(step);
      case "navigate":
        // navigate는 background에서 처리
        return { success: true };
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Step execution failed: ${(error as Error).message}`,
    };
  }
}

