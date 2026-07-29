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
  const ext = mediaType === 'video' ? 'mp4' : 'jpg';
  const path = `${userId}/${jobId}.${ext}`;

  // Blob uploads from fetch() produce 0-byte files on React Native, so read the
  // file as base64 and upload a decoded ArrayBuffer instead.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage.from('processed').upload(path, arrayBuffer, {
    contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    upsert: true,
  });

  if (error) throw error;
  return path;
}

export async function recordJob(input: {
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
