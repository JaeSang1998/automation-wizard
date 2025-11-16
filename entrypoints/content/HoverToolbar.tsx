import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Step } from "../../types";
import { makeSelector } from "../../lib/selectors/selectorGenerator";

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
      const savedPosition = localStorage.getItem('automation-wizard-toolbar-position');
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

  const [position, setPosition] = useState<{ x: number; y: number }>(getInitialPosition);

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
    if (Math.abs(position.x - adjustedX) > 50 || Math.abs(position.y - adjustedY) > 50) {
      setPosition({ x: Math.max(20, adjustedX), y: Math.max(20, adjustedY) });
    }
  }, [toolbarRef.current, locked]);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

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
      const clampedY = Math.max(0, Math.min(newY, viewportHeight - rect.height));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setUserMoved(true);
      
      // 드래그가 끝나면 위치를 localStorage에 저장
      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        const savedPos = { x: rect.left, y: rect.top };
        localStorage.setItem('automation-wizard-toolbar-position', JSON.stringify(savedPos));
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
  const hasParent = target.parentElement !== null && target.parentElement !== document.body;
  const hasChild = target.children.length > 0;
  const selector = makeSelector(target);

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
      const screenshot = await captureElementScreenshot(target, selector);
      onRecord({
        type: "click",
        selector,
        url: window.location.href,
        screenshot: screenshot || undefined,
      });
    },
    [target, selector, captureElementScreenshot, onRecord]
  );

  const handleScreenshot = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const screenshot = await captureElementScreenshot(target, selector);
      
      if (screenshot) {
        // 스크린샷을 다운로드
        const link = document.createElement('a');
        link.href = screenshot;
        link.download = `element-screenshot-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 스크린샷 촬영 피드백
        alert('📸 Screenshot saved!');
      }
    },
    [target, selector, captureElementScreenshot]
  );

  const handleType = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const onTextInput = (text: string | null) => {
        if (text !== null) {
          const maskedDisplayText = "*".repeat(text.length);
          captureElementScreenshot(target, selector).then((screenshot) => {
            onRecord({
              type: "type",
              selector,
              text: maskedDisplayText,
              originalText: text,
              url: window.location.href,
              screenshot: screenshot || undefined,
            });
          });
        }
      };

      if (onShowTextInput) {
        onShowTextInput(onTextInput);
      } else {
        // Fallback to prompt
        const text = prompt("입력할 텍스트를 입력하세요 (보안상 마스킹됩니다):");
        onTextInput(text);
      }
    },
    [target, selector, captureElementScreenshot, onRecord, onShowTextInput]
  );

  const handleSelect = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!(target instanceof HTMLSelectElement)) {
        alert("This element is not a select element!");
        return;
      }

      const options = Array.from(target.options).map((opt, idx) => ({
        index: idx,
        value: opt.value,
        text: opt.text,
      }));

      const onSelectOption = (selectedValue: string | null) => {
        if (selectedValue !== null) {
          captureElementScreenshot(target, selector).then((screenshot) => {
            onRecord({
              type: "select",
              selector,
              value: selectedValue,
              url: window.location.href,
              screenshot: screenshot || undefined,
            });
          });
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
    [target, selector, captureElementScreenshot, onRecord, onShowSelectOption]
  );

  const handleExtract = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const screenshot = await captureElementScreenshot(target, selector);
      onRecord({
        type: "extract",
        selector,
        url: window.location.href,
        screenshot: screenshot || undefined,
      });
    },
    [target, selector, captureElementScreenshot, onRecord]
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
      const timeoutStr = prompt("Wait timeout (ms, default: 5000):");
      const timeoutMs = timeoutStr ? parseInt(timeoutStr) : 5000;
      
      if (!isNaN(timeoutMs)) {
        onRecord({
          type: "waitFor",
          selector,
          timeoutMs,
          url: window.location.href,
        });
      }
    },
    [selector, onRecord]
  );

  return (
    <div
      ref={toolbarRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        background: locked ? "#1f2937" : "#2d3748",
        color: "#f7fafc",
        padding: locked ? "12px" : "8px",
        borderRadius: "8px",
        boxShadow: locked
          ? "0 4px 16px rgba(245, 158, 11, 0.3)"
          : "0 2px 8px rgba(0, 0, 0, 0.2)",
        zIndex: 2147483647,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        pointerEvents: "auto",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: isDragging ? "none" : "all 0.2s ease",
        border: locked ? "2px solid #f59e0b" : "1px solid #4a5568",
        minWidth: locked ? "300px" : "auto",
        maxWidth: locked ? "450px" : "auto",
      }}
    >
      {/* Element Info (항상 표시, locked일 때 더 상세) */}
      {locked ? (
        <div
          style={{
            marginBottom: "12px",
            paddingBottom: "12px",
            borderBottom: "1px solid #374151",
          }}
        >
          <div
            style={{
              fontWeight: "600",
              marginBottom: "6px",
              color: "#f59e0b",
              fontSize: "11px",
            }}
          >
            🔍 SELECTED ELEMENT
          </div>
          <div style={{ fontSize: "11px", color: "#d1d5db", lineHeight: "1.6" }}>
            <div style={{ marginBottom: "4px" }}>
              <strong style={{ color: "#f3f4f6" }}>{elementInfo.tagName}</strong>
              {elementInfo.id && (
                <span style={{ color: "#60a5fa", marginLeft: "4px" }}>
                  {elementInfo.id}
                </span>
              )}
              {elementInfo.classes && (
                <span style={{ color: "#34d399", marginLeft: "4px" }}>
                  {elementInfo.classes}
                </span>
              )}
            </div>
            {elementInfo.text && (
              <div
                style={{
                  fontStyle: "italic",
                  color: "#9ca3af",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "8px",
                }}
              >
                "{elementInfo.text}"
              </div>
            )}
            
            {/* Full Selector */}
            <div
              style={{
                marginTop: "8px",
                padding: "8px",
                background: "#374151",
                borderRadius: "4px",
                fontSize: "10px",
                fontFamily: "monospace",
                color: "#d1d5db",
                wordBreak: "break-all",
                lineHeight: "1.4",
              }}
            >
              {selector}
            </div>

            {/* 키보드 단축키 안내 */}
            <div
              style={{
                marginTop: "8px",
                fontSize: "10px",
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              ⬆️ ArrowUp | ⬇️ ArrowDown | ESC: Unlock
            </div>
          </div>

          {/* 요소 탐색 버튼 */}
          {(onNavigateParent || onNavigateChild) && (
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
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
                    padding: "6px 10px",
                    background: hasParent ? "#6366f1" : "#d1d5db",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: hasParent ? "pointer" : "not-allowed",
                    fontSize: "11px",
                    fontWeight: "500",
                    transition: "background 0.2s",
                  }}
                >
                  ⬆️ Parent
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
                    padding: "6px 10px",
                    background: hasChild ? "#8b5cf6" : "#d1d5db",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: hasChild ? "pointer" : "not-allowed",
                    fontSize: "11px",
                    fontWeight: "500",
                    transition: "background 0.2s",
                  }}
                >
                  ⬇️ Child
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            marginBottom: "8px",
            fontSize: "11px",
            color: "#cbd5e0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <strong>{elementInfo.tagName}</strong>
          {elementInfo.id}
          {elementInfo.classes}
          </div>
        )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <ActionButton onClick={handleClick} locked={locked}>
          🖱️ Click
        </ActionButton>
        <ActionButton onClick={handleScreenshot} locked={locked}>
          📸 Screenshot
        </ActionButton>
        <ActionButton onClick={handleType} locked={locked}>
          ⌨️ Type
        </ActionButton>
        {target instanceof HTMLSelectElement && (
          <ActionButton onClick={handleSelect} locked={locked}>
            📋 Select
          </ActionButton>
        )}
        <ActionButton onClick={handleExtract} locked={locked}>
          📤 Extract
        </ActionButton>
        <ActionButton onClick={handleNavigate} locked={locked}>
          🔗 Navigate
        </ActionButton>
        <ActionButton onClick={handleWaitFor} locked={locked}>
          ⏱️ Wait
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
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  locked: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  const getButtonColor = () => {
    const childText = typeof children === 'string' ? children : '';
    if (childText.includes('Click')) return hover ? '#2563eb' : '#3b82f6';
    if (childText.includes('Screenshot')) return hover ? '#c026d3' : '#d946ef';
    if (childText.includes('Type')) return hover ? '#059669' : '#10b981';
    if (childText.includes('Select')) return hover ? '#db2777' : '#ec4899';
    if (childText.includes('Extract')) return hover ? '#d97706' : '#f59e0b';
    if (childText.includes('Navigate')) return hover ? '#0284c7' : '#0ea5e9';
    if (childText.includes('Wait')) return hover ? '#7c3aed' : '#8b5cf6';
    return hover ? '#2563eb' : '#3b82f6';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "6px 12px",
        background: disabled ? "#d1d5db" : getButtonColor(),
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "12px",
        fontWeight: "500",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

