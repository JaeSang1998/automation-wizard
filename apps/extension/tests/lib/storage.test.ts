import { describe, it, expect, beforeEach } from "vitest";
import {
  setStorageAdapter,
  MemoryStorageAdapter,
  saveFlow,
  getFlow,
  clearFlow,
  addStep,
  removeLastStep,
  removeStep,
  updateStep,
  updateFlow,
} from "@auto-wiz/core";
import type { Flow, Step } from "@auto-wiz/core";

describe("Flow Storage (Memory Adapter)", () => {
  beforeEach(async () => {
    // 각 테스트 전에 메모리 어댑터로 초기화
    const adapter = new MemoryStorageAdapter();
    setStorageAdapter(adapter);
    // 상태 초기화
    await clearFlow();
  });

  const mockStep: Step = {
    type: "click",
    selector: "button",
    locator: { primary: "button", fallbacks: [] },
  };

  it("should start with empty flow", async () => {
    const flow = await getFlow();
    expect(flow).not.toBeNull();
    expect(flow?.steps).toHaveLength(0);
    expect(flow?.title).toBe("New Flow");
  });

  it("should save and retrieve flow", async () => {
    const newFlow: Flow = {
      id: "test-id",
      title: "Test Flow",
      steps: [mockStep],
      createdAt: Date.now(),
    };

    await saveFlow(newFlow);
    const retrieved = await getFlow();

    expect(retrieved).toEqual(newFlow);
  });

  it("should add steps", async () => {
    await addStep(mockStep);

    const flow = await getFlow();
    expect(flow?.steps).toHaveLength(1);
    expect(flow?.steps[0]).toEqual(mockStep);

    await addStep(mockStep);
    const flow2 = await getFlow();
    expect(flow2?.steps).toHaveLength(2);
  });

  it("should remove last step", async () => {
    await addStep(mockStep);
    await addStep({ ...mockStep, type: "type", text: "hello" } as any);

    let flow = await getFlow();
    expect(flow?.steps).toHaveLength(2);

    await removeLastStep();
    flow = await getFlow();
    expect(flow?.steps).toHaveLength(1);
    expect(flow?.steps[0].type).toBe("click");
  });

  it("should remove specific step", async () => {
    const step1 = { ...mockStep, type: "click" } as Step;
    const step2 = {
      ...mockStep,
      type: "type",
      text: "hello",
    } as unknown as Step;
    const step3 = { ...mockStep, type: "wait" } as unknown as Step;

    await addStep(step1);
    await addStep(step2);
    await addStep(step3);

    await removeStep(1); // remove step2

    const flow = await getFlow();
    expect(flow?.steps).toHaveLength(2);
    expect(flow?.steps[0].type).toBe("click");
    // @ts-ignore
    expect(flow?.steps[1].type).toBe("wait");
  });

  it("should update specific step", async () => {
    await addStep(mockStep);

    const updatedStep = { ...mockStep, selector: "updated" };
    await updateStep(0, updatedStep);

    const flow = await getFlow();
    expect((flow?.steps[0] as any).selector).toBe("updated");
  });

  it("should update flow metadata", async () => {
    await updateFlow({ title: "Updated Title" });

    const flow = await getFlow();
    expect(flow?.title).toBe("Updated Title");
  });

  it("should set startUrl on first step if present", async () => {
    const stepWithUrl = { ...mockStep, url: "https://example.com" };

    // Clear first (implicit in beforeEach but explicitly ensure fresh state)
    await clearFlow();
    const cleanFlow = await getFlow();
    expect(cleanFlow?.startUrl).toBeUndefined();

    await addStep(stepWithUrl);

    const flow = await getFlow();
    expect(flow?.startUrl).toBe("https://example.com");
  });
});
