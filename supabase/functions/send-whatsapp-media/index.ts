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

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

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

    const { data: signed, error: signedUrlError } = await adminClient.storage
      .from('processed')
      .createSignedUrl(job.output_path, 15 * 60);
    if (signedUrlError) throw signedUrlError;

    let metaResponse: { messageId: string };
    try {
      metaResponse = await sendWhatsAppTemplate({
        mediaType: job.media_type,
        mediaUrl: signed.signedUrl,
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

async function sendWhatsAppTemplate(input: {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  recipient: string;
}): Promise<{ messageId: string }> {
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');
  const templateName = requiredEnv(
    input.mediaType === 'video'
      ? 'WHATSAPP_VIDEO_TEMPLATE_NAME'
      : 'WHATSAPP_IMAGE_TEMPLATE_NAME',
  );
  const languageCode = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') ?? 'en_US';

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
        to: input.recipient,
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
                  [input.mediaType]: { link: input.mediaUrl },
                },
              ],
            },
          ],
        },
      }),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    const metaMessage =
      result?.error?.error_user_msg ??
      result?.error?.message ??
      'Meta rejected the WhatsApp message.';
    throw new Error(metaMessage);
  }

  const messageId = result?.messages?.[0]?.id;
  if (typeof messageId !== 'string') {
    throw new Error('Meta did not return a WhatsApp message ID.');
  }
  return { messageId };
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
