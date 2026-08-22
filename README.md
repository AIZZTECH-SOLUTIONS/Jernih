# WhatsApp Status Quality Keeper

Prepare photos and videos on-device, then optionally have the Jernih WhatsApp Business account deliver the result to the user's chat for forwarding to Status.

## How it works

The app preserves media that is already suitable and only re-encodes oversized or unusually high-bitrate media:

- **Video:** H.264 MP4, up to 1080×1920, with a duration-aware bitrate that stays within the WhatsApp media-message limit
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
4. In Supabase Auth → URL configuration, add redirect URL: `jernih://auth/callback`

## Automatic WhatsApp delivery

Automatic delivery uses a protected Supabase Edge Function. The Meta access token is never included in the mobile app.

The function downloads the processed file from storage, uploads it to the WhatsApp Media API, and sends it by media ID as a **free-form message** — no approved template needed, as long as the user has messaged the Jernih business number within the last 24 hours (the customer service window). Outside that window it falls back to an approved template if one is configured; otherwise it asks the user to message the business number first and retry.

1. Create a WhatsApp Business Platform app and register the Jernih business number. Approved utility templates with dynamic **video**/**image** headers are optional (used only outside the 24h window).
2. Apply `supabase/schema.sql` to add the WhatsApp profile and delivery tables.
3. Configure the server secrets:

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_GRAPH_API_VERSION=... \
  WHATSAPP_BUSINESS_DISPLAY_NUMBER=... \
  WHATSAPP_VIDEO_TEMPLATE_NAME=... \
  WHATSAPP_IMAGE_TEMPLATE_NAME=... \
  WHATSAPP_TEMPLATE_LANGUAGE=en_US
```

4. Deploy the authenticated function:

```bash
supabase functions deploy send-whatsapp-media
```

In the app, sign in, save the destination number under **Settings → WhatsApp delivery**, enable **Send automatically**, and send one message to the Jernih number on WhatsApp to open the delivery window.

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
3. **Prepare** the file (preserving it when it is already suitable)
4. Jernih automatically sends the result to the user's WhatsApp chat
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
