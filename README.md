# WhatsApp Status Quality Keeper

Pre-encode photos and videos into WhatsApp's safe envelope on-device so WhatsApp passes them through with minimal re-compression.

## How it works

WhatsApp aggressively re-compresses status media that is too large, high-bitrate, or high-fps. This app re-encodes media **before** you post:

- **Video (Status preset):** H.264, max 1080p, ~3.5 Mbps — matches proven WhatsApp-safe output
- **Video (HD preset):** ~5.0 Mbps
- **Photo:** longest edge 1600px, JPEG quality 0.85

Optional Supabase auth backs up optimized files and keeps a job history.

## Prerequisites

- Node.js 20+
- [Expo account](https://expo.dev) and [EAS CLI](https://docs.expo.dev/build/setup/)
- iPhone or Android device (native modules — **not Expo Go**)
- Supabase project (optional, for cloud backup/history)

## Setup

```bash
cd ~/Projects/whatsapp-status-keeper
npm install
cp .env.example .env
```

1. Create a [Supabase](https://supabase.com) project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
3. Copy your project URL and anon key into `.env`.
4. In Supabase Auth → URL configuration, add redirect URL: `whatsappstatuskeeper://auth/callback`

## Run on device (dev build required)

```bash
# Install EAS CLI if needed
npm install -g eas-cli
eas login

# Create EAS project (first time)
eas init

# Build development client for your iPhone
eas build --profile development --platform ios

# After installing the dev build on your phone:
npx expo start --dev-client
```

For Android:

```bash
eas build --profile development --platform android
npx expo start --dev-client
```

## Usage (Forward method)

1. **Select** a photo or video
2. **Review** the WhatsApp safety analysis
3. **Encode** into the safe envelope (~3.5 Mbps H.264)
4. **Send to WhatsApp Chat** — share to yourself or a contact (not Status yet)
5. In WhatsApp: **long-press → Forward → My Status**
6. Post

Direct Status upload re-compresses aggressively. The chat → Forward path preserves quality.

## Project structure

- `app/` — Expo Router screens
- `lib/encoder.ts` — WhatsApp-safe encoding presets
- `lib/media.ts` — pick / save / share helpers
- `lib/supabase.ts` — auth, storage, job history
- `supabase/schema.sql` — database schema

## Notes

- On-device encoding uses hardware H.264/HEVC via `expo-image-and-video-compressor`.
- The app works without Supabase; sign-in is only needed for cloud backup and history.
- WhatsApp may still apply minor processing; this minimizes quality loss by matching its target envelope.
