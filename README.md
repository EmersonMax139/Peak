# Peak

Point your phone at a mountain. Find out what it is.

Peak is a free, open source peak identification app. It combines GPS, compass, and camera to tell you which mountain peaks are in front of you — no account, no subscription, no bullshit.

---

## How It Works

1. GPS fixes your position on the map
2. Compass + gyroscope determine which direction and angle you're pointing
3. A peak database is queried for summits along that bearing within your radius
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
├── turbo.json
└── package.json
```

## Getting Started

**Requirements:** Node 20+, npm 10+

```bash
# Install all workspace dependencies
npm install

# Start the Expo dev server
npm run mobile

# Run on iOS simulator
npm run mobile:ios
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
| Local data | expo-sqlite |
| Monorepo | Turborepo + npm workspaces |

---

## Peak Data

The initial seed dataset covers major PNW volcanoes and peaks. The full pipeline will load peak data from OpenStreetMap and USGS sources into a local SQLite database, organized by geographic tile for fast regional lookup.

---

## Contributing

This is open source and very early stage. Issues and PRs welcome.

---

## License

MIT
