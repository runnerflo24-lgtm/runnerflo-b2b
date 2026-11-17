// Cloudflare Pages Function: /api/langsmith
// LangSmith Managed Deep Agent Engine & Tenant Thread Isolator
// Central orchestration for Runnerflo Meta-PaaS

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-tenant-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const langsmithKey = (env && (env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY || env.LANGSMITH_KEY)) || '';
  const langsmithProject = (env && (env.LANGCHAIN_PROJECT || env.LANGSMITH_PROJECT)) || 'runnerflo-meta-paas';
  const langgraphBase = (env && env.LANGGRAPH_API_URL) || 'https://api.smith.langchain.com';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // GET: Health & Status check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'LangSmith Managed Deep Agent Gateway',
      configured: Boolean(langsmithKey),
      project: langsmithProject,
      message: langsmithKey
        ? 'LangSmith API Key aktif dan siap mengorkestrasikan deep agent per tenant.'
        : 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || request.headers.get('x-tenant-id') || 'default-tenant';
    const subAction = action || body.action || 'run';
    const input = body.input || body.prompt || body.messages || {};

    if (!langsmithKey) {
      // Graceful fallback response for offline testing
      return new Response(JSON.stringify({
        ok: false,
        simulated: true,
        tenantId,
        error: 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.',
        message: 'Kunci LangSmith belum terpasang. Pasang LANGSMITH_API_KEY di Cloudflare Pages Environment Variables.'
      }), { status: 200, headers: corsHeaders });
    }

    const commonHeaders = {
      'x-api-key': langsmithKey,
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId
    };

    // ─── 1. Thread Management (Isolated per Tenant) ─────────────────────────
    if (subAction === 'thread') {
      const threadRes = await fetch(`${langgraphBase}/threads`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          metadata: {
            tenantId,
            project: langsmithProject,
            createdAt: new Date().toISOString()
          }
        })
      });

      const threadData = await threadRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        ok: threadRes.ok,
        tenantId,
        thread: threadData
      }), { status: threadRes.ok ? 200 : threadRes.status, headers: corsHeaders });
    }

    // ─── 2. Deep Agent Run Dispatcher ───────────────────────────────────────
    if (subAction === 'run' || subAction === 'dispatch') {
      const assistantId = body.assistantId || 'agent';
      const threadId = body.threadId || `thread-${tenantId}`;

      // Dispatch run to LangGraph / LangSmith runs endpoint
      const runRes = await fetch(`${langgraphBase}/threads/${encodeURIComponent(threadId)}/runs`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          assistant_id: assistantId,
          input: typeof input === 'string' ? { prompt: input } : input,
          metadata: {
            tenantId,
            project: langsmithProject
          }
        })
      });

      if (runRes.ok) {
        const runData = await runRes.json();
        return new Response(JSON.stringify({
          ok: true,
          tenantId,
          threadId,
          run: runData
        }), { status: 200, headers: corsHeaders });
      }

      // If specific thread route is not initialized, create a LangSmith Run Trace directly
      const traceRes = await fetch(`https://api.smith.langchain.com/runs`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          name: `deep-agent-${tenantId}`,
          run_type: 'chain',
          inputs: typeof input === 'string' ? { input } : input,
          session_name: langsmithProject,
          extra: { tenantId }
        })
      });

      const traceData = await traceRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        ok: traceRes.ok,
        tenantId,
        source: 'langsmith_runs_api',
        data: traceData
      }), { status: traceRes.ok ? 200 : traceRes.status, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown action: "${subAction}". Supported: run, thread, dispatch.`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
