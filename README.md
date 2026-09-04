# Peak

Point your phone at a mountain. Find out what it is.

Peak is a free, open source peak identification app. It combines GPS, compass, and camera to tell you which mountain peaks are in front of you — no account, no subscription, no bullshit.

---

## How It Works

1. GPS fixes your position on the map
2. Compass + gyroscope determine which direction and angle you're pointing
3. Peak data is fetched from OpenStreetMap and cached locally in SQLite
4. Candidates are ranked by angular alignment and distance
5. The camera view overlays the best match with name, elevation, and distance

A future layer of DEM-based silhouette matching will further confirm identifications using the mountain's actual visual profile.

---

## Monorepo Structure

```
peak/
├── apps/
│   └── mobile/          # Expo (React Native + Expo Router)
├── packages/
│   └── types/           # Shared TypeScript interfaces (Peak, Coordinates, etc.)
├── docs/
│   └── phase-2.md       # Architecture guide and roadmap
├── turbo.json
└── package.json
```

## Getting Started

**Requirements:** Node ≥24, pnpm ≥10

```bash
# Install all workspace dependencies
pnpm install

# Start the Expo dev server
pnpm mobile

# Run on iOS simulator
pnpm mobile:ios
```

> The app requires a physical device for real compass and GPS readings.
> Simulators can test the UI but sensors will not work.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile app | Expo (React Native) + TypeScript |
| Routing | Expo Router (file-based) |
| Camera | expo-camera |
| GPS | expo-location |
| Compass + motion | expo-sensors (DeviceMotion) |
| Peak data | OpenStreetMap (Overpass API) |
| Local cache | expo-sqlite |
| Monorepo | Turborepo + pnpm workspaces |

---

## Peak Data

Peak data is sourced from OpenStreetMap via the Overpass API. On first launch the app fetches all named peaks within 200 km of the user's location and stores them in a local SQLite database. Subsequent launches in the same region read directly from SQLite with no network call. The cache refreshes automatically when the user moves more than 50 km from their last fetch origin — the app works fully offline after the first regional fetch.

---

## Contributing

This is open source and very early stage. Issues and PRs welcome.

---

## License

MIT
