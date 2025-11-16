import { describe, it, expect } from "vitest";

// 테스트 전용 URL 동등성 비교기
// - 해시는 무시
// - 쿼리 파라미터는 키/값 기준 정렬하여 비교 (순서 무시)
// - 상대경로는 base를 기준으로 절대화하여 비교
function areUrlsEqual(a: string, b: string, base = "https://example.com/"): boolean {
  const ua = new URL(a, base);
  const ub = new URL(b, base);

  // 해시 제거
  ua.hash = "";
  ub.hash = "";

  // 쿼리 파라미터 정렬
  const sortParams = (u: URL) => {
    const params = Array.from(u.searchParams.entries()).sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)
    );
    u.search = "";
    for (const [k, v] of params) u.searchParams.append(k, v);
  };
  sortParams(ua);
  sortParams(ub);

  return ua.toString() === ub.toString();
}

describe("URL Utils - Normalization & Equality", () => {
  it("해시(#)만 다른 경우 동일로 간주한다", () => {
    expect(areUrlsEqual("https://example.com/path#top", "https://example.com/path")).toBe(true);
    expect(areUrlsEqual("/path#section", "/path")).toBe(true);
  });

  it("쿼리 파라미터 순서를 무시하고 동일성 비교한다", () => {
    expect(areUrlsEqual("https://example.com/search?q=abc&page=2", "https://example.com/search?page=2&q=abc")).toBe(true);
    expect(areUrlsEqual("/search?q=abc&q=xyz&page=2", "/search?page=2&q=xyz&q=abc")).toBe(true);
  });

  it("상대경로를 base에 대해 절대화하여 비교한다", () => {
    const base = "https://example.com/app/";
    expect(areUrlsEqual("./list", "https://example.com/app/list", base)).toBe(true);
    expect(areUrlsEqual("../home", "https://example.com/home", base)).toBe(true);
    expect(areUrlsEqual("/abs", "https://example.com/abs", base)).toBe(true);
  });

  it("트레일링 슬래시는 경로 의미에 따라 다를 수 있으나 호스트 단위는 동일 취급", () => {
    // 호스트만 있을 때는 동일로 취급
    expect(areUrlsEqual("https://example.com", "https://example.com/")).toBe(true);
    // 경로가 있을 때는 trailing slash 의미가 달라질 수 있으므로 동일성 보장은 안함
    expect(areUrlsEqual("https://example.com/app", "https://example.com/app/")).toBe(false);
  });
});


