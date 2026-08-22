/**
 * Conservative export targets for a high-quality WhatsApp hand-off.
 *
 * `expo-image-and-video-compressor` treats `maxSize` as the longest edge, so
 * Full HD portrait video needs a value of 1920 (not 1080).
 */
export const WHATSAPP_LIMITS = {
  maxVideoDurationSec: 60,
  recommendedVideoDurationSec: 30,
  maxVideoBitrate: 12_000_000,
  targetVideoBitrate: 8_000_000,
  hdVideoBitrate: 12_000_000,
  maxVideoDimension: 1920,
  maxVideoSizeBytes: 16 * 1024 * 1024,
  targetVideoSizeBytes: 15 * 1024 * 1024,
  audioBitrate: 128_000,
  maxImageEdge: 1600,
  maxImageQuality: 0.85,
} as const;

export const FORWARD_STEPS = [
  {
    step: 1,
    title: 'Open WhatsApp',
    detail: 'Open WhatsApp and find the message sent by the Jernih business account.',
  },
  {
    step: 2,
    title: 'Select the media',
    detail: 'Long-press the video or photo that Jernih sent to you.',
  },
  {
    step: 3,
    title: 'Forward to Status',
    detail: 'Long-press the media → tap Forward → choose My Status.',
  },
  {
    step: 4,
    title: 'Post',
    detail: 'Add a caption if you want, then tap Send. Your status stays sharp this way.',
  },
] as const;
