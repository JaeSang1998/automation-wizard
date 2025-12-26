import {
  type FlowRunner,
  type RunResult,
  type ExecutionResult,
  type RunnerOptions,
  type Flow,
  type Step,
  type ElementLocator,
} from "@auto-wiz/core";
import { Page, Locator } from "playwright";

export class PlaywrightFlowRunner implements FlowRunner<Page> {
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
          // Playwright usually throws, but if we catch it:
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
          const locator = this.getLocator(page, step);
          await locator.click({ timeout });
          break;
        }

        case "type": {
          const locator = this.getLocator(page, step);
          const text = step.text || (step as any).originalText || "";
          await locator.fill(text, { timeout });
          if (step.submit) {
            await locator.press("Enter");
          }
          break;
        }

        case "select": {
          const locator = this.getLocator(page, step);
          if (step.value) {
            await locator.selectOption(step.value, { timeout });
          }
          break;
        }

        case "extract": {
          const locator = this.getLocator(page, step);
          const text = await locator.textContent({ timeout });
          return { success: true, extractedData: text?.trim() };
        }

        case "waitFor": {
          if (step.selector || step.locator) {
            const locator = this.getLocator(page, step);
            await locator.waitFor({
              state: "visible",
              timeout: step.timeoutMs || timeout,
            });
          } else if (step.timeoutMs) {
            await page.waitForTimeout(step.timeoutMs);
          }
          break;
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private getLocator(page: Page, step: Step): Locator {
    if ("locator" in step && step.locator) {
      const { primary } = step.locator as ElementLocator;
      return page.locator(primary).first();
    }
    if ("selector" in step && step.selector) {
      return page.locator(step.selector).first();
    }
    throw new Error(`Step ${step.type} requires a selector or locator`);
  }
}
