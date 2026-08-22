import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type User } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient throws on empty/invalid URLs, which would crash the app before
// the user has configured .env. Fall back to a syntactically valid placeholder
// and gate all real usage behind `supabaseConfigured`.
const safeUrl = supabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type JobRecord = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  original_bytes: number;
  output_bytes: number;
  preset: string;
  codec: string;
  output_path: string | null;
  created_at: string;
};

export type WhatsAppDeliveryResult = {
  delivered: true;
  messageId: string;
  duplicate?: boolean;
};

export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'jernih://auth/callback',
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function uploadProcessed(
  userId: string,
  jobId: string,
  uri: string,
  mediaType: 'image' | 'video',
): Promise<string> {
  const uploadType = getUploadType(uri, mediaType);
  const ext = uploadType.extension;
  const path = `${userId}/${jobId}.${ext}`;

  // Blob uploads from fetch() produce 0-byte files on React Native, so read the
  // file as base64 and upload a decoded ArrayBuffer instead.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage.from('processed').upload(path, arrayBuffer, {
    contentType: uploadType.contentType,
    upsert: true,
  });

  if (error) throw error;
  return path;
}

export async function recordJob(input: {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  original_bytes: number;
  output_bytes: number;
  preset: string;
  codec: string;
  output_path: string | null;
}): Promise<JobRecord> {
  const { data, error } = await supabase.from('jobs').insert(input).select().single();
  if (error) throw error;
  return data as JobRecord;
}

export async function fetchJobs(userId: string): Promise<JobRecord[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as JobRecord[];
}

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('processed').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function getWhatsAppPhone(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('whatsapp_phone')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return typeof data?.whatsapp_phone === 'string' ? data.whatsapp_phone : '';
}

export async function updateWhatsAppPhone(userId: string, phone: string): Promise<string> {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    throw new Error('Enter a valid WhatsApp number with country code.');
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, whatsapp_phone: normalized }, { onConflict: 'id' });
  if (error) throw error;
  return normalized;
}

export async function deliverJobToWhatsApp(jobId: string): Promise<WhatsAppDeliveryResult> {
  const { data, error } = await supabase.functions.invoke('send-whatsapp-media', {
    body: { jobId },
  });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === 'string') message = payload.error;
      } catch {
        // Keep the Supabase client error when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (!data?.delivered || typeof data?.messageId !== 'string') {
    throw new Error('Jernih could not confirm WhatsApp delivery.');
  }
  return data as WhatsAppDeliveryResult;
}

export function normalizeWhatsAppPhone(phone: string): string | null {
  const normalized = phone.replace(/\D/g, '');
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : null;
}

function getUploadType(
  uri: string,
  mediaType: 'image' | 'video',
): { extension: string; contentType: string } {
  const path = uri.split(/[?#]/, 1)[0];
  const extension = path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  if (mediaType === 'video' && extension === 'mov') {
    return { extension: 'mov', contentType: 'video/quicktime' };
  }
  if (mediaType === 'image' && extension === 'png') {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (mediaType === 'image' && (extension === 'heic' || extension === 'heif')) {
    return { extension, contentType: `image/${extension}` };
  }
  return mediaType === 'video'
    ? { extension: 'mp4', contentType: 'video/mp4' }
    : { extension: 'jpg', contentType: 'image/jpeg' };
}
