import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import type {
  Flow,
  FlowUpdatedMessage,
  SentOkMessage,
  Step,
  StepExecutingMessage,
  StepCompletedMessage,
  FlowFailedMessage,
  ElementScreenshotMessage,
} from "../../types";

function SidePanelApp() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [endpoint, setEndpoint] = useState("https://api.example.com/flows");
  const [startUrl, setStartUrl] = useState("");
  const [pickerOn, setPickerOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [executingStep, setExecutingStep] = useState<{
    step: Step;
    stepIndex: number;
    totalSteps: number;
    currentUrl?: string;
  } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [extractedData, setExtractedData] = useState<Map<number, any>>(
    new Map()
  );
  const [elementScreenshots, setElementScreenshots] = useState<
    Map<number, { screenshot: string; elementInfo: any }>
  >(new Map());

  // 플로우 로드
  useEffect(() => {
    loadFlow();

    // 메시지 리스너
    const handleMessage = (
      msg:
        | FlowUpdatedMessage
        | SentOkMessage
        | StepExecutingMessage
        | StepCompletedMessage
        | FlowFailedMessage
        | ElementScreenshotMessage
        | { type: "RECORD_STATE"; recording: boolean }
    ) => {
      if (msg.type === "FLOW_UPDATED") {
        setFlow(msg.flow);
        setStatusMessage(`Step added! Total: ${msg.flow.steps.length}`);
        setTimeout(() => setStatusMessage(""), 3000);
      } else if (msg.type === "RECORD_STATE") {
        setRecording(msg.recording);
        console.log("Recording state updated in sidepanel:", msg.recording);
      } else if (msg.type === "SENT_OK") {
        setStatusMessage("Successfully sent to backend!");
        setTimeout(() => setStatusMessage(""), 3000);
      } else if (msg.type === "STEP_EXECUTING") {
        setExecutingStep({
          step: msg.step,
          stepIndex: msg.stepIndex,
          totalSteps: msg.totalSteps,
          currentUrl: msg.currentUrl,
        });
        setStatusMessage(
          `Executing step ${msg.stepIndex + 1}/${msg.totalSteps}...`
        );
      } else if (msg.type === "STEP_COMPLETED") {
        setCompletedSteps((prev) => new Set([...prev, msg.stepIndex]));
        if (msg.success) {
          setStatusMessage(`Step ${msg.stepIndex + 1} completed successfully!`);

          // extract 데이터 저장
          if (msg.extractedData !== undefined) {
            setExtractedData((prev) =>
              new Map(prev).set(msg.stepIndex, msg.extractedData)
            );
            setStatusMessage(
              `Step ${msg.stepIndex + 1} completed! Extracted: "${
                msg.extractedData
              }"`
            );
          }
        } else {
          setStatusMessage(`Step ${msg.stepIndex + 1} failed: ${msg.error}`);
        }
        setTimeout(() => setStatusMessage(""), 2000);
      } else if (msg.type === "FLOW_FAILED") {
        setStatusMessage(
          `❌ Flow failed at step ${msg.failedStepIndex + 1}: ${msg.error}`
        );
        setExecutingStep(null);
        console.error("Flow execution failed:", msg.error);
      } else if (msg.type === "ELEMENT_SCREENSHOT") {
        setElementScreenshots((prev) =>
          new Map(prev).set(msg.stepIndex, {
            screenshot: msg.screenshot,
            elementInfo: msg.elementInfo,
          })
        );
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadFlow = async () => {
    const result = await browser.storage.local.get("flow");
    if (result.flow) {
      setFlow(result.flow);
      if (result.flow.startUrl) {
        setStartUrl(result.flow.startUrl);
      }
    }
  };

  const handleRun = async () => {
    // 이미 실행 중이면 중단
    if (executingStep) {
      console.log("Stopping flow execution...");
      await browser.runtime.sendMessage({ type: "STOP_RUN" });
      setExecutingStep(null);
      setStatusMessage("Flow execution stopped");
      setTimeout(() => setStatusMessage(""), 2000);
      return;
    }

    console.log("handleRun clicked!");
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("Current tab:", tab);

    if (!tab.id) {
      console.error("No tab ID found!");
      setStatusMessage("Error: No active tab found");
      return;
    }

    try {
      // 실행 중에는 픽커 끄기
      console.log("Turning off picker...");
      await browser.tabs
        .sendMessage(tab.id, {
          type: "TOGGLE_PICKER",
          on: false,
        })
        .catch((e) => console.warn("Failed to toggle picker:", e));

      // 녹화 중단
      console.log("Stopping record...");
      await browser.runtime.sendMessage({ type: "STOP_RECORD" });

      // 실행 상태 초기화
      setExecutingStep(null);
      setCompletedSteps(new Set());
      setStatusMessage("Starting flow execution...");

      console.log("Sending RUN_FLOW message...");
      await browser.runtime.sendMessage({ type: "RUN_FLOW" });
      console.log("Flow completed!");
      setStatusMessage("Flow completed!");
      setExecutingStep(null);
    } catch (error) {
      console.error("Flow execution error:", error);
      setStatusMessage(`Flow execution failed: ${error}`);
      setExecutingStep(null);
    }

    // 다시 픽커 켜기
    setTimeout(async () => {
      if (tab.id) {
        await browser.tabs
          .sendMessage(tab.id, {
            type: "TOGGLE_PICKER",
            on: pickerOn,
          })
          .catch((e) => console.warn("Failed to restore picker:", e));
      }
      setStatusMessage("");
    }, 2000);
  };

  const handleSend = async () => {
    if (!endpoint) {
      setStatusMessage("Please enter an endpoint URL");
      return;
    }

    setStatusMessage("Sending to backend...");

    try {
      await browser.runtime.sendMessage({ type: "SEND_TO_BACKEND", endpoint });
    } catch (error) {
      setStatusMessage("Failed to send!");
      console.error(error);
    }
  };

  const handleStartRecord = async () => {
    setRecording(true);
    setStatusMessage("Recording started. Click on the page to capture steps.");
    setTimeout(() => setStatusMessage(""), 2000);
    await browser.runtime.sendMessage({ type: "START_RECORD" });
  };

  const handleStopRecord = async () => {
    setRecording(false);
    setStatusMessage("Recording stopped.");
    setTimeout(() => setStatusMessage(""), 2000);
    await browser.runtime.sendMessage({ type: "STOP_RECORD" });
  };

  const handleTogglePicker = async () => {
    const newPickerState = !pickerOn;
    setPickerOn(newPickerState);

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: "TOGGLE_PICKER",
        on: newPickerState,
      });
    }

    setStatusMessage(
      newPickerState ? "Mouse pointer enabled" : "Mouse pointer disabled"
    );
    setTimeout(() => setStatusMessage(""), 2000);
  };

  const handleReset = async () => {
    if (!confirm("정말로 모든 레코드를 초기화하시겠습니까?")) return;

    const freshFlow: Flow = {
      id: crypto.randomUUID(),
      title: "Automation PoC Flow",
      steps: [],
      createdAt: Date.now(),
      startUrl: startUrl || undefined,
    };

    await browser.storage.local.set({ flow: freshFlow });
    setFlow(freshFlow);
    setStatusMessage("Flow reset!");
    setTimeout(() => setStatusMessage(""), 2000);
  };

  const handleDeleteStep = async (stepIndex: number) => {
    if (!flow) return;

    if (!confirm(`Step ${stepIndex + 1}을 삭제하시겠습니까?`)) return;

    const updatedFlow: Flow = {
      ...flow,
      steps: flow.steps.filter((_, index) => index !== stepIndex),
    };

    await browser.storage.local.set({ flow: updatedFlow });
    setFlow(updatedFlow);
    setStatusMessage(`Step ${stepIndex + 1} deleted!`);
    setTimeout(() => setStatusMessage(""), 2000);

    // extractedData와 elementScreenshots에서도 해당 스텝 제거
    const newExtractedData = new Map(extractedData);
    newExtractedData.delete(stepIndex);
    setExtractedData(newExtractedData);

    const newElementScreenshots = new Map(elementScreenshots);
    newElementScreenshots.delete(stepIndex);
    setElementScreenshots(newElementScreenshots);

    // completedSteps에서도 제거
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.delete(stepIndex);
    setCompletedSteps(newCompletedSteps);
  };

  const moveStep = async (fromIndex: number, toIndex: number) => {
    if (!flow) return;
    if (toIndex < 0 || toIndex >= flow.steps.length) return;
    const steps = [...flow.steps];
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    const updatedFlow: Flow = { ...flow, steps };
    await browser.storage.local.set({ flow: updatedFlow });
    setFlow(updatedFlow);
    setStatusMessage("Step order updated");
    setTimeout(() => setStatusMessage(""), 1200);
  };
  const handleUpdateStartUrl = async () => {
    if (!flow) return;

    const updatedFlow: Flow = {
      ...flow,
      startUrl: startUrl || undefined,
    };

    await browser.storage.local.set({ flow: updatedFlow });
    setFlow(updatedFlow);
    setStatusMessage("Start URL updated!");
    setTimeout(() => setStatusMessage(""), 2000);
  };

  const getStepDescription = (step: Step, index: number): string => {
    let urlInfo = "";
    if ("url" in step && step.url) {
      try {
        const url = new URL(step.url);
        urlInfo = ` (${url.hostname})`;
      } catch (error) {
        urlInfo = ` (${step.url})`;
      }
    }

    switch (step.type) {
      case "click":
        return `${index + 1}. Click on ${step.selector}${urlInfo}`;
      case "type":
        // 보안을 위해 마스킹된 텍스트 표시
        const typeStep = step as any;
        const displayText = typeStep.originalText
          ? "*".repeat(typeStep.originalText.length)
          : typeStep.text;
        return `${index + 1}. Type "${displayText}" into ${
          step.selector
        }${urlInfo}`;
      case "select":
        return `${index + 1}. Select "${(step as any).value}" in ${
          step.selector
        }${urlInfo}`;
      case "extract":
        return `${index + 1}. Extract ${
          (step as any).prop || "innerText"
        } from ${step.selector}${urlInfo}`;
      case "screenshot":
        return `${index + 1}. Screenshot of ${step.selector}${urlInfo}`;
      case "waitFor":
        return `${index + 1}. Wait for ${step.selector} (${
          (step as any).timeoutMs || 5000
        }ms)${urlInfo}`;
      case "navigate":
        return `${index + 1}. Navigate to ${step.url}`;
      case "waitForNavigation":
        return `${index + 1}. Wait for navigation (${
          (step as any).timeoutMs || 10000
        }ms)`;
      default:
        return `${index + 1}. Unknown action`;
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "16px",
        minHeight: "100vh",
        background: "#f9fafb",
      }}
    >
      <h2
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          marginBottom: "16px",
          color: "#111827",
        }}
      >
        Automation Wizard
      </h2>

      {/* 상태 메시지 */}
      {statusMessage && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: "12px",
            background: "#dbeafe",
            border: "1px solid #3b82f6",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#1e40af",
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* 실행 중인 스텝 정보 */}
      {executingStep && (
        <div
          style={{
            padding: "12px",
            marginBottom: "12px",
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#92400e",
              marginBottom: "8px",
            }}
          >
            🚀 Executing Step {executingStep.stepIndex + 1}/
            {executingStep.totalSteps}
          </div>

          <div
            style={{ fontSize: "12px", color: "#78350f", marginBottom: "4px" }}
          >
            <strong>Action:</strong>{" "}
            {getStepDescription(executingStep.step, executingStep.stepIndex)}
          </div>

          {executingStep.currentUrl && (
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                fontFamily: "monospace",
              }}
            >
              <strong>URL:</strong> {executingStep.currentUrl}
            </div>
          )}
        </div>
      )}

      {/* 시작 URL 입력 */}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: "500",
            marginBottom: "4px",
            color: "#374151",
          }}
        >
          Start URL (Optional)
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder="https://example.com (opens in new tab)"
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleUpdateStartUrl}
            style={{
              padding: "8px 12px",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            Save
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
          If set, Run will open a new tab with this URL first
        </p>
      </div>

      {/* 엔드포인트 입력 */}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: "500",
            marginBottom: "4px",
            color: "#374151",
          }}
        >
          Backend Endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://api.example.com/flows"
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "13px",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* 레코딩/실행 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={recording ? handleStopRecord : handleStartRecord}
          disabled={!!executingStep}
          style={{
            padding: "10px 16px",
            background: executingStep
              ? "#9ca3af"
              : recording
              ? "#ef4444"
              : "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: executingStep ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: "500",
            opacity: executingStep ? 0.6 : 1,
          }}
        >
          {recording ? "■ Stop" : "● Record"}
        </button>
        <button
          onClick={handleRun}
          disabled={!executingStep && (!flow || flow.steps.length === 0)}
          style={{
            padding: "10px 16px",
            background: executingStep
              ? "#ef4444"
              : !flow || flow.steps.length === 0
              ? "#9ca3af"
              : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor:
              !executingStep && (!flow || flow.steps.length === 0)
                ? "not-allowed"
                : "pointer",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          {executingStep ? "■ Stop Run" : "▶ Run"}
        </button>

        <button
          onClick={handleSend}
          disabled={!flow || flow.steps.length === 0}
          style={{
            padding: "10px 16px",
            background: flow && flow.steps.length > 0 ? "#10b981" : "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: flow && flow.steps.length > 0 ? "pointer" : "not-allowed",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          📤 Send
        </button>

        <button
          onClick={handleTogglePicker}
          style={{
            padding: "10px 16px",
            background: pickerOn ? "#f59e0b" : "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          {pickerOn ? "🖱️ Mouse ON" : "🖱️ Mouse OFF"}
        </button>

        <button
          onClick={handleReset}
          style={{
            padding: "10px 16px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          🗑 Reset
        </button>
      </div>

      {/* Recorded Steps - enhanced visibility and ordering */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#111827",
              margin: 0,
            }}
          >
            Recorded Steps ({flow?.steps.length || 0})
          </h3>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>
            Use ↑/↓ to reorder steps
          </span>
        </div>

        {!flow || flow.steps.length === 0 ? (
          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
              fontStyle: "italic",
            }}
          >
            마우스를 움직여서 엘리먼트를 선택하고 액션을 레코드하세요.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {flow.steps.map((step, index) => {
              const isExecuting = executingStep?.stepIndex === index;
              const isCompleted = completedSteps.has(index);
              const extractedValue = extractedData.get(index);
              const screenshot = elementScreenshots.get(index);

              return (
                <div
                  key={index}
                  style={{
                    padding: "8px 10px",
                    background: isExecuting
                      ? "#fef3c7"
                      : isCompleted
                      ? "#d1fae5"
                      : "#f9fafb",
                    border: isExecuting
                      ? "2px solid #f59e0b"
                      : isCompleted
                      ? "2px solid #10b981"
                      : "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#374151",
                    position: "relative",
                  }}
                >
                  {isExecuting && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        background: "#f59e0b",
                        color: "white",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: "bold",
                      }}
                    >
                      ▶
                    </div>
                  )}

                  {isCompleted && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        background: "#10b981",
                        color: "white",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: "bold",
                      }}
                    >
                      ✓
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "9999px",
                        background: "#6366f1",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#111827",
                          fontWeight: 500,
                          marginBottom: "2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={getStepDescription(step, index)}
                      >
                        {getStepDescription(step, index)}
                      </div>
                      {"selector" in step && (step as any).selector && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={(step as any).selector}
                        >
                          {(step as any).selector}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => moveStep(index, index - 1)}
                        title="Move up"
                        style={{
                          padding: "4px 6px",
                          background: "#e5e7eb",
                          border: "none",
                          borderRadius: "4px",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          opacity: index === 0 ? 0.5 : 1,
                          fontSize: "11px",
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveStep(index, index + 1)}
                        title="Move down"
                        style={{
                          padding: "4px 6px",
                          background: "#e5e7eb",
                          border: "none",
                          borderRadius: "4px",
                          cursor:
                            index === (flow?.steps.length || 1) - 1
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            index === (flow?.steps.length || 1) - 1 ? 0.5 : 1,
                          fontSize: "11px",
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(index);
                        }}
                        title="Delete this step"
                        style={{
                          padding: "4px 6px",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* 레코드된 스텝의 스크린샷 표시 */}
                  {"screenshot" in step && step.screenshot && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px",
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#0369a1",
                          marginBottom: "6px",
                          fontWeight: "500",
                        }}
                      >
                        📸 Recorded Element
                      </div>
                      <img
                        src={step.screenshot}
                        alt="Recorded element screenshot"
                        style={{
                          maxWidth: "100%",
                          height: "auto",
                          borderRadius: "4px",
                          border: "1px solid #7dd3fc",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                        onError={(e) => {
                          console.log("Recorded image failed to load:", e);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* 실행 중 생성된 스크린샷 표시 */}
                  {screenshot && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#475569",
                          marginBottom: "6px",
                          fontWeight: "500",
                        }}
                      >
                        📸 Element Preview
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#64748b",
                          marginBottom: "6px",
                        }}
                      >
                        <strong>Tag:</strong> {screenshot.elementInfo.tagName} |{" "}
                        <strong>Text:</strong>{" "}
                        {screenshot.elementInfo.text?.substring(0, 50)}
                        {screenshot.elementInfo.text?.length > 50 ? "..." : ""}
                      </div>
                      <img
                        src={screenshot.screenshot}
                        alt="Element screenshot"
                        style={{
                          maxWidth: "100%",
                          height: "auto",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                        onError={(e) => {
                          console.log("Image failed to load:", e);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extracted Data 섹션 */}
      {extractedData.size > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
            marginTop: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "12px",
              color: "#374151",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            📋 Extracted Data ({extractedData.size})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from(extractedData.entries()).map(([stepIndex, data]) => {
              const step = flow?.steps[stepIndex];
              if (!step) return null;

              return (
                <div
                  key={stepIndex}
                  style={{
                    padding: "8px 10px",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "500",
                      color: "#0369a1",
                      marginBottom: "4px",
                    }}
                  >
                    Step {stepIndex + 1}: {getStepDescription(step, stepIndex)}
                  </div>
                  <div
                    style={{
                      color: "#1e40af",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {String(data)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* JSON 뷰 (디버깅용) */}
      {flow && flow.steps.length > 0 && (
        <details style={{ marginTop: "16px" }}>
          <summary
            style={{
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            View JSON
          </summary>
          <pre
            style={{
              marginTop: "8px",
              padding: "12px",
              background: "#1f2937",
              color: "#f3f4f6",
              borderRadius: "6px",
              fontSize: "11px",
              overflow: "auto",
              maxHeight: "300px",
            }}
          >
            {JSON.stringify(flow, null, 2)}
          </pre>
        </details>
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
