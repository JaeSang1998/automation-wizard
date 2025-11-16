import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import HoverToolbar from "./content/HoverToolbar";
import type { Step, TogglePickerMessage } from "../types";
import { useRecording } from "../hooks/useRecording";
import { useElementInspector } from "../hooks/useElementInspector";

function ContentApp() {
  // Picker 상태
  const [pickerOn, setPickerOn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockedTarget, setLockedTarget] = useState<HTMLElement | null>(null);
  const [lockedCoords, setLockedCoords] = useState({ x: 0, y: 0 });

  // Modal 상태
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputCallback, setTextInputCallback] = useState<
    ((text: string | null) => void) | null
  >(null);

  const [showSelectOption, setShowSelectOption] = useState(false);
  const [selectOptions, setSelectOptions] = useState<
    Array<{ index: number; value: string; text: string }>
  >([]);
  const [selectOptionCallback, setSelectOptionCallback] = useState<
    ((value: string | null) => void) | null
  >(null);

  // 커스텀 훅 사용
  const { recording } = useRecording({ autoCapture: true });
  const {
    target,
    coords,
    hoverBox,
    hoverSelector,
    inspectedElement,
    setInspectedElement,
    navigateToParent,
    navigateToChild,
  } = useElementInspector({
    enabled: pickerOn,
    locked,
  });

  /**
   * Step 기록 핸들러
   */
  const handleRecord = useCallback((step: Step) => {
    browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
  }, []);

  /**
   * Text Input 모달 표시
   */
  const handleShowTextInput = useCallback(
    (callback: (text: string | null) => void) => {
      setTextInputValue("");
      setTextInputCallback(() => callback);
      setShowTextInput(true);
    },
    []
  );

  /**
   * Select Option 모달 표시
   */
  const handleShowSelectOption = useCallback(
    (
      options: Array<{ index: number; value: string; text: string }>,
      callback: (selectedValue: string | null) => void
    ) => {
      setSelectOptions(options);
      setSelectOptionCallback(() => callback);
      setShowSelectOption(true);
    },
    []
  );

  /**
   * Alt + Shift (또는 Option + Shift) 키로 툴바 고정/해제
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Picker가 켜져 있을 때만 동작
      if (!pickerOn) return;

      // Alt + Shift (Windows) 또는 Option + Shift (Mac) - 호버 HUD 고정/해제
      if (
        e.altKey &&
        e.shiftKey &&
        !e.key.startsWith("Arrow") &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        console.log("Alt+Shift detected, locked:", locked, "target:", target);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (locked) {
          // 이미 잠금 상태면 해제
          console.log("Unlocking element");
          setLocked(false);
          setLockedTarget(null);
          setInspectedElement(null);
        } else {
          // target이 없으면 현재 마우스 위치에서 요소 감지
          let elementToLock = target;

          if (!elementToLock) {
            // 마우스 커서 아래 요소 찾기
            const hoveredElements = document.querySelectorAll(":hover");
            for (let i = hoveredElements.length - 1; i >= 0; i--) {
              const el = hoveredElements[i];
              if (
                el instanceof HTMLElement &&
                !el.closest("#automation-wizard-root")
              ) {
                elementToLock = el;
                break;
              }
            }
          }

          if (elementToLock) {
            // 현재 호버 중인 엘리먼트 잠금
            console.log("Locking element:", elementToLock);
            setLocked(true);
            setLockedTarget(elementToLock);

            // coords 업데이트
            const rect = elementToLock.getBoundingClientRect();
            setLockedCoords({
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });

            setInspectedElement(elementToLock);
          } else {
            console.log("No element to lock");
          }
        }
        return;
      }

      // ESC로 잠금 해제
      if (e.key === "Escape" && locked) {
        e.preventDefault();
        e.stopPropagation();
        setLocked(false);
        setLockedTarget(null);
        setInspectedElement(null);
        return;
      }

      // 화살표 키로 요소 탐색 (잠금 상태일 때만)
      if (locked && inspectedElement) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          navigateToParent();
          return;
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          navigateToChild();
          return;
        }
      }
    };

    // capture phase에서 최우선으로 처리
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [
    pickerOn,
    locked,
    target,
    coords,
    inspectedElement,
    navigateToParent,
    navigateToChild,
    setInspectedElement,
  ]);

  /**
   * Picker 토글 및 Recording 상태 메시지 수신
   */
  useEffect(() => {
    const handleMessage = (msg: TogglePickerMessage | any) => {
      if (msg.type === "TOGGLE_PICKER") {
        setPickerOn(msg.on);
        if (!msg.on) {
          setLocked(false);
          setLockedTarget(null);
          setInspectedElement(null);
        }
      } else if (msg.type === "RECORD_STATE") {
        // Recording이 시작되면 자동으로 picker도 켜기
        if (msg.recording) {
          setPickerOn(true);
        } else {
          // Recording이 중지되면 picker도 끄기
          setPickerOn(false);
          setLocked(false);
          setLockedTarget(null);
          setInspectedElement(null);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, [setInspectedElement]);

  // 현재 표시할 target과 coords 결정
  const displayTarget = locked ? lockedTarget : target;
  const displayCoords = locked ? lockedCoords : coords;

  return (
    <>
      {/* Hover Box (요소 하이라이트) */}
      {pickerOn && hoverBox && (
        <div
          style={{
            position: "fixed",
            left: hoverBox.left,
            top: hoverBox.top,
            width: hoverBox.width,
            height: hoverBox.height,
            border: locked ? "3px solid #f59e0b" : "2px solid #3b82f6",
            pointerEvents: "none",
            zIndex: 9998,
            boxSizing: "border-box",
            backgroundColor: locked
              ? "rgba(245, 158, 11, 0.1)"
              : "rgba(59, 130, 246, 0.1)",
            transition: locked ? "none" : "all 0.05s ease-out",
          }}
        />
      )}

      {/* Hover Toolbar */}
      {pickerOn && displayTarget && (
        <HoverToolbar
          x={displayCoords.x}
          y={displayCoords.y}
          target={displayTarget}
          locked={locked}
          onRecord={handleRecord}
          onNavigateParent={navigateToParent}
          onNavigateChild={navigateToChild}
          onShowTextInput={handleShowTextInput}
          onShowSelectOption={handleShowSelectOption}
        />
      )}

      {/* Recording 상태 표시 */}
      {recording && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#dc2626",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "bold",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "white",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          Recording
        </div>
      )}

      {/* Text Input Modal */}
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
            zIndex: 10002,
          }}
          onClick={() => {
            textInputCallback?.(null);
            setShowTextInput(false);
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "8px",
              minWidth: "400px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>
              Enter Text
            </h3>
            <input
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  textInputCallback?.(textInputValue);
                  setShowTextInput(false);
                }
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  textInputCallback?.(null);
                  setShowTextInput(false);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  textInputCallback?.(textInputValue);
                  setShowTextInput(false);
                }}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  background: "#3b82f6",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Option Modal */}
      {showSelectOption && (
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
            zIndex: 10002,
          }}
          onClick={() => {
            selectOptionCallback?.(null);
            setShowSelectOption(false);
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "8px",
              minWidth: "400px",
              maxHeight: "600px",
              overflow: "auto",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>
              Select an Option
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {selectOptions.map((option) => (
                <button
                  key={option.index}
                  onClick={() => {
                    selectOptionCallback?.(option.value);
                    setShowSelectOption(false);
                  }}
                  style={{
                    padding: "12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  {option.text}
                </button>
              ))}
            </div>
            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => {
                  selectOptionCallback?.(null);
                  setShowSelectOption(false);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  background: "white",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </>
  );
}

// React 앱 마운트
function mount() {
  let rootContainer = document.getElementById("automation-wizard-root");

  if (!rootContainer) {
    rootContainer = document.createElement("div");
    rootContainer.id = "automation-wizard-root";
    rootContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;

    // body에 추가
    if (document.body) {
      document.body.appendChild(rootContainer);
    } else {
      // body가 아직 없으면 대기
      const observer = new MutationObserver(() => {
        if (document.body) {
          document.body.appendChild(rootContainer!);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
  }

  const reactRoot = ReactDOM.createRoot(rootContainer);
  reactRoot.render(<ContentApp />);

  console.log("🧙‍♂️ Automation Wizard content script loaded");
}

// WXT Content Script Definition
export default {
  matches: ["<all_urls>"],
  async main() {
    // 페이지 로드 후 마운트
    if (document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve);
      });
    }
    mount();
  },
};
