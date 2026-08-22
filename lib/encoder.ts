import { compress, getMetadata, type CompressionCodec } from 'expo-image-and-video-compressor';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import type { Codec, VideoPreset } from './settings';
import { WHATSAPP_LIMITS } from './whatsapp';

export const VIDEO_PRESETS = {
  status: {
    bitrate: WHATSAPP_LIMITS.targetVideoBitrate,
    maxSize: WHATSAPP_LIMITS.maxVideoDimension,
    speed: 'balanced' as const,
  },
  hd: {
    bitrate: WHATSAPP_LIMITS.hdVideoBitrate,
    maxSize: WHATSAPP_LIMITS.maxVideoDimension,
    speed: 'balanced' as const,
  },
} as const;

export const IMAGE_PRESET = {
  maxEdge: WHATSAPP_LIMITS.maxImageEdge,
  quality: WHATSAPP_LIMITS.maxImageQuality,
} as const;

export type MediaInfo = {
  uri: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
  sizeBytes: number;
  bitrate?: number;
  extension?: string;
};

export type OptimizeResult = {
  uri: string;
  skipped: boolean;
  info: MediaInfo;
};

export async function getMediaInfo(uri: string, mediaType: 'image' | 'video'): Promise<MediaInfo> {
  if (mediaType === 'video') {
    const meta = await getMetadata(uri);
    const bitrate =
      typeof meta.bitrate === 'number' && meta.bitrate > 0
        ? Math.round(meta.bitrate)
        : meta.duration > 0
          ? Math.round((meta.size * 8) / meta.duration)
          : undefined;
    return {
      uri,
      mediaType,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      sizeBytes: meta.size,
      bitrate,
      extension: meta.extension?.toLowerCase(),
    };
  }

  const sizeBytes = await getFileSize(uri);
  const { width, height } = await getImageDimensions(uri);
  return { uri, mediaType, width, height, sizeBytes, extension: getFileExtension(uri) };
}

export async function optimizeVideo(
  uri: string,
  preset: VideoPreset,
  codec: Codec,
  onProgress?: (progress: number) => void,
): Promise<OptimizeResult> {
  const original = await getMediaInfo(uri, 'video');
  const options = VIDEO_PRESETS[preset];
  const targetBitrate = getVideoTargetBitrate(preset, original.duration);

  const alreadySafe =
    (original.bitrate ?? Infinity) <= targetBitrate * 1.1 &&
    Math.max(original.width ?? 0, original.height ?? 0) <= options.maxSize &&
    original.sizeBytes <= WHATSAPP_LIMITS.maxVideoSizeBytes &&
    original.extension === 'mp4';

  if (alreadySafe) {
    onProgress?.(1);
    return { uri, skipped: true, info: original };
  }

  let outputUri = await compress(
    uri,
    {
      // A resize should never increase the source bitrate.
      bitrate: Math.min(original.bitrate ?? targetBitrate, targetBitrate),
      maxSize: options.maxSize,
      codec: codec as CompressionCodec,
      speed: options.speed,
    },
    onProgress,
  );

  let info = await getMediaInfo(outputUri, 'video');

  // Hardware encoders can overshoot their requested average bitrate. Retry
  // once with additional headroom so Meta does not reject a >16 MB payload.
  if (info.sizeBytes > WHATSAPP_LIMITS.maxVideoSizeBytes) {
    const retryBitrate = Math.max(
      500_000,
      Math.floor(
        targetBitrate *
          (WHATSAPP_LIMITS.targetVideoSizeBytes / info.sizeBytes) *
          0.9,
      ),
    );
    outputUri = await compress(
      uri,
      {
        bitrate: retryBitrate,
        maxSize: options.maxSize,
        codec: codec as CompressionCodec,
        speed: options.speed,
      },
      onProgress,
    );
    info = await getMediaInfo(outputUri, 'video');
  }

  return { uri: outputUri, skipped: false, info };
}

export async function optimizeImage(
  uri: string,
  forceWhatsAppCompatible = false,
): Promise<OptimizeResult> {
  const original = await getMediaInfo(uri, 'image');
  const longest = Math.max(original.width ?? 0, original.height ?? 0);

  const alreadySafe =
    longest <= IMAGE_PRESET.maxEdge &&
    original.sizeBytes <= 1.5 * 1024 * 1024 &&
    (!forceWhatsAppCompatible ||
      original.extension === 'jpg' ||
      original.extension === 'jpeg' ||
      original.extension === 'png');

  if (alreadySafe) {
    return { uri, skipped: true, info: original };
  }

  const resize =
    longest > IMAGE_PRESET.maxEdge
      ? (original.width ?? 0) >= (original.height ?? 0)
        ? { width: IMAGE_PRESET.maxEdge }
        : { height: IMAGE_PRESET.maxEdge }
      : undefined;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    resize ? [{ resize }] : [],
    {
      compress: IMAGE_PRESET.quality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const info = await getMediaInfo(result.uri, 'image');
  return { uri: result.uri, skipped: false, info };
}

async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

async function getFileSize(uri: string): Promise<number> {
  const { getInfoAsync } = await import('expo-file-system/legacy');
  const info = await getInfoAsync(uri);
  return info.exists && 'size' in info ? info.size ?? 0 : 0;
}

export async function getOutputInfo(uri: string, mediaType: 'image' | 'video'): Promise<MediaInfo> {
  return getMediaInfo(uri, mediaType);
}

export function getVideoTargetBitrate(
  preset: VideoPreset,
  duration?: number,
): number {
  const qualityTarget = VIDEO_PRESETS[preset].bitrate;
  if (!duration || duration <= 0) return qualityTarget;

  // Leave room for 128 kbps AAC audio and normal MP4 container overhead.
  const totalBitsPerSecond =
    (WHATSAPP_LIMITS.targetVideoSizeBytes * 8 * 0.95) / duration;
  const sizeLimitedVideoBitrate = Math.floor(
    totalBitsPerSecond - WHATSAPP_LIMITS.audioBitrate,
  );

  return Math.max(500_000, Math.min(qualityTarget, sizeLimitedVideoBitrate));
}

function getFileExtension(uri: string): string | undefined {
  const path = uri.split(/[?#]/, 1)[0];
  return path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
}
