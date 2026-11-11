package com.venomee.rivalsheist;

import java.net.URI;

/** Pure-Java security boundaries, also exercised by cloud JVM tests */
final class NativeSessionPolicy {
    private NativeSessionPolicy() {}

    static boolean validParameter(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{43}");
    }

    static boolean allowedClientRequest(String path, String method) {
        if (("/api/auth/me".equals(path) && "GET".equals(method))
            || ("/api/auth/logout".equals(path) && "POST".equals(method))) return true;
        try {
            URI uri = new URI(path);
            if (uri.isAbsolute() || uri.getRawAuthority() != null || uri.getFragment() != null) return false;
            String route = uri.getRawPath(), query = uri.getRawQuery();
            if (query != null && (!"GET".equals(method) || !route.matches("/api/bounties/(tasks|submissions|ledger|withdrawals|notifications)")
                || !query.matches("(limit=([1-9]|[1-9][0-9]|100)|before=[a-fA-F0-9]{24})(&(limit=([1-9]|[1-9][0-9]|100)|before=[a-fA-F0-9]{24}))*"))) return false;
            if ("GET".equals(method)) return route.matches("/api/bounties/(tasks|submissions|wallet|ledger|withdrawals|notifications)") || route.matches("/api/bounties/tasks/[a-fA-F0-9]{24}");
            if ("PUT".equals(method)) return "/api/bounties/wallet/address".equals(route);
            return "POST".equals(method) && (route.matches("/api/bounties/tasks/[a-fA-F0-9]{24}/submissions")
                || route.matches("/api/bounties/(withdrawals|notifications/read)"));
        } catch (Exception ignored) { return false; }
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
