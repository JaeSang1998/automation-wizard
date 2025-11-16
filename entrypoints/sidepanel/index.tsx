import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import type { Flow, FlowUpdatedMessage, SentOkMessage } from "../../types";
import { useFlowExecution } from "../../hooks/useFlowExecution";
import { getFlow, saveFlow, clearFlow, removeStep } from "../../lib/storage/flowStorage";
import { FlowStepItem } from "./components/FlowStepItem";
import { FlowControls } from "./components/FlowControls";

/**
 * SidePanel 메인 컴포넌트
 * 
 * 기능:
 * - Flow 관리 (보기, 편집, 삭제, 실행)
 * - Recording 제어
 * - Backend 전송
 * - Step 실행 상태 추적
 */
function SidePanelApp() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [endpoint, setEndpoint] = useState("https://api.example.com/flows");
  const [startUrl, setStartUrl] = useState("");
  const [pickerOn, setPickerOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  // Flow 실행 상태 관리
  const {
    executingStep,
    completedSteps,
    extractedData,
    elementScreenshots,
    isRunning,
    statusMessage,
    startExecution,
    stopExecution,
    clearState,
  } = useFlowExecution();

  /**
   * Flow 로드
   */
  const loadFlow = useCallback(async () => {
    const loadedFlow = await getFlow();
    if (loadedFlow) {
      setFlow(loadedFlow);
      if (loadedFlow.startUrl) {
        setStartUrl(loadedFlow.startUrl);
      }
    }
  }, []);

  /**
   * 초기 로드 및 메시지 리스너
   */
  useEffect(() => {
    loadFlow();

    const handleMessage = (
      msg:
        | FlowUpdatedMessage
        | SentOkMessage
        | { type: "RECORD_STATE"; recording: boolean }
    ) => {
      if (msg.type === "FLOW_UPDATED") {
        setFlow(msg.flow);
        setSendStatus(`Step added! Total: ${msg.flow.steps.length}`);
        setTimeout(() => setSendStatus(""), 3000);
      } else if (msg.type === "RECORD_STATE") {
        setRecording(msg.recording);
      } else if (msg.type === "SENT_OK") {
        setSendStatus("Successfully sent to backend!");
        setTimeout(() => setSendStatus(""), 3000);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, [loadFlow]);

  /**
   * Picker 토글
   */
  const handleTogglePicker = useCallback(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.id) return;

    const newPickerState = !pickerOn;
    setPickerOn(newPickerState);

    await browser.tabs.sendMessage(tab.id, {
      type: "TOGGLE_PICKER",
      on: newPickerState,
    });
  }, [pickerOn]);

  /**
   * Recording 시작
   */
  const handleStartRecording = useCallback(async () => {
    await browser.runtime.sendMessage({ type: "START_RECORD" });
    setRecording(true);
    setPickerOn(true);

    // Picker도 켜기
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: "TOGGLE_PICKER",
        on: true,
      });
    }
  }, []);

  /**
   * Recording 중지
   */
  const handleStopRecording = useCallback(async () => {
    await browser.runtime.sendMessage({ type: "STOP_RECORD" });
    setRecording(false);
  }, []);

  /**
   * Flow 실행
   */
  const handleRun = useCallback(async () => {
    if (isRunning) {
      await stopExecution();
      return;
    }

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.id) {
      setSendStatus("Error: No active tab found");
      return;
    }

    clearState();
    await startExecution(tab.id);
  }, [isRunning, startExecution, stopExecution, clearState]);

  /**
   * Flow 초기화
   */
  const handleClear = useCallback(async () => {
    if (
      !confirm(
        "Are you sure you want to clear all steps? This cannot be undone."
      )
    ) {
      return;
    }

    await clearFlow();
    const clearedFlow = await getFlow();
    setFlow(clearedFlow);
    clearState();
    setSendStatus("Flow cleared");
    setTimeout(() => setSendStatus(""), 2000);
  }, [clearState]);

  /**
   * Step 제거
   */
  const handleRemoveStep = useCallback(async (index: number) => {
    const updatedFlow = await removeStep(index);
    setFlow(updatedFlow);
  }, []);

  /**
   * Step 순서 변경 (드래그 앤 드롭)
   */
  const handleReorderSteps = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !flow) return;

    const newSteps = [...flow.steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);

    const updatedFlow: Flow = {
      ...flow,
      steps: newSteps,
    };

    await saveFlow(updatedFlow);
    setFlow(updatedFlow);
  }, [flow]);

  /**
   * Undo 마지막 Step
   */
  const handleUndo = useCallback(async () => {
    await browser.runtime.sendMessage({ type: "UNDO_LAST_STEP" });
    await loadFlow();
  }, [loadFlow]);

  /**
   * Backend로 전송
   */
  const handleSendToBackend = useCallback(async () => {
    if (!flow || flow.steps.length === 0) {
      setSendStatus("No steps to send");
      return;
    }

    setSendStatus("Sending...");

    try {
      await browser.runtime.sendMessage({
        type: "SEND_TO_BACKEND",
        endpoint,
        flow,
      });
    } catch (error) {
      setSendStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setTimeout(() => setSendStatus(""), 5000);
    }
  }, [flow, endpoint]);

  const hasSteps = flow && flow.steps.length > 0;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          background: "#3b82f6",
          color: "white",
          borderBottom: "1px solid #2563eb",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
          🧙‍♂️ Automation Wizard
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
          Record and replay browser automation flows
        </p>
      </div>

      {/* Status Messages */}
      {(statusMessage || sendStatus) && (
        <div
          style={{
            padding: "12px 16px",
            background: "#dbeafe",
            border: "1px solid #3b82f6",
            color: "#1e40af",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {statusMessage || sendStatus}
        </div>
      )}

      {/* Controls */}
      <FlowControls
        recording={recording}
        pickerOn={pickerOn}
        isRunning={isRunning}
        hasSteps={!!hasSteps}
        onTogglePicker={handleTogglePicker}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onRun={handleRun}
        onStop={stopExecution}
        onClear={handleClear}
        onUndo={handleUndo}
        onSendToBackend={handleSendToBackend}
      />

      {/* Flow Info */}
      <div
        style={{
          padding: "12px 16px",
          background: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
          fontSize: "12px",
          color: "#6b7280",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Steps:</strong> {flow?.steps.length || 0}
        </div>
        {startUrl && (
          <div
            style={{
              maxWidth: "60%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <strong>Start URL:</strong> {startUrl}
          </div>
        )}
      </div>

      {/* Steps List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {!hasSteps ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#9ca3af",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
              No steps recorded yet
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              Turn on the picker and start recording your automation flow
            </p>
          </div>
        ) : (
          <>
            {flow!.steps.map((step, index) => (
              <FlowStepItem
                key={index}
                step={step}
                index={index}
                isExecuting={
                  executingStep !== null && executingStep.stepIndex === index
                }
                isCompleted={completedSteps.has(index)}
                extractedData={extractedData.get(index)}
                screenshot={elementScreenshots.get(index)}
                onRemove={handleRemoveStep}
                onReorder={handleReorderSteps}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer Actions */}
      {hasSteps && (
        <div
          style={{
            padding: "12px 16px",
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: "8px",
          }}
        >
          <button
            onClick={handleUndo}
            disabled={recording || isRunning}
            style={{
              flex: 1,
              padding: "8px",
              background:
                recording || isRunning ? "#d1d5db" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: recording || isRunning ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            ↩️ Undo Last
          </button>

          <div style={{ flex: 2 }}>
            <input
              type="text"
              placeholder="Backend endpoint URL"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// DOM이 로드된 후 실행
function init() {
  const root = document.getElementById("root");
  if (root) {
    console.log("Mounting React app to sidepanel");
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(<SidePanelApp />);
  } else {
    console.error("Root element not found");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export default SidePanelApp;

