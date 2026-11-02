// Cloudflare Pages Function: /api/ai/[[path]]
// Runnerflo AI & Tripo 3D AI Gateway
// Handles: Tripo 3D (Text-to-Model, Image-to-Model, Status Polling, GLB Proxy)
//          Claude Sonnet 5.5 (3D Three.js Game Generator & Game Refiner)

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. HEALTH / MODELS STATUS
  if (pathname === '/api/ai/models') {
    const anthropicKey = Boolean(env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY));
    const tripoKey = Boolean(env && (env.TRIPO_API_KEY || env.TRIPO_KEY));
    const makeKey = Boolean(env && env.MAKE_API_KEY);

    return new Response(JSON.stringify({
      status: 'active',
      services: {
        claudeSonnet: { active: anthropicKey, model: 'claude-sonnet-5-5' },
        tripo3d: { active: tripoKey, engine: 'v3.1-20260211' },
        makeOrchestrator: { active: makeKey }
      }
    }), { status: 200, headers: corsHeaders });
  }

  // 2. TRIPO 3D TEXT-TO-MODEL CREATION
  if (pathname === '/api/ai/tripo-text-to-model' && request.method === 'POST') {
    try {
      const tripoKey = (env && (env.TRIPO_API_KEY || env.TRIPO_KEY)) || '';
      if (!tripoKey) {
        return new Response(JSON.stringify({
          error: 'TRIPO_API_KEY belum dikonfigurasi di Cloudflare Pages.'
        }), { status: 422, headers: corsHeaders });
      }

      const body = await request.json().catch(() => ({}));
      const promptText = (body.prompt || '').trim();
      if (!promptText) {
        return new Response(JSON.stringify({
          error: 'Prompt teks wajib diisi untuk membuat model 3D Tripo.'
        }), { status: 400, headers: corsHeaders });
      }

      const tripoRes = await fetch('https://openapi.tripo3d.ai/v3/generation/text-to-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tripoKey}`
        },
        body: JSON.stringify({
          prompt: promptText,
          model: 'v3.1-20260211',
          texture: true,
          pbr: true,
          texture_quality: 'detailed'
        })
      });

      const tripoData = await tripoRes.json();
      if (!tripoRes.ok || tripoData.code !== 0) {
        return new Response(JSON.stringify({
          error: `Tripo 3D Error: ${tripoData.message || JSON.stringify(tripoData)}`
        }), { status: 502, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        success: true,
        taskId: tripoData.data ? tripoData.data.task_id : null,
        data: tripoData.data
      }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 3. TRIPO 3D IMAGE-TO-MODEL CREATION
  if (pathname === '/api/ai/tripo-create' && request.method === 'POST') {
    try {
      const tripoKey = (env && (env.TRIPO_API_KEY || env.TRIPO_KEY)) || '';
      if (!tripoKey) {
        return new Response(JSON.stringify({
          error: 'TRIPO_API_KEY belum dikonfigurasi di Cloudflare Pages.'
        }), { status: 422, headers: corsHeaders });
      }

      const body = await request.json().catch(() => ({}));
      const imageInput = body.image || body.input;
      if (!imageInput) {
        return new Response(JSON.stringify({
          error: 'Gambar wajib diunggah untuk membuat model 3D.'
        }), { status: 400, headers: corsHeaders });
      }

      let tripoInput = imageInput;

      if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
        try {
          const match = imageInput.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Str = match[2];
            const binaryStr = atob(base64Str);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const ext = mimeType.includes('png') ? 'png' : (mimeType.includes('webp') ? 'webp' : 'jpg');
            const fileBlob = new Blob([bytes], { type: mimeType });

            const uploadForm = new FormData();
            uploadForm.append('file', fileBlob, `upload.${ext}`);

            const uploadRes = await fetch('https://openapi.tripo3d.ai/v3/files', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${tripoKey}` },
              body: uploadForm
            });

            const uploadData = await uploadRes.json();
            if (uploadRes.ok && uploadData.code === 0 && uploadData.data && uploadData.data.file_token) {
              tripoInput = uploadData.data.file_token;
            } else {
              return new Response(JSON.stringify({
                error: `Gagal upload gambar ke Tripo: ${uploadData.message || JSON.stringify(uploadData)}`
              }), { status: 502, headers: corsHeaders });
            }
          }
        } catch (uploadErr) {
          return new Response(JSON.stringify({
            error: `Gagal memproses file gambar: ${uploadErr.message}`
          }), { status: 500, headers: corsHeaders });
        }
      }

      const tripoPayload = {
        model: 'v3.1-20260211',
        texture: true,
        pbr: true,
        texture_quality: 'standard'
      };
      if (typeof tripoInput === 'string' && tripoInput.startsWith('file_')) {
        tripoPayload.file = { type: 'png', file_token: tripoInput };
        tripoPayload.input = tripoInput;
      } else {
        tripoPayload.input = tripoInput;
      }

      const tripoRes = await fetch('https://openapi.tripo3d.ai/v3/generation/image-to-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tripoKey}`
        },
        body: JSON.stringify(tripoPayload)
      });

      const tripoData = await tripoRes.json();
      if (!tripoRes.ok || tripoData.code !== 0) {
        return new Response(JSON.stringify({
          error: `Tripo 3D Error: ${tripoData.message || JSON.stringify(tripoData)}`
        }), { status: 502, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        success: true,
        taskId: tripoData.data ? tripoData.data.task_id : null,
        data: tripoData.data
      }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 4. TRIPO 3D TASK STATUS POLLING
  if (pathname === '/api/ai/tripo-status') {
    try {
      const tripoKey = (env && (env.TRIPO_API_KEY || env.TRIPO_KEY)) || '';
      if (!tripoKey) {
        return new Response(JSON.stringify({
          error: 'TRIPO_API_KEY belum dikonfigurasi di Cloudflare Pages.'
        }), { status: 422, headers: corsHeaders });
      }

      const taskId = url.searchParams.get('taskId');
      if (!taskId) {
        return new Response(JSON.stringify({ error: 'taskId query parameter is required' }), { status: 400, headers: corsHeaders });
      }

      const tripoRes = await fetch(`https://openapi.tripo3d.ai/v3/tasks/${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': `Bearer ${tripoKey}` }
      });

      const tripoData = await tripoRes.json();
      if (!tripoRes.ok || tripoData.code !== 0) {
        return new Response(JSON.stringify({
          error: `Tripo 3D Status Error: ${tripoData.message || JSON.stringify(tripoData)}`
        }), { status: 502, headers: corsHeaders });
      }

      const task = tripoData.data || {};
      const status = task.status; // queued, running, success, failed
      const progress = task.progress || 0;
      let glbUrl = null;

      if (status === 'success' && task.output) {
        glbUrl = task.output.model_url || task.output.pbr_model || task.output.model || null;
      }

      const proxyGlbUrl = glbUrl ? ('/api/ai/proxy-model?url=' + encodeURIComponent(glbUrl)) : null;

      return new Response(JSON.stringify({
        success: true,
        status,
        progress,
        glbUrl,
        proxyGlbUrl,
        task
      }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 5. CORS PROXY FOR 3D GLB MODELS (Solves Three.js GLTFLoader CORS blocking)
  if (pathname === '/api/ai/proxy-model') {
    const rawUrl = url.searchParams.get('url');
    if (!rawUrl) {
      return new Response('Query parameter "url" is required', { status: 400, headers: corsHeaders });
    }
    try {
      const glbRes = await fetch(rawUrl);
      if (!glbRes.ok) {
        return new Response(`Failed to fetch 3D model: ${glbRes.statusText}`, { status: glbRes.status, headers: corsHeaders });
      }
      const modelBuffer = await glbRes.arrayBuffer();
      return new Response(modelBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'model/gltf-binary',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    } catch (proxyErr) {
      return new Response(`Proxy error: ${proxyErr.message}`, { status: 500, headers: corsHeaders });
    }
  }

  // 6. CLAUDE SONNET 5.5 3D GAME GENERATOR
  if (pathname === '/api/ai/generate' || pathname === '/api/ai/generate-game') {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const prompt = (body.prompt || body.text || '').trim();
      const glbModelUrl = (body.glbModelUrl || '').trim();
      const style = body.style || '3D Hyper-Realistic Arcade';

      let safeGlbUrl = glbModelUrl;
      if (safeGlbUrl && (safeGlbUrl.startsWith('http://') || safeGlbUrl.startsWith('https://'))) {
        safeGlbUrl = `${url.origin}/api/ai/proxy-model?url=${encodeURIComponent(safeGlbUrl)}`;
      }

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt ide game tidak boleh kosong' }), { status: 400, headers: corsHeaders });
      }

      const anthropicKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
      if (!anthropicKey) {
        return new Response(JSON.stringify({
          error: 'ANTHROPIC_API_KEY belum dikonfigurasi di Cloudflare Pages.'
        }), { status: 422, headers: corsHeaders });
      }

      const SYSTEM_PROMPT = `Buatkan game 3D Three.js lengkap dalam 1 file HTML executable mandiri sesuai instruksi pengguna.
Gaya: Hyper-realistic, pencahayaan alami (daylight cerah), tekstur procedural nyata.
Semua kontrol (WASD, Arrow, Touch Joystick) wajib responsif.
Web Audio API programatik untuk efek suara.
OUTPUT HANYA kode HTML mentah dimulai <!DOCTYPE html> dan diakhiri </html>. Nol markdown, nol code fence.
${safeGlbUrl ? `Gunakan THREE.GLTFLoader untuk memuat model 3D player dari URL: "${safeGlbUrl}".` : ''}`;

      const candidateModels = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'];
      let generatedHtml = null;

      for (const model of candidateModels) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model,
              max_tokens: 16000,
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: `Buatkan game 3D lengkap untuk: "${prompt}". Gaya: ${style}. Mulai langsung dengan <!DOCTYPE html>` }]
            })
          });

          if (!res.ok) continue;

          const data = await res.json();
          const textBlock = (data.content || []).find(b => b.type === 'text');
          if (textBlock && textBlock.text) {
            generatedHtml = textBlock.text.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
            break;
          }
        } catch (e) {
          console.warn('Game generate model error:', model, e.message);
        }
      }

      if (!generatedHtml) {
        return new Response(JSON.stringify({ error: 'Claude API gagal menghasilkan game. Pastikan ANTHROPIC_API_KEY aktif.' }), { status: 502, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        success: true,
        html: generatedHtml,
        title: prompt.slice(0, 40)
      }), { status: 200, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 7. CLAUDE GAME REFINER
  if (pathname === '/api/ai/refine' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const existingHtml = (body.html || '').trim();
      const instruction = (body.instruction || '').trim();

      if (!existingHtml || !instruction) {
        return new Response(JSON.stringify({ error: 'HTML dan instruksi perbaikan wajib diisi.' }), { status: 400, headers: corsHeaders });
      }

      const anthropicKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
      if (!anthropicKey) {
        return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY belum dikonfigurasi.' }), { status: 422, headers: corsHeaders });
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5-5',
          max_tokens: 16000,
          system: 'Kamu adalah ahli Three.js. Modifikasi kode HTML game sesuai instruksi. Kembalikan HANYA seluruh kode HTML utuh dimulai <!DOCTYPE html> diakhiri </html> tanpa markdown.',
          messages: [{ role: 'user', content: `INSTRUKSI: ${instruction}\n\nKODE LENGKAP SAAT INI:\n${existingHtml.slice(0, 150000)}` }]
        })
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Gagal menghubungi Claude untuk refine' }), { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      const textBlock = (data.content || []).find(b => b.type === 'text');
      const cleanHtml = (textBlock?.text || '').trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

      return new Response(JSON.stringify({ success: true, html: cleanHtml }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // CLAUDE CHAT PROXY — for AI Agents (Lumo, Nara, Narasi, Nova)
  // Route: POST /api/ai/chat
  if (pathname === '/api/ai/chat' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      let { messages = [], system = '', model = 'claude-3-5-sonnet-20241022', stream = false, max_tokens = 2048 } = body;

      const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key') || '';
      const cleanHeaderKey = authHeader.replace(/^Bearer\s+/i, '').trim();
      const envKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
      const anthropicKey = cleanHeaderKey || envKey;

      // Normalize messages
      const formattedMessages = [];
      for (const m of (Array.isArray(messages) ? messages : [])) {
        if (!m) continue;
        const role = (m.role === 'assistant' || m.role === 'agent') ? 'assistant' : 'user';
        let content = m.content;
        if (typeof content !== 'string' && !Array.isArray(content)) content = m.text || '';
        if (content) formattedMessages.push({ role, content });
      }
      if (formattedMessages.length === 0) formattedMessages.push({ role: 'user', content: 'Halo' });

      if (!anthropicKey) {
        // Graceful fallback without API key
        const lastMsg = formattedMessages[formattedMessages.length - 1]?.content || '';
        const agentName = (typeof system === 'string' ? system : '').match(/KAMU ADALAH ([A-Z]+)/i)?.[1] || 'AI';
        const fallbackTxt = `Halo! Saya ${agentName}. Untuk menggunakan layanan ini, administrator perlu mengonfigurasi API key Claude di pengaturan Cloudflare Pages. Silakan hubungi admin Runnerflo untuk informasi lebih lanjut.`;
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: fallbackTxt }],
          text: fallbackTxt,
          model: 'fallback',
          stop_reason: 'end_turn'
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const modelCandidates = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307'
      ];

      // Normalize model alias
      const resolvedModel = modelCandidates.includes(model) ? model : modelCandidates[0];

      // Build Anthropic request body
      const reqBody = {
        model: resolvedModel,
        max_tokens: Math.min(Number(max_tokens) || 2048, 4096),
        messages: formattedMessages
      };
      if (system && typeof system === 'string' && system.trim()) {
        reqBody.system = system.trim();
      }

      for (const candidate of modelCandidates) {
        reqBody.model = candidate;
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify(reqBody)
        });

        if (anthropicRes.ok) {
          const data = await anthropicRes.json();
          const textStr = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
          return new Response(JSON.stringify({ ...data, text: textStr }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const errData = await anthropicRes.json().catch(() => ({}));
        // If model not found, try next; otherwise return error immediately
        if (anthropicRes.status !== 404 && anthropicRes.status !== 400) {
          return new Response(JSON.stringify({ error: errData.error?.message || 'Claude API error', status: anthropicRes.status }), {
            status: anthropicRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Semua model Claude tidak tersedia saat ini.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers: corsHeaders });
}
