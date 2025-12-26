import {
  type FlowRunner,
  type RunResult,
  type ExecutionResult,
  type RunnerOptions,
  type Flow,
  type Step,
  type ElementLocator,
} from "@auto-wiz/core";
import { Page, ElementHandle } from "puppeteer";

export class PuppeteerFlowRunner implements FlowRunner<Page> {
  async run(
    flow: Flow,
    page: Page,
    options: RunnerOptions = {}
  ): Promise<RunResult> {
    const extractedData: Record<string, any> = {};

    for (const [index, step] of flow.steps.entries()) {
      try {
        const result = await this.runStep(step, page, options);

        if (!result.success) {
          if (options.stopOnError !== false) {
            return {
              success: false,
              error: result.error,
              failedStepIndex: index,
              extractedData,
            };
          }
        }

        if (result.extractedData) {
          extractedData[`step_${index}`] = result.extractedData;
        }
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          failedStepIndex: index,
          extractedData,
        };
      }
    }

    return { success: true, extractedData };
  }

  async runStep(
    step: Step,
    page: Page,
    options: RunnerOptions = {}
  ): Promise<ExecutionResult> {
    const timeout = options.timeout || 5000;

    try {
      switch (step.type) {
        case "navigate":
          if (step.url) {
            await page.goto(step.url, { timeout });
          }
          break;

        case "click": {
          const el = await this.getElement(page, step, timeout);
          await el.click();
          break;
        }

        case "type": {
          const el = await this.getElement(page, step, timeout);
          const text = step.text || (step as any).originalText || "";
          await el.type(text);
          if (step.submit) {
            await page.keyboard.press("Enter");
          }
          break;
        }

        case "select": {
          const selector = this.getSelector(step);
          // Puppeteer select uses selector string, not element handle usually
          if (step.value) {
            // Need to wait for it first
            await page.waitForSelector(selector, { timeout });
            await page.select(selector, step.value);
          }
          break;
        }

        case "extract": {
          const selector = this.getSelector(step);
          await page.waitForSelector(selector, { timeout });

          // Extract text
          const text = await page.$eval(selector, (el) => el.textContent);
          return { success: true, extractedData: text?.trim() };
        }

        case "waitFor": {
          if (step.selector || step.locator) {
            const selector = this.getSelector(step);
            await page.waitForSelector(selector, {
              visible: true,
              timeout: step.timeoutMs || timeout,
            });
          } else if (step.timeoutMs) {
            await new Promise((r) => setTimeout(r, step.timeoutMs));
          }
          break;
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private getSelector(step: Step): string {
    if ("locator" in step && step.locator) {
      const { primary } = step.locator as ElementLocator;
      return primary;
    }
    if ("selector" in step && step.selector) {
      return step.selector;
    }
    throw new Error(`Step ${step.type} requires a selector or locator`);
  }

  private async getElement(
    page: Page,
    step: Step,
    timeout: number
  ): Promise<ElementHandle> {
    const selector = this.getSelector(step);
    const element = await page.waitForSelector(selector, {
      visible: true,
      timeout,
    });
    if (!element) throw new Error(`Element not found: ${selector}`);
    return element;
  }
}
