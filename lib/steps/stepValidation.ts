import type { Step } from "../../types";

/**
 * Step validation 유틸리티
 * Step의 유효성 검증 및 오류 메시지 생성
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Step의 기본 구조 검증
 */
export function validateStep(step: Step): ValidationResult {
  if (!step || typeof step !== "object") {
    return { valid: false, error: "Step must be an object" };
  }

  if (!step.type) {
    return { valid: false, error: "Step type is required" };
  }

  // 타입별 검증
  switch (step.type) {
    case "click":
      return validateClickStep(step);
    case "type":
      return validateTypeStep(step);
    case "select":
      return validateSelectStep(step);
    case "extract":
      return validateExtractStep(step);
    case "navigate":
      return validateNavigateStep(step);
    case "waitFor":
      return validateWaitForStep(step);
    default:
      return { valid: false, error: `Unknown step type: ${step.type}` };
  }
}

function validateClickStep(step: Step): ValidationResult {
  if (step.type !== "click") {
    return { valid: false, error: "Invalid step type for click validation" };
  }

  if (!step.selector) {
    return { valid: false, error: "Click step requires selector" };
  }

  return { valid: true };
}

function validateTypeStep(step: Step): ValidationResult {
  if (step.type !== "type") {
    return { valid: false, error: "Invalid step type for type validation" };
  }

  if (!step.selector) {
    return { valid: false, error: "Type step requires selector" };
  }

  if (step.text === undefined && step.originalText === undefined) {
    return { valid: false, error: "Type step requires text or originalText" };
  }

  return { valid: true };
}

function validateSelectStep(step: Step): ValidationResult {
  if (step.type !== "select") {
    return { valid: false, error: "Invalid step type for select validation" };
  }

  if (!step.selector) {
    return { valid: false, error: "Select step requires selector" };
  }

  if (step.value === undefined) {
    return { valid: false, error: "Select step requires value" };
  }

  return { valid: true };
}

function validateExtractStep(step: Step): ValidationResult {
  if (step.type !== "extract") {
    return { valid: false, error: "Invalid step type for extract validation" };
  }

  if (!step.selector) {
    return { valid: false, error: "Extract step requires selector" };
  }

  return { valid: true };
}

function validateNavigateStep(step: Step): ValidationResult {
  if (step.type !== "navigate") {
    return { valid: false, error: "Invalid step type for navigate validation" };
  }

  if (!step.url) {
    return { valid: false, error: "Navigate step requires URL" };
  }

  // URL 형식 검증
  try {
    new URL(step.url);
  } catch {
    return { valid: false, error: `Invalid URL: ${step.url}` };
  }

  return { valid: true };
}

function validateWaitForStep(step: Step): ValidationResult {
  if (step.type !== "waitFor") {
    return { valid: false, error: "Invalid step type for waitFor validation" };
  }

  if (!step.selector && step.timeoutMs === undefined) {
    return {
      valid: false,
      error: "WaitFor step requires selector or timeoutMs",
    };
  }

  if (step.timeoutMs !== undefined) {
    if (typeof step.timeoutMs !== "number" || step.timeoutMs < 0) {
      return { valid: false, error: "Timeout must be a positive number" };
    }
  }

  return { valid: true };
}

/**
 * Step 배열의 모든 Step 검증
 */
export function validateSteps(steps: Step[]): ValidationResult {
  if (!Array.isArray(steps)) {
    return { valid: false, error: "Steps must be an array" };
  }

  for (let i = 0; i < steps.length; i++) {
    const result = validateStep(steps[i]);
    if (!result.valid) {
      return {
        valid: false,
        error: `Step ${i + 1}: ${result.error}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Step이 실행 가능한지 확인
 */
export function isExecutableStep(step: Step): boolean {
  return validateStep(step).valid;
}

/**
 * Step 타입별 필수 필드 확인
 */
export function hasRequiredFields(step: Step): boolean {
  const validation = validateStep(step);
  return validation.valid;
}

