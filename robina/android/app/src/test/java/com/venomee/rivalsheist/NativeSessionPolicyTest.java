package com.venomee.rivalsheist;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeSessionPolicyTest {
    @Test public void onlyDefinitiveAuthenticationFailuresClearTheEncryptedSession() {
        for(String error:new String[]{"unauthenticated","invalid_token","token_revoked","session_expired"}) {
            assertTrue(NativeSessionPolicy.definitiveSessionFailure(401,error));
            assertFalse(NativeSessionPolicy.definitiveSessionFailure(503,error));
        }
        assertFalse(NativeSessionPolicy.definitiveSessionFailure(401,"upstream_unavailable"));
        assertFalse(NativeSessionPolicy.definitiveSessionFailure(503,"session_verification_unavailable"));
        assertFalse(NativeSessionPolicy.definitiveSessionFailure(200,""));
    }
    @org.junit.Test public void seasonClaimsArePlayerOnly() {
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/payments/season/claim", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/payments/season/claim", "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/admin/payments/seasons", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/payments/season/claim?player=other", "POST"));
    }
    @Test public void onlyPublicAuthOperationsAreExposed() {
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/auth/me", "GET"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/auth/logout", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/auth/native/exchange", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/admin/me", "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/auth/logout", "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/auth/me?redirect=evil", "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("https://evil.invalid/api/auth/me", "GET"));
    }

    @Test public void returnMustUseTheExactVerifiedHttpsAppLink() {
        assertTrue(NativeSessionPolicy.allowedReturnUrl("https://rivals-heist.vercel.app/android/auth/callback?code=example&state=example"));
        for (String value : new String[]{"http://rivals-heist.vercel.app/android/auth/callback", "https://evil.invalid/android/auth/callback", "https://rivals-heist.vercel.app.evil.invalid/android/auth/callback", "https://rivals-heist.vercel.app:444/android/auth/callback", "https://user@rivals-heist.vercel.app/android/auth/callback", "https://rivals-heist.vercel.app/android/auth/callback#evil", "https://rivals-heist.vercel.app/%61ndroid/auth/callback", "https://rivals-heist.vercel.app/other", "not a URL"}) {
            assertFalse(value, NativeSessionPolicy.allowedReturnUrl(value));
        }
    }
    @Test public void playerBountiesAreAllowedButTreasuryAndAdminOperationsRemainBlocked() {
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/bounties/tasks?limit=20&before=0123456789abcdef01234567", "GET"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/bounties/tasks/0123456789abcdef01234567/submissions", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/bounties/withdrawals", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/bounties/wallet/address", "PUT"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/bounties/notifications/read", "POST"));
        for (String path : new String[]{"/api/admin/bounties/summary", "/api/admin/bounties/withdrawals/0123456789abcdef01234567/execute", "/api/bounties/../admin/bounties/summary", "/api/bounties/%2e%2e/admin/me", "/api/bounties/tasks?redirect=https://evil.invalid", "//evil.invalid/api/bounties/wallet", "/api/bounties/wallet#fragment"}) assertFalse(path, NativeSessionPolicy.allowedClientRequest(path, "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/bounties/wallet", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/bounties/withdrawals?limit=20", "POST"));
    }

    @Test public void parametersMustBe256BitBase64UrlValues() {
        assertTrue(NativeSessionPolicy.validParameter("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"));
        assertFalse(NativeSessionPolicy.validParameter(null));
        assertFalse(NativeSessionPolicy.validParameter("short"));
        assertFalse(NativeSessionPolicy.validParameter("abcdefghijklmnopqrstuvwxyz0123456789ABCDEF+"));
    }
    @Test public void paymentsPermitOnlyPlayerStoreAndOrderRequests() {
        String id="0123456789abcdef01234567";
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/payments/store","GET"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/payments/checkout","POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/payments/equipment","PUT"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/payments/orders/"+id+"/check","POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/payments/bachs/webhook","POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/admin/payments/orders","GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/payments/verify","POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/payments/checkout?price=1","POST"));
    }
    @Test public void missionsPermitOnlyPlayerLifecycleRequests() {
        String id="0123456789abcdef01234567";
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/eligibility", "GET"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id+"/heartbeat", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id+"/report", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id+"/connect", "POST"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id, "GET"));
        assertTrue(NativeSessionPolicy.allowedClientRequest("/api/missions/results", "GET"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id+"/damage", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions/"+id+"/complete", "POST"));
        assertFalse(NativeSessionPolicy.allowedClientRequest("/api/missions/sessions?admin=true", "GET"));
    }
}
