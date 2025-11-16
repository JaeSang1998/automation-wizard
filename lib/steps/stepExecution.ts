import type { Step } from "../../types";
import { querySelector } from "../selectors/selectorGenerator";

/**
 * Step execution 유틸리티
 * 각 Step 타입별 실행 로직
 */

export interface ExecutionResult {
  success: boolean;
  error?: string;
  extractedData?: any;
}

/**
 * Click step 실행
 */
export async function executeClickStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "click" || !step.selector) {
    return { success: false, error: "Invalid click step" };
  }

  const element = querySelector(step.selector);
  if (!element) {
    return { success: false, error: `Element not found: ${step.selector}` };
  }

  try {
    element.click();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to click element: ${(error as Error).message}`,
    };
  }
}

/**
 * Type step 실행
 */
export async function executeTypeStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "type" || !step.selector) {
    return { success: false, error: "Invalid type step" };
  }

  const element = querySelector(step.selector);
  if (!element) {
    return { success: false, error: `Element not found: ${step.selector}` };
  }

  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return { success: false, error: "Element is not a text input" };
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

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to type into element: ${(error as Error).message}`,
    };
  }
}

/**
 * Select step 실행
 */
export async function executeSelectStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "select" || !step.selector || step.value === undefined) {
    return { success: false, error: "Invalid select step" };
  }

  const element = querySelector(step.selector);
  if (!element) {
    return { success: false, error: `Element not found: ${step.selector}` };
  }

  if (!(element instanceof HTMLSelectElement)) {
    return { success: false, error: "Element is not a select element" };
  }

  try {
    element.value = step.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to select option: ${(error as Error).message}`,
    };
  }
}

/**
 * Extract step 실행
 */
export async function executeExtractStep(step: Step): Promise<ExecutionResult> {
  if (step.type !== "extract" || !step.selector) {
    return { success: false, error: "Invalid extract step" };
  }

  const element = querySelector(step.selector);
  if (!element) {
    return { success: false, error: `Element not found: ${step.selector}` };
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

    return { success: true, extractedData };
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract data: ${(error as Error).message}`,
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
  if (!step.selector && step.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, step.timeoutMs));
    return { success: true };
  }

  // selector 대기인 경우
  if (!step.selector) {
    return { success: false, error: "WaitFor step requires selector or timeoutMs" };
  }

  const timeout = step.timeoutMs || 5000; // 기본 5초
  const startTime = Date.now();
  const pollInterval = 100; // 100ms마다 체크

  while (Date.now() - startTime < timeout) {
    const element = querySelector(step.selector);
    if (element) {
      return { success: true };
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return {
    success: false,
    error: `Timeout waiting for element: ${step.selector}`,
  };
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

