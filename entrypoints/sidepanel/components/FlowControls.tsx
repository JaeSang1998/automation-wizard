import React from "react";

interface FlowControlsProps {
  recording: boolean;
  pickerOn: boolean;
  isRunning: boolean;
  hasSteps: boolean;
  onTogglePicker: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
  onUndo: () => void;
  onSendToBackend: () => void;
}

/**
 * Flow 제어 버튼들을 표시하는 컴포넌트
 */
export function FlowControls({
  recording,
  pickerOn,
  isRunning,
  hasSteps,
  onTogglePicker,
  onStartRecording,
  onStopRecording,
  onRun,
  onStop,
  onClear,
  onUndo,
  onSendToBackend,
}: FlowControlsProps) {
  return (
    <div
      style={{
        padding: "16px",
        background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {/* Main Action Buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <button
          onClick={onTogglePicker}
          style={{
            flex: 1,
            padding: "10px",
            background: pickerOn ? "#10b981" : "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          {pickerOn ? "🎯 Picker ON" : "🎯 Turn ON Picker"}
        </button>

        {recording ? (
          <button
            onClick={onStopRecording}
            style={{
              flex: 1,
              padding: "10px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            ⏹️ Stop Recording
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            style={{
              flex: 1,
              padding: "10px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            ⏺️ Start Recording
          </button>
        )}
      </div>

      {/* Flow Action Buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        {isRunning ? (
          <button
            onClick={onStop}
            style={{
              flex: 1,
              padding: "10px",
              background: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            ⏸️ Stop Flow
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!hasSteps}
            style={{
              flex: 1,
              padding: "10px",
              background: hasSteps ? "#3b82f6" : "#9ca3af",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: hasSteps ? "pointer" : "not-allowed",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            ▶️ Run Flow
          </button>
        )}

        <button
          onClick={onUndo}
          disabled={!hasSteps || isRunning}
          style={{
            padding: "10px 16px",
            background: !hasSteps || isRunning ? "#d1d5db" : "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: !hasSteps || isRunning ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          ↩️ Undo
        </button>

        <button
          onClick={onClear}
          disabled={!hasSteps || recording || isRunning}
          style={{
            padding: "10px 16px",
            background:
              !hasSteps || recording || isRunning ? "#d1d5db" : "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor:
              !hasSteps || recording || isRunning ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          🗑️ Clear
        </button>

        <button
          onClick={onSendToBackend}
          disabled={!hasSteps || isRunning}
          style={{
            padding: "10px 16px",
            background: !hasSteps || isRunning ? "#d1d5db" : "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: !hasSteps || isRunning ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          📤 Send
        </button>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
        `}
      </style>
    </div>
  );
}

