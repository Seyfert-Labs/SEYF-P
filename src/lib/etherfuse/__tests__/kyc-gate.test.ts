import { describe, expect, it } from "vitest";
import { isEtherfuseKycApprovedStatus } from "@/lib/seyf/etherfuse-kyc-guard";

describe("isEtherfuseKycApprovedStatus", () => {
  it("accepts approved statuses for ramp operations", () => {
    expect(isEtherfuseKycApprovedStatus("approved")).toBe(true);
    expect(isEtherfuseKycApprovedStatus("approved_chain_deploying")).toBe(true);
  });

  it("rejects non-approved statuses for ramp operations", () => {
    expect(isEtherfuseKycApprovedStatus("not_started")).toBe(false);
    expect(isEtherfuseKycApprovedStatus("proposed")).toBe(false);
    expect(isEtherfuseKycApprovedStatus("rejected")).toBe(false);
  });
});
