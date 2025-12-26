import { chromium } from "playwright";
import { PlaywrightFlowRunner } from "./src/runner";
import type { Flow } from "@auto-wiz/core";

async function main() {
  console.log("🚀 Starting Playwright Flow Runner Example");

  // 1. Playwright 브라우저 실행
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 2. 실행할 Flow 정의
  const flow: Flow = {
    id: "demo-flow",
    title: "Example Domain Test",
    createdAt: Date.now(),
    steps: [
      {
        type: "navigate",
        url: "https://example.com",
      },
      {
        type: "extract",
        selector: "h1",
        prop: "innerText", // PlaywrightRunner에서는 textContent를 사용하지만 호환성 확인
      },
      {
        type: "click",
        selector: "a",
      },
    ],
  };

  // 3. Runner 인스턴스 생성 및 실행
  const runner = new PlaywrightFlowRunner();

  try {
    console.log("Running flow:", flow.title);
    const result = await runner.run(flow, page);

    console.log("✅ Execution Completed!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Execution Failed:", error);
  } finally {
    await browser.close();
  }
}

main();
