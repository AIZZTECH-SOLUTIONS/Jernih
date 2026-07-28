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
      meta.duration > 0 ? Math.round((meta.size * 8) / meta.duration) : meta.bitrate;
    return {
      uri,
      mediaType,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      sizeBytes: meta.size,
      bitrate,
    };
  }

  const sizeBytes = await getFileSize(uri);
  const { width, height } = await getImageDimensions(uri);
  return { uri, mediaType, width, height, sizeBytes };
}

export async function optimizeVideo(
  uri: string,
  preset: VideoPreset,
  codec: Codec,
  onProgress?: (progress: number) => void,
): Promise<OptimizeResult> {
  const original = await getMediaInfo(uri, 'video');
  const options = VIDEO_PRESETS[preset];
  const targetBitrate = options.bitrate;

  const alreadySafe =
    (original.bitrate ?? Infinity) <= targetBitrate * 1.1 &&
    Math.max(original.width ?? 0, original.height ?? 0) <= options.maxSize &&
    original.sizeBytes <= WHATSAPP_LIMITS.targetVideoSizeBytes * 1.5;

  if (alreadySafe) {
    onProgress?.(1);
    return { uri, skipped: true, info: original };
  }

  const outputUri = await compress(
    uri,
    {
      bitrate: targetBitrate,
      maxSize: options.maxSize,
      codec: codec as CompressionCodec,
      speed: options.speed,
    },
    onProgress,
  );

  const info = await getMediaInfo(outputUri, 'video');
  return { uri: outputUri, skipped: false, info };
}

export async function optimizeImage(uri: string): Promise<OptimizeResult> {
  const original = await getMediaInfo(uri, 'image');
  const longest = Math.max(original.width ?? 0, original.height ?? 0);

  const alreadySafe =
    longest <= IMAGE_PRESET.maxEdge && original.sizeBytes <= 1.5 * 1024 * 1024;

  if (alreadySafe) {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: IMAGE_PRESET.quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const info = await getMediaInfo(result.uri, 'image');
    return { uri: result.uri, skipped: true, info };
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
