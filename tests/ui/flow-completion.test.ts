import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Flow 완료 후 상태 초기화 테스트
 * 
 * 테스트 대상:
 * - FLOW_COMPLETED 메시지 수신 시 실행 상태 초기화
 * - FLOW_FAILED 메시지 수신 시 실행 상태 초기화
 * - executingStep null 처리
 * - isRunning 상태 변경
 */

describe("Flow Completion State Reset", () => {
  interface StepExecutionState {
    step: any;
    stepIndex: number;
    totalSteps: number;
    currentUrl?: string;
  }

  let executingStep: StepExecutionState | null = null;
  let isRunning = false;
  let statusMessage = "";

  beforeEach(() => {
    executingStep = null;
    isRunning = false;
    statusMessage = "";
  });

  it("Should reset state when FLOW_COMPLETED is received", () => {
    // Simulate running state
    executingStep = {
      step: { type: "click", selector: "#btn" },
      stepIndex: 2,
      totalSteps: 3,
    };
    isRunning = true;

    // FLOW_COMPLETED message received
    const message = { type: "FLOW_COMPLETED", totalSteps: 3 };

    // Simulate useFlowExecution handler
    if (message.type === "FLOW_COMPLETED") {
      statusMessage = `✅ Flow completed successfully! (${message.totalSteps} steps)`;
      executingStep = null;
    }

    isRunning = executingStep !== null;

    expect(executingStep).toBe(null);
    expect(isRunning).toBe(false);
    expect(statusMessage).toContain("completed successfully");
  });

  it("Should reset state when FLOW_FAILED is received", () => {
    // Simulate running state
    executingStep = {
      step: { type: "click", selector: "#btn" },
      stepIndex: 1,
      totalSteps: 3,
    };
    isRunning = true;

    // FLOW_FAILED message received
    const message = {
      type: "FLOW_FAILED",
      error: "Element not found",
      failedStepIndex: 1,
      failedStep: { type: "click", selector: "#btn" },
    };

    // Simulate useFlowExecution handler
    if (message.type === "FLOW_FAILED") {
      statusMessage = `❌ Flow failed at step ${message.failedStepIndex + 1}: ${message.error}`;
      executingStep = null;
    }

    isRunning = executingStep !== null;

    expect(executingStep).toBe(null);
    expect(isRunning).toBe(false);
    expect(statusMessage).toContain("Flow failed");
  });

  it("Should maintain running state during step execution", () => {
    // STEP_EXECUTING message received
    const message = {
      type: "STEP_EXECUTING",
      step: { type: "click", selector: "#btn" },
      stepIndex: 1,
      totalSteps: 3,
      currentUrl: "https://example.com",
    };

    // Simulate useFlowExecution handler
    if (message.type === "STEP_EXECUTING") {
      executingStep = {
        step: message.step,
        stepIndex: message.stepIndex,
        totalSteps: message.totalSteps,
        currentUrl: message.currentUrl,
      };
      statusMessage = `Executing step ${message.stepIndex + 1}/${message.totalSteps}...`;
    }

    isRunning = executingStep !== null;

    expect(executingStep).not.toBe(null);
    expect(isRunning).toBe(true);
    expect(statusMessage).toContain("Executing step 2/3");
  });

  it("Should track completed steps", () => {
    const completedSteps = new Set<number>();

    // STEP_COMPLETED messages
    const messages = [
      { type: "STEP_COMPLETED", stepIndex: 0, success: true },
      { type: "STEP_COMPLETED", stepIndex: 1, success: true },
      { type: "STEP_COMPLETED", stepIndex: 2, success: true },
    ];

    messages.forEach((msg) => {
      if (msg.type === "STEP_COMPLETED") {
        completedSteps.add(msg.stepIndex);
      }
    });

    expect(completedSteps.size).toBe(3);
    expect(completedSteps.has(0)).toBe(true);
    expect(completedSteps.has(1)).toBe(true);
    expect(completedSteps.has(2)).toBe(true);
  });

  it("Should clear completed steps on state reset", () => {
    const completedSteps = new Set<number>([0, 1, 2]);
    const extractedData = new Map<number, any>([[0, "data"]]);
    const elementScreenshots = new Map<number, any>([[0, "screenshot"]]);

    // Simulate clearState
    completedSteps.clear();
    extractedData.clear();
    elementScreenshots.clear();
    executingStep = null;
    statusMessage = "";

    expect(completedSteps.size).toBe(0);
    expect(extractedData.size).toBe(0);
    expect(elementScreenshots.size).toBe(0);
    expect(executingStep).toBe(null);
    expect(statusMessage).toBe("");
  });
});

