/**
 * URL 유틸리티 함수들
 * URL 비교, 정규화, 파싱 등의 기능 제공
 */

/**
 * URL 정규화
 * - 트레일링 슬래시 제거
 * - 해시(fragment) 제거
 * - 쿼리 파라미터 정렬
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // 트레일링 슬래시 제거 (루트 경로 제외)
    if (urlObj.pathname !== "/" && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // 쿼리 파라미터 정렬
    const params = Array.from(urlObj.searchParams.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    urlObj.search = new URLSearchParams(params).toString();
    
    // 해시 제거 (fragment는 페이지 내 이동만 하므로)
    urlObj.hash = "";
    
    return urlObj.toString();
  } catch (error) {
    console.error("Invalid URL:", url, error);
    return url;
  }
}

/**
 * 두 URL이 같은 페이지를 가리키는지 확인
 * (해시와 쿼리 파라미터 순서 무시)
 */
export function isSameUrl(url1: string, url2: string): boolean {
  try {
    return normalizeUrl(url1) === normalizeUrl(url2);
  } catch (error) {
    return url1 === url2;
  }
}

/**
 * 두 URL의 origin이 같은지 확인
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const origin1 = new URL(url1).origin;
    const origin2 = new URL(url2).origin;
    return origin1 === origin2;
  } catch (error) {
    return false;
  }
}

/**
 * 상대 URL을 절대 URL로 변환
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    console.error("Failed to resolve URL:", relativeUrl, baseUrl, error);
    return relativeUrl;
  }
}

/**
 * URL에서 도메인 추출
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

/**
 * URL에서 경로 추출
 */
export function getPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch (error) {
    return "";
  }
}

/**
 * URL에서 쿼리 파라미터 추출
 */
export function getQueryParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch (error) {
    return {};
  }
}

/**
 * URL이 유효한지 검증
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * HTTP/HTTPS URL인지 확인
 */
export function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * URL이 현재 페이지와 같은 페이지인지 확인
 * (해시만 다른 경우 같은 페이지로 간주)
 */
export function isSamePage(url1: string, url2: string): boolean {
  try {
    const obj1 = new URL(url1);
    const obj2 = new URL(url2);
    
    return (
      obj1.origin === obj2.origin &&
      obj1.pathname === obj2.pathname &&
      obj1.search === obj2.search
    );
  } catch {
    return false;
  }
}

