import { describe, expect, it } from "vitest";

import { destinationFor } from "../../lib/auth-dispatch";

describe("destinationFor", () => {
  it("sends a missing profile to onboarding", () => {
    expect(destinationFor(null)).toBe("/onboarding");
  });

  it("sends a profile with no account_type to onboarding", () => {
    expect(
      destinationFor({ account_type: null, application_status: null })
    ).toBe("/onboarding");
    expect(
      destinationFor({ account_type: null, application_status: "approved" })
    ).toBe("/onboarding");
  });

  it("sends a consumer to the Fan app", () => {
    expect(
      destinationFor({ account_type: "consumer", application_status: null })
    ).toBe("/fan");
  });

  it("sends an approved professional to the dashboard", () => {
    expect(
      destinationFor({
        account_type: "professional",
        application_status: "approved",
      })
    ).toBe("/dashboard");
  });

  it("sends pending and rejected professionals to the pending page", () => {
    for (const status of ["pending", "rejected"]) {
      expect(
        destinationFor({
          account_type: "professional",
          application_status: status,
        })
      ).toBe("/apply/pending");
    }
  });

  it("parks unexpected values on the pending page", () => {
    expect(
      destinationFor({ account_type: "professional", application_status: null })
    ).toBe("/apply/pending");
    expect(
      destinationFor({
        account_type: "professional",
        application_status: "Approved",
      })
    ).toBe("/apply/pending");
    expect(
      destinationFor({ account_type: "admin", application_status: "approved" })
    ).toBe("/apply/pending");
  });
});
