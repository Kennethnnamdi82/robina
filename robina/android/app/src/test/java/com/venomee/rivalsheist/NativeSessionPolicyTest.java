package com.venomee.rivalsheist;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeSessionPolicyTest {
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

    @Test public void parametersMustBe256BitBase64UrlValues() {
        assertTrue(NativeSessionPolicy.validParameter("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"));
        assertFalse(NativeSessionPolicy.validParameter(null));
        assertFalse(NativeSessionPolicy.validParameter("short"));
        assertFalse(NativeSessionPolicy.validParameter("abcdefghijklmnopqrstuvwxyz0123456789ABCDEF+"));
    }
}
