import type { Flow, Step } from "../../types";

/**
 * Flow storage 유틸리티
 * Chrome Extension Storage API를 사용한 Flow 저장/로드
 */

const FLOW_STORAGE_KEY = "flow";

/**
 * Flow 가져오기
 */
export async function getFlow(): Promise<Flow | null> {
  try {
    const result = await browser.storage.local.get(FLOW_STORAGE_KEY);
    return result[FLOW_STORAGE_KEY] || null;
  } catch (error) {
    console.error("Failed to get flow from storage:", error);
    return null;
  }
}

/**
 * Flow 저장하기
 */
export async function saveFlow(flow: Flow): Promise<void> {
  try {
    await browser.storage.local.set({ [FLOW_STORAGE_KEY]: flow });
  } catch (error) {
    console.error("Failed to save flow to storage:", error);
    throw error;
  }
}

/**
 * Flow 초기화 (비우기)
 */
export async function clearFlow(): Promise<void> {
  try {
    const emptyFlow: Flow = {
      id: crypto.randomUUID(),
      title: "New Flow",
      steps: [],
      createdAt: Date.now(),
    };
    await saveFlow(emptyFlow);
  } catch (error) {
    console.error("Failed to clear flow:", error);
    throw error;
  }
}

/**
 * Flow에 Step 추가
 */
export async function addStep(step: Step): Promise<Flow> {
  const flow = (await getFlow()) || {
    id: crypto.randomUUID(),
    title: "New Flow",
    steps: [],
    createdAt: Date.now(),
  };
  flow.steps.push(step);
  
  if (!flow.startUrl && (step as any).url) {
    flow.startUrl = (step as any).url;
  }
  
  await saveFlow(flow);
  return flow;
}

/**
 * Flow에서 마지막 Step 제거
 */
export async function removeLastStep(): Promise<Flow> {
  const flow = await getFlow();
  if (!flow || flow.steps.length === 0) {
    return {
      id: crypto.randomUUID(),
      title: "New Flow",
      steps: [],
      createdAt: Date.now(),
    };
  }
  
  flow.steps.pop();
  await saveFlow(flow);
  return flow;
}

/**
 * Flow에서 특정 Step 제거
 */
export async function removeStep(index: number): Promise<Flow> {
  const flow = await getFlow();
  if (!flow || index < 0 || index >= flow.steps.length) {
    throw new Error(`Invalid step index: ${index}`);
  }
  
  flow.steps.splice(index, 1);
  await saveFlow(flow);
  return flow;
}

/**
 * Flow의 특정 Step 업데이트
 */
export async function updateStep(index: number, step: Step): Promise<Flow> {
  const flow = await getFlow();
  if (!flow || index < 0 || index >= flow.steps.length) {
    throw new Error(`Invalid step index: ${index}`);
  }
  
  flow.steps[index] = step;
  await saveFlow(flow);
  return flow;
}

/**
 * Flow 업데이트 (전체 교체)
 */
export async function updateFlow(updates: Partial<Flow>): Promise<Flow> {
  const flow = (await getFlow()) || {
    id: crypto.randomUUID(),
    title: "New Flow",
    steps: [],
    createdAt: Date.now(),
  };
  const updatedFlow = { ...flow, ...updates };
  await saveFlow(updatedFlow);
  return updatedFlow;
}

