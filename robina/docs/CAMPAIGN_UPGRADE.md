# Rival Heist campaign upgrade

The seven saved contract IDs retain their existing dossier indices. Completing
a contract records the actual result and offers the next named contract; the
lobby also selects the next unfinished assignment. Retrying preserves the seed.

| Contract | Environment | Main challenge |
| --- | --- | --- |
| The Last Deposit | Financial mile, operating bank, cashiers and customers | Manager key, 12-second vault drill, vault retrieval, break contact and cross Meridian Bridge |
| Cold Reaction | Low research campus, glass laboratory, containment chamber | Access control, 16-second containment process, two chemical components |
| Ghost in the Glass | Tall corporate skyline at night, server floor | Two access nodes and a 20-second data transfer |
| Running Red | Port interchange, container gantry, distant dock cranes | Intercept a moving transport and deliver it intact |
| No One Left Behind | Low garden district and timber-veranda house | Release a witness, escort them on foot or in a vehicle |
| Midnight Manifest | Industrial night terminal and bonded containers | Identify cargo, 24-second clamp release, transport the shipment |
| Black Standard | Restricted perimeter, watchtowers, bunker courtyard | Relays, 28-second uplink operation and equipment recovery under reinforced response |

## World and interaction

Districts vary building footprints, density, heights, foliage, palette, lighting,
insertion points, mission lots and landmarks. They retain a connected street
network so traffic, police navigation, collision and the existing four camera
modes agree. The waterfront has a visible suspension crossing and real road
connections. Mission art and collision share `SiteLayout` footprints.

The bank has a public lobby, counter workstations, customer queues, side exits,
automatic glass entrance leaves and a separate vault. Seven instanced animated
civilians include two cashiers. Site personnel flee through navigable passages
after an alert. The closed vault blocks movement and sight until the actual
drill objective completes. Moving away pauses timed operations.

Access panels provide an alternative to eliminating every guard. Each stage
increases site security; later stages permit more simultaneous attackers.
Precise head-height shots against security units receive a damage multiplier.
Site first-aid supplies support the longer encounters.

Police use real traffic vehicles, deploy officers, fire from vehicles and search
the last observed position. Valuable-cargo pursuit can be escaped after twelve
seconds out of contact. Extraction stays unavailable during an active pursuit.
Distance-attenuated stereo sirens use two bounded oscillators and obey existing
pause, mute and volume controls. The HUD shows response level, search progress
and timed operation progress.

## Release checks

- Unit scenarios cover every contract's task/recovery/escort/transport sequence,
  locked vault, paused drill, access bypass, evasion and actual extraction.
- Physics checks exercise bank entrances, side passage and the vault barrier.
- Precision-hit checks use the real swept projectile pipeline.
- Browser fixtures render all seven interiors and animate real civilian models,
  bank doors and the vault; a separate audio check verifies siren output/mute.
- The production game startup check runs against the built application with
  account APIs isolated. Android uses the same compiled game in Capacitor.

The signed Android release is produced by the existing GitHub workflow; local
browser and packaging checks do not establish physical-phone GPU performance
or installed-app authentication behavior.
