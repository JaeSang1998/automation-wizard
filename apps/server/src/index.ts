import express from "express";
import cors from "cors";
import { chromium } from "playwright";
import puppeteer from "puppeteer";
import { PlaywrightFlowRunner } from "@auto-wiz/playwright";
import { PuppeteerFlowRunner } from "@auto-wiz/puppeteer";
import type { Flow } from "@auto-wiz/core";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Run with Playwright
app.post("/run/playwright", async (req, res) => {
  const flow: Flow = req.body;
  console.log(`[Playwright] Received flow: ${flow.title}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: false }); // Visible for demo
    const page = await browser.newPage();

    const runner = new PlaywrightFlowRunner();
    const result = await runner.run(flow, page);

    res.json(result);
  } catch (error) {
    console.error("[Playwright] Error:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    if (browser) await browser.close();
  }
});

// Run with Puppeteer
app.post("/run/puppeteer", async (req, res) => {
  const flow: Flow = req.body;
  console.log(`[Puppeteer] Received flow: ${flow.title}`);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: false }); // Visible for demo
    const page = await browser.newPage();

    const runner = new PuppeteerFlowRunner();
    const result = await runner.run(flow, page);

    res.json(result);
  } catch (error) {
    console.error("[Puppeteer] Error:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Automation Server running at http://localhost:${PORT}`);
  console.log(`   - POST /run/playwright`);
  console.log(`   - POST /run/puppeteer`);
});
