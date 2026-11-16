// Cloudflare Pages Function: /api/catalog
// Unified AI Model Catalog Engine (OpenRouter, fal.ai, Replicate, WaveSpeed)
// Provides real-time and curated model discovery, category filtering, and automated metering/pricing

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const providerFilter = (url.searchParams.get('provider') || 'all').toLowerCase();
  const categoryFilter = (url.searchParams.get('category') || 'all').toLowerCase();
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();
  const marginMultiplier = parseFloat(url.searchParams.get('margin') || '1.30'); // Default 30% margin for PaaS owner

  // Key detection
  const keys = {
    openrouter: (env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY)) || '',
    fal: (env && (env.FAL_KEY || env.FAL_API_KEY)) || '',
    replicate: (env && (env.REPLICATE_API_TOKEN || env.REPLICATE_KEY || env.REPLICATE_API_KEY)) || '',
    wavespeed: (env && (env.WAVESPEED_API_KEY || env.WAVESPEED_KEY)) || ''
  };

  // High-fidelity curated catalog of premier AI models across all 4 aggregators
  // Ensures zero downtime and instant loading even if external APIs rate-limit
  const CURATED_MODELS = [
    // ─── 1. OpenRouter (LLM, Reasoning, Chat, Code) ─────────────────────────
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1 (Reasoning)',
      provider: 'openrouter',
      category: 'llm',
      icon: '🧠',
      contextLength: 64000,
      description: 'State-of-the-art open reasoning model matching OpenAI o1 on math, coding, and logical thinking.',
      basePrice: { promptPerM: 0.55, completionPerM: 2.19 },
      unit: 'per 1M tokens'
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'openrouter',
      category: 'llm',
      icon: '⚡',
      contextLength: 64000,
      description: 'Ultra-fast, cost-efficient frontier general language model for chat, extraction, and content generation.',
      basePrice: { promptPerM: 0.14, completionPerM: 0.28 },
      unit: 'per 1M tokens'
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
      provider: 'openrouter',
      category: 'llm',
      icon: '✨',
      contextLength: 200000,
      description: 'Top-tier code generation, complex system architecture, and adaptive extended thinking.',
      basePrice: { promptPerM: 3.00, completionPerM: 15.00 },
      unit: 'per 1M tokens'
    },
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI GPT-4o',
      provider: 'openrouter',
      category: 'llm',
      icon: '🌐',
      contextLength: 128000,
      description: 'High-speed flagship multimodal model for text, structured JSON outputs, and reasoning.',
      basePrice: { promptPerM: 2.50, completionPerM: 10.00 },
      unit: 'per 1M tokens'
    },
    {
      id: 'google/gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'openrouter',
      category: 'llm',
      icon: '⚡',
      contextLength: 1000000,
      description: '1 Million token context window with near-instant generation speed and multimodal capabilities.',
      basePrice: { promptPerM: 0.10, completionPerM: 0.40 },
      unit: 'per 1M tokens'
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'openrouter',
      category: 'llm',
      icon: '🦙',
      contextLength: 128000,
      description: 'High performance open weights model from Meta, benchmarked on par with GPT-4.',
      basePrice: { promptPerM: 0.12, completionPerM: 0.30 },
      unit: 'per 1M tokens'
    },

    // ─── 2. fal.ai (Ultra-fast Real-time Media, 3D, Video) ───────────────────
    {
      id: 'fal-ai/tripo3d',
      name: 'Tripo3D Mesh Generator',
      provider: 'fal',
      category: '3d',
      icon: '🧊',
      description: 'Rapid 3D asset and mesh synthesis from text or single images with automatic texturing.',
      basePrice: { perRun: 0.02 },
      unit: 'per generation'
    },
    {
      id: 'fal-ai/flux/dev',
      name: 'FLUX.1 [dev]',
      provider: 'fal',
      category: 'image',
      icon: '🎨',
      description: '12B parameter open-weight photorealistic text-to-image model by Black Forest Labs.',
      basePrice: { perRun: 0.025 },
      unit: 'per image'
    },
    {
      id: 'fal-ai/flux-pro/v1.1-ultra',
      name: 'FLUX.1.1 [pro] Ultra (4K)',
      provider: 'fal',
      category: 'image',
      icon: '🖼️',
      description: 'Ultra-crisp 4-megapixel photographic generation with cinematic lighting and typography.',
      basePrice: { perRun: 0.06 },
      unit: 'per image'
    },
    {
      id: 'fal-ai/kling-video/v1.5/pro',
      name: 'Kling 1.5 Video Pro',
      provider: 'fal',
      category: 'video',
      icon: '🎬',
      description: 'High-motion text-to-video and image-to-video synthesis at 1080p cinematic resolution.',
      basePrice: { perRun: 0.14 },
      unit: 'per 5s video'
    },
    {
      id: 'fal-ai/luma-dream-machine',
      name: 'Luma Dream Machine',
      provider: 'fal',
      category: 'video',
      icon: '🎥',
      description: 'Fast, physically-grounded video generation with camera motion controls and realistic physics.',
      basePrice: { perRun: 0.18 },
      unit: 'per generation'
    },
    {
      id: 'fal-ai/recraft-v3',
      name: 'Recraft V3 (Vector & Graphic)',
      provider: 'fal',
      category: 'image',
      icon: '📐',
      description: 'Generates professional vector SVG graphics, brand icons, and raster illustrations with precise brand colors.',
      basePrice: { perRun: 0.04 },
      unit: 'per graphic'
    },

    // ─── 3. Replicate (Media, 3D, Audio, Specialized Models) ─────────────────
    {
      id: 'stability-ai/sdxl',
      name: 'Stable Diffusion XL (SDXL)',
      provider: 'replicate',
      category: 'image',
      icon: '✨',
      description: 'Classic, highly customizable image model with vast LoRA and style community support.',
      basePrice: { perRun: 0.009 },
      unit: 'per image'
    },
    {
      id: 'lucataco/tripo-sr',
      name: 'TripoSR 3D Reconstruction',
      provider: 'replicate',
      category: '3d',
      icon: '💎',
      description: 'Fast 0.5-second feed-forward 3D reconstruction from single portrait or object images.',
      basePrice: { perRun: 0.015 },
      unit: 'per 3D model'
    },
    {
      id: 'openai/whisper',
      name: 'Whisper Large v3',
      provider: 'replicate',
      category: 'audio',
      icon: '🎙️',
      description: 'Speech-to-text audio transcription and translation supporting 99+ languages with timestamps.',
      basePrice: { perRun: 0.005 },
      unit: 'per audio minute'
    },
    {
      id: 'meta/musicgen',
      name: 'MusicGen Stereo',
      provider: 'replicate',
      category: 'audio',
      icon: '🎵',
      description: 'High-quality instrumental and background music synthesis conditioned on text and melodies.',
      basePrice: { perRun: 0.03 },
      unit: 'per song clip'
    },

    // ─── 4. WaveSpeed (Cinematic Video, Voice & Real-Time Models) ───────────
    {
      id: 'pixverse/pixverse-v5.5',
      name: 'PixVerse V5.5 Cinematic Video',
      provider: 'wavespeed',
      category: 'video',
      icon: '🎞️',
      description: 'Ultra-fluid 60fps cinematic video generation with dynamic multi-angle camera motion.',
      basePrice: { perRun: 0.12 },
      unit: 'per video'
    },
    {
      id: 'minimax/speech-2.6-hd',
      name: 'MiniMax Speech 2.6 HD',
      provider: 'wavespeed',
      category: 'audio',
      icon: '🗣️',
      description: 'Ultra-expressive neural text-to-speech with natural breathing, emotion, and voice cloning.',
      basePrice: { perRun: 0.01 },
      unit: 'per 1000 characters'
    },
    {
      id: 'wavespeed-ai/wan-2.1/text-to-video',
      name: 'Wan 2.1 Video Generator',
      provider: 'wavespeed',
      category: 'video',
      icon: '🌊',
      description: 'Next-gen open diffusion video transformer with exceptional prompt adherence and coherent physical motion.',
      basePrice: { perRun: 0.10 },
      unit: 'per video'
    }
  ];

  // Try fetching live models from OpenRouter if key is present
  let allModels = [...CURATED_MODELS];

  if (keys.openrouter && (providerFilter === 'all' || providerFilter === 'openrouter')) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${keys.openrouter}` }
      });
      if (orRes.ok) {
        const orData = await orRes.json();
        const liveOrModels = (orData.data || []).slice(0, 30).map(m => {
          const promptCost = (m.pricing && m.pricing.prompt) ? (parseFloat(m.pricing.prompt) * 1000000) : 0.5;
          const complCost = (m.pricing && m.pricing.completion) ? (parseFloat(m.pricing.completion) * 1000000) : 1.5;
          return {
            id: m.id,
            name: m.name || m.id.split('/').pop(),
            provider: 'openrouter',
            category: 'llm',
            icon: '🧠',
            contextLength: m.context_length || 32000,
            description: m.description ? m.description.slice(0, 160) : 'OpenRouter high-performance language model.',
            basePrice: { promptPerM: parseFloat(promptCost.toFixed(3)), completionPerM: parseFloat(complCost.toFixed(3)) },
            unit: 'per 1M tokens',
            live: true
          };
        });

        // Merge without duplicating IDs
        const existingIds = new Set(allModels.map(m => m.id));
        liveOrModels.forEach(lm => {
          if (!existingIds.has(lm.id)) allModels.push(lm);
        });
      }
    } catch (_) {
      // Fallback gracefully to curated models
    }
  }

  // Calculate Retail Metering / Margins for each model
  const processedModels = allModels.map(m => {
    let clientPriceText = '';
    let basePriceText = '';

    if (m.basePrice.perRun !== undefined) {
      const base = m.basePrice.perRun;
      const client = parseFloat((base * marginMultiplier).toFixed(4));
      basePriceText = `$${base.toFixed(3)} ${m.unit}`;
      clientPriceText = `$${client.toFixed(3)} ${m.unit}`;
    } else if (m.basePrice.promptPerM !== undefined) {
      const baseIn = m.basePrice.promptPerM;
      const baseOut = m.basePrice.completionPerM;
      const clientIn = parseFloat((baseIn * marginMultiplier).toFixed(3));
      const clientOut = parseFloat((baseOut * marginMultiplier).toFixed(3));
      basePriceText = `$${baseIn}/$${baseOut} per 1M tokens`;
      clientPriceText = `$${clientIn}/$${clientOut} per 1M tokens`;
    }

    return {
      ...m,
      hasProviderKey: Boolean(keys[m.provider]),
      pricing: {
        base: m.basePrice,
        baseDisplay: basePriceText,
        margin: Math.round((marginMultiplier - 1) * 100) + '%',
        clientPriceDisplay: clientPriceText,
        unit: m.unit
      }
    };
  });

  // Apply Filters
  const filtered = processedModels.filter(m => {
    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (query) {
      const haystack = (m.id + ' ' + m.name + ' ' + m.description + ' ' + m.category + ' ' + m.provider).toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  // Response payload
  const responseData = {
    ok: true,
    total: filtered.length,
    activeKeys: {
      openrouter: Boolean(keys.openrouter),
      fal: Boolean(keys.fal),
      replicate: Boolean(keys.replicate),
      wavespeed: Boolean(keys.wavespeed)
    },
    supportedProviders: ['openrouter', 'fal', 'replicate', 'wavespeed'],
    supportedCategories: ['llm', 'image', 'video', 'audio', '3d'],
    marginApplied: Math.round((marginMultiplier - 1) * 100) + '%',
    models: filtered
  };

  return new Response(JSON.stringify(responseData, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=300, s-maxage=3600'
    }
  });
}
