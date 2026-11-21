// Cloudflare Pages Function: /api/trigger
// Dedicated Trigger.dev v3 Background Job Orchestrator for Heavy AI Pipelines
// Prevents Cloudflare Workers timeout for Replicate, WaveSpeed, Fal.ai, HeyGen, Tripo 3D

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'info';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id, x-paas-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const TRIGGER_KEY = (env && (env.TRIGGER_SECRET_KEY || env.TRIGGER_DEV_KEY || env.TRIGGER_API_KEY)) || '';
  const TRIGGER_URL = (env && env.TRIGGER_API_URL) || 'https://api.trigger.dev/api/v3';

  // GET: Health / Status check
  if (request.method === 'GET' && action === 'info') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'Runnerflo Trigger.dev Background Orchestrator',
      configured: Boolean(TRIGGER_KEY),
      triggerApiUrl: TRIGGER_URL,
      registeredTasks: [
        { id: 'heygen-avatar-6', provider: 'heygen', description: 'Async HeyGen Avatar 6 video rendering with motion prompt' },
        { id: 'heygen-video', provider: 'heygen', description: 'Async HeyGen talking avatar video generator' },
        { id: 'replicate-video', provider: 'replicate', description: 'Async Replicate Wan 2.1 / Minimax video rendering' },
        { id: 'wavespeed-video', provider: 'wavespeed', description: 'Async WaveSpeed PixVerse 60fps video generation' },
        { id: 'fal-generation', provider: 'fal', description: 'Async Fal.ai Kling / Luma / Flux ultra-resolution generation' },
        { id: 'tripo3d-mesh', provider: 'tripo3d', description: 'Async Tripo 3D mesh reconstruction from image/text' }
      ],
      actions: ['info', 'dispatch', 'status', 'cancel', 'batch']
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  // ─── 1. DISPATCH BACKGROUND JOB (POST /api/trigger?action=dispatch) ─────────
  if (action === 'dispatch' || (request.method === 'POST' && action === 'trigger')) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST required to dispatch trigger job' }), { status: 405, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const taskId = body.taskId || body.task || 'heavy-ai-task';
    const payload = body.payload || body.data || body;
    const paasId = body.paasId || request.headers.get('x-paas-id') || 'default-paas';

    // If Trigger key is not configured, return informative simulated queued response
    if (!TRIGGER_KEY) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'TRIGGER_SECRET_KEY belum disetel di Cloudflare Pages Environment Variables.',
        simulated: true,
        taskId,
        message: 'Konfigurasikan TRIGGER_SECRET_KEY di Cloudflare Pages agar job berat (HeyGen, Replicate, Fal, WaveSpeed, Tripo 3D) berjalan di background worker tanpa timeout.'
      }), { status: 503, headers: corsHeaders });
    }

    try {
      const trRes = await fetch(`${TRIGGER_URL}/tasks/${encodeURIComponent(taskId)}/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TRIGGER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payload: {
            ...payload,
            _paasId: paasId,
            _dispatchedAt: new Date().toISOString()
          }
        })
      });

      const trData = await trRes.json();
      if (!trRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          error: trData.message || trData.error || `Trigger.dev HTTP ${trRes.status}`,
          taskId
        }), { status: trRes.status, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        ok: true,
        runId: trData.id,
        taskId,
        status: trData.status || 'QUEUED',
        createdAt: trData.createdAt || new Date().toISOString(),
        message: `Task "${taskId}" successfully queued in Trigger.dev background worker. Poll status with ?action=status&runId=${trData.id}.`
      }), { status: 202, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        ok: false,
        error: err.message,
        taskId
      }), { status: 500, headers: corsHeaders });
    }
  }

  // ─── 2. CHECK RUN STATUS (GET /api/trigger?action=status&runId=...) ─────────
  if (action === 'status') {
    const runId = url.searchParams.get('runId') || url.searchParams.get('id');
    if (!runId) {
      return new Response(JSON.stringify({ error: 'runId parameter is required' }), { status: 400, headers: corsHeaders });
    }

    if (!TRIGGER_KEY) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'TRIGGER_SECRET_KEY not configured'
      }), { status: 503, headers: corsHeaders });
    }

    try {
      const res = await fetch(`${TRIGGER_URL}/runs/${encodeURIComponent(runId)}`, {
        headers: {
          'Authorization': `Bearer ${TRIGGER_KEY}`
        }
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        ok: res.ok,
        runId,
        status: data.status,
        output: data.output || null,
        error: data.error || null,
        isCompleted: data.status === 'COMPLETED',
        isFailed: data.status === 'FAILED' || data.status === 'CRASHED',
        isRunning: data.status === 'EXECUTING' || data.status === 'WAITING' || data.status === 'QUEUED'
      }), { status: res.status, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // ─── 3. CANCEL RUN (POST /api/trigger?action=cancel) ────────────────────────
  if (action === 'cancel' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const runId = body.runId || url.searchParams.get('runId');
    if (!runId) {
      return new Response(JSON.stringify({ error: 'runId required' }), { status: 400, headers: corsHeaders });
    }

    try {
      const res = await fetch(`${TRIGGER_URL}/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TRIGGER_KEY}`
        }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({
    error: `Unknown action: "${action}". Supported: info, dispatch, status, cancel.`
  }), { status: 400, headers: corsHeaders });
}
