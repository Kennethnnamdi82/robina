import { describe, expect, it, vi } from "vitest";
import { getAccessTokenAfterLogin } from "@/lib/privyAuth";

describe("getAccessTokenAfterLogin", () => {
  it("retries when Privy has not published the token immediately after login", async () => {
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("verified-access-token");
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(getAccessTokenAfterLogin(getAccessToken, wait)).resolves.toBe("verified-access-token");
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("returns null after bounded retries for a cancelled or incomplete login", async () => {
    const getAccessToken = vi.fn().mockResolvedValue(null);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(getAccessTokenAfterLogin(getAccessToken, wait, 3)).resolves.toBeNull();
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
