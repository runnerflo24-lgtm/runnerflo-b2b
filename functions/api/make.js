// Cloudflare Pages Function: /api/make
// Make.com API Integration — Execute Automation Workflows
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  const makeApiKey = (env && env.MAKE_API_KEY) || '';
  const makeTeamId = (env && env.MAKE_TEAM_ID) || '';

  if (!makeApiKey) {
    return new Response(JSON.stringify({
      error: 'MAKE_API_KEY belum disetel. Tambahkan di Cloudflare Pages → Settings → Environment Variables.',
      configured: false,
      docs: 'https://www.make.com/en/api-documentation'
    }), { status: 503, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const action = body.action || 'list'; // list | create | run | status
    const makeBase = 'https://eu1.make.com/api/v2';
    const makeHeaders = {
      'Authorization': `Token ${makeApiKey}`,
      'Content-Type': 'application/json'
    };

    // ── LIST scenarios milik user ──────────────────────────────────────
    if (action === 'list') {
      const teamQuery = makeTeamId ? `?teamId=${makeTeamId}` : '';
      const res = await fetch(`${makeBase}/scenarios${teamQuery}`, { headers: makeHeaders });
      const data = await res.json();
      return new Response(JSON.stringify({
        success: res.ok,
        scenarios: data.scenarios || data,
        total: (data.scenarios || []).length
      }), { status: 200, headers: corsHeaders });
    }

    // ── CREATE scenario baru via blueprint ────────────────────────────
    if (action === 'create') {
      const { name, blueprint, folderId } = body;
      if (!blueprint) {
        return new Response(JSON.stringify({ error: 'Field "blueprint" wajib diisi untuk membuat scenario.' }), {
          status: 400, headers: corsHeaders
        });
      }

      const payload = {
        name: name || 'Runnerflo Scout Workflow',
        blueprint,
        scheduling: { type: 'indefinitely', interval: 900 } // polling tiap 15 menit
      };
      if (folderId) payload.folderId = folderId;
      if (makeTeamId) payload.teamId = Number(makeTeamId);

      const res = await fetch(`${makeBase}/scenarios`, {
        method: 'POST',
        headers: makeHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        success: res.ok,
        scenarioId: data.scenario?.id || data.id,
        scenario: data.scenario || data,
        message: res.ok ? 'Workflow berhasil dibuat di Make.com!' : 'Gagal membuat workflow.'
      }), { status: res.ok ? 201 : 400, headers: corsHeaders });
    }

    // ── RUN scenario sekali (on-demand) ──────────────────────────────
    if (action === 'run') {
      const { scenarioId, data: inputData } = body;
      if (!scenarioId) {
        return new Response(JSON.stringify({ error: 'Field "scenarioId" wajib diisi.' }), {
          status: 400, headers: corsHeaders
        });
      }

      const res = await fetch(`${makeBase}/scenarios/${scenarioId}/run`, {
        method: 'POST',
        headers: makeHeaders,
        body: JSON.stringify({ data: inputData || {} })
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        success: res.ok,
        executionId: data.executionId || data.id,
        status: data.status || 'running',
        message: res.ok ? 'Workflow dijalankan!' : 'Gagal menjalankan workflow.'
      }), { status: 200, headers: corsHeaders });
    }

    // ── STATUS eksekusi ───────────────────────────────────────────────
    if (action === 'status') {
      const { scenarioId } = body;
      if (!scenarioId) {
        return new Response(JSON.stringify({ error: 'Field "scenarioId" wajib diisi.' }), {
          status: 400, headers: corsHeaders
        });
      }

      const res = await fetch(`${makeBase}/scenarios/${scenarioId}`, { headers: makeHeaders });
      const data = await res.json();
      return new Response(JSON.stringify({
        success: res.ok,
        isActive: data.scenario?.islinked || data.isActive,
        lastRun: data.scenario?.lastEdit,
        scenario: data.scenario || data
      }), { status: 200, headers: corsHeaders });
    }

    // ── TRIGGER via webhook (kirim data ke webhook URL Make) ──────────
    if (action === 'trigger') {
      const { webhookUrl, payload: webhookPayload } = body;
      if (!webhookUrl) {
        return new Response(JSON.stringify({ error: 'Field "webhookUrl" wajib diisi.' }), {
          status: 400, headers: corsHeaders
        });
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload || {})
      });

      return new Response(JSON.stringify({
        success: res.ok,
        status: res.status,
        message: res.ok ? 'Webhook Make berhasil dipicu!' : 'Gagal memicu webhook.'
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Action "${action}" tidak dikenal. Gunakan: list | create | run | status | trigger`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
