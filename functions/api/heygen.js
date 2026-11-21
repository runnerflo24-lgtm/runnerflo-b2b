// Cloudflare Pages Function: /api/heygen
// Dedicated Zero-BYOK HeyGen API Gateway supporting Avatar 6 & Trigger.dev Background Dispatch
// Documentation: HeyGen Avatar 6 (v3/models/avatars) & Video Generation Engine

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'info';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-use-trigger, x-tenant-id, x-paas-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const HEYGEN_KEY = (env && (env.HEYGEN_API_KEY || env.HEYGEN_KEY)) || '';
  const TRIGGER_KEY = (env && (env.TRIGGER_SECRET_KEY || env.TRIGGER_DEV_KEY || env.TRIGGER_API_KEY)) || '';
  const TRIGGER_URL = (env && env.TRIGGER_API_URL) || 'https://api.trigger.dev/api/v3';

  // GET: Health / Capability Status
  if (request.method === 'GET' && action === 'info') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'HeyGen Avatar 6 & Video Gateway',
      configured: Boolean(HEYGEN_KEY),
      hasTriggerDev: Boolean(TRIGGER_KEY),
      models: [
        {
          id: 'heygen-avatar-6',
          name: 'HeyGen Avatar 6 (Pro)',
          description: 'Flagship audio-driven AI avatar model with script-linked context-aware gestures, 2K/1080p resolution, and 84.4% indistinguishability rating.',
          type: 'avatar-6'
        },
        {
          id: 'heygen-avatar-6-turbo',
          name: 'HeyGen Avatar 6 Turbo',
          description: 'Accelerated low-latency Avatar 6 inference optimized for high-volume video pipelines.',
          type: 'avatar-6'
        }
      ],
      actions: ['avatar-6', 'generate-video', 'init-upload', 'complete-upload', 'list-avatars', 'list-voices', 'video-status', 'list-videos']
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (!HEYGEN_KEY) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'HEYGEN_API_KEY belum disetel di Cloudflare Pages Environment Variables.',
      simulated: true,
      hint: 'Tambahkan HEYGEN_API_KEY di Cloudflare Pages Dashboard -> Settings -> Environment Variables.'
    }), { status: 503, headers: corsHeaders });
  }

  const heygenFetch = async (path, options = {}) => {
    return await fetch(`https://api.heygen.com${path}`, {
      ...options,
      headers: {
        'x-api-key': HEYGEN_KEY,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  };

  try {
    // ─── 1. HEYGEN AVATAR 6: Model API (POST /v3/models/avatars) ───────────────
    // Directly animates a short video clip or image + speech audio track
    // with context-aware gestures & motion_prompt. No training wait needed!
    if (action === 'avatar-6' || action === 'avatar6') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST required for action=avatar-6' }), { status: 405, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const useTrigger = body.useTrigger === true || request.headers.get('x-use-trigger') === 'true';

      // If user wants Trigger.dev async background execution to prevent Cloudflare Worker timeout
      if (useTrigger && TRIGGER_KEY) {
        try {
          const triggerRes = await fetch(`${TRIGGER_URL}/tasks/heygen-avatar-6/trigger`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${TRIGGER_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ payload: body })
          });
          if (triggerRes.ok) {
            const triggerData = await triggerRes.json();
            return new Response(JSON.stringify({
              ok: true,
              dispatchedToTrigger: true,
              runId: triggerData.id,
              status: 'QUEUED_IN_TRIGGER_DEV',
              message: 'Avatar 6 job successfully queued in Trigger.dev background worker to prevent Cloudflare timeout.'
            }), { status: 202, headers: corsHeaders });
          }
        } catch (_) { /* fallback to standard async call */ }
      }

      // Structure HeyGen Avatar 6 Model API payload
      const model = body.model || 'heygen-avatar-6';
      const payload = {
        model,
        resolution: body.resolution || '1080p',
        motion_prompt: body.motion_prompt || 'Natural engaging gestures, confident posture and friendly facial expression.'
      };

      // Reference media: can be video or image
      if (body.reference_videos && Array.isArray(body.reference_videos)) {
        payload.reference_videos = body.reference_videos;
      } else if (body.video_url) {
        payload.reference_videos = [{ type: 'url', url: body.video_url }];
      } else if (body.video_asset_id) {
        payload.reference_videos = [{ type: 'asset_id', asset_id: body.video_asset_id }];
      } else if (body.reference_images && Array.isArray(body.reference_images)) {
        payload.reference_images = body.reference_images;
      } else if (body.image_url) {
        payload.reference_images = [{ type: 'url', url: body.image_url }];
      } else if (body.image_asset_id) {
        payload.reference_images = [{ type: 'asset_id', asset_id: body.image_asset_id }];
      } else if (body.image_base64) {
        payload.reference_images = [{ type: 'base64', media_type: body.image_type || 'image/jpeg', data: body.image_base64 }];
      }

      // Audio / Speech input
      if (body.audio) {
        payload.audio = body.audio;
      } else if (body.audio_url) {
        payload.audio = { type: 'url', url: body.audio_url };
      } else if (body.audio_asset_id) {
        payload.audio = { type: 'asset_id', asset_id: body.audio_asset_id };
      }

      const res = await heygenFetch('/v3/models/avatars', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        ok: res.ok,
        data: data.data || data,
        error: data.error || null,
        provider: 'heygen',
        model
      }), { status: res.status, headers: corsHeaders });
    }

    // ─── 2. HEYGEN APPLICATION API: Generate Video (POST /v2/video/generate) ──
    if (action === 'generate-video') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST required for action=generate-video' }), { status: 405, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const useTrigger = body.useTrigger === true || request.headers.get('x-use-trigger') === 'true';

      if (useTrigger && TRIGGER_KEY) {
        try {
          const triggerRes = await fetch(`${TRIGGER_URL}/tasks/heygen-video/trigger`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${TRIGGER_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ payload: body })
          });
          if (triggerRes.ok) {
            const triggerData = await triggerRes.json();
            return new Response(JSON.stringify({
              ok: true,
              dispatchedToTrigger: true,
              runId: triggerData.id,
              status: 'QUEUED_IN_TRIGGER_DEV',
              message: 'HeyGen Video queued in Trigger.dev background worker.'
            }), { status: 202, headers: corsHeaders });
          }
        } catch (_) {}
      }

      const payload = {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: body.avatar_id || 'Angela-inblackskirt-20220820',
            avatar_style: body.avatar_style || 'normal'
          },
          voice: {
            type: body.voice_type || 'text',
            input_text: body.script || body.text || 'Halo, ini adalah video demo dari Runnerflo Avatar.',
            voice_id: body.voice_id || 'en-US-JennyNeural',
            speed: typeof body.speed === 'number' ? body.speed : 1.0
          },
          background: {
            type: 'color',
            value: body.background_color || '#ffffff'
          }
        }],
        dimension: {
          width: body.width || 1280,
          height: body.height || 720
        },
        title: body.title || 'Runnerflo AI Talking Avatar'
      };

      const res = await heygenFetch('/v2/video/generate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        ok: res.ok,
        data: data.data || data,
        error: data.error || null
      }), { status: res.status, headers: corsHeaders });
    }

    // ─── 3. ASSET DIRECT UPLOAD (Step 1: Init S3 Presigned URL) ────────────────
    if (action === 'init-upload' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const res = await heygenFetch('/v3/assets/direct-uploads', {
        method: 'POST',
        body: JSON.stringify({
          file_name: body.file_name || 'sample_avatar.mp4',
          file_type: body.file_type || 'video',
          content_type: body.content_type || 'video/mp4',
          size_bytes: body.size_bytes || 0
        })
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // ─── 4. ASSET COMPLETE UPLOAD (Step 2: Mark upload complete) ───────────────
    if (action === 'complete-upload' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const assetId = body.asset_id;
      if (!assetId) {
        return new Response(JSON.stringify({ error: 'asset_id required' }), { status: 400, headers: corsHeaders });
      }
      const res = await heygenFetch(`/v3/assets/${assetId}/complete`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // ─── 5. LIST AVATARS ───────────────────────────────────────────────────────
    if (action === 'list-avatars') {
      const res = await heygenFetch('/v2/avatars');
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // ─── 6. LIST VOICES ────────────────────────────────────────────────────────
    if (action === 'list-voices') {
      const res = await heygenFetch('/v2/voices');
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // ─── 7. CHECK VIDEO STATUS (Poll for completion) ───────────────────────────
    if (action === 'video-status' || action === 'status') {
      const videoId = url.searchParams.get('video_id') || url.searchParams.get('id');
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'video_id required' }), { status: 400, headers: corsHeaders });
      }
      const res = await heygenFetch(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // ─── 8. LIST VIDEOS ────────────────────────────────────────────────────────
    if (action === 'list-videos') {
      const limit = url.searchParams.get('limit') || '20';
      const res = await heygenFetch(`/v1/video.list?limit=${limit}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown action: "${action}".`,
      availableActions: ['info', 'avatar-6', 'generate-video', 'init-upload', 'complete-upload', 'list-avatars', 'list-voices', 'video-status', 'list-videos']
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message
    }), { status: 500, headers: corsHeaders });
  }
}
