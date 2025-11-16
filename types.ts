// 레코드 가능한 액션 타입
type CoreStep =
  | { type: "click"; selector: string; url?: string; screenshot?: string }
  | {
      type: "type";
      selector: string;
      text: string;
      originalText?: string; // 보안을 위해 마스킹된 원본 텍스트
      submit?: boolean; // 입력 후 Enter 제출 여부
      url?: string;
      screenshot?: string;
    }
  | {
      type: "select";
      selector: string;
      value: string; // 선택할 옵션의 value 또는 text
      url?: string;
      screenshot?: string;
    }
  | {
      type: "extract";
      selector: string;
      prop?: "innerText" | "value";
      url?: string;
      screenshot?: string;
    }
  | {
      type: "waitFor";
      selector: string;
      timeoutMs?: number;
      url?: string;
      screenshot?: string;
    }
  | {
      type: "screenshot";
      selector: string;
      url?: string;
      screenshot: string;
    }
  | { type: "navigate"; url: string }
  | { type: "waitForNavigation"; timeoutMs?: number };

// 각 스텝에 프레임 메타데이터를 선택적으로 포함
export type Step = CoreStep & {
  _frameId?: number; // 기록된 프레임 ID (브라우저 frameId)
  _frameUrl?: string; // 기록 당시 프레임 URL
};

// 플로우 전체 구조
export interface Flow {
  id: string;
  title: string;
  steps: Step[];
  createdAt: number;
  startUrl?: string; // 시작 URL (선택사항)
}

// 메시지 타입
export type RecordStepMessage = { type: "REC_STEP"; step: Step };
export type TogglePickerMessage = { type: "TOGGLE_PICKER"; on: boolean };
export type RunFlowMessage = { type: "RUN_FLOW" };
export type SendToBackendMessage = {
  type: "SEND_TO_BACKEND";
  endpoint: string;
};
export type FlowUpdatedMessage = { type: "FLOW_UPDATED"; flow: Flow };
export type SentOkMessage = { type: "SENT_OK" };
export type StepExecutingMessage = {
  type: "STEP_EXECUTING";
  step: Step;
  stepIndex: number;
  totalSteps: number;
  currentUrl?: string;
};
export type StepCompletedMessage = {
  type: "STEP_COMPLETED";
  step: Step;
  stepIndex: number;
  success: boolean;
  error?: string;
  extractedData?: any; // extract 액션에서 추출된 데이터
};

export type FlowFailedMessage = {
  type: "FLOW_FAILED";
  error: string;
  failedStepIndex: number;
  failedStep: Step;
};

export type ElementScreenshotMessage = {
  type: "ELEMENT_SCREENSHOT";
  stepIndex: number;
  screenshot: string; // base64 이미지 데이터
  elementInfo: {
    tagName: string;
    selector: string;
    text?: string;
  };
};

// 레코딩 관련 메시지
export type StartRecordMessage = { type: "START_RECORD" };
export type StopRecordMessage = { type: "STOP_RECORD" };
export type StopRunMessage = { type: "STOP_RUN" };
export type PlayEventsToContentMessage = {
  type: "PLAY_EVENTS";
  events: any[]; // deprecated: Step 기반 재생을 권장
};
export type RecordStateUpdatedMessage = {
  type: "RECORD_STATE";
  recording: boolean;
};
export type GetRecordStateMessage = { type: "GET_RECORD_STATE" };
export type UndoLastStepMessage = { type: "UNDO_LAST_STEP" };

export type Message =
  | RecordStepMessage
  | TogglePickerMessage
  | RunFlowMessage
  | SendToBackendMessage
  | FlowUpdatedMessage
  | SentOkMessage
  | StepExecutingMessage
  | StepCompletedMessage
  | FlowFailedMessage
  | ElementScreenshotMessage
  | StartRecordMessage
  | StopRecordMessage
  | StopRunMessage
  | PlayEventsToContentMessage
  | RecordStateUpdatedMessage
  | GetRecordStateMessage
  | UndoLastStepMessage;
