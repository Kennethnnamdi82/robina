package com.venomee.rivalsheist;

import java.net.URI;

/** Pure-Java security boundaries, also exercised by cloud JVM tests */
final class NativeSessionPolicy {
    private NativeSessionPolicy() {}

    static boolean validParameter(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{43}");
    }

    static boolean allowedClientRequest(String path, String method) {
        return ("/api/auth/me".equals(path) && "GET".equals(method))
            || ("/api/auth/logout".equals(path) && "POST".equals(method));
    }

    static boolean allowedReturnUrl(String value) {
        try {
            URI uri = new URI(value);
            return "https".equals(uri.getScheme())
                && "rivals-heist.vercel.app".equals(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null
                && uri.getFragment() == null
                && "/android/auth/callback".equals(uri.getRawPath());
        } catch (Exception ignored) { return false; }
    }
}
