import { createClient } from 'npm:@supabase/supabase-js@2';

type DeliveryRequest = {
  jobId?: string;
};

type Job = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  output_path: string | null;
};

// WhatsApp Cloud API media-message limits.
const MAX_VIDEO_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Meta error 131047: business-initiated message outside the 24h customer
// service window — the recipient must message the business number first.
const META_REENGAGEMENT_CODE = 131047;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

class WhatsAppApiError extends Error {
  code: number | null;

  constructor(message: string, code: number | null) {
    super(message);
    this.code = code;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const publicKey =
      Deno.env.get('SUPABASE_ANON_KEY') ??
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
      requiredEnv('SUPABASE_ANON_KEY');
    const serviceKey = getServiceKey();

    const userClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const body = (await request.json()) as DeliveryRequest;
    if (!body.jobId || !isUuid(body.jobId)) {
      return json({ error: 'A valid jobId is required.' }, 400);
    }

    const [{ data: job, error: jobError }, { data: profile, error: profileError }] =
      await Promise.all([
        userClient
          .from('jobs')
          .select('id, user_id, media_type, output_path')
          .eq('id', body.jobId)
          .single<Job>(),
        userClient.from('profiles').select('whatsapp_phone').eq('id', user.id).single(),
      ]);

    if (jobError || !job || job.user_id !== user.id) {
      return json({ error: 'Processed media was not found.' }, 404);
    }
    if (!job.output_path) {
      return json({ error: 'Processed media has not been uploaded.' }, 409);
    }
    if (profileError) {
      throw profileError;
    }

    const recipient = normalizePhone(profile?.whatsapp_phone);
    if (!recipient) {
      return json(
        { error: 'Add a WhatsApp number in Settings before enabling automatic delivery.' },
        422,
      );
    }

    const { data: existing } = await adminClient
      .from('whatsapp_deliveries')
      .select('status, whatsapp_message_id')
      .eq('job_id', job.id)
      .maybeSingle();

    if (existing?.status === 'sent') {
      return json({
        delivered: true,
        messageId: existing.whatsapp_message_id,
        duplicate: true,
      });
    }
    if (existing?.status === 'sending') {
      return json({ error: 'This video is already being sent.' }, 409);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from('whatsapp_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);
    if ((count ?? 0) >= 10) {
      return json({ error: 'Hourly WhatsApp delivery limit reached. Try again later.' }, 429);
    }

    const { error: deliveryError } = await adminClient.from('whatsapp_deliveries').upsert(
      {
        job_id: job.id,
        user_id: user.id,
        recipient_phone: recipient,
        status: 'sending',
        whatsapp_message_id: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_id' },
    );
    if (deliveryError) throw deliveryError;

    let metaResponse: { messageId: string };
    try {
      const { data: file, error: downloadError } = await adminClient.storage
        .from('processed')
        .download(job.output_path);
      if (downloadError || !file) {
        throw downloadError ?? new Error('Could not read the processed file from storage.');
      }

      const maxBytes = job.media_type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        throw new Error(
          `The ${job.media_type} is ${(file.size / (1024 * 1024)).toFixed(1)}MB, above the ` +
            `${Math.round(maxBytes / (1024 * 1024))}MB WhatsApp limit. Re-optimize and try again.`,
        );
      }

      // Uploading to the Media API and sending by id fails synchronously here,
      // unlike link-based sends where Meta fetches the URL later and drops the
      // message without telling us.
      const mediaId = await uploadWhatsAppMedia({
        file,
        mimeType: mimeTypeFor(job.output_path, job.media_type),
      });

      metaResponse = await sendWhatsAppMedia({
        mediaType: job.media_type,
        mediaId,
        recipient,
      });
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error ? sendError.message : 'WhatsApp delivery failed.';
      await adminClient
        .from('whatsapp_deliveries')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', job.id);
      if (sendError instanceof WhatsAppApiError && sendError.code === META_REENGAGEMENT_CODE) {
        return json({ error: sendError.message, needsOptIn: true }, 422);
      }
      throw sendError;
    }

    await adminClient
      .from('whatsapp_deliveries')
      .update({
        status: 'sent',
        whatsapp_message_id: metaResponse.messageId,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', job.id);

    return json({ delivered: true, messageId: metaResponse.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WhatsApp delivery failed.';
    return json({ error: message }, 500);
  }
});

async function uploadWhatsAppMedia(input: { file: Blob; mimeType: string }): Promise<string> {
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', input.mimeType);
  form.append('file', new File([input.file], `media.${input.mimeType.split('/')[1]}`, {
    type: input.mimeType,
  }));

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/media`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw toWhatsAppError(result, 'Meta rejected the media upload.');
  }
  if (typeof result?.id !== 'string') {
    throw new Error('Meta did not return a media ID.');
  }
  return result.id;
}

/**
 * Send the media as a free-form message first — this works whenever the user
 * has messaged the Jernih business number within the last 24 hours and needs
 * no approved template. Outside that window Meta answers with error 131047;
 * fall back to an approved template when one is configured, otherwise tell
 * the user to open the window by messaging the business number.
 */
async function sendWhatsAppMedia(input: {
  mediaType: 'image' | 'video';
  mediaId: string;
  recipient: string;
}): Promise<{ messageId: string }> {
  try {
    return await postMessage(input.recipient, {
      type: input.mediaType,
      [input.mediaType]: { id: input.mediaId },
    });
  } catch (error) {
    if (!(error instanceof WhatsAppApiError) || error.code !== META_REENGAGEMENT_CODE) {
      throw error;
    }

    const templateName = Deno.env.get(
      input.mediaType === 'video'
        ? 'WHATSAPP_VIDEO_TEMPLATE_NAME'
        : 'WHATSAPP_IMAGE_TEMPLATE_NAME',
    );
    if (!templateName) {
      const businessNumber = Deno.env.get('WHATSAPP_BUSINESS_DISPLAY_NUMBER');
      throw new WhatsAppApiError(
        businessNumber
          ? `Send any message to Jernih on WhatsApp (${businessNumber}) first, then retry.`
          : 'Send any message to the Jernih WhatsApp number first, then retry.',
        META_REENGAGEMENT_CODE,
      );
    }

    const languageCode = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') ?? 'en_US';
    return await postMessage(input.recipient, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: input.mediaType,
                [input.mediaType]: { id: input.mediaId },
              },
            ],
          },
        ],
      },
    });
  }
}

async function postMessage(
  recipient: string,
  payload: Record<string, unknown>,
): Promise<{ messageId: string }> {
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        ...payload,
      }),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw toWhatsAppError(result, 'Meta rejected the WhatsApp message.');
  }

  const messageId = result?.messages?.[0]?.id;
  if (typeof messageId !== 'string') {
    throw new Error('Meta did not return a WhatsApp message ID.');
  }
  return { messageId };
}

function toWhatsAppError(result: unknown, fallback: string): WhatsAppApiError {
  const error = (result as { error?: { message?: string; error_user_msg?: string; code?: number } })
    ?.error;
  return new WhatsAppApiError(
    error?.error_user_msg ?? error?.message ?? fallback,
    typeof error?.code === 'number' ? error.code : null,
  );
}

function mimeTypeFor(outputPath: string, mediaType: 'image' | 'video'): string {
  const extension = outputPath.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (mediaType === 'video') {
    // WhatsApp accepts video/mp4 and video/3gpp only. QuickTime output shares
    // the ISO-BMFF container, so present it as MP4 rather than failing.
    return extension === '3gp' ? 'video/3gpp' : 'video/mp4';
  }
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\D/g, '');
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getServiceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const serialized = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (serialized) {
    const keys = JSON.parse(serialized);
    if (typeof keys.default === 'string') return keys.default;
  }
  throw new Error('Missing Supabase server credential.');
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: corsHeaders });
}
