import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export type PickedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  fileName?: string | null;
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

/** Copy to cache with a clean extension so WhatsApp recognizes the file type. */
export async function prepareForShare(
  uri: string,
  mediaType: 'image' | 'video',
): Promise<string> {
  const ext = mediaType === 'video' ? 'mp4' : 'jpg';
  const dest = `${FileSystem.cacheDirectory}status_${Date.now()}.${ext}`;

  if (uri === dest) return uri;

  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function saveToPhotos(uri: string, mediaType: 'image' | 'video'): Promise<void> {
  const { granted } = await MediaLibrary.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Permission is required to save to your photo library.');
  }
  const prepared = await prepareForShare(uri, mediaType);
  await MediaLibrary.saveToLibraryAsync(prepared);
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

  await Sharing.shareAsync(prepared, {
    dialogTitle: 'Send to WhatsApp Chat',
    mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    UTI: mediaType === 'video' ? 'public.mpeg-4' : 'public.jpeg',
  });
}
