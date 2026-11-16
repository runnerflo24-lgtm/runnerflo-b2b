// Cloudflare Pages Function: /api/status (Diagnostic status for Runnerflo B2B)
export async function onRequest(context) {
  const { env } = context;

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

  let managedAgentsStatus = 'not_tested';
  const aKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
  if (aKey) {
    try {
      // 1. Check existing agents or create one
      const listRes = await fetch('https://api.anthropic.com/v1/agents?limit=1', {
        headers: {
          'x-api-key': aKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'managed-agents-2026-04-01'
        }
      });
      const listData = await listRes.json();
      let agentId = (listData && listData.data && listData.data[0] && listData.data[0].id) || null;

      if (!agentId) {
        const maRes = await fetch('https://api.anthropic.com/v1/agents', {
          method: 'POST',
          headers: {
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: 'runnerflo-saas-architect',
            model: 'claude-haiku-5-5',
            system: 'You are the Autonomous SaaS Architect for Runnerflo.'
          })
        });
        const created = await maRes.json();
        agentId = created.id;
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

      // 3. Test Session Creation
      let sessStatus = 'skipped';
      if (envId) {
        const sessRes = await fetch('https://api.anthropic.com/v1/sessions', {
          method: 'POST',
          headers: {
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            agent: agentId,
            environment_id: envId,
            title: 'runnerflo-diagnostic-session'
          })
        });
        const sessData = await sessRes.text();
        sessStatus = `HTTP ${sessRes.status}: ${sessData}`;
      } else {
        sessStatus = `No Env ID. EnvError: ${envError}`;
      }

      managedAgentsStatus = {
        agentId,
        envId,
        sessionStatus: sessStatus
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
