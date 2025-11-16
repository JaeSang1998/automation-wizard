import "@testing-library/jest-dom";
import { beforeAll, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// 각 테스트 후 자동으로 cleanup
afterEach(() => {
  cleanup();
});

// 브라우저 API Mock 설정
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onUpdated: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
  },
};

// 글로벌 browser 객체 설정
beforeAll(() => {
  // @ts-ignore
  global.browser = mockBrowser;
  // Chrome 확장도 지원
  // @ts-ignore
  global.chrome = mockBrowser;
});

// crypto.randomUUID() polyfill (Node 환경에서)
if (!global.crypto) {
  // @ts-ignore
  global.crypto = {
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      ) as `${string}-${string}-${string}-${string}-${string}`;
    },
  };
}

// Mock helper functions
export const mockStorageGet = (data: any) => {
  // @ts-ignore
  global.browser.storage.local.get.mockResolvedValueOnce(data);
};

export const mockStorageSet = () => {
  // @ts-ignore
  return global.browser.storage.local.set;
};

export const mockRuntimeSendMessage = (response?: any) => {
  // @ts-ignore
  global.browser.runtime.sendMessage.mockResolvedValueOnce(response);
};

export const mockTabsQuery = (tabs: any[]) => {
  // @ts-ignore
  global.browser.tabs.query.mockResolvedValueOnce(tabs);
};

// Mock 리셋 함수
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

