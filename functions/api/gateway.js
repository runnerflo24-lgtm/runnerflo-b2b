// Cloudflare Pages Function: /api/gateway
// Central AI API Gateway & Metering Router (OpenRouter, fal.ai, Replicate, WaveSpeed)
// All white-label SaaS frontends call ONLY this endpoint. PaaS owner holds all keys.

// ─── Pillar B-03: Sliding-Window Multi-Tenant Rate Limiter ───────────────────
const TENANT_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const TENANT_MAX_REQ_PER_MIN = 60; // 60 requests per minute per tenant
const tenantRateMap = new Map(); // paasId -> Array of timestamps

function checkTenantRateLimit(paasId) {
  const now = Date.now();
  let timestamps = tenantRateMap.get(paasId) || [];
  timestamps = timestamps.filter(t => now - t < TENANT_RATE_WINDOW_MS);

  if (timestamps.length >= TENANT_MAX_REQ_PER_MIN) {
    const oldest = timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + TENANT_RATE_WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      count: timestamps.length,
      limit: TENANT_MAX_REQ_PER_MIN,
      retryAfter
    };
  }

  timestamps.push(now);
  tenantRateMap.set(paasId, timestamps);

  // Periodic eviction
  if (tenantRateMap.size > 2000) {
    for (const [k, v] of tenantRateMap.entries()) {
      if (!v.length || now - v[v.length - 1] > TENANT_RATE_WINDOW_MS) {
        tenantRateMap.delete(k);
      }
    }
  }

  return {
    allowed: true,
    count: timestamps.length,
    limit: TENANT_MAX_REQ_PER_MIN,
    remaining: Math.max(0, TENANT_MAX_REQ_PER_MIN - timestamps.length)
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-project-id, x-tenant-id, x-paas-id, x-end-user-id',
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
      wavespeed: Boolean(env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY)),
      langsmith: Boolean(env && (env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY || env.LANGSMITH_KEY)),
      composio: Boolean(env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY))
    };

    return new Response(JSON.stringify({
      ok: true,
      service: 'Runnerflo Meta-PaaS Central AI & Agent Gateway',
      version: '2026.2',
      activeProviders: keys,
      core4Ready: keys.openrouter && keys.fal && keys.replicate && keys.wavespeed,
      langsmithReady: keys.langsmith,
      composioReady: keys.composio,
      message: 'Meta-PaaS Central Gateway active. All child PaaS platforms route exclusively to Runnerflo.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    // Composite Tenant Identity standard: {paas_id}:{end_user_id}
    const paasId = body.paas_id || body.paasId || body.tenantId || request.headers.get('x-paas-id') || request.headers.get('x-tenant-id') || 'default-paas';
    const endUserId = body.end_user_id || body.endUserId || body.userId || request.headers.get('x-end-user-id') || request.headers.get('x-user-id') || 'default-user';
    const compositeId = `${paasId}:${endUserId}`;

    // ─── Pillar B-03: Sliding-Window Multi-Tenant Rate Limiter ───────────────
    const rateCheck = checkTenantRateLimit(paasId);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Tenant rate limit exceeded (max ${rateCheck.limit} req/min). Please slow down.`,
        paasId,
        limit: rateCheck.limit,
        retryAfter: rateCheck.retryAfter
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(rateCheck.retryAfter),
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': '0'
        }
      });
    }

    const responseHeaders = {
      ...corsHeaders,
      'X-RateLimit-Limit': String(rateCheck.limit),
      'X-RateLimit-Remaining': String(rateCheck.remaining)
    };

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
        tenantId: compositeId,
        paasId,
        endUserId,
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
        tenantId: compositeId,
        paasId,
        endUserId,
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
        tenantId: compositeId,
        paasId,
        endUserId,
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
        tenantId: compositeId,
        paasId,
        endUserId,
        provider: 'wavespeed',
        model,
        result: wsData
      }), { status: wsRes.ok ? 200 : wsRes.status, headers: corsHeaders });
    }

    // ─── 5. Custom API Proxy / LangSmith Deep Agent Dispatcher ──────────────
    if (provider === 'custom' || provider === 'tripo3d' || provider === 'langsmith') {
      const endpoint = body.endpoint || body.url || '';
      const method = (body.method || 'POST').toUpperCase();
      const customHeaders = body.headers || {};
      const customPayload = body.payload || input;
      const tenantId = body.tenantId || request.headers.get('x-tenant-id') || 'default-tenant';

      // LangSmith tracing & state headers
      const langsmithKey = env && (env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY);
      if (langsmithKey) {
        customHeaders['x-api-key'] = langsmithKey;
      }

      // Tripo 3D integration
      if (endpoint.includes('tripo3d') || provider === 'tripo3d' || model.includes('tripo')) {
        const tripoKey = env && (env.TRIPO3D_API_KEY || env.TRIPO_KEY || env.TRIPO_API_KEY);
        if (tripoKey) {
          customHeaders['Authorization'] = `Bearer ${tripoKey}`;
        }
      }

      if (endpoint && endpoint.startsWith('http')) {
        const customRes = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            ...customHeaders
          },
          body: method !== 'GET' ? JSON.stringify(customPayload) : undefined
        });
        const customData = await customRes.json().catch(() => ({ status: customRes.status }));
        return new Response(JSON.stringify({
          ok: customRes.ok,
          provider: provider || 'custom',
          tenantId,
          result: customData
        }), { status: customRes.ok ? 200 : customRes.status, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        ok: true,
        provider: provider || 'custom',
        tenantId,
        message: 'Custom Meta-PaaS API gateway routed successfully.',
        data: customPayload
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown provider: "${provider}". Supported: openrouter, fal, replicate, wavespeed, custom, tripo3d, langsmith.`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
