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
  const langsmithWorkspaceId = (env && (env.LANGSMITH_WORKSPACE_ID || env.LANGCHAIN_WORKSPACE_ID || env.LANGSMITH_TENANT_ID)) || 'd2acb410-5fff-4807-9fd8-19010de0fa1f';
  const langgraphBase = (env && env.LANGGRAPH_API_URL) || '';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const requestedProject = url.searchParams.get('project') || '';

  // GET: Health & Status check or Diagnostic
  if (request.method === 'GET') {
    // Diagnostic: List Google AI Studio models
    if (action === 'gemini-models') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      if (!googleKey) {
        return new Response(JSON.stringify({ ok: false, error: 'GOOGLE_AI_API_KEY missing' }), { status: 400, headers: corsHeaders });
      }
      const mRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
      const mData = await mRes.json().catch(() => ({}));
      const models = (mData.models || []).map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods
      }));
      return new Response(JSON.stringify({
        ok: mRes.ok,
        count: models.length,
        models
      }, null, 2), { status: mRes.status, headers: corsHeaders });
    }

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

    // Common headers for LangSmith REST API v1 with workspace header
    const commonHeaders = {
      'x-api-key': langsmithKey,
      'Content-Type': 'application/json',
      'X-Tenant-ID': langsmithWorkspaceId
    };

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

    // ─── 3. Gemini UI/UX Generator (LangSmith Deep Agent — Google AI Studio) ──
    // Orkestrasi: LangSmith trace → Gemini generate UI/UX → inject capabilities
    // Fallback chain: gemini-2.5-flash → gemini-2.0-flash-lite → gemini-1.5-flash
    if (subAction === 'generate-ui') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);

      if (!googleKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'GOOGLE_AI_API_KEY belum disetel di Cloudflare Pages. Tambahkan via Settings > Environment Variables.',
          fallback: 'claude'
        }), { status: 200, headers: corsHeaders });
      }

      const userPrompt = typeof input === 'string'
        ? input
        : (input.prompt || input.text || 'Build a modern SaaS application');
      const projectName = body.projectName || paasId.replace(/[^a-z0-9-]+/g, '-') || 'runnerflo-app';
      const userLlmModel = body.userModel || 'openai/gpt-4o-mini';
      const userLlmProvider = body.userProvider || 'openrouter';

      // LangSmith: open trace run BEFORE inference
      const runId = crypto.randomUUID();
      const startTime = new Date().toISOString();
      await fetch('https://api.smith.langchain.com/api/v1/runs', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          id: runId,
          name: `gemini-ui-generator-${paasId}`,
          run_type: 'llm',
          inputs: { prompt: userPrompt, projectName },
          start_time: startTime,
          session_name: langsmithProject,
          extra: { metadata: { paas_id: paasId, end_user_id: endUserId, composite_tenant_id: compositeId, engine: 'gemini-ui-generator' } }
        })
      }).catch(() => null);

      // ── System Prompt: SAMA PERSIS dengan Claude Managed Agent ──────────────
      const geminiSystemPrompt = `You are an Autonomous Lead Software Architect & Orchestrator for the Runnerflo Cloud Platform (Year 2026).

CORE MISSION: META-PAAS (PLATFORM-AS-A-SERVICE THAT BUILDS PAAS & SAAS)
Runnerflo is a META-PAAS: an enterprise platform that autonomously constructs complete, production-ready PaaS and SaaS platforms for customers.
Every generated application is a full, turnkey platform operating with an isolated tenant ID (e.g. "${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}").

CRITICAL 4-ENGINE AI & AGENT GATEWAY ARCHITECTURE (STRICT RUNNERFLO TOPOLOGY):
Runnerflo provides a centralized, turnkey Edge Gateway at "/api/gateway" and LangSmith agent dispatcher at "/api/langsmith".
The platform owner manages ALL API keys centrally in Cloudflare Pages Secrets.

TENANT DUAL-IDENTITY STANDARD (paas_id + end_user_id):
Every generated child PaaS operates with two distinct identities that must never be mixed up:
1. paasId: The unique identifier of the generated child PaaS (e.g. "${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}").
2. endUserId: The specific end-user using the child PaaS (persisted in client localStorage or session).
Composite Tenant Identity format: "${projectName}:{endUserId}".
In every client script, initialize tenant identity:
\`\`\`javascript
const PAAS_ID = window.PAAS_ID || '${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}';
let END_USER_ID = localStorage.getItem('rf_end_user_id');
if (!END_USER_ID) {
  END_USER_ID = 'usr_' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('rf_end_user_id', END_USER_ID);
}
const COMPOSITE_TENANT_ID = PAAS_ID + ':' + END_USER_ID;
\`\`\`

STRICT TOPOLOGY MANDATE:
All generated PaaS and SaaS applications MUST send their API calls EXCLUSIVELY to Runnerflo internal endpoints ("/api/gateway", "/api/langsmith", "/api/composio").
NEVER make direct calls to third-party APIs from the generated code!
Runnerflo acts as the single central hub holding all credentials, metering, and tenant isolation.

THE 4 UNIVERSAL ENGINES:
1. Engine 1 — LLM (User's chosen model: ${userLlmModel} via ${userLlmProvider}):
   Call: fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: '${userLlmProvider}', model: '${userLlmModel}', input: { messages: [...] } }) })
2. Engine 2 — Replicate (Video, audio, speech-to-text):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'replicate', model: 'owner/model', input: {...} }) })
3. Engine 3 — WaveSpeed (Real-time video & avatar):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'wavespeed', model: '...', input: {...} }) })
4. Engine 4 — fal.ai (Fast diffusion: Flux, Kling, Wan2.1):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'fal', model: 'fal-ai/...', input: {...} }) })

LANGSMITH MANAGED DEEP AGENT & COMPOSIO MANAGED APIS (ZERO-CONFIG GOOGLE OAUTH):
- LangSmith Deep Agent (user's chosen AI model: ${userLlmModel}):
  Call: fetch('/api/langsmith', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, action: 'run', model: '${userLlmModel}', provider: '${userLlmProvider}', input: { prompt: '...' } }) })

- COMPOSIO MANAGED APPS GOOGLE OAUTH (MANDATORY PATTERN):
  Every generated PaaS that needs user login MUST use Composio Managed Auth.
  DO NOT ask end-users for Google Cloud Client IDs or Secrets!
  \`\`\`javascript
  async function loginWithGoogle() {
    const redirectUri = window.location.href;
    const res = await fetch('/api/composio?action=connect-url&app=google&paasId=' + encodeURIComponent(PAAS_ID) + '&endUserId=' + encodeURIComponent(END_USER_ID) + '&redirectUri=' + encodeURIComponent(redirectUri));
    const data = await res.json();
    if (data.connectUrl) { window.location.href = data.connectUrl; }
  }
  async function checkGoogleConnection() {
    const res = await fetch('/api/composio?action=connections&paasId=' + encodeURIComponent(PAAS_ID) + '&endUserId=' + encodeURIComponent(END_USER_ID));
    const data = await res.json();
    return Boolean(data.connections && data.connections.some(c => c.appName.toLowerCase().includes('google') || c.status === 'ACTIVE'));
  }
  \`\`\`

ABSOLUTE NO-BYOK (BRING YOUR OWN KEY) MANDATE:
- NEVER output UI forms asking end-users to input API keys. That is strictly prohibited!
- All AI, 3D, video, and agent capabilities must be wired directly to "/api/gateway", "/api/langsmith", or "/api/composio".

CRITICAL DIRECTIVE: CREATING NEW APPLICATION FROM ZERO
1. YOU ARE IN CREATION MODE. Build a brand new, production-grade application for: "${userPrompt}".
2. You MUST produce a COMPLETE, self-contained, browser-executable HTML5 file as "index.html".
3. Use Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and working interactive JavaScript.
4. Render high-fidelity UI: clean navigation, interactive buttons, realistic mock data, and functional controls.
5. DO NOT default to dark theme unless explicitly requested. Use crisp light backgrounds (bg-white, bg-slate-50).
6. Output ONLY the complete HTML code inside a single markdown code block: \`\`\`html ... \`\`\`

PROJECT CONTEXT:
- Project Name: "${projectName}"
- Tenant ID: "${paasId}"
- User's LLM Choice: ${userLlmModel} (${userLlmProvider})

Respond in Indonesian if the prompt is in Indonesian. Otherwise respond in English.`;

      // Gemini model fallback chain (exact sequence requested by user)
      const GEMINI_MODELS = [
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash'
      ];
      const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

      let geminiResult = null;
      let usedModel = '';
      let geminiError = '';

      for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const mdl = GEMINI_MODELS[i];
        try {
          const gRes = await fetch(`${GEMINI_BASE}/${mdl}:generateContent?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: geminiSystemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 65536 }
            })
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text && text.length > 100) {
              geminiResult = text;
              usedModel = mdl;
              break;
            }
          } else {
            const errBody = await gRes.text().catch(() => '');
            geminiError = `${mdl}: HTTP ${gRes.status} — ${errBody.slice(0, 200)}`;
          }
        } catch (e) {
          geminiError = `${mdl}: ${e.message}`;
        }
      }

      // If all Gemini models failed → signal frontend to fall back to Claude
      if (!geminiResult) {
        await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
          method: 'PATCH', headers: commonHeaders,
          body: JSON.stringify({ outputs: { error: geminiError }, end_time: new Date().toISOString(), error: geminiError })
        }).catch(() => null);

        return new Response(JSON.stringify({
          ok: false,
          fallback: 'claude',
          runId,
          tenantId: compositeId,
          paasId,
          endUserId,
          error: geminiError || 'All Gemini models failed',
          hint: 'Frontend should activate Claude Managed Agent fallback.'
        }), { status: 200, headers: corsHeaders });
      }

      // Extract HTML from Gemini output
      let htmlCode = '';
      const htmlMatch = geminiResult.match(/```(?:html|xml)?\s*([\s\S]*?```)/i);
      if (htmlMatch && htmlMatch[1]) {
        htmlCode = htmlMatch[1].replace(/```\s*$/, '').trim();
      } else if (geminiResult.includes('<!DOCTYPE') || geminiResult.includes('<html')) {
        const bare = geminiResult.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
        htmlCode = bare ? bare[0].trim() : geminiResult.trim();
      } else {
        htmlCode = geminiResult.trim();
      }

      // PATCH LangSmith run with output
      await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
        method: 'PATCH', headers: commonHeaders,
        body: JSON.stringify({
          outputs: { htmlLength: htmlCode.length, model: usedModel, projectName },
          end_time: new Date().toISOString()
        })
      }).catch(() => null);

      return new Response(JSON.stringify({
        ok: true,
        source: 'gemini_ui_generator',
        runId,
        tenantId: compositeId,
        paasId,
        endUserId,
        model: usedModel,
        htmlCode,
        projectName,
        userLlmModel,
        userLlmProvider
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown action: "${subAction}". Supported: run, thread, dispatch, generate-ui.`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
