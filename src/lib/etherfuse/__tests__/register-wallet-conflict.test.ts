// Regression: "You have already added user with this address, see org: <uuid>"
// debe tratarse como conflicto idempotente recuperable (same-org), no bloquear KYC/onramp.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isRecoverableRegisterWalletConflict,
  registerOrganizationWallet,
} from "../wallets";
import { AppError } from "@/lib/seyf/api-error";

const ALREADY_ADDED_MSG =
  "You have already added user with this address, see org: ec7bc08a-9ccc-48eb-b45f-db57eee24502";

function mockResponse(status: number, body = ""): Response {
  return new Response(body, { status });
}

function resetEnv() {
  process.env.ETHERFUSE_API_KEY = "test-api-key";
  process.env.ETHERFUSE_API_BASE_URL = "https://api.test.etherfuse.com";
}

beforeEach(() => {
  resetEnv();
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.ETHERFUSE_API_KEY;
  delete process.env.ETHERFUSE_API_BASE_URL;
  vi.restoreAllMocks();
});

describe("registerOrganizationWallet re-wraps etherfuseFetch errors", () => {
  it("wraps the provider message with a 'register wallet' prefix so callers can classify it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(409, ALREADY_ADDED_MSG)),
    );

    const err = await registerOrganizationWallet({ publicKey: "GABC" }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message.toLowerCase()).toContain("register wallet");
    expect((err as Error).message).toContain(ALREADY_ADDED_MSG);
  });

  it("the wrapped error is classified as a recoverable same-org conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(409, ALREADY_ADDED_MSG)),
    );

    const err = await registerOrganizationWallet({ publicKey: "GABC" }).catch(
      (e) => e,
    );
    expect(isRecoverableRegisterWalletConflict(err)).toBe(true);
  });
});

describe("isRecoverableRegisterWalletConflict", () => {
  it("treats 'already added user with this address' as recoverable", () => {
    const err = new Error(
      `Etherfuse register wallet failed: ${ALREADY_ADDED_MSG}`,
    );
    expect(isRecoverableRegisterWalletConflict(err)).toBe(true);
  });

  it("still treats cross-org claims as NON-recoverable", () => {
    const err = new Error(
      "Etherfuse register wallet failed: wallet is claimed by another organization",
    );
    expect(isRecoverableRegisterWalletConflict(err)).toBe(false);
  });

  it("ignores unrelated errors that don't come from register wallet", () => {
    const err = new AppError("provider_unavailable", {
      message: "some other failure already exists",
    });
    expect(isRecoverableRegisterWalletConflict(err)).toBe(false);
  });
});
