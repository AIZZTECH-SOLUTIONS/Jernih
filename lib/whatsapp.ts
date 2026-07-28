/** WhatsApp Status envelope — derived from proven bypass metadata. */
export const WHATSAPP_LIMITS = {
  maxVideoDurationSec: 60,
  recommendedVideoDurationSec: 30,
  maxVideoBitrate: 3_800_000,
  targetVideoBitrate: 3_500_000,
  hdVideoBitrate: 5_000_000,
  maxVideoDimension: 1080,
  maxImageEdge: 1600,
  maxImageQuality: 0.85,
  maxVideoSizeBytes: 16 * 1024 * 1024,
  targetVideoSizeBytes: 3 * 1024 * 1024,
} as const;

export const FORWARD_STEPS = [
  {
    step: 1,
    title: 'Send to a chat',
    detail: 'Share the optimized file to yourself or a trusted contact. Use "Message Yourself" if available.',
  },
  {
    step: 2,
    title: 'Open the chat',
    detail: 'Go to the WhatsApp chat where you just sent the video or photo.',
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
