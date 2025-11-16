import type {
  Step,
  Flow,
  Message,
  RecordStepMessage,
  SendToBackendMessage,
  StepExecutingMessage,
  StepCompletedMessage,
} from "../types";

// 플로우 가져오기 (없으면 새로 생성)
async function getFlow(): Promise<Flow> {
  const result = await browser.storage.local.get("flow");

  if (result.flow) {
    return result.flow as Flow;
  }

  const freshFlow: Flow = {
    id: crypto.randomUUID(),
    title: "Automation PoC Flow",
    steps: [],
    createdAt: Date.now(),
  };

  await browser.storage.local.set({ flow: freshFlow });
  return freshFlow;
}

// 플로우 저장
async function saveFlow(flow: Flow): Promise<void> {
  await browser.storage.local.set({ flow });
}

let isRecording = false;
let shouldStopRunning = false;

// 메시지 핸들러
browser.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  console.log("Background received message:", msg);

  // 레코딩 상태 토글
  if (msg.type === "START_RECORD") {
    isRecording = true;
    (async () => {
      // 사이드패널 열기 (현재 탭)
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id) {
          await browser.sidePanel.open({ tabId: tab.id });
        }
      } catch (e) {
        console.warn("Failed to open side panel on start record:", e);
      }

      // 모든 탭에 상태 전파
      const tabs = await browser.tabs.query({});
      await Promise.all(
        tabs
          .filter((t) => t.id)
          .map((t) =>
            browser.tabs
              .sendMessage(t.id!, { type: "RECORD_STATE", recording: true })
              .catch(() => {})
          )
      );

      // Sidepanel에도 상태 브로드캐스트
      try {
        await browser.runtime.sendMessage({ 
          type: "RECORD_STATE", 
          recording: true 
        });
      } catch (e) {
        // Sidepanel이 열려있지 않으면 에러 발생 - 무시
      }
    })();
    return true;
  }

  // 현재 레코딩 상태 질의
  if (msg.type === "GET_RECORD_STATE") {
    try {
      sendResponse({ type: "RECORD_STATE", recording: isRecording });
    } catch (e) {
      console.warn("Failed to send record state:", e);
    }
    return true;
  }

  // 마지막 스텝 되돌리기
  if (msg.type === "UNDO_LAST_STEP") {
    (async () => {
      const flow = await getFlow();
      if (flow.steps.length > 0) {
        flow.steps.pop();
        await saveFlow(flow);
        browser.runtime
          .sendMessage({ type: "FLOW_UPDATED", flow })
          .catch(() => {});
      }
    })();
    return true;
  }

  if (msg.type === "STOP_RECORD") {
    isRecording = false;
    (async () => {
      // 모든 탭에 상태 전파
      const tabs = await browser.tabs.query({});
      await Promise.all(
        tabs
          .filter((t) => t.id)
          .map((t) =>
            browser.tabs
              .sendMessage(t.id!, { type: "RECORD_STATE", recording: false })
              .catch(() => {})
          )
      );

      // Sidepanel에도 상태 브로드캐스트
      try {
        await browser.runtime.sendMessage({ 
          type: "RECORD_STATE", 
          recording: false 
        });
      } catch (e) {
        // Sidepanel이 열려있지 않으면 에러 발생 - 무시
      }

      sendResponse({ success: true });
    })();
    return true;
  }

  // 스텝 레코드
  if (msg.type === "REC_STEP") {
    (async () => {
      const flow = await getFlow();
      const incoming = (msg as RecordStepMessage).step as Step;
      // 프레임 메타데이터 부착
      try {
        const frameId = (sender as any)?.frameId as number | undefined;
        if (frameId !== undefined) {
          (incoming as any)._frameId = frameId;
        }
        const senderUrl = (sender as any)?.url as string | undefined;
        if (senderUrl) {
          (incoming as any)._frameUrl = senderUrl;
        }
      } catch {}
      flow.steps.push(incoming);
      await saveFlow(flow);

      // 사이드패널 업데이트 알림
      browser.runtime
        .sendMessage({
          type: "FLOW_UPDATED",
          flow,
        })
        .catch(() => {
          // 사이드패널이 열려있지 않으면 에러 발생 - 무시
        });

      console.log("Step recorded:", flow.steps.length);
    })();
    return true;
  }

  // 플로우 실행 중단
  if (msg.type === "STOP_RUN") {
    console.log("STOP_RUN requested");
    shouldStopRunning = true;
    sendResponse({ success: true });
    return true;
  }

  // 플로우 실행
  if (msg.type === "RUN_FLOW") {
    shouldStopRunning = false; // 실행 시작 시 플래그 리셋
    (async () => {
      const flow = await getFlow();

      // 녹화 중단 및 상태 브로드캐스트
      try {
        // @ts-ignore
        isRecording = false;
        const tabs = await browser.tabs.query({});
        await Promise.all(
          tabs
            .filter((t) => t.id)
            .map((t) =>
              browser.tabs
                .sendMessage(t.id!, { type: "RECORD_STATE", recording: false })
                .catch(() => {})
            )
        );
      } catch {}

      // 현재 활성 탭에서 실행 (새 탭 생성하지 않음)
      let targetTabId: number;
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) {
        console.error("No active tab found");
        return;
      }
      targetTabId = activeTab.id;
      console.log(`Running flow in current tab ${targetTabId}`);

      // 실행 전, 첫 번째 스텝의 URL로 이동 (가능한 경우)
      try {
        const firstStep = flow.steps[0];
        const firstUrl =
          firstStep && "url" in firstStep && (firstStep as any).url
            ? (firstStep as any).url
            : undefined;
        if (typeof firstUrl === "string" && firstUrl.startsWith("http")) {
          console.log(`Navigating to first step URL: ${firstUrl}`);
          await browser.tabs.update(targetTabId, { url: firstUrl, active: true });
          await waitForTabLoaded(targetTabId);
          await new Promise((resolve) => setTimeout(resolve, 800));
        } else if (flow.startUrl) {
          // fallback: startUrl이 있으면 사용
          console.log(`Navigating to startUrl: ${flow.startUrl}`);
          await browser.tabs.update(targetTabId, { url: flow.startUrl, active: true });
          await waitForTabLoaded(targetTabId);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } catch (navErr) {
        console.warn("Pre-navigation before run failed:", navErr);
      }

      // content script 확인
      try {
        await browser.scripting.executeScript({
          target: { tabId: targetTabId },
          func: () => {
            console.log("Content script ready in current tab");
            return true;
          },
          world: "MAIN",
        });
      } catch (error) {
        console.warn("Content script check failed:", error);
      }

      await runFlowInTab(targetTabId, flow);
      console.log("Flow execution completed");
    })();
    return true;
  }

  // 백엔드 전송
  if (msg.type === "SEND_TO_BACKEND") {
    (async () => {
      const flow = await getFlow();
      await sendToBackend(flow, (msg as SendToBackendMessage).endpoint);

      browser.runtime.sendMessage({ type: "SENT_OK" }).catch(() => {
        // 사이드패널이 열려있지 않으면 에러 발생 - 무시
      });

      console.log("Flow sent to backend");
    })();
    return true;
  }

  return false;
});

// 탭 로드 완료 대기
async function waitForTabLoaded(
  tabId: number,
  timeoutMs: number = 30000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const checkTab = async () => {
      try {
        const tab = await browser.tabs.get(tabId);

        if (tab.status === "complete") {
          // 추가로 조금 더 대기 (DOM이 완전히 준비될 때까지)
          setTimeout(() => resolve(), 500);
          return;
        }

        if (Date.now() > deadline) {
          reject(new Error("Tab load timeout"));
          return;
        }

        setTimeout(checkTab, 100);
      } catch (error) {
        reject(error);
      }
    };

    checkTab();
  });
}

// 탭에서 플로우 실행 (content script context에서 실행)
async function runFlowInTab(tabId: number, flow: Flow): Promise<void> {
  const steps = flow.steps;
  console.log(`Running ${steps.length} steps in tab ${tabId}`);

  // 첫 번째 스텝이 navigate이고 새 탭에서 시작한 경우 건너뛰기
  let startIndex = 0;
  if (flow.startUrl && steps.length > 0 && steps[0].type === "navigate") {
    startIndex = 1;
    console.log(
      "Skipping first navigate step as it was already executed during tab creation"
    );
  }

  for (let i = startIndex; i < steps.length; i++) {
    // 중단 플래그 체크
    if (shouldStopRunning) {
      console.log("Flow execution stopped by user");
      browser.runtime
        .sendMessage({
          type: "FLOW_FAILED",
          failedStepIndex: i,
          error: "Stopped by user",
        })
        .catch(() => {});
      shouldStopRunning = false;
      return;
    }

    const step = steps[i];
    console.log(`Executing step ${i + 1}:`, step);

    // 현재 탭 URL 가져오기
    let currentUrl = "";
    try {
      const tab = await browser.tabs.get(tabId);
      currentUrl = tab.url || "";
    } catch (error) {
      console.warn("Failed to get current URL:", error);
    }

    // 스텝에 현재 URL 정보 추가
    const stepWithUrl = { ...step, url: currentUrl };

    // 스텝 실행 시작 알림
    browser.runtime
      .sendMessage({
        type: "STEP_EXECUTING",
        step: stepWithUrl,
        stepIndex: i,
        totalSteps: steps.length,
        currentUrl,
      } as StepExecutingMessage)
      .catch(() => {
        // 사이드패널이 열려있지 않으면 에러 발생 - 무시
      });

    try {
      // navigate 스텝 처리 (백그라운드에서 직접 처리)
      if (step.type === "navigate") {
        console.log(`Navigating to: ${step.url}`);
        await browser.tabs.update(tabId, { url: step.url });
        await waitForTabLoaded(tabId);
        console.log("Navigation completed");

        // 네비게이션 후 추가 대기
        console.log("Waiting 1000ms after navigation...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("Navigation delay completed");
        continue;
      }

      // URL 확인 및 탭 포커스
      const currentTab = await browser.tabs.get(tabId);
      const currentUrl = currentTab.url || "";

      // 새 탭 생성 후 안정화를 위한 짧은 대기
      console.log("Waiting 20ms for tab stabilization...");
      await new Promise((resolve) => setTimeout(resolve, 20));
      console.log("Tab stabilization completed");

      // 스텝에 저장된 URL과 현재 URL 비교 (전체 URL 비교)
      if ("url" in step && step.url) {
        try {
          const stepUrl = new URL(step.url);
          const currentUrlObj = new URL(currentUrl);

          // URL이 다르면 네비게이션 (origin + pathname 비교)
          const stepUrlPath = stepUrl.origin + stepUrl.pathname;
          const currentUrlPath = currentUrlObj.origin + currentUrlObj.pathname;
          
          if (stepUrlPath !== currentUrlPath) {
            console.log(
              `URL mismatch: expected ${stepUrlPath}, got ${currentUrlPath}`
            );
            console.log("Navigating to step URL...");

            await browser.tabs.update(tabId, { url: step.url });
            await waitForTabLoaded(tabId);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            console.log("Navigation to step URL completed");
          } else {
            console.log(
              `Same URL: ${stepUrlPath}, proceeding with current tab`
            );
          }
        } catch (error) {
          console.warn(
            "URL parsing error, proceeding with current tab:",
            error
          );
        }
      }

      // 탭 포커스 (활성화) - 이미 올바른 탭이므로 단순히 포커스만
      await browser.tabs.update(tabId, { active: true });
      console.log(`Focused tab ${tabId} for step execution`);

      // waitForNavigation 스텝 처리
      if (step.type === "waitForNavigation") {
        console.log("Waiting for navigation...");
        await waitForTabLoaded(tabId, step.timeoutMs ?? 10000);
        console.log("Navigation wait completed");

        // 네비게이션 대기 후 추가 대기
        console.log("Waiting 500ms after navigation wait...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log("Navigation wait delay completed");
        continue;
      }

      const execTarget: any = { tabId } as { tabId: number; frameIds?: number[] };
      if ((step as any)._frameId !== undefined) {
        execTarget.frameIds = [(step as any)._frameId as number];
      }
      const result = await browser.scripting.executeScript({
        target: execTarget,
        func: async (stepToRun: Step) => {
          function querySelector(sel: string): Element | null {
            return document.querySelector(sel);
          }

          async function scrollIntoViewCentered(el: Element) {
            try {
              (el as HTMLElement).scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "smooth",
              });
              await new Promise((r) => setTimeout(r, 200));
            } catch {}
          }

          switch (stepToRun.type) {
            case "waitFor": {
              const deadline = Date.now() + (stepToRun.timeoutMs ?? 5000);
              return new Promise<void>((resolve, reject) => {
                const interval = setInterval(async () => {
                  const el = querySelector(stepToRun.selector);
                  if (el) {
                    clearInterval(interval);
                    await scrollIntoViewCentered(el);
                    resolve();
                  } else if (Date.now() > deadline) {
                    clearInterval(interval);
                    reject(new Error("waitFor timeout: " + stepToRun.selector));
                  }
                }, 150);
              });
            }

            case "click": {
              const el = querySelector(
                stepToRun.selector
              ) as HTMLElement | null;
              if (!el)
                throw new Error("Element not found: " + stepToRun.selector);
              await scrollIntoViewCentered(el);
              el.click();
              return { success: true, type: "click" };
            }

            case "type": {
              const el = querySelector(stepToRun.selector) as
                | HTMLInputElement
                | HTMLTextAreaElement
                | null;
              if (!el)
                throw new Error("Element not found: " + stepToRun.selector);

              // 보안을 위해 원본 텍스트 사용 (마스킹되지 않은)
              const text =
                (stepToRun as any).originalText ||
                (stepToRun as any).text ||
                "";

              await scrollIntoViewCentered(el);
              // 요소에 포커스 및 클릭 (더 확실한 포커스)
              el.focus();
              el.click();

              // 포커스 확인을 위한 짧은 대기
              await new Promise((resolve) => setTimeout(resolve, 100));

              // 기존 값 클리어 (더 확실하게)
              el.select();
              el.value = "";

              // 실제 사용자 입력처럼 한 글자씩 타이핑
              for (let i = 0; i < text.length; i++) {
                const char = text[i];

                // 값 업데이트
                el.value += char;

                // 커서를 끝으로 이동
                el.setSelectionRange(el.value.length, el.value.length);

                // 각 문자마다 완전한 키보드 이벤트 시퀀스
                const keydownEvent = new KeyboardEvent("keydown", {
                  key: char,
                  code: `Key${char.toUpperCase()}`,
                  keyCode: char.charCodeAt(0),
                  which: char.charCodeAt(0),
                  bubbles: true,
                  cancelable: true,
                });

                const keypressEvent = new KeyboardEvent("keypress", {
                  key: char,
                  code: `Key${char.toUpperCase()}`,
                  keyCode: char.charCodeAt(0),
                  which: char.charCodeAt(0),
                  bubbles: true,
                  cancelable: true,
                });

                const inputEvent = new Event("input", {
                  bubbles: true,
                  cancelable: true,
                });

                const keyupEvent = new KeyboardEvent("keyup", {
                  key: char,
                  code: `Key${char.toUpperCase()}`,
                  keyCode: char.charCodeAt(0),
                  which: char.charCodeAt(0),
                  bubbles: true,
                  cancelable: true,
                });

                // 이벤트 순서대로 트리거
                el.dispatchEvent(keydownEvent);
                el.dispatchEvent(keypressEvent);
                el.dispatchEvent(inputEvent);
                el.dispatchEvent(keyupEvent);

                // 타이핑 간격 (사람처럼)
                await new Promise((resolve) =>
                  setTimeout(resolve, 80 + Math.random() * 40)
                );
              }

              // 최종 이벤트들
              el.dispatchEvent(
                new Event("change", { bubbles: true, cancelable: true })
              );
              el.dispatchEvent(
                new Event("blur", { bubbles: true, cancelable: true })
              );

              // 요청된 경우 Enter 제출 처리
              if ((stepToRun as any).submit) {
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
                el.dispatchEvent(enterDown);
                el.dispatchEvent(enterPress);
                el.dispatchEvent(enterUp);
                // form이 있으면 submit 시도
                const form = el.form;
                if (form) {
                  try {
                    form.requestSubmit ? form.requestSubmit() : form.submit();
                  } catch {}
                }
                await new Promise((resolve) => setTimeout(resolve, 200));
              }

              return { success: true, type: "type", value: el.value };
            }

            case "screenshot": {
              const el = querySelector(stepToRun.selector) as any;
              if (!el)
                throw new Error("Element not found: " + stepToRun.selector);
              await scrollIntoViewCentered(el);
              try {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                  return { success: true, type: "screenshot", value: null };
                }
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) return { success: true, type: "screenshot", value: null };
                canvas.width = Math.max(rect.width, 200);
                canvas.height = Math.max(rect.height, 100);
                ctx.fillStyle = "#f8fafc";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = "#e2e8f0";
                ctx.lineWidth = 2;
                ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
                ctx.fillStyle = "#1e293b";
                ctx.font = "bold 14px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(el.tagName.toUpperCase(), canvas.width / 2, canvas.height / 2);
                const screenshotData = {
                  type: "ELEMENT_SCREENSHOT",
                  stepIndex: -1,
                  screenshot: canvas.toDataURL("image/png"),
                  elementInfo: {
                    tagName: el.tagName.toLowerCase(),
                    selector: (stepToRun as any).selector,
                    text:
                      el.innerText?.substring(0, 100) ||
                      el.textContent?.substring(0, 100) ||
                      "",
                  },
                };
                browser.runtime.sendMessage(screenshotData).catch(() => {});
              } catch {}
              return { success: true, type: "screenshot" };
            }

            case "select": {
              const el = querySelector(
                stepToRun.selector
              ) as HTMLSelectElement | null;
              if (!el)
                throw new Error("Element not found: " + stepToRun.selector);

              if (el.tagName.toLowerCase() !== "select") {
                throw new Error(
                  "Element is not a select element: " + stepToRun.selector
                );
              }

              await scrollIntoViewCentered(el);
              const selectValue = (stepToRun as any).value;

              // value로 매칭 시도
              let optionFound = false;
              for (let i = 0; i < el.options.length; i++) {
                if (el.options[i].value === selectValue) {
                  el.selectedIndex = i;
                  optionFound = true;
                  break;
                }
              }

              // value로 못 찾으면 text로 매칭 시도
              if (!optionFound) {
                for (let i = 0; i < el.options.length; i++) {
                  if (el.options[i].text === selectValue) {
                    el.selectedIndex = i;
                    optionFound = true;
                    break;
                  }
                }
              }

              if (!optionFound) {
                throw new Error(`Option not found: ${selectValue}`);
              }

              // change 이벤트 발생
              el.dispatchEvent(
                new Event("change", { bubbles: true, cancelable: true })
              );
              el.dispatchEvent(
                new Event("input", { bubbles: true, cancelable: true })
              );

              return { success: true, type: "select", value: el.value };
            }

            case "extract": {
              const el = querySelector(stepToRun.selector) as any;
              if (!el)
                throw new Error("Element not found: " + stepToRun.selector);

              await scrollIntoViewCentered(el);
              const prop = stepToRun.prop ?? "innerText";
              const value = el[prop];

              console.log("Extracted value:", value);

              // 엘리먼트 스크린샷 촬영
              try {
                const rect = el.getBoundingClientRect();

                // 엘리먼트가 화면에 보이는지 확인
                if (rect.width === 0 || rect.height === 0) {
                  console.log(
                    "Element has no visible size, skipping screenshot"
                  );
                  return { success: true, type: "extract", value };
                }

                // 간단한 스크린샷 생성 (실제 DOM을 캡처하는 대신 시각적 표현)
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                  console.warn("Failed to get canvas context");
                  return { success: true, type: "extract", value };
                }

                // 캔버스 크기 설정 (최소 크기 보장)
                canvas.width = Math.max(rect.width, 200);
                canvas.height = Math.max(rect.height, 100);

                // 배경 그리기
                ctx.fillStyle = "#f8fafc";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 테두리 그리기
                ctx.strokeStyle = "#e2e8f0";
                ctx.lineWidth = 2;
                ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

                // 엘리먼트 정보 그리기
                ctx.fillStyle = "#1e293b";
                ctx.font = "bold 14px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(
                  el.tagName.toUpperCase(),
                  canvas.width / 2,
                  canvas.height / 2 - 10
                );

                // 텍스트 내용 표시
                const text =
                  el.innerText?.substring(0, 30) ||
                  el.textContent?.substring(0, 30) ||
                  "";
                if (text) {
                  ctx.fillStyle = "#64748b";
                  ctx.font = "12px system-ui";
                  ctx.fillText(
                    text + (text.length >= 30 ? "..." : ""),
                    canvas.width / 2,
                    canvas.height / 2 + 10
                  );
                }

                // 선택자 정보 표시
                ctx.fillStyle = "#8b5cf6";
                ctx.font = "10px monospace";
                ctx.fillText(
                  stepToRun.selector.substring(0, 40) +
                    (stepToRun.selector.length > 40 ? "..." : ""),
                  canvas.width / 2,
                  canvas.height - 10
                );

                // 엘리먼트 스타일 정보 수집
                const elementInfo = {
                  tagName: el.tagName.toLowerCase(),
                  selector: stepToRun.selector,
                  text:
                    el.innerText?.substring(0, 100) ||
                    el.textContent?.substring(0, 100) ||
                    "",
                };

                // 스크린샷 데이터를 메시지로 전송
                const screenshotData = {
                  type: "ELEMENT_SCREENSHOT",
                  stepIndex: i, // 루프 인덱스 사용
                  screenshot: canvas.toDataURL("image/png"),
                  elementInfo,
                };

                console.log("Screenshot captured for step", i);
                browser.runtime.sendMessage(screenshotData).catch(() => {});
              } catch (screenshotError) {
                console.warn(
                  "Failed to capture element screenshot:",
                  screenshotError
                );
              }

              return { success: true, type: "extract", value };
            }

            default:
              throw new Error("Unknown step type");
          }
        },
        args: [step],
        world: "MAIN",
      });

      // 스텝 완료 알림 (extract 결과 포함)
      const completedMessage: StepCompletedMessage = {
        type: "STEP_COMPLETED",
        step: stepWithUrl,
        stepIndex: i,
        success: true,
      };

      // extract 액션인 경우 추출된 데이터 포함
      if (step.type === "extract" && result && result[0]) {
        const resultData = result[0] as any;
        console.log("Extract result data:", resultData);

        // executeScript의 결과는 { result: { ... } } 형태일 수 있음
        if (resultData.result && resultData.result.value !== undefined) {
          completedMessage.extractedData = resultData.result.value;
          console.log(
            "Extracted data (from result.result.value):",
            resultData.result.value
          );
        } else if (resultData.value !== undefined) {
          completedMessage.extractedData = resultData.value;
          console.log("Extracted data (from result.value):", resultData.value);
        }
      }

      browser.runtime.sendMessage(completedMessage).catch(() => {
        // 사이드패널이 열려있지 않으면 에러 발생 - 무시
      });

      // 스텝 간 부드러운 딜레이 (500ms로 증가)
      console.log(`Waiting 500ms before next step...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`Delay completed, continuing to next step`);

      // 탭이 여전히 활성 상태인지 확인 (불필요한 탭 생성 방지)
      try {
        const activeTab = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (activeTab[0]?.id !== tabId) {
          console.log(`Tab ${tabId} is no longer active, refocusing...`);
          await browser.tabs.update(tabId, { active: true });
        }
      } catch (error) {
        console.warn("Failed to check/focus tab:", error);
      }
    } catch (error) {
      console.error(`Step ${i + 1} failed:`, error);

      // 스텝 실패 알림
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`Sending step failure notification: ${errorMessage}`);

      try {
        await browser.runtime.sendMessage({
          type: "STEP_COMPLETED",
          step: stepWithUrl,
          stepIndex: i,
          success: false,
          error: errorMessage,
        } as StepCompletedMessage);
        console.log("Step failure notification sent successfully");
      } catch (sendError) {
        console.warn("Failed to send step failure notification:", sendError);
      }

      // 플로우 전체 실패 알림
      try {
        await browser.runtime.sendMessage({
          type: "FLOW_FAILED",
          error: `Step ${i + 1} failed: ${errorMessage}`,
          failedStepIndex: i,
          failedStep: stepWithUrl,
        });
        console.log("Flow failure notification sent");
      } catch (flowError) {
        console.warn("Failed to send flow failure notification:", flowError);
      }

      throw error;
    }
  }

  // Flow 성공적으로 완료
  console.log("All steps completed successfully");
  try {
    await browser.runtime.sendMessage({
      type: "FLOW_COMPLETED",
      totalSteps: steps.length,
    });
    console.log("Flow completion notification sent");
  } catch (error) {
    console.warn("Failed to send flow completion notification:", error);
  }
}

// 백엔드로 플로우 전송
async function sendToBackend(flow: Flow, endpoint: string): Promise<void> {
  if (!endpoint) {
    console.error("No endpoint provided");
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flow),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("Successfully sent to backend:", endpoint);
  } catch (error) {
    console.error("Failed to send to backend:", error);
    throw error;
  }
}

export default defineBackground(() => {
  console.log("Background script initialized");

  // 확장 프로그램 설치/업데이트 시 사이드패널 자동 열기
  browser.runtime.onInstalled.addListener(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      try {
        await browser.sidePanel.open({ tabId: tab.id });
      } catch (error) {
        console.log("사이드패널 열기 실패 (정상 동작):", error);
      }
    }
  });

  // 브라우저 시작 시 현재 탭에 사이드패널 열기
  browser.runtime.onStartup.addListener(async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await browser.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      console.log("onStartup: side panel open skipped:", error);
    }
  });

  // 탭 업데이트(네비게이션 포함) 시, 로드 완료 후 현재 레코딩 상태 브로드캐스트
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      if (isRecording) {
        browser.tabs
          .sendMessage(tabId, { type: "RECORD_STATE", recording: true })
          .catch(() => {});
      }
    }
  });
});
