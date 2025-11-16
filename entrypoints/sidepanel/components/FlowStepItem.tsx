import React, { useState } from "react";
import type { Step } from "../../../types";

interface FlowStepItemProps {
  step: Step;
  index: number;
  isExecuting: boolean;
  isCompleted: boolean;
  extractedData?: any;
  screenshot?: { screenshot: string; elementInfo: any };
  onRemove: (index: number) => void;
  onEdit?: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

/**
 * Flow의 개별 Step을 표시하는 컴포넌트
 */
export function FlowStepItem({
  step,
  index,
  isExecuting,
  isCompleted,
  extractedData,
  screenshot,
  onRemove,
  onEdit,
  onReorder,
}: FlowStepItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
    const toIndex = index;

    if (onReorder && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  const getStepIcon = (type: Step["type"]) => {
    switch (type) {
      case "click":
        return "🖱️";
      case "type":
        return "⌨️";
      case "select":
        return "📋";
      case "extract":
        return "📤";
      case "navigate":
        return "🔗";
      case "waitFor":
        return "⏱️";
      default:
        return "❓";
    }
  };

  const getStepDescription = (step: Step) => {
    switch (step.type) {
      case "click":
        return `Click ${step.selector}`;
      case "type":
        return `Type "${step.text || step.originalText}" into ${step.selector}${
          step.submit ? " (Submit)" : ""
        }`;
      case "select":
        return `Select "${step.value}" in ${step.selector}`;
      case "extract":
        return `Extract from ${step.selector}`;
      case "navigate":
        return `Navigate to ${step.url}`;
      case "waitFor":
        return `Wait for ${step.selector || `${step.timeoutMs}ms`}`;
      default:
        return JSON.stringify(step);
    }
  };

  return (
    <div
      draggable={onReorder !== undefined}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: "12px",
        background: isDragging
          ? "#e0e7ff"
          : isDragOver
          ? "#fef3c7"
          : isExecuting
          ? "#fef3c7"
          : isCompleted
          ? "#d1fae5"
          : "#f9fafb",
        borderLeft: isDragOver
          ? "3px solid #3b82f6"
          : isExecuting
          ? "3px solid #f59e0b"
          : isCompleted
          ? "3px solid #10b981"
          : "3px solid #e5e7eb",
        borderRadius: "6px",
        marginBottom: "8px",
        transition: "all 0.2s ease",
        cursor: onReorder ? "move" : "default",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Step Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onReorder && (
            <span
              style={{
                fontSize: "14px",
                cursor: "grab",
                color: "#9ca3af",
              }}
              title="Drag to reorder"
            >
              ⋮⋮
            </span>
          )}
          <span style={{ fontSize: "16px" }}>{getStepIcon(step.type)}</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#6b7280",
            }}
          >
            Step {index + 1}
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 6px",
              background: "#e5e7eb",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            {step.type}
          </span>
          {isExecuting && (
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                background: "#fbbf24",
                color: "#78350f",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Running...
            </span>
          )}
          {isCompleted && (
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                background: "#10b981",
                color: "white",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              ✓ Done
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "4px" }}>
          {onEdit && (
            <button
              onClick={() => onEdit(index)}
              style={{
                padding: "4px 8px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onRemove(index)}
            style={{
              padding: "4px 8px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Step Description */}
      <div
        style={{
          fontSize: "12px",
          color: "#374151",
          marginBottom: extractedData || screenshot ? "8px" : "0",
          wordBreak: "break-word",
        }}
      >
        {getStepDescription(step)}
      </div>

      {/* Extracted Data */}
      {extractedData !== undefined && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px",
            background: "#dbeafe",
            borderRadius: "4px",
            fontSize: "11px",
            color: "#1e40af",
            fontFamily: "monospace",
          }}
        >
          <strong>Extracted:</strong> {JSON.stringify(extractedData)}
        </div>
      )}

      {/* Screenshot */}
      {screenshot && (
        <div style={{ marginTop: "8px" }}>
          <img
            src={screenshot.screenshot}
            alt="Element screenshot"
            style={{
              maxWidth: "100%",
              borderRadius: "4px",
              border: "1px solid #e5e7eb",
            }}
          />
        </div>
      )}
    </div>
  );
}

