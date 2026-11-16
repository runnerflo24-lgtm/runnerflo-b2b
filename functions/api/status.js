// Cloudflare Pages Function: /api/status (Diagnostic status for Runnerflo B2B)
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const inspectSessionId = url.searchParams.get('session');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const hasTotalum = Boolean(env && (env.TOTALUM_API_KEY || env.TOTALUM_KEY || env.TLM_API_KEY));
  const hasAnthropic = Boolean(env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY));
  const anthropicPrefix = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY))
    ? (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY).slice(0, 12) + '...'
    : 'none';
  const hasVertex = Boolean(env && (env.VERTEX_PROJECT_ID || env.VERTEX_API_KEY || env.GOOGLE_ACCESS_TOKEN));
  const hasGemini = Boolean(env && (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_KEY));
  const hasOpenAI = Boolean(env && env.OPENAI_API_KEY);
  const hasTrigger = Boolean(env && (env.TRIGGER_SECRET_KEY || env.TRIGGER_DEV_KEY || env.TRIGGER_API_KEY));
  const hasComposio = Boolean(env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY));
  const hasOpenRouter = Boolean(env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY));
  const hasFal = Boolean(env && (env.FAL_KEY || env.FAL_API_KEY));
  const hasReplicate = Boolean(env && (env.REPLICATE_API_TOKEN || env.REPLICATE_KEY || env.REPLICATE_API_KEY));
  const hasWaveSpeed = Boolean(env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY));

  let modelsList = [];
  let managedAgentsStatus = 'not_tested';
  const aKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
  if (aKey) {
    try {
      // 0. Get available models
      try {
        const mRes = await fetch('https://api.anthropic.com/v1/models?limit=20', {
          headers: { 'x-api-key': aKey, 'anthropic-version': '2023-06-01' }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          modelsList = (mData.data || []).map(m => m.id);
        }
      } catch (_) {}

      // 1. Check existing agents or create Claude Sonnet 5.5 agent
      const listRes = await fetch('https://api.anthropic.com/v1/agents?limit=10', {
        headers: {
          'x-api-key': aKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'managed-agents-2026-04-01'
        }
      });
      const listData = await listRes.json();
      const allAgents = listData.data || [];
      
      // Specifically identify or create a Claude Sonnet 5.5 agent!
      let sonnetAgent = allAgents.find(a => {
        const m = typeof a.model === 'string' ? a.model : (a.model?.id || '');
        return m.includes('sonnet-5-5') || m.includes('sonnet-5') || a.name.includes('sonnet');
      });
      let agentId = sonnetAgent ? sonnetAgent.id : null;
      let agentCreationLog = null;

      if (!agentId || url.searchParams.get('recreate_agent') === 'true') {
        const maRes = await fetch('https://api.anthropic.com/v1/agents', {
          method: 'POST',
          headers: {
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: 'runnerflo-sonnet-5-5-architect',
            model: 'claude-sonnet-5-5',
            system: 'You are Claude Sonnet 5.5 — Autonomous Lead Full-Stack Architect for Runnerflo. You design modern, responsive, visually stunning, multi-file web applications deployable to Cloudflare Pages. Never force dark theme unless user specifically requests dark theme. Always adapt theme, palette, and typography to user instructions.'
          })
        });
        const created = await maRes.json();
        agentCreationLog = created;
        if (created && created.id) {
          agentId = created.id;
          allAgents.unshift(created);
        }
      }

      // 2. Check or create Environment
      let envId = null;
      let envError = null;
      try {
        const envListRes = await fetch('https://api.anthropic.com/v1/environments?limit=1', {
          headers: {
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01'
          }
        });
        const envListData = await envListRes.json();
        envId = (envListData && envListData.data && envListData.data[0] && envListData.data[0].id) || null;

        if (!envId) {
          const createEnvRes = await fetch('https://api.anthropic.com/v1/environments', {
            method: 'POST',
            headers: {
              'x-api-key': aKey,
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'managed-agents-2026-04-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              name: 'runnerflo-sandbox-env',
              config: {
                type: 'cloud',
                networking: { type: 'unrestricted' }
              }
            })
          });
          const createEnvData = await createEnvRes.json();
          if (createEnvData && createEnvData.id) {
            envId = createEnvData.id;
          } else {
            envError = JSON.stringify(createEnvData);
          }
        }
      } catch (errEnv) {
        envError = errEnv.message;
      }

      // 3. Test Session Creation & Event Dispatch
      let sessStatus = 'skipped';
      let eventStatus = 'none';
      const targetSessId = inspectSessionId || null;

      if (inspectSessionId) {
        // Poll existing session events
        const evRes = await fetch(`https://api.anthropic.com/v1/sessions/${inspectSessionId}/events?limit=30`, {
          headers: {
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01'
          }
        });
        const evData = await evRes.json();
        eventStatus = {
          session: inspectSessionId,
          status: evRes.status,
          count: evData && evData.data ? evData.data.length : 0,
          events: (evData && evData.data ? evData.data.map(d => ({
            type: d.type,
            text: (d.content && d.content[0] && d.content[0].text) ? d.content[0].text.slice(0, 150) : null
          })) : [])
        };
        sessStatus = `Inspected ${inspectSessionId}`;
      } else if (envId) {
        sessStatus = 'Ready. Use ?session=<session_id> to inspect live session.';
      }

      managedAgentsStatus = {
        agentId,
        sonnetAgentFound: Boolean(sonnetAgent),
        agentCreationLog,
        allAgents: allAgents.map(a => ({ id: a.id, name: a.name, model: a.model })),
        envId,
        sessionStatus: sessStatus,
        eventStatus
      };
    } catch (e) {
      managedAgentsStatus = `Error: ${e.message}`;
    }
  }

  return new Response(JSON.stringify({
    project: 'runnerflo-b2b',
    totalum: hasTotalum,
    anthropic: hasAnthropic,
    anthropicPrefix: anthropicPrefix,
    anthropicModels: modelsList,
    managedAgents: managedAgentsStatus,
    vertex: hasVertex,
    gemini: hasGemini,
    openai: hasOpenAI,
    trigger: hasTrigger,
    composio: hasComposio,
    // 4 Core Aggregators for PaaS Model Gateway
    openrouter: hasOpenRouter,
    fal: hasFal,
    replicate: hasReplicate,
    wavespeed: hasWaveSpeed,
    ready: hasTotalum || hasAnthropic || hasVertex || hasGemini || hasOpenAI,
    message: hasTotalum
      ? 'Totalum v2 Full-Stack Next.js Engine siap dan aktif.'
      : (hasAnthropic ? 'Claude API siap dan aktif.' : 'TOTALUM_API_KEY atau ANTHROPIC_API_KEY belum disetel di Cloudflare Pages Environment variables.')
  }, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
