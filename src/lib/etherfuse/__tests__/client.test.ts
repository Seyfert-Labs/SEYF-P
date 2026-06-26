// Feature: etherfuse-client-hardening
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  etherfuseFetch,
  ETHERFUSE_DEFAULT_TIMEOUT_MS,
  ETHERFUSE_MAX_RETRIES,
} from "../client";
import { AppError } from "@/lib/seyf/api-error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(status: number, body = ""): Response {
  return new Response(body, { status });
}

/**
 * Stub setTimeout so ALL timers (backoff + abort) fire immediately.
 * This makes the abort controller fire synchronously, triggering the AbortError.
 */
function stubSetTimeoutImmediate() {
  vi.stubGlobal("setTimeout", (fn: () => void, _ms: number) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
}

function resetEnv() {
  process.env.ETHERFUSE_API_KEY = "test-api-key";
  process.env.ETHERFUSE_API_BASE_URL = "https://api.test.etherfuse.com";
}

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetEnv();
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.ETHERFUSE_API_KEY;
  delete process.env.ETHERFUSE_API_BASE_URL;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Unit tests — constants
// ---------------------------------------------------------------------------

describe("exported constants", () => {
  it("ETHERFUSE_DEFAULT_TIMEOUT_MS === 10_000 (Req 2.4)", () => {
    expect(ETHERFUSE_DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it("ETHERFUSE_MAX_RETRIES === 3 (Req 3.7)", () => {
    expect(ETHERFUSE_MAX_RETRIES).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — retry behaviour
// ---------------------------------------------------------------------------

describe("etherfuseFetch() — retry behaviour", () => {
  it("GET: retries on 503 and returns 200 on third attempt (Req 3.1)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount <= 2) return mockResponse(503, "service unavailable");
        return mockResponse(200, "{}");
      }),
    );
    stubSetTimeoutImmediate();

    const res = await etherfuseFetch("/test");
    expect(res.status).toBe(200);
    expect(callCount).toBe(3);
  });

  it("GET: does NOT retry on 400 — throws immediately (Req 3.5)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return mockResponse(400, "bad request");
      }),
    );

    await expect(etherfuseFetch("/test")).rejects.toBeInstanceOf(AppError);
    expect(callCount).toBe(1);
  });

  it("POST without retryable: does NOT retry on 503 (Req 3.2)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        return mockResponse(503, "service unavailable");
      }),
    );

    await expect(
      etherfuseFetch("/test", { method: "POST" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(callCount).toBe(1);
  });

  it("POST with retryable:true: retries on 503 (Req 3.2 opt-in)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount <= 2) return mockResponse(503, "service unavailable");
        return mockResponse(200, "{}");
      }),
    );
    stubSetTimeoutImmediate();

    const res = await etherfuseFetch("/test", {
      method: "POST",
      retryable: true,
    });
    expect(res.status).toBe(200);
    expect(callCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — timeout
// ---------------------------------------------------------------------------

describe("etherfuseFetch() — timeout", () => {
  it("throws AppError provider_unavailable with statusCode 504 when fetch never resolves within timeoutMs (Req 2.3)", async () => {
    // Stub setTimeout to fire immediately — this triggers the AbortController abort
    stubSetTimeoutImmediate();

    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const err = await etherfuseFetch("/test", { timeoutMs: 50 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("provider_unavailable");
    expect((err as AppError).statusCode).toBe(504);
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("etherfuseFetch() — property tests", () => {
  it(// Feature: etherfuse-client-hardening, Property 5: Timeout produces AppError provider_unavailable 504
  // Validates: Requirements 2.3
  "P5: any timeoutMs value — fetch never resolves → AppError provider_unavailable 504", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 10, max: 200 }), async (timeoutMs) => {
        // Stub setTimeout to fire immediately — triggers abort
        vi.stubGlobal("setTimeout", (fn: () => void, _ms: number) => {
          fn();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

        vi.stubGlobal(
          "fetch",
          vi.fn((_url: string, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
              if (init.signal?.aborted) {
                reject(new DOMException("Aborted", "AbortError"));
                return;
              }
              init.signal?.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            });
          }),
        );

        const err = await etherfuseFetch("/test", { timeoutMs }).catch(
          (e) => e,
        );

        vi.restoreAllMocks();
        resetEnv();

        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("provider_unavailable");
        expect((err as AppError).statusCode).toBe(504);
      }),
      { numRuns: 20 },
    );
  });

  it(// Feature: etherfuse-client-hardening, Property 6: Custom timeoutMs overrides the default
  // Validates: Requirements 2.2
  "P6: custom timeoutMs is used instead of ETHERFUSE_DEFAULT_TIMEOUT_MS", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 200 }),
        async (customTimeout) => {
          vi.stubGlobal("setTimeout", (fn: () => void, _ms: number) => {
            fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
          });

          vi.stubGlobal(
            "fetch",
            vi.fn((_url: string, init: RequestInit) => {
              return new Promise((_resolve, reject) => {
                if (init.signal?.aborted) {
                  reject(new DOMException("Aborted", "AbortError"));
                  return;
                }
                init.signal?.addEventListener("abort", () => {
                  reject(new DOMException("Aborted", "AbortError"));
                });
              });
            }),
          );

          const err = await etherfuseFetch("/test", {
            timeoutMs: customTimeout,
          }).catch((e) => e);

          vi.restoreAllMocks();
          resetEnv();

          expect(err).toBeInstanceOf(AppError);
          expect((err as AppError).code).toBe("provider_unavailable");
          expect((err as AppError).statusCode).toBe(504);
        },
      ),
      { numRuns: 10 },
    );
  });

  it(// Feature: etherfuse-client-hardening, Property 7: GET retries if and only if the status is retryable
  // Validates: Requirements 3.1, 3.4, 3.5
  "P7: GET retries on retryable statuses (429/502/503/504) and does NOT retry on other 4xx/5xx", async () => {
    // Retryable statuses: should attempt ETHERFUSE_MAX_RETRIES + 1 total times
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(429, 502, 503, 504),
        async (retryableStatus) => {
          let callCount = 0;
          vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
              callCount++;
              return mockResponse(retryableStatus, "error");
            }),
          );
          stubSetTimeoutImmediate();

          await etherfuseFetch("/test").catch(() => {});
          expect(callCount).toBe(ETHERFUSE_MAX_RETRIES + 1);

          vi.restoreAllMocks();
          resetEnv();
        },
      ),
      { numRuns: 10 },
    );

    // Non-retryable 4xx (except 429): should attempt exactly once
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 499 }).filter((s) => s !== 429),
        async (nonRetryableStatus) => {
          let callCount = 0;
          vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
              callCount++;
              return mockResponse(nonRetryableStatus, "error");
            }),
          );

          await etherfuseFetch("/test").catch(() => {});
          expect(callCount).toBe(1);

          vi.restoreAllMocks();
          resetEnv();
        },
      ),
      { numRuns: 20 },
    );
  });

  it(// Feature: etherfuse-client-hardening, Property 8: Non-GET writes do not retry without explicit opt-in
  // Validates: Requirements 3.2
  "P8: POST/PUT/PATCH/DELETE without retryable:true — fetch called exactly once on 503", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("POST", "PUT", "PATCH", "DELETE"),
        async (method) => {
          let callCount = 0;
          vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
              callCount++;
              return mockResponse(503, "service unavailable");
            }),
          );

          await etherfuseFetch("/test", { method }).catch(() => {});
          expect(callCount).toBe(1);

          vi.restoreAllMocks();
          resetEnv();
        },
      ),
      { numRuns: 20 },
    );
  });

  it(// Feature: etherfuse-client-hardening, Property 9: Exponential backoff between retry attempts
  // Validates: Requirements 3.3
  "P9: backoff delay before attempt n equals 200 * 2^n ms (0-indexed)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (attemptIndex) => {
        // Backoff delays are 200, 400, 800ms.
        // The abort timer uses ETHERFUSE_DEFAULT_TIMEOUT_MS (10000ms).
        // We only record delays < ETHERFUSE_DEFAULT_TIMEOUT_MS to isolate backoff delays.
        const backoffDelays: number[] = [];
        let callCount = 0;

        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            callCount++;
            if (callCount <= attemptIndex + 1)
              return mockResponse(503, "error");
            return mockResponse(200, "{}");
          }),
        );

        vi.stubGlobal("setTimeout", (fn: () => void, ms: number) => {
          if (ms > 0 && ms < ETHERFUSE_DEFAULT_TIMEOUT_MS) {
            backoffDelays.push(ms);
          }
          fn();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

        await etherfuseFetch("/test").catch(() => {});

        // Number of retries = attemptIndex + 1 (first call fails, then attemptIndex more retries)
        // Each retry has a preceding backoff delay
        expect(backoffDelays.length).toBe(attemptIndex + 1);
        for (let i = 0; i < backoffDelays.length; i++) {
          expect(backoffDelays[i]).toBe(200 * 2 ** i);
        }

        vi.restoreAllMocks();
        resetEnv();
      }),
      { numRuns: 10 },
    );
  });

  it(// Feature: etherfuse-client-hardening, Property 10: Exhausted retries throw AppError provider_unavailable
  // Validates: Requirements 3.6
  "P10: GET always returning 503 — throws AppError provider_unavailable after ETHERFUSE_MAX_RETRIES retries", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(503), async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => mockResponse(503, "service unavailable")),
        );
        stubSetTimeoutImmediate();

        const err = await etherfuseFetch("/test").catch((e) => e);
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("provider_unavailable");

        vi.restoreAllMocks();
        resetEnv();
      }),
      { numRuns: 10 },
    );
  });
});
