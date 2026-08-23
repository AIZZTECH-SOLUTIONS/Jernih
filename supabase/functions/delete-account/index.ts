import { createClient } from 'npm:@supabase/supabase-js@2';

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

    // Remove every uploaded file first — deleting the auth user cascades the
    // profiles/jobs/whatsapp_deliveries rows but leaves storage objects behind.
    const storage = adminClient.storage.from('processed');
    for (;;) {
      const { data: files, error: listError } = await storage.list(user.id, { limit: 100 });
      if (listError) throw listError;
      if (!files || files.length === 0) break;

      const { error: removeError } = await storage.remove(
        files.map((file) => `${user.id}/${file.name}`),
      );
      if (removeError) throw removeError;
      if (files.length < 100) break;
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed.';
    return json({ error: message }, 500);
  }
});

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
