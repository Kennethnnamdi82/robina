# Persistent sessions and direct Android delivery

Player authentication already uses a persistent `HttpOnly` cookie, not a
JavaScript/localStorage access token. The existing policy remains 14 days idle,
rolling renewal after a day of verified use, with a 30-day absolute maximum.
Android persists the credential using its existing AES-GCM / Keystore storage.
Temporary Keystore/provider failures now preserve the encrypted value too;
only unrecoverable corruption/key invalidation clears an unreadable value.
Keep Render's `JWT_SECRET` stable across deployments; rotating it invalidates
existing credentials. No new environment variables are required by this change.

## Recovery, not a false logout

Previously the user middleware caught database failures in the same branch as
JWT verification errors and returned `401 invalid_token`. The native bridge
then deleted the saved credential. Repeated quick cold-start failures also
exhausted the frontend's small retry count and displayed the login screen.

JWT failures, expiry, revocation and account/session-version checks still fail
closed. Database/profile read failures now return a sanitized 503 with
`Retry-After`; they do not clear credentials or authorize requests. Web and
native restoration retry within a bounded deadline, then show a reconnecting
state and retry again rather than pretending the session was invalid. An
unverified offline profile is never treated as logged in. Logout/unmount cancel
pending restoration; late responses cannot restore a signed-out account.

Web foreground checks and a six-hour visible-page check renew/revalidate the
existing cookie without initiating Google or wallet login. Android still
rechecks on resume. Admin session policy is not extended.

## Direct APK route

Public link: `https://rivals-heist.vercel.app/download/RIVALS-RIVAL-HEIST.apk`.

Vercel externally rewrites this path to the existing Render backend's
`/api/downloads/android` route. The browser receives an APK attachment from the
RIVALS URL, not a redirect or GitHub HTML page. The Express endpoint streams
without buffering the entire file or using a size-limited serverless response.
It works independently of MongoDB and player authentication.

The endpoint uses only the fixed official publisher/release asset, validates
the published app/signing certificate and file size, caches/coalesces metadata
lookups, limits active streams, and sends no account cookies to GitHub. Byte
ranges and strong `If-Range`/ETag checks support interrupted downloads without
joining bytes from different releases. Errors return no fake APK attachment.

The metadata API keeps its legacy `url` solely so older installed clients can
still detect upgrades. Current web/native clients use the allowlisted
`downloadUrl` and never send users to the legacy GitHub URL. Updates retain the
same application ID and signing certificate.

Chrome/Android own the download list and installer. After download, open
Chrome Downloads, tap `RIVALS-RIVAL-HEIST.apk`, and confirm installation. Android
may require permission for Chrome to install apps. A website cannot bypass
that confirmation or install silently.
