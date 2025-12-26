import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { Wand2, Undo, Square } from "lucide-react";
import type {
  Flow,
  FlowUpdatedMessage,
  SentOkMessage,
} from "@auto-wiz/core";
import { useFlowExecution } from "../../hooks/useFlowExecution";
import {
  getFlow,
  saveFlow,
  clearFlow,
  removeStep,
} from "@auto-wiz/core";
import { FlowStepItem } from "@auto-wiz/ui";
import { FlowControls } from "@auto-wiz/ui";

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
   * Step 위로 이동
   */
  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0 || !flow) return;

      const newSteps = [...flow.steps];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];

      const updatedFlow: Flow = {
        ...flow,
        steps: newSteps,
      };

      await saveFlow(updatedFlow);
      setFlow(updatedFlow);
    },
    [flow]
  );

  /**
   * Step 아래로 이동
   */
  const handleMoveDown = useCallback(
    async (index: number) => {
      if (!flow || index === flow.steps.length - 1) return;

      const newSteps = [...flow.steps];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];

      const updatedFlow: Flow = {
        ...flow,
        steps: newSteps,
      };

      await saveFlow(updatedFlow);
      setFlow(updatedFlow);
    },
    [flow]
  );

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
          padding: "16px 20px",
          background: "#ffffff",
          color: "#1a1a1a",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Wand2 size={18} strokeWidth={2} />
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Automation Wizard
          </h2>
        </div>
      </div>

      {/* Status Messages */}
      {(statusMessage || sendStatus) && (
        <div
          style={{
            padding: "12px 20px",
            background: "#fafafa",
            borderBottom: "1px solid #e5e5e5",
            color: "#404040",
            fontSize: "13px",
            fontWeight: 500,
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
          padding: "14px 20px",
          background: "#fafafa",
          borderBottom: "1px solid #e5e5e5",
          fontSize: "13px",
          color: "#737373",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong style={{ color: "#1a1a1a", fontWeight: 500 }}>Steps:</strong>{" "}
          <span style={{ color: "#404040" }}>{flow?.steps.length || 0}</span>
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
            <strong style={{ color: "#1a1a1a", fontWeight: 500 }}>
              Start URL:
            </strong>{" "}
            <span style={{ color: "#737373" }}>{startUrl}</span>
          </div>
        )}
      </div>

      {/* Steps List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0 0",
        }}
      >
        {!hasSteps ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#a3a3a3",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "15px",
                fontWeight: 500,
                color: "#404040",
              }}
            >
              No steps recorded yet
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#737373",
                lineHeight: "1.6",
              }}
            >
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
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                totalSteps={flow!.steps.length}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer Actions */}
      {hasSteps && (
        <div
          style={{
            padding: "16px 20px",
            background: "#fafafa",
            borderTop: "1px solid #e5e5e5",
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={handleUndo}
            disabled={recording || isRunning}
            style={{
              flex: 1,
              padding: "10px",
              background: recording || isRunning ? "#fafafa" : "#f5f5f5",
              color: recording || isRunning ? "#a3a3a3" : "#404040",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              cursor: recording || isRunning ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              opacity: recording || isRunning ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Undo size={16} strokeWidth={2} />
            Undo Last
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              flex: 2,
              padding: "10px",
              background: isRunning ? "#dc2626" : "#1a1a1a",
              color: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isRunning ? (
              <>
                <Square size={16} strokeWidth={2} fill="currentColor" />
                Stop Flow
              </>
            ) : (
              <>
                <Wand2 size={16} strokeWidth={2} />
                Run Flow
              </>
            )}
          </button>
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
