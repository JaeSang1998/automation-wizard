import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MousePointer2,
  Keyboard,
  ListChecks,
  Download,
  Globe,
  Clock,
  Camera,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Step } from "@auto-wiz/core";
import { makeSelector, generateRobustLocator } from "@auto-wiz/dom";

interface HoverToolbarProps {
  x: number;
  y: number;
  target: HTMLElement | null;
  locked: boolean;
  onRecord: (step: Step) => void;
  onNavigateParent?: () => void;
  onNavigateChild?: () => void;
  onShowTextInput?: (callback: (text: string | null) => void) => void;
  onShowSelectOption?: (
    options: Array<{ index: number; value: string; text: string }>,
    callback: (selectedValue: string | null) => void
  ) => void;
}

/**
 * 호버된 요소 위에 표시되는 툴바 컴포넌트
 *
 * 기능:
 * - Click, Type, Select, Extract 등의 액션 버튼 제공
 * - 드래그 앤 드롭으로 이동 가능 (locked 상태일 때)
 * - Element 스크린샷 캡처
 * - 부모/자식 요소 탐색
 */
export default function HoverToolbar({
  x,
  y,
  target,
  locked,
  onRecord,
  onNavigateParent,
  onNavigateChild,
  onShowTextInput,
  onShowSelectOption,
}: HoverToolbarProps) {
  if (!target) return null;

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [userMoved, setUserMoved] = useState(false);

  // 초기 위치 계산 (즉시 실행)
  const getInitialPosition = () => {
    // localStorage에서 저장된 위치 확인
    try {
      const savedPosition = localStorage.getItem(
        "automation-wizard-toolbar-position"
      );
      if (savedPosition) {
        return JSON.parse(savedPosition);
      }
    } catch (e) {
      // 파싱 실패 시 무시
    }

    // 기본 위치: 우측 하단
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const estimatedWidth = 250;
    const estimatedHeight = 100;

    return {
      x: Math.max(20, viewportWidth - estimatedWidth - 20),
      y: Math.max(20, viewportHeight - estimatedHeight - 20),
    };
  };

  const [position, setPosition] = useState<{ x: number; y: number }>(
    getInitialPosition
  );

  // 실제 렌더링 후 위치 미세 조정
  useEffect(() => {
    if (!toolbarRef.current || userMoved) return;

    const toolbar = toolbarRef.current;
    const rect = toolbar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 실제 크기에 맞춰 위치 재조정
    const adjustedX = viewportWidth - rect.width - 20;
    const adjustedY = viewportHeight - rect.height - 20;

    // 위치가 많이 다르면 업데이트
    if (
      Math.abs(position.x - adjustedX) > 50 ||
      Math.abs(position.y - adjustedY) > 50
    ) {
      setPosition({ x: Math.max(20, adjustedX), y: Math.max(20, adjustedY) });
    }
  }, [toolbarRef.current, locked]);

  // 드래그 핸들러
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!toolbarRef.current) return;

      const rect = toolbarRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const clampedX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
      const clampedY = Math.max(
        0,
        Math.min(newY, viewportHeight - rect.height)
      );

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setUserMoved(true);

      // 드래그가 끝나면 위치를 localStorage에 저장
      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        const savedPos = { x: rect.left, y: rect.top };
        localStorage.setItem(
          "automation-wizard-toolbar-position",
          JSON.stringify(savedPos)
        );
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, setUserMoved]);

  // Element 정보 추출
  const getElementInfo = useCallback((el: HTMLElement) => {
    const tagName = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classes = el.className
      ? `.${el.className.split(" ").filter(Boolean).join(".")}`
      : "";
    const text =
      el.innerText?.substring(0, 30) || el.textContent?.substring(0, 30) || "";
    return { tagName, id, classes, text };
  }, []);

  const elementInfo = getElementInfo(target);
  const hasParent =
    target.parentElement !== null && target.parentElement !== document.body;
  const hasChild = target.children.length > 0;

  // selector와 locator는 target이 변경될 때마다 재계산
  const selector = makeSelector(target); // UI 표시용
  const locator = generateRobustLocator(target); // Step 기록용

  /**
   * Element 스크린샷 캡처
   */
  const captureElementScreenshot = useCallback(
    async (element: HTMLElement, selector: string) => {
      try {
        const rect = element.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {
          console.log("Element has no visible size, skipping screenshot");
          return null;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // 캔버스 크기 설정
        canvas.width = Math.max(rect.width, 200);
        canvas.height = Math.max(rect.height, 100);

        // 배경 그리기
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 엘리먼트의 실제 스타일 정보 가져오기
        const computedStyle = window.getComputedStyle(element);
        const backgroundColor = computedStyle.backgroundColor;
        const borderColor = computedStyle.borderColor;
        const borderWidth = computedStyle.borderWidth;
        const color = computedStyle.color;
        const fontSize = computedStyle.fontSize;
        const fontFamily = computedStyle.fontFamily;

        // 배경색 적용
        if (
          backgroundColor &&
          backgroundColor !== "rgba(0, 0, 0, 0)" &&
          backgroundColor !== "transparent"
        ) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 테두리 그리기
        if (borderWidth && borderWidth !== "0px") {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = parseInt(borderWidth) || 1;
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
        }

        // 텍스트 내용 그리기
        const text = element.innerText || element.textContent || "";
        if (text) {
          ctx.fillStyle = color || "#000000";
          ctx.font = `${fontSize || "14px"} ${fontFamily || "system-ui"}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // 텍스트가 캔버스보다 크면 줄바꿈
          const maxWidth = canvas.width - 20;
          const words = text.split(" ");
          let line = "";
          let y = canvas.height / 2;

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " ";
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
              ctx.fillText(line, canvas.width / 2, y);
              line = words[n] + " ";
              y += parseInt(fontSize) || 14;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, canvas.width / 2, y);
        }

        // 엘리먼트 타입 표시
        ctx.fillStyle = "#666666";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(element.tagName.toLowerCase(), 5, canvas.height - 5);

        return canvas.toDataURL("image/png");
      } catch (error) {
        console.warn("Failed to capture screenshot:", error);
        return null;
      }
    },
    []
  );

  /**
   * 액션 핸들러들
   */
  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 최신 target 기반으로 selector와 locator 재계산
      const currentSelector = makeSelector(target);
      const currentLocator = generateRobustLocator(target);
      const screenshot = await captureElementScreenshot(
        target,
        currentSelector
      );

      onRecord({
        type: "click",
        selector: currentSelector, // 하위 호환성
        locator: currentLocator, // 새로운 다중 selector 시스템
        url: window.location.href,
        screenshot: screenshot || undefined,
      });
    },
    [target, captureElementScreenshot, onRecord]
  );

  const handleScreenshot = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const screenshot = await captureElementScreenshot(target, selector);

      if (screenshot) {
        // 스크린샷을 다운로드
        const link = document.createElement("a");
        link.href = screenshot;
        link.download = `element-screenshot-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 스크린샷 촬영 피드백
        alert("📸 Screenshot saved!");
      }
    },
    [target, selector, captureElementScreenshot]
  );

  const handleType = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 최신 target 기반으로 selector와 locator 재계산
      const currentSelector = makeSelector(target);
      const currentLocator = generateRobustLocator(target);

      const onTextInput = (text: string | null) => {
        if (text !== null) {
          const maskedDisplayText = "*".repeat(text.length);
          captureElementScreenshot(target, currentSelector).then(
            (screenshot) => {
              onRecord({
                type: "type",
                selector: currentSelector, // 하위 호환성
                locator: currentLocator, // 새로운 다중 selector 시스템
                text: maskedDisplayText,
                originalText: text,
                url: window.location.href,
                screenshot: screenshot || undefined,
              });
            }
          );
        }
      };

      if (onShowTextInput) {
        onShowTextInput(onTextInput);
      } else {
        // Fallback to prompt
        const text = prompt(
          "입력할 텍스트를 입력하세요 (보안상 마스킹됩니다):"
        );
        onTextInput(text);
      }
    },
    [target, captureElementScreenshot, onRecord, onShowTextInput]
  );

  const handleSelect = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!(target instanceof HTMLSelectElement)) {
        alert("This element is not a select element!");
        return;
      }

      // 최신 target 기반으로 selector와 locator 재계산
      const currentSelector = makeSelector(target);
      const currentLocator = generateRobustLocator(target);

      const options = Array.from(target.options).map((opt, idx) => ({
        index: idx,
        value: opt.value,
        text: opt.text,
      }));

      const onSelectOption = (selectedValue: string | null) => {
        if (selectedValue !== null) {
          captureElementScreenshot(target, currentSelector).then(
            (screenshot) => {
              onRecord({
                type: "select",
                selector: currentSelector, // 하위 호환성
                locator: currentLocator, // 새로운 다중 selector 시스템
                value: selectedValue,
                url: window.location.href,
                screenshot: screenshot || undefined,
              });
            }
          );
        }
      };

      if (onShowSelectOption) {
        onShowSelectOption(options, onSelectOption);
      } else {
        // Fallback to prompt
        const selectedValue = prompt(
          `옵션을 선택하세요:\n${options
            .map((o) => `${o.index}: ${o.text}`)
            .join("\n")}\n\n선택한 옵션의 인덱스를 입력하세요:`
        );
        if (selectedValue !== null) {
          const idx = parseInt(selectedValue);
          if (!isNaN(idx) && options[idx]) {
            onSelectOption(options[idx].value);
          }
        }
      }
    },
    [target, captureElementScreenshot, onRecord, onShowSelectOption]
  );

  const handleExtract = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 최신 target 기반으로 selector와 locator 재계산
      const currentSelector = makeSelector(target);
      const currentLocator = generateRobustLocator(target);
      const screenshot = await captureElementScreenshot(
        target,
        currentSelector
      );

      onRecord({
        type: "extract",
        selector: currentSelector, // 하위 호환성
        locator: currentLocator, // 새로운 다중 selector 시스템
        url: window.location.href,
        screenshot: screenshot || undefined,
      });
    },
    [target, captureElementScreenshot, onRecord]
  );

  const handleNavigate = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const url = window.location.href;
      onRecord({
        type: "navigate",
        url,
      });
    },
    [onRecord]
  );

  const handleWaitFor = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 최신 target 기반으로 selector와 locator 재계산
      const currentSelector = makeSelector(target);
      const currentLocator = generateRobustLocator(target);

      const timeoutStr = prompt("Wait timeout (ms, default: 5000):");
      const timeoutMs = timeoutStr ? parseInt(timeoutStr) : 5000;

      if (!isNaN(timeoutMs)) {
        onRecord({
          type: "waitFor",
          selector: currentSelector, // 하위 호환성
          locator: currentLocator, // 새로운 다중 selector 시스템
          timeoutMs,
          url: window.location.href,
        });
      }
    },
    [target, onRecord]
  );

  return (
    <div
      ref={toolbarRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        background: "#ffffff",
        color: "#1a1a1a",
        padding: locked ? "16px" : "12px",
        borderRadius: "12px",
        boxShadow: locked
          ? "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)"
          : "0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)",
        zIndex: 2147483647,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
        fontSize: "13px",
        pointerEvents: "auto",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: isDragging ? "none" : "all 0.2s ease",
        border: locked ? "2px solid #1a1a1a" : "1px solid #e5e5e5",
        minWidth: locked ? "320px" : "auto",
        maxWidth: locked ? "480px" : "auto",
      }}
    >
      {/* Element Info (항상 표시, locked일 때 더 상세) */}
      {locked ? (
        <div
          style={{
            marginBottom: "16px",
            paddingBottom: "16px",
            borderBottom: "1px solid #e5e5e5",
          }}
        >
          <div
            style={{
              fontWeight: "500",
              marginBottom: "10px",
              color: "#1a1a1a",
              fontSize: "12px",
              letterSpacing: "-0.01em",
            }}
          >
            Selected Element
          </div>
          <div
            style={{ fontSize: "12px", color: "#404040", lineHeight: "1.6" }}
          >
            <div style={{ marginBottom: "6px" }}>
              <strong style={{ color: "#1a1a1a", fontWeight: 500 }}>
                {elementInfo.tagName}
              </strong>
              {elementInfo.id && (
                <span style={{ color: "#737373", marginLeft: "6px" }}>
                  {elementInfo.id}
                </span>
              )}
              {elementInfo.classes && (
                <span style={{ color: "#737373", marginLeft: "6px" }}>
                  {elementInfo.classes}
                </span>
              )}
            </div>
            {elementInfo.text && (
              <div
                style={{
                  fontStyle: "italic",
                  color: "#737373",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "10px",
                }}
              >
                "{elementInfo.text}"
              </div>
            )}

            {/* Full Selector */}
            <div
              style={{
                marginTop: "10px",
                padding: "10px",
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                fontSize: "11px",
                fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
                color: "#404040",
                wordBreak: "break-all",
                lineHeight: "1.5",
              }}
            >
              {selector}
            </div>

            {/* 키보드 단축키 안내 */}
            <div
              style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "#a3a3a3",
                textAlign: "center",
              }}
            >
              ↑ ArrowUp | ↓ ArrowDown | ESC: Unlock
            </div>
          </div>

          {/* 요소 탐색 버튼 */}
          {(onNavigateParent || onNavigateChild) && (
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              {onNavigateParent && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigateParent();
                  }}
                  disabled={!hasParent}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: hasParent ? "#f5f5f5" : "#fafafa",
                    color: hasParent ? "#404040" : "#a3a3a3",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    cursor: hasParent ? "pointer" : "not-allowed",
                    fontSize: "12px",
                    fontWeight: "500",
                    transition: "all 0.15s ease",
                    letterSpacing: "-0.01em",
                    opacity: hasParent ? 1 : 0.4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ChevronUp size={14} strokeWidth={2} />
                  Parent
                </button>
              )}
              {onNavigateChild && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigateChild();
                  }}
                  disabled={!hasChild}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: hasChild ? "#f5f5f5" : "#fafafa",
                    color: hasChild ? "#404040" : "#a3a3a3",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    cursor: hasChild ? "pointer" : "not-allowed",
                    fontSize: "12px",
                    fontWeight: "500",
                    transition: "all 0.15s ease",
                    letterSpacing: "-0.01em",
                    opacity: hasChild ? 1 : 0.4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ChevronDown size={14} strokeWidth={2} />
                  Child
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            marginBottom: "10px",
            fontSize: "12px",
            color: "#737373",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <strong style={{ fontWeight: 500, color: "#1a1a1a" }}>
            {elementInfo.tagName}
          </strong>
          <span style={{ marginLeft: "6px" }}>{elementInfo.id}</span>
          <span style={{ marginLeft: "4px" }}>{elementInfo.classes}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <ActionButton
          onClick={handleClick}
          locked={locked}
          icon={<MousePointer2 size={14} strokeWidth={2} />}
        >
          Click
        </ActionButton>
        <ActionButton
          onClick={handleScreenshot}
          locked={locked}
          icon={<Camera size={14} strokeWidth={2} />}
        >
          Screenshot
        </ActionButton>
        <ActionButton
          onClick={handleType}
          locked={locked}
          icon={<Keyboard size={14} strokeWidth={2} />}
        >
          Type
        </ActionButton>
        {target instanceof HTMLSelectElement && (
          <ActionButton
            onClick={handleSelect}
            locked={locked}
            icon={<ListChecks size={14} strokeWidth={2} />}
          >
            Select
          </ActionButton>
        )}
        <ActionButton
          onClick={handleExtract}
          locked={locked}
          icon={<Download size={14} strokeWidth={2} />}
        >
          Extract
        </ActionButton>
        <ActionButton
          onClick={handleNavigate}
          locked={locked}
          icon={<Globe size={14} strokeWidth={2} />}
        >
          Navigate
        </ActionButton>
        <ActionButton
          onClick={handleWaitFor}
          locked={locked}
          icon={<Clock size={14} strokeWidth={2} />}
        >
          Wait
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * 액션 버튼 컴포넌트
 */
function ActionButton({
  onClick,
  locked,
  disabled = false,
  icon,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  locked: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "8px 14px",
        background: disabled ? "#fafafa" : hover ? "#f5f5f5" : "#ffffff",
        color: disabled ? "#a3a3a3" : "#1a1a1a",
        border: "1px solid #e5e5e5",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "13px",
        fontWeight: "500",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        letterSpacing: "-0.01em",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
