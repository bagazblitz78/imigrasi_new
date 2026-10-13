import { describe, expect, it } from "vitest";

import { initials, maskName, maskPassport } from "./format";

describe("masking helpers", () => {
  it("masks passport numbers", () => {
    expect(maskPassport("A12345678")).toBe("A123***78");
    expect(maskPassport("AB1")).toBe("A**");
  });

  it("masks names keeping first name", () => {
    expect(maskName("Budi Santoso")).toBe("Budi S.");
    expect(maskName("Budi")).toBe("B***");
  });

  it("derives initials", () => {
    expect(initials("Budi Santoso")).toBe("BS");
  });
});
