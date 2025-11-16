import { useState, useEffect, useCallback, useRef } from "react";
import { getSimpleSelector } from "../lib/selectors/selectorGenerator";

interface UseElementInspectorOptions {
  enabled: boolean;
  locked?: boolean;
}

interface HoverBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseElementInspectorReturn {
  target: HTMLElement | null;
  coords: { x: number; y: number };
  hoverBox: HoverBox | null;
  hoverSelector: string;
  inspectedElement: HTMLElement | null;
  setInspectedElement: (el: HTMLElement | null) => void;
  navigateToParent: () => void;
  navigateToChild: () => void;
}

/**
 * 요소 검사 및 호버 로직을 처리하는 커스텀 훅
 * 
 * 기능:
 * - 마우스 호버 시 요소 감지 및 하이라이트
 * - 화살표 키로 부모/자식 요소 탐색
 * - Selector 생성
 * - 호버 박스 표시
 */
export function useElementInspector({
  enabled,
  locked = false,
}: UseElementInspectorOptions): UseElementInspectorReturn {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hoverBox, setHoverBox] = useState<HoverBox | null>(null);
  const [hoverSelector, setHoverSelector] = useState<string>("");
  const [inspectedElement, setInspectedElement] = useState<HTMLElement | null>(
    null
  );
  const [hoverSelectorUpdatedAt, setHoverSelectorUpdatedAt] = useState<number>(0);

  /**
   * 부모 요소로 이동
   */
  const navigateToParent = useCallback(() => {
    if (!inspectedElement) return;

    const parent = inspectedElement.parentElement;
    if (parent && parent !== document.body) {
      setInspectedElement(parent);
      setTarget(parent);

      // hover box 업데이트
      const rect = parent.getBoundingClientRect();
      setHoverBox({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });

      // selector 업데이트
      const selector = getSimpleSelector(parent);
      setHoverSelector(selector);
      setHoverSelectorUpdatedAt(Date.now());
    }
  }, [inspectedElement]);

  /**
   * 자식 요소로 이동 (첫 번째 자식)
   */
  const navigateToChild = useCallback(() => {
    if (!inspectedElement) return;

    const firstChild = inspectedElement.children[0];
    if (firstChild && firstChild instanceof HTMLElement) {
      setInspectedElement(firstChild);
      setTarget(firstChild);

      // hover box 업데이트
      const rect = firstChild.getBoundingClientRect();
      setHoverBox({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });

      // selector 업데이트
      const selector = getSimpleSelector(firstChild);
      setHoverSelector(selector);
      setHoverSelectorUpdatedAt(Date.now());
    }
  }, [inspectedElement]);

  /**
   * inspectedElement가 변경되면 hover 상태 업데이트
   */
  useEffect(() => {
    if (locked && inspectedElement) {
      const rect = inspectedElement.getBoundingClientRect();
      setHoverBox({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });

      const selector = getSimpleSelector(inspectedElement);
      setHoverSelector(selector);
      setHoverSelectorUpdatedAt(Date.now());
    }
  }, [inspectedElement, locked]);

  /**
   * Picker가 켜질 때 현재 마우스 위치의 요소를 즉시 감지
   */
  useEffect(() => {
    if (!enabled || locked) return;

    // Picker가 켜질 때 즉시 현재 마우스 위치의 요소 감지
    const hoveredElements = document.querySelectorAll(':hover');
    for (let i = hoveredElements.length - 1; i >= 0; i--) {
      const el = hoveredElements[i];
      if (
        el instanceof HTMLElement &&
        !el.closest("#automation-wizard-root")
      ) {
        setTarget(el);
        
        const rect = el.getBoundingClientRect();
        setHoverBox({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });

        const selector = getSimpleSelector(el);
        setHoverSelector(selector);
        setHoverSelectorUpdatedAt(Date.now());
        break;
      }
    }
  }, [enabled, locked]);

  /**
   * 마우스 무브 핸들러 (throttled)
   */
  useEffect(() => {
    if (!enabled || locked) return;

    let rafId: number | null = null;
    let lastUpdate = 0;
    const throttleMs = 50; // 50ms throttle

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const now = Date.now();
        if (now - lastUpdate < throttleMs) {
          rafId = null;
          return;
        }

        lastUpdate = now;
        const el = document.elementFromPoint(e.clientX, e.clientY);

        if (
          el &&
          el instanceof HTMLElement &&
          !el.closest("#automation-wizard-root")
        ) {
          setTarget(el);
          setCoords({ x: e.clientX, y: e.clientY });

          const rect = el.getBoundingClientRect();
          setHoverBox({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });

          const selector = getSimpleSelector(el);
          setHoverSelector(selector);
          setHoverSelectorUpdatedAt(Date.now());
        }

        rafId = null;
      });
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, locked]);

  /**
   * 스크롤/리사이즈 시 hover box 위치 업데이트 (throttled)
   */
  useEffect(() => {
    if (!enabled) return;

    let rafId: number | null = null;
    let lastUpdate = 0;
    const throttleMs = 16; // ~60fps

    const updateHoverBox = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const now = Date.now();
        if (now - lastUpdate < throttleMs) {
          rafId = null;
          return;
        }

        lastUpdate = now;
        const elementToUpdate = locked ? inspectedElement : target;
        
        if (elementToUpdate) {
          const rect = elementToUpdate.getBoundingClientRect();
          setHoverBox({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
        }

        rafId = null;
      });
    };

    window.addEventListener("scroll", updateHoverBox, { passive: true, capture: true });
    window.addEventListener("resize", updateHoverBox, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateHoverBox, true);
      window.removeEventListener("resize", updateHoverBox);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, locked, inspectedElement, target]);

  /**
   * locked가 해제되면 inspectedElement 초기화
   */
  useEffect(() => {
    if (!locked) {
      setInspectedElement(null);
    }
  }, [locked]);

  return {
    target,
    coords,
    hoverBox,
    hoverSelector,
    inspectedElement,
    setInspectedElement,
    navigateToParent,
    navigateToChild,
  };
}

