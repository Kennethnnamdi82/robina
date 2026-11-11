package com.venomee.rivalsheist;

/** Standalone JVM probe when a local Android SDK/JUnit cache is unavailable. */
public final class NativeBountyPolicyProbe {
    private static void check(boolean condition) { if (!condition) throw new AssertionError("Native bounty policy failed"); }
    public static void main(String[] args) {
        check(NativeSessionPolicy.allowedClientRequest("/api/auth/me", "GET"));
        check(NativeSessionPolicy.allowedClientRequest("/api/auth/logout", "POST"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/tasks?limit=20&before=0123456789abcdef01234567", "GET"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/submissions?limit=20", "GET"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/tasks/0123456789abcdef01234567/submissions", "POST"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/withdrawals", "POST"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/wallet/address", "PUT"));
        check(NativeSessionPolicy.allowedClientRequest("/api/bounties/notifications/read", "POST"));
        for (String path : new String[]{"/api/admin/bounties/summary", "/api/bounties/../admin/me", "/api/bounties/%2e%2e/admin/me", "/api/bounties/tasks?redirect=evil", "https://evil.invalid/api/bounties/wallet", "//evil.invalid/api/bounties/wallet", "/api/bounties/wallet#fragment", "/api/bounties/tasks?limit=101", "/api/bounties/tasks?before=bad", "/api/auth/me?redirect=evil"}) check(!NativeSessionPolicy.allowedClientRequest(path, "GET"));
        check(!NativeSessionPolicy.allowedClientRequest("/api/bounties/withdrawals?limit=20", "POST"));
        check(!NativeSessionPolicy.allowedClientRequest("/api/admin/bounties/withdrawals/0123456789abcdef01234567/execute", "POST"));
        check(!NativeSessionPolicy.allowedClientRequest("/api/bounties/wallet", "POST"));
        System.out.println("Native player bounty allowlist and admin/treasury rejection checks passed.");
    }
}
