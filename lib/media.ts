import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export type PickedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  fileName?: string | null;
};

type PreparedShare = {
  uri: string;
  mimeType: string;
  UTI: string;
};

export async function requestMediaPermissions(): Promise<boolean> {
  const picker = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const library = await MediaLibrary.requestPermissionsAsync();
  return picker.granted && library.granted;
}

export async function pickMedia(): Promise<PickedMedia | null> {
  const granted = await requestMediaPermissions();
  if (!granted) {
    throw new Error('Photo library permission is required.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
    videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mediaType: asset.type === 'video' ? 'video' : 'image',
    fileName: asset.fileName,
  };
}

/** Copy to cache without changing the file's actual container/format. */
export async function prepareForShare(
  uri: string,
  mediaType: 'image' | 'video',
): Promise<PreparedShare> {
  const sourceExt = getFileExtension(uri);
  const ext = sourceExt ?? (mediaType === 'video' ? 'mp4' : 'jpg');
  const dest = `${FileSystem.cacheDirectory}status_${Date.now()}.${ext}`;

  await FileSystem.copyAsync({ from: uri, to: dest });
  return {
    uri: dest,
    ...getShareType(mediaType, ext),
  };
}

export async function saveToPhotos(uri: string): Promise<void> {
  const { granted } = await MediaLibrary.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Permission is required to save to your photo library.');
  }
  await MediaLibrary.saveToLibraryAsync(uri);
}

/**
 * Opens the share sheet — user must send to a WhatsApp chat (ideally Message Yourself).
 * Then they Forward → My Status for best quality retention.
 */
export async function shareToWhatsAppChat(
  uri: string,
  mediaType: 'image' | 'video',
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  const prepared = await prepareForShare(uri, mediaType);

  await Sharing.shareAsync(prepared.uri, {
    dialogTitle: 'Send to WhatsApp Chat',
    mimeType: prepared.mimeType,
    UTI: prepared.UTI,
  });
}

function getFileExtension(uri: string): string | null {
  const path = uri.split(/[?#]/, 1)[0];
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function getShareType(
  mediaType: 'image' | 'video',
  extension: string,
): Pick<PreparedShare, 'mimeType' | 'UTI'> {
  if (mediaType === 'video' && extension === 'mov') {
    return { mimeType: 'video/quicktime', UTI: 'com.apple.quicktime-movie' };
  }
  if (mediaType === 'image' && (extension === 'heic' || extension === 'heif')) {
    return { mimeType: `image/${extension}`, UTI: `public.${extension}` };
  }
  if (mediaType === 'image' && extension === 'png') {
    return { mimeType: 'image/png', UTI: 'public.png' };
  }
  return mediaType === 'video'
    ? { mimeType: 'video/mp4', UTI: 'public.mpeg-4' }
    : { mimeType: 'image/jpeg', UTI: 'public.jpeg' };
}
