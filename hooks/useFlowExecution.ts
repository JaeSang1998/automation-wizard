import { useState, useEffect, useCallback } from "react";
import type { Step } from "../types";

interface StepExecutionState {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  currentUrl?: string;
}

interface UseFlowExecutionReturn {
  executingStep: StepExecutionState | null;
  completedSteps: Set<number>;
  extractedData: Map<number, any>;
  elementScreenshots: Map<number, { screenshot: string; elementInfo: any }>;
  isRunning: boolean;
  statusMessage: string;
  startExecution: (tabId: number) => Promise<void>;
  stopExecution: () => Promise<void>;
  clearState: () => void;
}

/**
 * Flow 실행 상태를 관리하는 커스텀 훅
 * 
 * 기능:
 * - Step별 실행 상태 추적
 * - 완료된 Step 추적
 * - Extract 데이터 수집
 * - Element 스크린샷 수집
 * - 실행 시작/중지
 */
export function useFlowExecution(): UseFlowExecutionReturn {
  const [executingStep, setExecutingStep] =
    useState<StepExecutionState | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [extractedData, setExtractedData] = useState<Map<number, any>>(
    new Map()
  );
  const [elementScreenshots, setElementScreenshots] = useState<
    Map<number, { screenshot: string; elementInfo: any }>
  >(new Map());
  const [statusMessage, setStatusMessage] = useState("");

  const isRunning = executingStep !== null;

  /**
   * 실행 시작
   */
  const startExecution = useCallback(async (tabId: number) => {
    try {
      // 픽커 끄기
      await browser.tabs.sendMessage(tabId, {
        type: "TOGGLE_PICKER",
        on: false,
      });

      // 플로우 실행 시작
      await browser.runtime.sendMessage({
        type: "RUN_FLOW",
        tabId,
      });

      setStatusMessage("Flow execution started...");
    } catch (error) {
      console.error("Failed to start flow execution:", error);
      setStatusMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setExecutingStep(null);
    }
  }, []);

  /**
   * 실행 중지
   */
  const stopExecution = useCallback(async () => {
    try {
      await browser.runtime.sendMessage({ type: "STOP_RUN" });
      setExecutingStep(null);
      setStatusMessage("Flow execution stopped");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (error) {
      console.error("Failed to stop flow execution:", error);
      setStatusMessage("Failed to stop execution");
    }
  }, []);

  /**
   * 상태 초기화
   */
  const clearState = useCallback(() => {
    setExecutingStep(null);
    setCompletedSteps(new Set());
    setExtractedData(new Map());
    setElementScreenshots(new Map());
    setStatusMessage("");
  }, []);

  /**
   * 메시지 리스너
   */
  useEffect(() => {
    const handleMessage = (msg: any) => {
      switch (msg.type) {
        case "STEP_EXECUTING":
          setExecutingStep({
            step: msg.step,
            stepIndex: msg.stepIndex,
            totalSteps: msg.totalSteps,
            currentUrl: msg.currentUrl,
          });
          setStatusMessage(
            `Executing step ${msg.stepIndex + 1}/${msg.totalSteps}...`
          );
          break;

        case "STEP_COMPLETED":
          setCompletedSteps((prev) => new Set([...prev, msg.stepIndex]));

          if (msg.success) {
            setStatusMessage(`Step ${msg.stepIndex + 1} completed successfully!`);

            // Extract 데이터 저장
            if (msg.extractedData !== undefined) {
              setExtractedData((prev) =>
                new Map(prev).set(msg.stepIndex, msg.extractedData)
              );
              setStatusMessage(
                `Step ${msg.stepIndex + 1} completed! Extracted: "${msg.extractedData}"`
              );
            }
          } else {
            setStatusMessage(`Step ${msg.stepIndex + 1} failed: ${msg.error}`);
          }

          setTimeout(() => setStatusMessage(""), 2000);
          break;

        case "FLOW_FAILED":
          setStatusMessage(
            `❌ Flow failed at step ${msg.failedStepIndex + 1}: ${msg.error}`
          );
          setExecutingStep(null);
          console.error("Flow execution failed:", msg.error);
          break;

        case "FLOW_COMPLETED":
          setStatusMessage(`✅ Flow completed successfully! (${msg.totalSteps} steps)`);
          setExecutingStep(null);
          console.log("Flow execution completed:", msg.totalSteps, "steps");
          setTimeout(() => setStatusMessage(""), 3000);
          break;

        case "ELEMENT_SCREENSHOT":
          setElementScreenshots((prev) =>
            new Map(prev).set(msg.stepIndex, {
              screenshot: msg.screenshot,
              elementInfo: msg.elementInfo,
            })
          );
          break;

        default:
          break;
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return {
    executingStep,
    completedSteps,
    extractedData,
    elementScreenshots,
    isRunning,
    statusMessage,
    startExecution,
    stopExecution,
    clearState,
  };
}

