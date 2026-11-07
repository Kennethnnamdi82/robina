# Open-world movement and persistent sessions

## Gameplay

- Physics uses a stable 60 Hz interpolation interval rather than changing that interval below 12 FPS
- Catch-up is bounded to 12 swept ticks / 200 ms; long background stalls do not teleport the player
- Walk/jog/sprint transitions preserve stride phase
- Mounted drivers do not step the on-foot controller or walking/shooting animation
- The player car's steering and wheel travel use the same interpolation phase as its position
- Vehicle collision, fire, damage, braking and reverse behavior remain active

## Connected waterfront

- Removed the concrete avenue closures at the old district edge
- Expanded playable width from 96 to 144 metres while retaining the original 96-metre depth
- Added four open canal bridges with asphalt lanes, pedestrian edges and parallel safety rails
- Added Hotel Meridian and Amber Room bar facades and a waterfront promenade
- Buildings have navigation/physical collision; decorative east skyline is moved beyond the playable area
- The map is a connected finite district, not an infinite streaming world or enterable hotel/bar interiors

## Continuous contracts

All seven contract types are accessible without level prerequisites
Completing a contract offers the next contract with a fresh seed, including after the last contract
The sequence counter continues across loops rather than resetting at the final contract
Contract templates repeat; this does not claim unlimited uniquely authored missions

## Authentication

The existing Render authentication backend remains the authority
The Vercel `/api` handler is a first-party transport, not a second account database
It only accepts the existing allowlisted auth/owner-auth routes and forwards only their cookies
It validates browser write origins, refuses upstream redirects, bounds requests and prevents session caching
Cookies are host-only, HttpOnly, Secure and SameSite=Lax at the public game origin
No session token is added to localStorage

User sessions have a 14-day inactivity lifetime, with daily verified renewal and a 30-day absolute cap
Renewal retains the same revocation identifier; logout revokes the complete session family
User session-version and suspension checks still run before renewal
Owner/admin sessions retain their separate short-lived policy
Existing cross-site Render cookies cannot be copied by JavaScript; existing users may need to sign in once to establish the first-party cookie
Private browsing, cleared cookies and explicit logout still require authentication

## Audio and verification

Human pain and alternate death vocals are CC0 recordings by HaelDB
Source, licence and derivation details are in `public/assets/rivals/combat3d/audio/LICENSE-vocals.txt`
Three short mono WAVs add about 119 KB and load through the existing bounded combat-audio bus
No Call of Duty recordings are used

Regression coverage includes uneven-frame walk/sprint presentation, mounted animation isolation,
car steering/wheel interpolation, on-foot/car traversal across every new bridge, repeat contracts,
first-party cookie transport, expiry/renewal/revocation, actual browser rendering and vocal decoding
Physical-phone frame-rate certification and a real multi-day wait are not claimed
