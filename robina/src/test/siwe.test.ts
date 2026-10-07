import { beforeEach, describe, expect, it, vi } from "vitest";

const { signMessage } = vi.hoisted(() => ({
  signMessage: vi.fn().mockResolvedValue("0xsignature"),
}));

vi.mock("wagmi/actions", () => ({ signMessage }));
vi.mock("@/lib/wagmi", () => ({ wagmiConfig: {} }));

import { buildAndSignSiwe } from "@/lib/siwe";

describe("buildAndSignSiwe", () => {
  beforeEach(() => {
    signMessage.mockClear();
    signMessage.mockResolvedValue("0xsignature");
  });

  it("uses the server-issued authentication domain and URI", async () => {
    await buildAndSignSiwe(
      "0x0000000000000000000000000000000000000001",
      "0123456789abcdef",
      8453,
      "auth.example.com",
      "https://auth.example.com",
    );

    expect(signMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        message: expect.stringContaining("auth.example.com wants you to sign in"),
        account: "0x0000000000000000000000000000000000000001",
      }),
    );
    expect(signMessage.mock.calls[0][1].message).toContain("URI: https://auth.example.com");
  });
});
