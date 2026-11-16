// Cloudflare Pages Function: /api/gateway
// Central AI API Gateway & Metering Router (OpenRouter, fal.ai, Replicate, WaveSpeed)
// All white-label SaaS frontends call ONLY this endpoint. PaaS owner holds all keys.

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-project-id, x-tenant-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET: Health & Status check of the Gateway
  if (request.method === 'GET') {
    const keys = {
      openrouter: Boolean(env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY)),
      fal: Boolean(env && (env.FAL_KEY || env.FAL_API_KEY)),
      replicate: Boolean(env && (env.REPLICATE_API_TOKEN || env.REPLICATE_KEY || env.REPLICATE_API_KEY)),
      wavespeed: Boolean(env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY))
    };

    return new Response(JSON.stringify({
      ok: true,
      service: 'Runnerflo Central AI API Gateway',
      version: '2026.1',
      activeProviders: keys,
      allReady: keys.openrouter && keys.fal && keys.replicate && keys.wavespeed,
      message: 'Gateway active. Forwarding inference calls to OpenRouter, fal.ai, Replicate, and WaveSpeed.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let provider = (body.provider || '').toLowerCase();
    const model = body.model || body.modelId || '';
    const input = body.input || body.params || body.payload || {};

    if (!model) {
      return new Response(JSON.stringify({
        error: 'Missing required field: "model"'
      }), { status: 400, headers: corsHeaders });
    }

    // Auto-detect provider from model name if not explicitly passed
    if (!provider) {
      if (model.startsWith('fal-ai/') || model.includes('tripo3d') || model.includes('flux/')) {
        provider = 'fal';
      } else if (model.includes('deepseek') || model.includes('anthropic/') || model.includes('openai/gpt') || model.includes('llama-3')) {
        provider = 'openrouter';
      } else if (model.includes('stability-ai') || model.includes('whisper') || model.includes('musicgen')) {
        provider = 'replicate';
      } else if (model.includes('pixverse') || model.includes('wavespeed') || model.includes('minimax')) {
        provider = 'wavespeed';
      } else {
        provider = 'openrouter'; // default fallback
      }
    }

    // ─── 1. OpenRouter (LLM / Chat / Text Generation) ───────────────────────
    if (provider === 'openrouter') {
      const apiKey = (env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY)) || '';
      if (!apiKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'OPENROUTER_API_KEY belum disetel di Cloudflare Pages secrets.',
          simulated: true,
          provider: 'openrouter',
          model,
          output: `[Simulated OpenRouter Response for ${model}]: Provide OPENROUTER_API_KEY in Cloudflare for live execution.`
        }), { status: 200, headers: corsHeaders });
      }

      // Format messages
      const messages = Array.isArray(input.messages)
        ? input.messages
        : [{ role: 'user', content: input.prompt || input.text || 'Hello' }];

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://runnerflo-b2b.pages.dev',
          'X-Title': 'Runnerflo B2B PaaS',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.max_tokens || 2048,
          response_format: input.response_format
        })
      });

      const orData = await orRes.json();
      if (!orRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          error: orData.error?.message || `OpenRouter HTTP ${orRes.status}`,
          provider: 'openrouter',
          model
        }), { status: orRes.status, headers: corsHeaders });
      }

      const replyText = orData.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({
        ok: true,
        provider: 'openrouter',
        model,
        result: replyText,
        usage: orData.usage,
        raw: orData
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 2. fal.ai (Fast Real-Time Media, 3D & Video) ───────────────────────
    if (provider === 'fal') {
      const apiKey = (env && (env.FAL_KEY || env.FAL_API_KEY)) || '';
      if (!apiKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'FAL_KEY belum disetel di Cloudflare Pages secrets.',
          simulated: true,
          provider: 'fal',
          model,
          output: {
            url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
            note: `[Simulated fal.ai result for ${model}]. Set FAL_KEY in Cloudflare for live generation.`
          }
        }), { status: 200, headers: corsHeaders });
      }

      // Remove "fal-ai/" prefix if targeting endpoint route directly
      const endpointId = model.startsWith('fal-ai/') ? model : `fal-ai/${model}`;

      const falRes = await fetch(`https://fal.run/${endpointId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const falData = await falRes.json();
      if (!falRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          error: falData.detail || `fal.ai HTTP ${falRes.status}`,
          provider: 'fal',
          model
        }), { status: falRes.status, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        ok: true,
        provider: 'fal',
        model,
        result: falData
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 3. Replicate (Media, Audio, 3D, Specialist AI) ────────────────────
    if (provider === 'replicate') {
      const apiKey = (env && (env.REPLICATE_API_TOKEN || env.REPLICATE_KEY || env.REPLICATE_API_KEY)) || '';
      if (!apiKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'REPLICATE_API_TOKEN belum disetel di Cloudflare Pages secrets.',
          simulated: true,
          provider: 'replicate',
          model,
          output: {
            url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1200',
            note: `[Simulated Replicate result for ${model}]. Set REPLICATE_API_TOKEN in Cloudflare for live generation.`
          }
        }), { status: 200, headers: corsHeaders });
      }

      // Support model in format "owner/model_name"
      let url = 'https://api.replicate.com/v1/predictions';
      let payload = { input };

      if (model.includes('/')) {
        url = `https://api.replicate.com/v1/models/${model}/predictions`;
        payload = { input };
      }

      const repRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait' // synchronous wait whenever possible
        },
        body: JSON.stringify(payload)
      });

      const repData = await repRes.json();
      if (!repRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          error: repData.detail || `Replicate HTTP ${repRes.status}`,
          provider: 'replicate',
          model
        }), { status: repRes.status, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        ok: true,
        provider: 'replicate',
        model,
        result: repData.output || repData
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 4. WaveSpeed (Video, Audio & Real-Time Models) ─────────────────────
    if (provider === 'wavespeed') {
      const apiKey = (env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY)) || '';
      if (!apiKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'WAVESPEED_API_KEY belum disetel di Cloudflare Pages secrets.',
          simulated: true,
          provider: 'wavespeed',
          model,
          output: {
            note: `[Simulated WaveSpeed result for ${model}]. Set WAVESPEED_API_KEY in Cloudflare for live generation.`
          }
        }), { status: 200, headers: corsHeaders });
      }

      const wsRes = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const wsData = await wsRes.json();
      return new Response(JSON.stringify({
        ok: wsRes.ok,
        provider: 'wavespeed',
        model,
        result: wsData
      }), { status: wsRes.ok ? 200 : wsRes.status, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown provider: "${provider}". Supported: openrouter, fal, replicate, wavespeed.`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
