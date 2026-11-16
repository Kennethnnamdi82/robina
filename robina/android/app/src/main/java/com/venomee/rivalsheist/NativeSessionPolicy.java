package com.venomee.rivalsheist;

import java.net.URI;

/** Pure-Java security boundaries, also exercised by cloud JVM tests */
final class NativeSessionPolicy {
    private NativeSessionPolicy() {}

    static boolean definitiveSessionFailure(int status, String error) {
        return status == 401 && ("unauthenticated".equals(error) || "invalid_token".equals(error)
            || "token_revoked".equals(error) || "session_expired".equals(error));
    }

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
            if(query == null && route != null && route.startsWith("/api/payments/")) {
                if("GET".equals(method)) return route.equals("/api/payments/store") || route.matches("/api/payments/orders/[a-fA-F0-9]{24}");
                if("PUT".equals(method)) return route.equals("/api/payments/equipment");
                return "POST".equals(method) && (route.equals("/api/payments/checkout") || route.equals("/api/payments/season/claim") || route.matches("/api/payments/orders/[a-fA-F0-9]{24}/check"));
            }
            if (query == null && route != null && route.startsWith("/api/missions/")) {
                if ("GET".equals(method)) return route.matches("/api/missions/(eligibility|leaderboard|results|sessions|sessions/current)") || route.matches("/api/missions/sessions/[a-fA-F0-9]{24}");
                return "POST".equals(method) && (route.equals("/api/missions/sessions")
                    || route.matches("/api/missions/sessions/[a-fA-F0-9]{24}/(heartbeat|abandon|report|connect)"));
            }
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
