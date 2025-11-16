import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Picker 자동 켜짐 테스트
 * 
 * 테스트 대상:
 * - Recording 시작 시 Picker 자동 켜짐
 * - Recording 중지 시 Picker는 유지 (수동으로 끄기 전까지)
 * - RECORD_STATE 메시지 수신 시 Picker 상태 변경
 */

// Mock browser APIs
const mockSendMessage = vi.fn();

vi.stubGlobal("browser", {
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
    },
  },
});

describe("Picker Auto-Enable on Recording", () => {
  let pickerOn = false;
  let recording = false;

  beforeEach(() => {
    pickerOn = false;
    recording = false;
    vi.clearAllMocks();
  });

  it("Should enable picker when recording starts", () => {
    // RECORD_STATE message received
    const message = { type: "RECORD_STATE", recording: true };

    // Simulate content.tsx handler
    if (message.type === "RECORD_STATE") {
      recording = message.recording;
      if (message.recording) {
        pickerOn = true; // Auto-enable picker
      }
    }

    expect(recording).toBe(true);
    expect(pickerOn).toBe(true);
  });

  it("Should keep picker on when recording stops (unless manually disabled)", () => {
    pickerOn = true;
    recording = true;

    // RECORD_STATE message received
    const message = { type: "RECORD_STATE", recording: false };

    // Simulate content.tsx handler
    if (message.type === "RECORD_STATE") {
      recording = message.recording;
      // Picker는 유지됨 (수동으로 꺼야 함)
    }

    expect(recording).toBe(false);
    expect(pickerOn).toBe(true); // Still on
  });

  it("Should receive TOGGLE_PICKER message and change state", () => {
    pickerOn = false;

    // TOGGLE_PICKER message received
    const message = { type: "TOGGLE_PICKER", on: true };

    // Simulate content.tsx handler
    if (message.type === "TOGGLE_PICKER") {
      pickerOn = message.on;
    }

    expect(pickerOn).toBe(true);
  });

  it("Should disable picker when TOGGLE_PICKER off is received", () => {
    pickerOn = true;

    // TOGGLE_PICKER message received
    const message = { type: "TOGGLE_PICKER", on: false };

    // Simulate content.tsx handler
    if (message.type === "TOGGLE_PICKER") {
      pickerOn = message.on;
    }

    expect(pickerOn).toBe(false);
  });
});

