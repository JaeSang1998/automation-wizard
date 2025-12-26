import {
  type FlowRunner,
  type RunResult,
  type ExecutionResult,
  type RunnerOptions,
  type Flow,
  type Step,
} from "@auto-wiz/core";
import { executeStep } from "./steps/stepExecution";

export class DomFlowRunner implements FlowRunner<void> {
  async run(
    flow: Flow,
    _context: any = {}, // unused
    _options: RunnerOptions = {} // unused
  ): Promise<RunResult> {
    const extractedData: Record<string, any> = {};
    const steps = flow.steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        const result = await this.runStep(step);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            failedStepIndex: i,
            extractedData,
          };
        }

        if (result.extractedData) {
          extractedData[`step_${i}`] = result.extractedData;
        }
      } catch (e) {
        return {
          success: false,
          error: (e as Error).message,
          failedStepIndex: i,
          extractedData,
        };
      }
    }

    return { success: true, extractedData };
  }

  async runStep(step: Step): Promise<ExecutionResult> {
    try {
      // Direct DOM execution using existing logic
      const result = await executeStep(step);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
