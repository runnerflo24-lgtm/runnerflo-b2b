// Cloudflare Pages Function: /api/langsmith
// LangSmith Managed Deep Agent Engine & Tenant Thread Isolator
// Central orchestration for Runnerflo Meta-PaaS

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-tenant-id, x-paas-id, x-end-user-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const langsmithKey = (env && (env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY || env.LANGSMITH_KEY)) || '';
  const defaultProject = (env && (env.LANGCHAIN_PROJECT || env.LANGSMITH_PROJECT)) || 'default';
  const langgraphBase = (env && env.LANGGRAPH_API_URL) || '';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const requestedProject = url.searchParams.get('project') || '';

  // GET: Health & Status check or Diagnostic
  if (request.method === 'GET') {
    if (action === 'diagnostic') {
      const testTenant = url.searchParams.get('tenantHeader') || (env && env.LANGSMITH_WORKSPACE_ID) || 'd2acb410-5fff-4807-9fd8-19010de0fa1f';
      let results = {};
      let error = null;
      if (langsmithKey) {
        try {
          // 1. Test sessions without tenant header
          const s1 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
            headers: { 'x-api-key': langsmithKey }
          });
          results['sessions_no_tenant'] = { status: s1.status, data: await s1.json().catch(() => ({})) };

          // 2. Test sessions with X-Tenant-ID
          if (testTenant) {
            const s2 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
              headers: { 'x-api-key': langsmithKey, 'X-Tenant-ID': testTenant }
            });
            results[`sessions_with_tenant_${testTenant}`] = { status: s2.status, data: await s2.json().catch(() => ({})) };

            // 3. Test sessions with X-Organization-Id
            const s3 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
              headers: { 'x-api-key': langsmithKey, 'X-Organization-Id': testTenant }
            });
            results[`sessions_with_org_${testTenant}`] = { status: s3.status, data: await s3.json().catch(() => ({})) };
          }
        } catch (e) {
          error = e.message;
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        configured: Boolean(langsmithKey),
        results,
        error
      }, null, 2), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      service: 'LangSmith Managed Deep Agent Gateway',
      version: 'v1',
      configured: Boolean(langsmithKey),
      project: defaultProject,
      message: langsmithKey
        ? 'LangSmith API Key aktif dan siap mengorkestrasikan deep agent per tenant.'
        : 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    let body = {};
    try {
      const rawText = await request.text();
      if (rawText && rawText.trim().startsWith('{')) {
        body = JSON.parse(rawText);
      }
    } catch {
      body = {};
    }
    
    // Composite Tenant Identity standard: {paas_id}:{end_user_id}
    const paasId = body.paas_id || body.paasId || body.tenantId || url.searchParams.get('paas_id') || url.searchParams.get('paasId') || url.searchParams.get('tenantId') || request.headers.get('x-paas-id') || request.headers.get('x-tenant-id') || 'default-paas';
    const endUserId = body.end_user_id || body.endUserId || body.userId || url.searchParams.get('end_user_id') || url.searchParams.get('endUserId') || url.searchParams.get('userId') || request.headers.get('x-end-user-id') || request.headers.get('x-user-id') || 'default-user';
    const compositeId = `${paasId}:${endUserId}`;
    
    const subAction = action || body.action || 'run';
    const langsmithProject = body.project || requestedProject || defaultProject;
    const input = body.input || body.prompt || body.messages || {};

    if (!langsmithKey) {
      // Graceful simulated response when key is missing
      return new Response(JSON.stringify({
        ok: false,
        simulated: true,
        tenantId: compositeId,
        paasId,
        endUserId,
        error: 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.',
        message: 'Kunci LangSmith belum terpasang. Pasang LANGSMITH_API_KEY di Cloudflare Pages Environment Variables.'
      }), { status: 200, headers: corsHeaders });
    }

    // Common headers for LangSmith REST API v1
    // Personal Access Token (lsv2_pt_...) does NOT need X-Tenant-ID.
    // Service Key (lsv2_sk_...) paired with workspace needs it.
    const commonHeaders = {
      'x-api-key': langsmithKey,
      'Content-Type': 'application/json'
    };

    // X-Tenant-ID only for Service Keys paired with a workspace
    // Personal PAT keys must NOT send X-Tenant-ID or they get 403
    if (env && env.LANGSMITH_WORKSPACE_ID && langsmithKey.startsWith('lsv2_sk_')) {
      commonHeaders['X-Tenant-ID'] = env.LANGSMITH_WORKSPACE_ID;
    }

    // ─── 1. Thread Management (Isolated per Composite Tenant) ───────────────
    if (subAction === 'thread' || subAction === 'threads') {
      const threadId = body.threadId || `thread-${encodeURIComponent(compositeId)}`;

      if (langgraphBase) {
        const threadRes = await fetch(`${langgraphBase}/threads`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({
            metadata: {
              paas_id: paasId,
              end_user_id: endUserId,
              composite_tenant_id: compositeId,
              project: langsmithProject,
              createdAt: new Date().toISOString()
            }
          })
        }).catch(() => null);

        if (threadRes && threadRes.ok) {
          const threadData = await threadRes.json();
          return new Response(JSON.stringify({
            ok: true,
            tenantId: compositeId,
            paasId,
            endUserId,
            thread: threadData
          }), { status: 200, headers: corsHeaders });
        }
      }

      // Default managed thread response
      return new Response(JSON.stringify({
        ok: true,
        tenantId: compositeId,
        paasId,
        endUserId,
        thread: {
          id: threadId,
          paas_id: paasId,
          end_user_id: endUserId,
          project: langsmithProject,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 2. Deep Agent Run Dispatcher (LangSmith REST API v1) ─────────────────
    if (subAction === 'run' || subAction === 'dispatch') {
      const runId = crypto.randomUUID();
      const startTime = new Date().toISOString();
      const assistantId = body.assistantId || `agent-${paasId}`;

      // Official LangSmith Runs v1 payload schema
      const runPayload = {
        id: runId,
        name: body.name || `deep-agent-${paasId}`,
        run_type: body.run_type || 'chain',
        inputs: typeof input === 'string' ? { prompt: input } : input,
        start_time: startTime,
        session_name: langsmithProject,
        extra: {
          metadata: {
            paas_id: paasId,
            end_user_id: endUserId,
            composite_tenant_id: compositeId,
            assistant_id: assistantId,
            project: langsmithProject
          }
        }
      };

      // 1. Auto-ensure LangSmith project exists first (PAT 403 on unknown project)
      let projectCheckNote = '';
      try {
        const projectRes = await fetch(`https://api.smith.langchain.com/api/v1/sessions?name=${encodeURIComponent(langsmithProject)}`, {
          method: 'GET',
          headers: commonHeaders
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const existing = projectData.find ? projectData.find(p => p.name === langsmithProject) : null;
          if (!existing) {
            // Create the project/session automatically
            await fetch('https://api.smith.langchain.com/api/v1/sessions', {
              method: 'POST',
              headers: commonHeaders,
              body: JSON.stringify({ name: langsmithProject })
            }).catch(() => null);
            projectCheckNote = 'auto-created project';
          } else {
            projectCheckNote = 'project-exists';
          }
        }
      } catch (e) {
        projectCheckNote = `project-check-error: ${e.message}`;
      }

      // 2. Post Run to LangSmith REST API v1
      const traceRes = await fetch('https://api.smith.langchain.com/api/v1/runs', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(runPayload)
      });

      const traceData = await traceRes.json().catch(() => ({}));

      if (!traceRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          source: 'langsmith_runs_api_v1',
          status: traceRes.status,
          tenantId: compositeId,
          paasId,
          endUserId,
          projectNote: projectCheckNote,
          error: traceData.detail || traceData.error || `LangSmith HTTP ${traceRes.status}`,
          hint: traceRes.status === 403 ? `Create project "${langsmithProject}" in LangSmith dashboard at smith.langchain.com/settings then retry.` : undefined,
          raw: traceData
        }), { status: traceRes.status, headers: corsHeaders });
      }

      // 2. Perform Agent Inference if requested and OpenRouter key is present
      let outputData = null;
      const openrouterKey = env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY);

      if (openrouterKey && body.execute !== false) {
        const userPrompt = typeof input === 'string'
          ? input
          : (input.prompt || input.text || (Array.isArray(input.messages) ? input.messages[input.messages.length - 1]?.content : 'Hello'));

        const systemPrompt = body.systemPrompt || 
          `You are an autonomous Deep Agent running on child PaaS (${paasId}) for end-user (${endUserId}). Orchestrated by Runnerflo Meta-PaaS.`;

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://runnerflo-b2b.pages.dev',
            'X-Title': 'Runnerflo Meta-PaaS Deep Agent',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: body.model || 'openai/gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7
          })
        }).catch(() => null);

        if (orRes && orRes.ok) {
          const orData = await orRes.json();
          const reply = orData.choices?.[0]?.message?.content || '';
          outputData = {
            output: reply,
            model: body.model || 'openai/gpt-4o-mini',
            usage: orData.usage
          };

          // Complete Run in LangSmith with outputs
          await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
            method: 'PATCH',
            headers: commonHeaders,
            body: JSON.stringify({
              outputs: outputData,
              end_time: new Date().toISOString()
            })
          }).catch(() => null);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        source: 'langsmith_runs_api_v1',
        runId,
        tenantId: compositeId,
        paasId,
        endUserId,
        project: langsmithProject,
        result: outputData?.output || null,
        output: outputData,
        data: traceData
      }), { status: 200, headers: corsHeaders });
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
