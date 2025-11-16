import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import HoverToolbar from "./content/HoverToolbar";
import type {
  Step,
  TogglePickerMessage,
  RecordStateUpdatedMessage,
} from "../types";

function ContentApp() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [pickerOn, setPickerOn] = useState(false);
  const [recordingOn, setRecordingOn] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [locked, setLocked] = useState(false); // Alt + Shift로 잠금
  const [lockedTarget, setLockedTarget] = useState<HTMLElement | null>(null);
  const [lockedCoords, setLockedCoords] = useState({ x: 0, y: 0 });
  const [inspectedElement, setInspectedElement] = useState<HTMLElement | null>(
    null
  );
  const [hoverBox, setHoverBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [hoverSelector, setHoverSelector] = useState<string>("");
  const [hoverSelectorUpdatedAt, setHoverSelectorUpdatedAt] = useState<number>(0);

  // 텍스트 입력 모달 상태
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputCallback, setTextInputCallback] = useState<
    ((text: string | null) => void) | null
  >(null);

  // select 옵션 모달 상태
  const [showSelectOption, setShowSelectOption] = useState(false);
  const [selectOptions, setSelectOptions] = useState<
    Array<{ index: number; value: string; text: string }>
  >([]);
  const [selectOptionCallback, setSelectOptionCallback] = useState<
    ((value: string | null) => void) | null
  >(null);

  // Alt + Shift (또는 Option + Shift) 키로 툴바 고정/해제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + Shift (Windows) 또는 Option + Shift (Mac)
      if (e.altKey && e.shiftKey && !e.key.startsWith("Arrow")) {
        e.preventDefault();

        if (locked) {
          // 이미 잠금 상태면 해제
          setLocked(false);
          setLockedTarget(null);
          setInspectedElement(null);
        } else if (target) {
          // 현재 호버 중인 엘리먼트 잠금
          setLocked(true);
          setLockedTarget(target);
          setLockedCoords(coords);
          setInspectedElement(target);
        }
      }

      // ESC로 잠금 해제
      if (e.key === "Escape" && locked) {
        setLocked(false);
        setLockedTarget(null);
        setInspectedElement(null);
      }

      // 화살표 키로 요소 탐색 (잠금 상태일 때만)
      if (locked && inspectedElement) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          navigateToParent();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          navigateToChild();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [locked, target, coords, inspectedElement]);

  // 성능 최적화: throttle 적용
  useEffect(() => {
    let rafId: number | null = null;
    let lastUpdate = 0;
    const throttleMs = 50; // 50ms throttle

    const handleMouseMove = (e: MouseEvent) => {
      if (!pickerOn || locked) return; // 잠금 상태면 마우스 무시

      const now = Date.now();
      if (now - lastUpdate < throttleMs) {
        return; // throttle
      }

      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        lastUpdate = now;

        const el = document.elementFromPoint(
          e.clientX,
          e.clientY
        ) as HTMLElement | null;

        if (!el || el === document.body || el === document.documentElement) {
          setTarget(null);
          setHoverBox(null);
          return;
        }

        // 우리가 만든 툴바/하이라이트 요소는 제외
        if (el.closest("#automation-wizard-root")) {
          return;
        }

        setTarget(el);
        try {
          setHoverSelector(getSimpleSelector(el));
          setHoverSelectorUpdatedAt(Date.now());
        } catch {
          setHoverSelector("");
        }
        setCoords({ x: e.clientX, y: e.clientY });

        const rect = el.getBoundingClientRect();
        setHoverBox({
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        });
      });
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [pickerOn, locked]);

  // 메시지 수신: 픽커 토글 및 레코딩 상태
  useEffect(() => {
    const handleMessage = (
      msg: TogglePickerMessage | RecordStateUpdatedMessage
    ) => {
      if (msg.type === "TOGGLE_PICKER") {
        setPickerOn(msg.on);
        if (!msg.on) {
          setTarget(null);
          setHoverBox(null);
          setHoverSelector("");
        }
      } else if (msg.type === "RECORD_STATE") {
        setRecordingOn(msg.recording);
        // 녹화 시작 시, 사용자가 바로 수동 조작 가능하도록 픽커 임시 활성화
        if (msg.recording) {
          setPickerOn(true);
        } else {
          setPickerOn(false);
          setTarget(null);
          setHoverBox(null);
          setHoverSelector("");
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // 간단한 CSS 셀렉터 생성기
  const getSimpleSelector = (el: Element): string => {
    if (!(el instanceof Element)) return "";
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if ((node as HTMLElement).classList.length > 0) {
        const cls = Array.from((node as HTMLElement).classList)
          .slice(0, 2)
          .map((c) => `.${CSS.escape(c)}`)
          .join("");
        part += cls;
      }
      // nth-child
      let idx = 1;
      let sib = node;
      while ((sib = sib.previousElementSibling as Element | null)) {
        if (sib.tagName === node.tagName) idx++;
      }
      part += `:nth-of-type(${idx})`;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  };

  // 레코딩 중 클릭 이벤트를 Step으로 백그라운드에 전송
  useEffect(() => {
    let recording = false;
    let typingTimer: number | null = null;
    let typingSelector: string | null = null;
    let typingValue: string = "";

    const handleRecordState = (msg: RecordStateUpdatedMessage) => {
      if (msg.type === "RECORD_STATE") {
        recording = msg.recording;
      }
    };
    const onMessage = (msg: any) => handleRecordState(msg as RecordStateUpdatedMessage);
    browser.runtime.onMessage.addListener(onMessage);

    // 초기 레코딩 상태 질의 (리로드/네비게이션 후 지속)
    (async () => {
      try {
        const resp = (await browser.runtime.sendMessage({
          type: "GET_RECORD_STATE",
        })) as RecordStateUpdatedMessage | undefined;
        if (resp && resp.type === "RECORD_STATE") {
          recording = resp.recording;
          setRecordingOn(resp.recording);
          if (resp.recording) {
            setPickerOn(true);
          }
        }
      } catch (e) {
        // ignore
      }
    })();

    let typingSubmit = false;
    const flushTyping = () => {
      if (!recording || !autoCapture) return;
      if (!typingSelector) return;
      
      // 타이머 즉시 정리 (중복 flush 방지)
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
      }
      
      const value = typingValue ?? "";
      const masked = value ? "*".repeat(value.length) : "";
      const step: Step = {
        type: "type",
        selector: typingSelector,
        text: masked,
        // @ts-expect-error preserve original for replay
        originalText: value,
        // @ts-expect-error include submit flag when Enter used
        submit: typingSubmit || undefined,
        url: window.location.href,
      } as any;
      browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
      
      // 상태 초기화
      typingSelector = null;
      typingValue = "";
      typingSubmit = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (!recording) return;
      const el = e.target as HTMLElement | null;
      if (!el) return;
      // 우리 툴바나 루트 클릭은 무시
      if (el.closest("#automation-wizard-root")) return;
      // 레코딩 중 새 탭 열림을 same-tab 네비로 강제
      const linkEl = (el.closest && el.closest("a[href]")) as HTMLAnchorElement | null;
      if (linkEl && linkEl.href) {
        const isMiddleClick = e.button === 1;
        const isModifierOpen = e.metaKey === true || e.ctrlKey === true;
        const opensNewTab = linkEl.target === "_blank" || isMiddleClick || isModifierOpen;
        if (opensNewTab) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {}
          try {
            window.location.href = linkEl.href;
          } catch {}
          const navStep: Step = { type: "navigate", url: linkEl.href } as any;
          browser.runtime.sendMessage({ type: "REC_STEP", step: navStep }).catch(() => {});
          return;
        }
      }
      // select 요소나 그 option 클릭은 무시 (change/input 이벤트에서 처리)
      const tag = el.tagName?.toLowerCase();
      if (tag === "select" || tag === "option") return;
      if (el.closest("select")) return;
      
      const selector = getSimpleSelector(el);
      const step: Step = {
        type: "click",
        selector,
        url: window.location.href,
      };
      browser.runtime
        .sendMessage({ type: "REC_STEP", step })
        .catch(() => {});
    };

    // Shift+Tab 시 활성 요소 값 추출 Step 기록
    const handleKeydown = (e: KeyboardEvent) => {
      if (!recording) return;
      if (e.shiftKey && e.key === "Tab") {
        // 먼저 진행 중인 타이핑 플러시
        flushTyping();
        const el = (document.activeElement || document.body) as HTMLElement;
        if (!el) return;
        if (el.closest("#automation-wizard-root")) return;
        const selector = getSimpleSelector(el);
        let prop: "value" | "innerText" = "innerText";
        const tag = el.tagName.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          (el as any).value !== undefined
        ) {
          prop = "value";
        }
        const step: Step = {
          type: "extract",
          selector,
          prop,
          url: window.location.href,
        } as any;
        browser.runtime
          .sendMessage({ type: "REC_STEP", step })
          .catch(() => {});
      }
    };

    // 입력 타이핑 자동 기록 (디바운스) + select 처리
    const handleInput = (e: Event) => {
      if (!recording || !autoCapture) return;
      const el = e.target as any;
      if (!el) return;
      if (el.closest && el.closest("#automation-wizard-root")) return;
      const tag = el.tagName?.toLowerCase?.() || "";
      
      // select 요소 처리
      if (tag === "select") {
        const selector = getSimpleSelector(el);
        const value: string = el.value ?? "";
        
        // 중복 방지
        if (lastSelectValue[selector] === value) return;
        lastSelectValue[selector] = value;
        
        console.log("Select input detected:", { selector, value });
        
        const step: Step = {
          type: "select",
          selector,
          // @ts-expect-error Step select value
          value,
          url: window.location.href,
        } as any;
        browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
        return;
      }
      
      // text input/textarea 처리
      const isTextField = tag === "input" || tag === "textarea";
      if (!isTextField) return;
      
      const selector = getSimpleSelector(el);
      const value: string = el.value ?? "";
      typingSelector = selector;
      typingValue = value;
      if (typingTimer) {
        window.clearTimeout(typingTimer);
      }
      typingTimer = window.setTimeout(() => {
        flushTyping();
      }, 500);
    };

    // 엔터/블러 시 즉시 플러시
    const handleKeydownGlobal = (e: KeyboardEvent) => {
      if (!recording || !autoCapture) return;
      if (e.key === "Enter") {
        const active = document.activeElement as any;
        const isTextField =
          active &&
          (active.tagName?.toLowerCase() === "input" ||
            active.tagName?.toLowerCase() === "textarea");

        // 입력 필드에서의 Enter 제출을 가로채서 먼저 기록하고, 그 다음 프로그램적으로 제출
        if (isTextField) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {}
          typingSubmit = true;
          // active가 존재하면 selector 갱신 보조
          try {
            if (!typingSelector) {
              typingSelector = getSimpleSelector(active);
              typingValue = active.value ?? "";
            }
          } catch {}
          flushTyping();
          // 메시지 전송 시간을 조금 주고 제출 재현
          setTimeout(() => {
            try {
              const form = active.form;
              if (form) {
                if (typeof form.requestSubmit === "function") {
                  form.requestSubmit();
                } else {
                  form.submit();
                }
              } else {
                // 폼이 없을 때 Enter 키 이벤트 재현
                const enterDown = new KeyboardEvent("keydown", {
                  key: "Enter",
                  code: "Enter",
                  keyCode: 13,
                  which: 13,
                  bubbles: true,
                  cancelable: true,
                });
                const enterPress = new KeyboardEvent("keypress", {
                  key: "Enter",
                  code: "Enter",
                  keyCode: 13,
                  which: 13,
                  bubbles: true,
                  cancelable: true,
                });
                const enterUp = new KeyboardEvent("keyup", {
                  key: "Enter",
                  code: "Enter",
                  keyCode: 13,
                  which: 13,
                  bubbles: true,
                  cancelable: true,
                });
                active.dispatchEvent(enterDown);
                active.dispatchEvent(enterPress);
                active.dispatchEvent(enterUp);
              }
            } catch {}
          }, 80);
          return;
        }
      }
    };
    const handleBlur = (_e: FocusEvent) => {
      if (!recording || !autoCapture) return;
      flushTyping();
    };

    // select 변경 자동 기록
    const handleChange = (e: Event) => {
      if (!recording || !autoCapture) return;
      const el = e.target as any;
      if (!el) return;
      if (el.closest && el.closest("#automation-wizard-root")) return;
      const tag = el.tagName?.toLowerCase?.() || "";
      if (tag !== "select") return;
      
      console.log("Select change detected:", el);
      const selector = getSimpleSelector(el);
      const value: string = el.value ?? "";
      const selectedOption = el.options?.[el.selectedIndex];
      const selectedText = selectedOption?.text || value;
      
      console.log("Recording select:", { selector, value, selectedText });
      
      const step: Step = {
        type: "select",
        selector,
        // @ts-expect-error Step select value
        value,
        url: window.location.href,
      } as any;
      browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("keydown", handleKeydownGlobal, true);
    window.addEventListener("blur", handleBlur, true);
    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("keydown", handleKeydownGlobal, true);
      window.removeEventListener("blur", handleBlur, true);
      if (typingTimer) {
        window.clearTimeout(typingTimer);
      }
    };
  }, []);

  // 레코딩 중 window.open을 same-tab 이동으로 오버라이드
  useEffect(() => {
    if (!recordingOn) return;
    const originalOpen = window.open;
    // @ts-expect-error override
    window.open = function (url: any, target?: any, features?: any) {
      if (typeof url === "string" && url) {
        try {
          window.location.href = url;
        } catch {}
        return window;
      }
      return originalOpen?.apply(window, arguments as any);
    };
    return () => {
      // @ts-expect-error restore
      window.open = originalOpen;
    };
  }, [recordingOn]);

  // 녹화 HUD UI
  const RecordingHUD = () => {
    if (!recordingOn) return null;
    return (
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 2147483647,
          background: "rgba(17,24,39,0.9)",
          color: "white",
          padding: "10px 12px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "system-ui",
          fontSize: "12px",
          pointerEvents: "auto",
        }}
      >
        <span style={{ color: "#f87171" }}>●</span>
        <span>Recording</span>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.2)" }} />
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoCapture}
            onChange={() => setAutoCapture((v) => !v)}
            style={{ cursor: "pointer" }}
          />
          Auto
        </label>
        <button
          onClick={() => {
            browser.runtime.sendMessage({ type: "UNDO_LAST_STEP" }).catch(() => {});
          }}
          style={{
            padding: "6px 10px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Undo
        </button>
      </div>
    );
  };

  const handleRecord = (step: Step) => {
    // 현재 URL을 스텝에 추가
    const stepWithUrl = { ...step, url: window.location.href };

    browser.runtime.sendMessage({ type: "REC_STEP", step: stepWithUrl });
    console.log("Recorded step:", stepWithUrl);

    // 액션 선택 후 자동으로 잠금 해제
    setLocked(false);
    setLockedTarget(null);
    setInspectedElement(null);
  };

  const navigateToParent = () => {
    if (!inspectedElement) return;
    const parent = inspectedElement.parentElement;
    if (
      parent &&
      parent !== document.body &&
      parent !== document.documentElement
    ) {
      setInspectedElement(parent);
      setLockedTarget(parent);

      // 하이라이트 업데이트
      const rect = parent.getBoundingClientRect();
      setHoverBox({
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  const navigateToChild = () => {
    if (!inspectedElement) return;
    const firstChild = inspectedElement.children[0] as HTMLElement;
    if (firstChild) {
      setInspectedElement(firstChild);
      setLockedTarget(firstChild);

      // 하이라이트 업데이트
      const rect = firstChild.getBoundingClientRect();
      setHoverBox({
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  // 텍스트 입력 모달 표시
  const handleShowTextInput = (callback: (text: string | null) => void) => {
    setTextInputValue("");
    setTextInputCallback(() => callback);
    setShowTextInput(true);
  };

  // 텍스트 입력 확인
  const handleTextInputSubmit = () => {
    if (textInputCallback) {
      textInputCallback(textInputValue);
    }
    setShowTextInput(false);
    setTextInputValue("");
    setTextInputCallback(null);
  };

  // 텍스트 입력 취소
  const handleTextInputCancel = () => {
    if (textInputCallback) {
      textInputCallback(null);
    }
    setShowTextInput(false);
    setTextInputValue("");
    setTextInputCallback(null);
  };

  // select 옵션 모달 표시
  const handleShowSelectOption = (
    options: Array<{ index: number; value: string; text: string }>,
    callback: (value: string | null) => void
  ) => {
    setSelectOptions(options);
    setSelectOptionCallback(() => callback);
    setShowSelectOption(true);
  };

  // select 옵션 선택
  const handleSelectOption = (value: string) => {
    if (selectOptionCallback) {
      selectOptionCallback(value);
    }
    setShowSelectOption(false);
    setSelectOptions([]);
    setSelectOptionCallback(null);
  };

  // select 옵션 취소
  const handleSelectOptionCancel = () => {
    if (selectOptionCallback) {
      selectOptionCallback(null);
    }
    setShowSelectOption(false);
    setSelectOptions([]);
    setSelectOptionCallback(null);
  };

  return (
    <>
      {/* 하이라이트 박스 */}
      {pickerOn && hoverBox && (
        <div
          style={{
            position: "absolute",
            left: `${hoverBox.left}px`,
            top: `${hoverBox.top}px`,
            width: `${hoverBox.width}px`,
            height: `${hoverBox.height}px`,
            border: locked ? "3px solid #f59e0b" : "2px solid #5b9",
            pointerEvents: "none",
            zIndex: 2147483646,
            boxSizing: "border-box",
            transition: "border 0.2s",
          }}
        />
      )}

      {/* 잠금 상태 표시 */}
      {locked && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "#f59e0b",
            color: "white",
            padding: "8px 16px",
            borderRadius: "8px",
            fontFamily: "system-ui",
            fontSize: "13px",
            fontWeight: "600",
            zIndex: 2147483647,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s",
          }}
        >
          🔒 Locked
          <span style={{ fontSize: "11px", opacity: 0.9 }}>
            (ESC or Alt+Shift)
          </span>
        </div>
      )}

      {/* 안내 메시지 - 잠금 상태가 아닐 때만 */}
      {pickerOn && !locked && target && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.75)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "8px",
            fontFamily: "system-ui",
            fontSize: "12px",
            zIndex: 2147483647,
            pointerEvents: "none",
          }}
        >
          Press <strong>Alt + Shift</strong> (or <strong>Option + Shift</strong>
          ) to lock and select action
        </div>
      )}

      {/* 현재 호버 셀렉터 표시 (Mouse ON일 때) */}
      {pickerOn && hoverSelector && (
        <div
          style={{
            position: "fixed",
            left: "12px",
            bottom: "56px",
            maxWidth: "60vw",
            background: "rgba(2,6,23,0.82)",
            color: "#e2e8f0",
            padding: "6px 10px",
            borderRadius: "8px",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "11px",
            zIndex: 2147483647,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            wordBreak: "break-all",
            opacity: Date.now() - hoverSelectorUpdatedAt > 1500 ? 0.6 : 1,
            transition: "opacity 0.2s ease",
          }}
          title={hoverSelector}
        >
          {hoverSelector}
        </div>
      )}

      {/* 잠금 상태일 때 키보드 안내 */}
      {locked && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.75)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "8px",
            fontFamily: "system-ui",
            fontSize: "12px",
            zIndex: 2147483647,
            pointerEvents: "none",
          }}
        >
          Use <strong>↑/↓</strong> arrows or buttons to navigate elements
        </div>
      )}

      {/* 툴바 - 잠금 상태일 때만 표시 */}
      {pickerOn && locked && inspectedElement && (
        <HoverToolbar
          x={lockedCoords.x}
          y={lockedCoords.y}
          target={inspectedElement}
          locked={locked}
          onRecord={handleRecord}
          onNavigateParent={navigateToParent}
          onNavigateChild={navigateToChild}
          onShowTextInput={handleShowTextInput}
        />
      )}

      {/* 레코딩 HUD */}
      <RecordingHUD />

      {/* 마스킹된 텍스트 입력 모달 */}
      {showTextInput && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2147483647,
          }}
          onClick={handleTextInputCancel}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              minWidth: "400px",
              maxWidth: "500px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#1e293b",
                fontFamily: "system-ui",
              }}
            >
              🔒 Enter Text (Secured)
            </h3>
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "13px",
                color: "#64748b",
                fontFamily: "system-ui",
              }}
            >
              Your input will be masked for security. Type your text below:
            </p>
            <input
              type="password"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTextInputSubmit();
                } else if (e.key === "Escape") {
                  handleTextInputCancel();
                }
              }}
              autoFocus
              placeholder="Type text here..."
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px",
                fontFamily: "system-ui",
                boxSizing: "border-box",
                marginBottom: "16px",
                outline: "none",
              }}
            />
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginBottom: "16px",
                fontFamily: "system-ui",
              }}
            >
              💡 Tip: Your text appears as "••••" for privacy
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleTextInputCancel}
                style={{
                  padding: "8px 16px",
                  background: "#e2e8f0",
                  color: "#475569",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  fontFamily: "system-ui",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTextInputSubmit}
                style={{
                  padding: "8px 16px",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  fontFamily: "system-ui",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchAboutBlank: true,
  main() {
    const root = document.createElement("div");
    root.id = "automation-wizard-root";
    document.documentElement.appendChild(root);

    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(<ContentApp />);
  },
});
