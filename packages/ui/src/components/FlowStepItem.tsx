import {
  MousePointer2,
  Keyboard,
  ListChecks,
  Download,
  Globe,
  Clock,
  X,
  Shield,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Step } from "@auto-wiz/core";

interface FlowStepItemProps {
  step: Step;
  index: number;
  isExecuting: boolean;
  isCompleted: boolean;
  extractedData?: any;
  screenshot?: { screenshot: string; elementInfo: any };
  onRemove: (index: number) => void;

  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  totalSteps?: number;
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

  onMoveUp,
  onMoveDown,
  totalSteps = 0,
}: FlowStepItemProps) {
  const getStepIcon = (type: Step["type"]) => {
    const iconProps = { size: 16, strokeWidth: 2 };
    switch (type) {
      case "click":
        return <MousePointer2 {...iconProps} />;
      case "type":
        return <Keyboard {...iconProps} />;
      case "select":
        return <ListChecks {...iconProps} />;
      case "extract":
        return <Download {...iconProps} />;
      case "navigate":
        return <Globe {...iconProps} />;
      case "waitFor":
        return <Clock {...iconProps} />;
      default:
        return null;
    }
  };

  const getStepLabel = (type: Step["type"]) => {
    switch (type) {
      case "click":
        return "Click";
      case "type":
        return "Type";
      case "select":
        return "Select";
      case "extract":
        return "Extract";
      case "navigate":
        return "Navigate";
      case "waitFor":
        return "Wait";
      default:
        return "Action";
    }
  };

  /**
   * 메타데이터를 활용해서 사람이 읽기 쉬운 요소 설명 생성
   */
  const getElementDescription = (step: Step): string => {
    if (step.type === "navigate" || step.type === "waitForNavigation") {
      return "";
    }

    const locator = "locator" in step ? step.locator : undefined;
    const metadata = locator?.metadata;

    if (!metadata) {
      // fallback: selector를 간략하게 표시
      const selector = "selector" in step ? step.selector : "";
      return simplifySelector(selector);
    }

    // 메타데이터에서 가장 의미있는 정보 추출
    const parts: string[] = [];

    // 1순위: text content
    if (metadata.text) {
      parts.push(`"${truncateText(metadata.text, 30)}"`);
    }

    // 2순위: placeholder (input 필드인 경우)
    else if (metadata.placeholder) {
      parts.push(`"${metadata.placeholder}"`);
    }

    // 3순위: aria-label
    else if (metadata.ariaLabel) {
      parts.push(`"${metadata.ariaLabel}"`);
    }

    // 4순위: title
    else if (metadata.title) {
      parts.push(`"${metadata.title}"`);
    }

    // 요소 타입 정보
    if (metadata.role) {
      parts.push(metadata.role);
    } else if (
      metadata.tagName &&
      metadata.tagName !== "div" &&
      metadata.tagName !== "span"
    ) {
      parts.push(metadata.tagName);
    }

    // testId가 있으면 힌트로 표시
    if (metadata.testId && parts.length === 0) {
      parts.push(`[${metadata.testId}]`);
    }

    return parts.length > 0
      ? parts.join(" ")
      : simplifySelector("selector" in step ? step.selector : "");
  };

  /**
   * Selector를 간략하게 표시 (ID나 class만 추출)
   */
  const simplifySelector = (selector?: string): string => {
    if (!selector) return "element";

    // ID selector
    const idMatch = selector.match(/#([\w-]+)/);
    if (idMatch) return `#${idMatch[1]}`;

    // data-testid
    const testIdMatch = selector.match(/\[data-testid=["']([^"']+)["']\]/);
    if (testIdMatch) return `[${testIdMatch[1]}]`;

    // class (첫 번째만)
    const classMatch = selector.match(/\.([\w-]+)/);
    if (classMatch) return `.${classMatch[1]}`;

    // 태그명
    const tagMatch = selector.match(/^(\w+)/);
    if (tagMatch) return tagMatch[1];

    return "element";
  };

  /**
   * 텍스트를 truncate
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  /**
   * Step의 주요 액션을 사람이 읽기 쉬운 형태로 표시
   */
  const getStepDescription = (step: Step) => {
    const elementDesc = getElementDescription(step);

    switch (step.type) {
      case "click":
        return elementDesc ? `Click ${elementDesc}` : "Click element";
      case "type":
        const textToShow = step.text || step.originalText || "";
        const displayText =
          textToShow.length > 30
            ? textToShow.substring(0, 30) + "..."
            : textToShow;
        return `Type "${displayText}"${
          elementDesc ? ` into ${elementDesc}` : ""
        }${step.submit ? " ⏎" : ""}`;
      case "select":
        return `Select "${step.value}"${
          elementDesc ? ` from ${elementDesc}` : ""
        }`;
      case "extract":
        return elementDesc ? `Extract from ${elementDesc}` : "Extract data";
      case "navigate":
        const url =
          step.url.length > 50 ? step.url.substring(0, 50) + "..." : step.url;
        return `Navigate to ${url}`;
      case "waitFor":
        if (step.selector) {
          return elementDesc ? `Wait for ${elementDesc}` : "Wait for element";
        }
        return `Wait ${step.timeoutMs}ms`;
      default:
        return JSON.stringify(step);
    }
  };

  /**
   * Selector 신뢰도 계산 (높을수록 견고함)
   */
  const getSelectorReliability = (step: Step): "high" | "medium" | "low" => {
    if (step.type === "navigate" || step.type === "waitForNavigation") {
      return "high"; // URL은 항상 신뢰도 높음
    }

    const locator = "locator" in step ? step.locator : undefined;

    if (!locator) {
      return "low"; // locator가 없으면 낮음
    }

    const metadata = locator.metadata;
    const fallbackCount = locator.fallbacks?.length || 0;

    // testId나 role이 있고 fallback이 있으면 높음
    if (metadata?.testId || metadata?.role) {
      return fallbackCount >= 1 ? "high" : "medium";
    }

    // fallback이 2개 이상이면 중간
    if (fallbackCount >= 2) {
      return "medium";
    }

    return "low";
  };

  /**
   * 신뢰도 뱃지 렌더링
   */
  const renderReliabilityBadge = (reliability: "high" | "medium" | "low") => {
    if (reliability === "high") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            padding: "4px 8px",
            background: "#dcfce7",
            color: "#16a34a",
            borderRadius: "4px",
            fontWeight: 600,
          }}
          title="Highly reliable selector with multiple fallbacks"
        >
          <Shield size={11} strokeWidth={2.5} />
          Robust
        </span>
      );
    }

    if (reliability === "low") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            padding: "4px 8px",
            background: "#fee2e2",
            color: "#dc2626",
            borderRadius: "4px",
            fontWeight: 600,
          }}
          title="Basic CSS selector - may be fragile"
        >
          <ShieldAlert size={11} strokeWidth={2.5} />
          Basic
        </span>
      );
    }

    return null; // medium은 표시 안함 (노이즈 줄이기)
  };

  return (
    <div
      style={{
        padding: "16px 0",
        borderBottom: "1px solid #f5f5f5",
        borderLeft: isExecuting
          ? "3px solid #1a1a1a"
          : isCompleted
          ? "3px solid #737373"
          : "3px solid transparent",
        paddingLeft: "12px",
        background: isExecuting
          ? "#fafafa"
          : isCompleted
          ? "#f9f9f9"
          : "transparent",
        transition: "all 0.15s ease",
      }}
    >
      {/* Step Header */}
      <div style={{ marginBottom: "12px" }}>
        {/* 첫 번째 줄: 번호, 타입, 상태, 이동 버튼 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "0",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#737373",
              minWidth: "20px",
            }}
          >
            {index + 1}
          </span>
          <span
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              background: "#f5f5f5",
              borderRadius: "4px",
              fontWeight: 500,
              color: "#404040",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {getStepIcon(step.type)}
            {getStepLabel(step.type)}
          </span>
          {renderReliabilityBadge(getSelectorReliability(step))}
          {isExecuting && (
            <span
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: "#1a1a1a",
                color: "#ffffff",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Running
            </span>
          )}
          {isCompleted && (
            <span
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: "#737373",
                color: "#ffffff",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Done
            </span>
          )}

          {/* 우측 버튼 그룹: 이동 + 삭제 */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginLeft: "auto",
              alignItems: "center",
              paddingRight: "12px",
            }}
          >
            {(onMoveUp || onMoveDown) && (
              <>
                <button
                  onClick={() => onMoveUp?.(index)}
                  disabled={index === 0}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    color: index === 0 ? "#d4d4d4" : "#737373",
                    border: "none",
                    cursor: index === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: index === 0 ? 0.3 : 1,
                  }}
                  title="Move up"
                >
                  <ChevronUp size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => onMoveDown?.(index)}
                  disabled={index === totalSteps - 1}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    color: index === totalSteps - 1 ? "#d4d4d4" : "#737373",
                    border: "none",
                    cursor:
                      index === totalSteps - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: index === totalSteps - 1 ? 0.3 : 1,
                  }}
                  title="Move down"
                >
                  <ChevronDown size={16} strokeWidth={2} />
                </button>
              </>
            )}
            <button
              onClick={() => onRemove(index)}
              style={{
                padding: "4px",
                background: "transparent",
                color: "#a3a3a3",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Remove"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Step Description */}
      <div
        style={{
          fontSize: "14px",
          color: "#404040",
          marginBottom: extractedData || screenshot ? "10px" : "0",
          paddingRight: "12px",
          wordBreak: "break-word",
          lineHeight: "1.5",
        }}
      >
        {getStepDescription(step)}
      </div>

      {/* Extracted Data */}
      {extractedData !== undefined && (
        <div
          style={{
            marginTop: "12px",
            marginRight: "12px",
            padding: "12px",
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#404040",
            fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
            lineHeight: "1.6",
          }}
        >
          <strong style={{ fontWeight: 500 }}>Extracted:</strong>{" "}
          {JSON.stringify(extractedData)}
        </div>
      )}

      {/* Screenshot */}
      {screenshot && (
        <div style={{ marginTop: "12px", marginRight: "12px" }}>
          <img
            src={screenshot.screenshot}
            alt="Element screenshot"
            style={{
              maxWidth: "100%",
              borderRadius: "6px",
              border: "1px solid #e5e5e5",
            }}
          />
        </div>
      )}
    </div>
  );
}
