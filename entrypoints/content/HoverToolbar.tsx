import React, { useState, useEffect, useRef } from "react";
import type { Step } from "../../types";

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
  const [position, setPosition] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 초기 위치를 화면 안으로 조정
  useEffect(() => {
    if (!toolbarRef.current) return;

    const toolbar = toolbarRef.current;
    const rect = toolbar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x + 12;
    let adjustedY = y + 12;

    // 오른쪽 경계 체크
    if (adjustedX + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 12;
    }

    // 왼쪽 경계 체크
    if (adjustedX < 12) {
      adjustedX = 12;
    }

    // 아래쪽 경계 체크
    if (adjustedY + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 12;
    }

    // 위쪽 경계 체크
    if (adjustedY < 12) {
      adjustedY = 12;
    }

    setPosition({ x: adjustedX, y: adjustedY });
  }, [x, y, locked]);

  // 드래그 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!locked) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // 화면 경계 체크
      if (!toolbarRef.current) return;
      const rect = toolbarRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const clampedX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
      const clampedY = Math.max(
        0,
        Math.min(newY, viewportHeight - rect.height)
      );

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // 요소 정보 추출
  const getElementInfo = (el: HTMLElement) => {
    const tagName = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classes = el.className
      ? `.${el.className.split(" ").filter(Boolean).join(".")}`
      : "";
    const text =
      el.innerText?.substring(0, 30) || el.textContent?.substring(0, 30) || "";
    return { tagName, id, classes, text };
  };

  const elementInfo = getElementInfo(target);
  const hasParent =
    target.parentElement !== null && target.parentElement !== document.body;
  const hasChild = target.children.length > 0;

  const makeSelector = (el: HTMLElement): string => {
    const segs: string[] = [];
    let cur: HTMLElement | null = el;

    for (let depth = 0; cur && depth < 5; depth++) {
      let s = cur.nodeName.toLowerCase();
      const id = cur.id;

      if (id) {
        segs.unshift(`${s}#${CSS.escape(id)}`);
        break;
      }

      const testid = cur.getAttribute("data-testid");
      const aria = cur.getAttribute("aria-label");

      if (testid) {
        s += `[data-testid="${testid}"]`;
      } else if (aria) {
        s += `[aria-label="${aria}"]`;
      } else {
        const parent = cur.parentElement;
        if (parent && cur) {
          const currentNode = cur; // TypeScript를 위한 변수 저장
          const same = Array.from(parent.children).filter(
            (c) => c.nodeName === currentNode.nodeName
          );
          if (same.length > 1) {
            s += `:nth-of-type(${same.indexOf(currentNode) + 1})`;
          }
        }
      }

      segs.unshift(s);
      cur = cur.parentElement;
    }

    return segs.join(">");
  };

  const selector = makeSelector(target);

  const captureElementScreenshot = async (
    element: HTMLElement,
    selector: string
  ) => {
    try {
      const rect = element.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        console.log("Element has no visible size, skipping screenshot");
        return null;
      }

      // 실제 엘리먼트를 복사해서 캔버스에 그리기
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

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

      // 엘리먼트 타입 표시 (작은 글씨로)
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
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const screenshot = await captureElementScreenshot(target, selector);
    onRecord({
      type: "click",
      selector,
      url: window.location.href,
      screenshot,
    });
  };

  const handleType = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onShowTextInput) {
      // Fallback to prompt if custom modal is not available
      const maskedText = prompt(
        "입력할 텍스트를 입력하세요 (보안상 마스킹됩니다):"
      );
      if (maskedText !== null) {
        const maskedDisplayText = "*".repeat(maskedText.length);
        const screenshot = await captureElementScreenshot(target, selector);
        onRecord({
          type: "type",
          selector,
          text: maskedDisplayText,
          originalText: maskedText,
          url: window.location.href,
          screenshot,
        });
      }
      return;
    }

    // 커스텀 마스킹 입력창 사용
    onShowTextInput(async (inputText) => {
      if (inputText !== null) {
        const maskedDisplayText = "*".repeat(inputText.length);
        const screenshot = await captureElementScreenshot(target, selector);
        onRecord({
          type: "type",
          selector,
          text: maskedDisplayText,
          originalText: inputText,
          url: window.location.href,
          screenshot,
        });
      }
    });
  };

  const handleExtract = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const screenshot = await captureElementScreenshot(target, selector);
    onRecord({
      type: "extract",
      selector,
      prop: "innerText",
      url: window.location.href,
      screenshot,
    });
  };

  const handleScreenshot = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const screenshot = await captureElementScreenshot(target, selector);
    if (screenshot) {
      onRecord({
        type: "screenshot",
        selector,
        url: window.location.href,
        screenshot,
      } as any);
    }
  };

  const handleSelect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // select 요소인지 확인
    if (target.tagName.toLowerCase() !== "select") {
      alert("이 요소는 select 요소가 아닙니다.");
      return;
    }

    if (!onShowSelectOption) {
      // Fallback to prompt if custom modal is not available
      const selectElement = target as HTMLSelectElement;
      const options = Array.from(selectElement.options).map((opt, idx) => ({
        index: idx,
        value: opt.value,
        text: opt.text,
      }));

      const optionsText = options
        .map((opt) => `${opt.index}: ${opt.text} (value: ${opt.value})`)
        .join("\n");
      const selectedIndex = prompt(
        `다음 옵션 중 하나를 선택하세요 (번호 입력):\n\n${optionsText}`
      );

      if (selectedIndex !== null && selectedIndex !== "") {
        const idx = parseInt(selectedIndex, 10);
        if (!isNaN(idx) && idx >= 0 && idx < options.length) {
          const selectedOption = options[idx];
          const screenshot = await captureElementScreenshot(target, selector);
          onRecord({
            type: "select",
            selector,
            value: selectedOption.value,
            url: window.location.href,
            screenshot,
          });
        } else {
          alert("잘못된 번호입니다.");
        }
      }
      return;
    }

    const selectElement = target as HTMLSelectElement;
    const options = Array.from(selectElement.options).map((opt, idx) => ({
      index: idx,
      value: opt.value,
      text: opt.text,
    }));

    // 커스텀 옵션 선택 모달 사용
    onShowSelectOption(options, async (selectedValue) => {
      if (selectedValue !== null) {
        const screenshot = await captureElementScreenshot(target, selector);
        onRecord({
          type: "select",
          selector,
          value: selectedValue,
          url: window.location.href,
          screenshot,
        });
      }
    });
  };

  const handleWaitFor = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const screenshot = await captureElementScreenshot(target, selector);
    onRecord({
      type: "waitFor",
      selector,
      timeoutMs: 5000,
      url: window.location.href,
      screenshot,
    });
  };

  return (
    <div
      ref={toolbarRef}
      className="wxt-toolbar"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        background: "white",
        border: "2px solid #f59e0b",
        borderRadius: "8px",
        boxShadow: isDragging
          ? "0 12px 32px rgba(245, 158, 11, 0.5)"
          : "0 8px 24px rgba(245, 158, 11, 0.3)",
        zIndex: 2147483647,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "12px",
        pointerEvents: "auto",
        cursor: isDragging ? "grabbing" : "default",
        animation: "slideIn 0.2s ease-out",
        maxWidth: "500px",
        minWidth: "400px",
        userSelect: "none",
        transition: isDragging ? "none" : "box-shadow 0.2s",
      }}
    >
      {locked && (
        <>
          {/* 드래그 핸들 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: "absolute",
              top: "4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "40px",
              height: "4px",
              background: isDragging ? "#f59e0b" : "#d1d5db",
              borderRadius: "2px",
              cursor: "grab",
              transition: "background 0.2s",
            }}
            title="Drag to move"
          />

          {/* 요소 인스펙터 */}
          <div
            style={{
              fontSize: "11px",
              background: "#fef3c7",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #fde68a",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                fontWeight: "600",
                color: "#92400e",
                marginBottom: "4px",
              }}
            >
              🔍 Selected Element
            </div>
            <div
              style={{ color: "#78350f", fontSize: "10px", lineHeight: "1.4" }}
            >
              <div>
                <strong>{elementInfo.tagName}</strong>
                {elementInfo.id && (
                  <span style={{ color: "#3b82f6" }}>{elementInfo.id}</span>
                )}
                {elementInfo.classes && (
                  <span style={{ color: "#10b981" }}>
                    {elementInfo.classes}
                  </span>
                )}
              </div>
              {elementInfo.text && (
                <div
                  style={{
                    marginTop: "4px",
                    fontStyle: "italic",
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    lineHeight: "1.3",
                  }}
                >
                  "{elementInfo.text}"
                </div>
              )}
            </div>
          </div>

          {/* 요소 탐색 버튼 */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigateParent?.();
              }}
              disabled={!hasParent}
              style={{
                flex: 1,
                padding: "6px 8px",
                background: hasParent ? "#6366f1" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: hasParent ? "pointer" : "not-allowed",
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              ⬆️ Parent
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigateChild?.();
              }}
              disabled={!hasChild}
              style={{
                flex: 1,
                padding: "6px 8px",
                background: hasChild ? "#8b5cf6" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: hasChild ? "pointer" : "not-allowed",
                fontSize: "11px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              ⬇️ Child
            </button>
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#f59e0b",
              fontWeight: "600",
              textAlign: "center",
              paddingBottom: "4px",
              borderBottom: "1px solid #fef3c7",
            }}
          >
            📍 Select an action
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={handleClick}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#2563eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#3b82f6";
          }}
        >
          👆 Click
        </button>
        <button
          onClick={handleScreenshot}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#0ea5e9",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0284c7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0ea5e9";
          }}
        >
          📸 Shot
        </button>
        <button
          onClick={handleType}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#10b981",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#059669";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#10b981";
          }}
        >
          ⌨️ Type
        </button>
        <button
          onClick={handleSelect}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#ec4899",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#db2777";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ec4899";
          }}
        >
          🔽 Select
        </button>
        <button
          onClick={handleExtract}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#f59e0b",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#d97706";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f59e0b";
          }}
        >
          📄 Extract
        </button>
        <button
          onClick={handleWaitFor}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            background: "#8b5cf6",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#7c3aed";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#8b5cf6";
          }}
        >
          ⏱️ Wait
        </button>
      </div>
    </div>
  );
}
