# RIVALS Android

## App and build

The app ID is `com.venomee.rivalsheist` and must not change after publication
Capacitor packages the existing Vite `dist` directory, including the game models,
audio and textures, into the APK — there is no remote `server.url`
Android packaging excludes the web-only `.gz` siblings to avoid asset-merger
duplicates; original models remain packaged and the web build stays unchanged
Android 7.0/API 24 is the minimum; compilation/target API is 36 with Java 21

The existing renderer, adaptive quality settings, missions, purchases, controls
and four cameras are shared with the browser game, not forked into another game
Gameplay locks landscape and uses immersive system bars; menus can use portrait
Back pauses a running mission, returns menu pages to the lobby, or minimizes
the app from the lobby; it does not accidentally exit a running mission
Backgrounding or loss of audio focus pauses the mission and clears active input
Resuming never automatically restarts combat or audio

No Android SDK or Android Studio is needed on the owner's computer
`npm run android:sync` builds the website and synchronizes packaged assets without
compiling Android; all Gradle compilation runs on GitHub-hosted runners

`.github/workflows/android.yml` runs frontend type checking and unit tests,
backend authentication tests, the production web build, Capacitor sync, packaged
asset verification, Gradle compilation, Android lint and available JVM tests
The feature branch produces a **DEBUG testing artifact only**, never a public release
Main requires persistent release signing and produces a verified, non-debug APK
A failed build/signature check prevents publication

## Signing and publication — owner approval required

The one-time `scripts/android/setup-github.mjs` operation creates a **public,
binary-only** `Kennethnnamdi82/rivals-heist-android` repository, a persistent app
signing identity and an SSH deploy key restricted to that distribution repository
It must only be run with explicit approval for those external/security changes
It never changes the existing visibility of the `robina` source repository
GitHub currently reports that source repository as public; making it private is
a separate owner decision and is not performed by this setup

The recovery file is created under the ignored, owner-only
`../.android-tools/signing/recovery.json` directory
It contains sensitive signing/recovery material and must be backed up securely
outside the repository; losing it risks losing the ability to issue app updates
Do not upload it, include it in screenshots, or rotate an existing release key

The setup uses the existing local GitHub credential in memory only
It does **not** put a personal access token into Actions
Actions signing secrets are `ANDROID_KEYSTORE_BASE64`,
`ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
`ANDROID_DISTRIBUTION_SSH_KEY` can write only to the public APK repository
The public certificate SHA-256, distribution repository and existing public
`VITE_API_URL`, `VITE_PRIVY_APP_ID`, `VITE_REOWN_PROJECT_ID` are Actions variables
Neither server secrets nor signing credentials may have a `VITE_` prefix

After signing setup, populate `public/.well-known/assetlinks.json` with the
**public** certificate fingerprint and app ID
Until this association matches the signed APK, the release verifier refuses to
publish — an unsigned/debug build is never advertised as the production app
Keep that static file accessible at the official website without SPA rewriting

Version codes increase above both the Actions run number and latest public release
The app ID, signing certificate and version code are verified against the actual
APK, not just Gradle configuration
The public workflow independently verifies signature, package ID, non-debug
status, version code and SHA-256 before publishing `RIVALS-RIVAL-HEIST.apk`
Transient orphan delivery branches contain binary chunks and the distribution
workflow only, never private game source; successful branches are deleted

Stable download URL:

`https://github.com/Kennethnnamdi82/rivals-heist-android/releases/latest/download/RIVALS-RIVAL-HEIST.apk`

The website login panel enables this URL only after its release manifest and
the actual published APK are available and consistent
It otherwise displays a disabled availability state, not a dead download link
The optional in-app update notice opens this official download in the system
browser; installation always requires the user's Android permission
Install official updates over the existing app to preserve local data
Do not uninstall first or try to update a debug build with a differently signed APK

## Authentication and existing data

Google/wallet sign-in opens the existing production login in an Android system
browser/Custom Tab, **not** Google OAuth inside the WebView
After explicit consent, the existing backend exchanges a short-lived, one-use
PKCE-bound grant for its existing session cookie
The HTTPS return is an Android App Link restricted to the production domain,
app package, path and signing certificate
The native bridge validates the random state and PKCE verifier; neither a login
token nor a session cookie is placed in redirect URLs or JavaScript storage

Android stores the existing session encrypted using Android Keystore and
AES-GCM in app-private preferences with Android backups disabled
Its native HTTP transport allows only the existing session/logout endpoints
and the internal grant exchange over the official HTTPS origin with no redirects
Server-side expiry, renewal, logout, suspension and session-version checks remain
in force; browser cookie authentication is unchanged
Native grant persistence uses the existing MongoDB connection and a TTL index
Render must deploy the native auth routes before real native sign-in can succeed

The existing game currently keeps portions of progression/inventory in local
browser storage; packaging does not turn those into cloud-synchronized data
The same authenticated account is reused, but a first native installation has
separate local WebView data from Chrome
Existing store/payment behavior is preserved; this work does not introduce a
payment provider, invent payment credentials or claim previously unsupported
real-money purchases are functional

## Verification boundaries

Unit tests cover existing browser regressions, native transport restrictions,
timeouts/retries, handoff consent, grant validation/replay and download states
Cloud compilation/signature/lint results must be checked for each release
Tests with mocked auth are not a substitute for an actual Google/wallet sign-in
on an installed, correctly signed APK

Physical Android testing remains necessary for WebView GPU/device performance,
all four camera/touch modes, backgrounding, calls/audio focus, Android back,
Google/wallet return, returning-user sessions and update-over-existing-install
Never report those physical-device behaviors as verified by a web/unit test
