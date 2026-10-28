// Cloudflare Pages Function: /api/status (Diagnostic status for Runnerflo B2B)
export async function onRequest(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const hasAnthropic = Boolean(env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY));
  const hasVertex = Boolean(env && (env.VERTEX_PROJECT_ID || env.VERTEX_API_KEY || env.GOOGLE_ACCESS_TOKEN));
  const hasGemini = Boolean(env && (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_KEY));
  const hasOpenAI = Boolean(env && env.OPENAI_API_KEY);

  return new Response(JSON.stringify({
    project: 'runnerflo-b2b',
    anthropic: hasAnthropic,
    vertex: hasVertex,
    gemini: hasGemini,
    openai: hasOpenAI,
    ready: hasAnthropic || hasVertex || hasGemini || hasOpenAI,
    message: hasAnthropic
      ? 'Claude API siap dan aktif.'
      : 'ANTHROPIC_API_KEY belum diisi di Cloudflare Pages Environment variables (runnerflo-b2b).'
  }, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
