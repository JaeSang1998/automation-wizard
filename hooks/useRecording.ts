import { useEffect, useState, useCallback, useRef } from "react";
import type { Step } from "../types";
import { getSimpleSelector } from "../lib/selectors/selectorGenerator";

interface UseRecordingOptions {
  autoCapture?: boolean;
}

interface UseRecordingReturn {
  recording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

/**
 * 녹화 로직을 처리하는 커스텀 훅
 * 
 * 기능:
 * - 클릭, 타이핑, 선택(select) 이벤트 자동 캡처
 * - 타이핑 디바운스 (500ms)
 * - Enter 키로 즉시 플러시 및 submit
 * - Shift+Tab으로 extract
 * - 링크 클릭 시 새 탭 강제 방지
 */
export function useRecording({
  autoCapture = true,
}: UseRecordingOptions = {}): UseRecordingReturn {
  const [recording, setRecording] = useState(false);
  
  // 타이핑 상태 관리 (ref로 최신 값 유지)
  const typingTimerRef = useRef<number | null>(null);
  const typingSelectorRef = useRef<string | null>(null);
  const typingValueRef = useRef<string>("");
  const typingSubmitRef = useRef<boolean>(false);
  const lastSelectValueRef = useRef<Record<string, string>>({});
  const recordingRef = useRef<boolean>(false);

  // recordingRef 동기화
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  /**
   * 타이핑 플러시 (Step 기록)
   */
  const flushTyping = useCallback(() => {
    if (!recordingRef.current || !autoCapture) return;
    if (!typingSelectorRef.current) return;

    // 타이머 즉시 정리 (중복 flush 방지)
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const value = typingValueRef.current ?? "";
    const masked = value ? "*".repeat(value.length) : "";
    const step: Step = {
      type: "type",
      selector: typingSelectorRef.current,
      text: masked,
      originalText: value,
      submit: typingSubmitRef.current || undefined,
      url: window.location.href,
    };

    browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});

    // 상태 초기화
    typingSelectorRef.current = null;
    typingValueRef.current = "";
    typingSubmitRef.current = false;
  }, [autoCapture]);

  /**
   * 클릭 이벤트 핸들러
   */
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!recordingRef.current) return;

      const el = e.target as HTMLElement | null;
      if (!el) return;

      // 우리 툴바나 루트 클릭은 무시
      if (el.closest("#automation-wizard-root")) return;

      // 링크 클릭 - 새 탭 열림을 same-tab 네비로 강제
      const linkEl = (el.closest &&
        el.closest("a[href]")) as HTMLAnchorElement | null;
      
      if (linkEl && linkEl.href) {
        const isMiddleClick = e.button === 1;
        const isModifierOpen = e.metaKey === true || e.ctrlKey === true;
        const opensNewTab =
          linkEl.target === "_blank" || isMiddleClick || isModifierOpen;

        if (opensNewTab) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {}

          try {
            window.location.href = linkEl.href;
          } catch {}

          const navStep: Step = { type: "navigate", url: linkEl.href };
          browser.runtime
            .sendMessage({ type: "REC_STEP", step: navStep })
            .catch(() => {});
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

      browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
    },
    []
  );

  /**
   * Input 이벤트 핸들러 (타이핑, Select)
   */
  const handleInput = useCallback(
    (e: Event) => {
      if (!recordingRef.current || !autoCapture) return;

      const el = e.target as any;
      if (!el) return;
      if (el.closest && el.closest("#automation-wizard-root")) return;

      const tag = el.tagName?.toLowerCase?.() || "";

      // select 요소 처리
      if (tag === "select") {
        const selector = getSimpleSelector(el);
        const value: string = el.value ?? "";

        // 중복 방지
        if (lastSelectValueRef.current[selector] === value) return;
        lastSelectValueRef.current[selector] = value;

        const step: Step = {
          type: "select",
          selector,
          value,
          url: window.location.href,
        };

        browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
        return;
      }

      // text input/textarea 처리
      const isTextField = tag === "input" || tag === "textarea";
      if (!isTextField) return;

      const selector = getSimpleSelector(el);
      const value: string = el.value ?? "";

      typingSelectorRef.current = selector;
      typingValueRef.current = value;

      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = window.setTimeout(() => {
        flushTyping();
      }, 500);
    },
    [autoCapture, flushTyping]
  );

  /**
   * Enter 키 - 즉시 플러시 및 submit
   */
  const handleKeydownGlobal = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingRef.current || !autoCapture) return;

      if (e.key === "Enter") {
        const active = document.activeElement as any;
        const tag = active?.tagName?.toLowerCase();
        const isTextField = active && (tag === "input" || tag === "textarea");

        // textarea는 Enter가 줄바꿈이므로 submit 하지 않음
        if (tag === "textarea") {
          return;
        }

        // 입력 필드에서의 Enter 제출을 가로채서 먼저 기록하고, 그 다음 프로그램적으로 제출
        if (isTextField) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {}

          // 기존 타이핑 타이머를 먼저 정리 (중복 레코딩 방지)
          if (typingTimerRef.current) {
            window.clearTimeout(typingTimerRef.current);
            typingTimerRef.current = null;
          }

          typingSubmitRef.current = true;

          // active가 존재하면 selector 갱신 보조
          try {
            if (!typingSelectorRef.current) {
              typingSelectorRef.current = getSimpleSelector(active);
              typingValueRef.current = active.value ?? "";
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
    },
    [autoCapture, flushTyping]
  );

  /**
   * Blur 이벤트 - 타이핑 플러시
   */
  const handleBlur = useCallback(() => {
    if (recordingRef.current && autoCapture) {
      flushTyping();
    }
  }, [autoCapture, flushTyping]);

  /**
   * Change 이벤트 - Select 처리
   */
  const handleChange = useCallback(
    (e: Event) => {
      if (!recordingRef.current || !autoCapture) return;

      const el = e.target as any;
      if (!el) return;
      if (el.closest && el.closest("#automation-wizard-root")) return;

      const tag = el.tagName?.toLowerCase?.() || "";
      if (tag !== "select") return;

      const selector = getSimpleSelector(el);
      const value: string = el.value ?? "";

      // 중복 방지
      if (lastSelectValueRef.current[selector] === value) return;
      lastSelectValueRef.current[selector] = value;

      const step: Step = {
        type: "select",
        selector,
        value,
        url: window.location.href,
      };

      browser.runtime.sendMessage({ type: "REC_STEP", step }).catch(() => {});
    },
    [autoCapture]
  );

  /**
   * 녹화 시작
   */
  const startRecording = useCallback(async () => {
    await browser.runtime.sendMessage({ type: "START_RECORD" });
    setRecording(true);
  }, []);

  /**
   * 녹화 중지
   */
  const stopRecording = useCallback(async () => {
    // 마지막 타이핑 플러시
    flushTyping();

    await browser.runtime.sendMessage({ type: "STOP_RECORD" });
    setRecording(false);
  }, [flushTyping]);

  /**
   * 이벤트 리스너 등록
   */
  useEffect(() => {
    if (!recording) return;

    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("keydown", handleKeydownGlobal, true);
    window.addEventListener("blur", handleBlur, true);
    document.addEventListener("change", handleChange, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("keydown", handleKeydownGlobal, true);
      window.removeEventListener("blur", handleBlur, true);
      document.removeEventListener("change", handleChange, true);
    };
  }, [
    recording,
    handleClick,
    handleInput,
    handleKeydownGlobal,
    handleBlur,
    handleChange,
  ]);

  /**
   * 초기 녹화 상태 가져오기
   */
  useEffect(() => {
    (async () => {
      try {
        const resp = await browser.runtime.sendMessage({
          type: "GET_RECORD_STATE",
        });

        if (resp && resp.type === "RECORD_STATE") {
          setRecording(resp.recording);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  /**
   * 녹화 상태 변경 메시지 수신
   */
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === "RECORD_STATE") {
        setRecording(msg.recording);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return {
    recording,
    startRecording,
    stopRecording,
  };
}

