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
  const hasVertex = Boolean(env && (env.VERTEX_PROJECT_ID || env.VERTEX_API_KEY || env.GOOGLE_ACCESS_TOKEN));
  const hasGemini = Boolean(env && (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_KEY));
  const hasOpenAI = Boolean(env && env.OPENAI_API_KEY);
  const hasTrigger = Boolean(env && (env.TRIGGER_SECRET_KEY || env.TRIGGER_DEV_KEY || env.TRIGGER_API_KEY));
  const hasComposio = Boolean(env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY));
  const hasOpenRouter = Boolean(env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY));
  const hasFal = Boolean(env && (env.FAL_KEY || env.FAL_API_KEY));
  const hasReplicate = Boolean(env && (env.REPLICATE_API_TOKEN || env.REPLICATE_KEY || env.REPLICATE_API_KEY));
  const hasWaveSpeed = Boolean(env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY));

  return new Response(JSON.stringify({
    project: 'runnerflo-b2b',
    totalum: hasTotalum,
    anthropic: hasAnthropic,
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
