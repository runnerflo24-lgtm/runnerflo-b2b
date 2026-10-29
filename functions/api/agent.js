// Cloudflare Pages Function: /api/agent
// Claude Sonnet 5.5 — Build AI Apps & Make Workflows
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  const anthropicKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_KEY)) || '';
  if (!anthropicKey) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY belum disetel di Cloudflare Pages.',
      fallback: true
    }), { status: 503, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const userText = body.text || '';
    const projectName = body.projectName || 'Proyek B2B';
    const currentStage = typeof body.stage === 'number' ? body.stage : 0;
    const mode = body.mode || 'Auto';
    const build = body.build || 'Build';
    const history = Array.isArray(body.history) ? body.history : [];
    const makeApiKey = env.MAKE_API_KEY || '';

    const systemPrompt = `Kamu adalah Runnerflo B2B AI Agent — platform pembangun bisnis berbasis AI untuk UMKM Indonesia.
Proyek: "${projectName}" | Stage: ${currentStage}/4 | Mode: ${mode} | Build: ${build}
Make.com API: ${makeApiKey ? 'tersedia' : 'belum dikonfigurasi'}

KEMAMPUANMU:
1. Bangun platform digital (landing page, katalog, dashboard, sistem booking, dll)
2. Rancang workflow otomasi bisnis menggunakan Make.com (WhatsApp, email, Google Sheets, payment)
3. Buat proposal & strategi bisnis
4. Hubungkan fitur "Runnerflo Scout" — AI pencari klien/peluang kerja

INSTRUKSI KETAT:
- Balas dalam Bahasa Indonesia yang profesional dan ramah
- HANYA kembalikan JSON mentah tanpa markdown, tanpa \`\`\`json, tanpa komentar di luar JSON
- Struktur JSON WAJIB persis:
{
  "text": "Penjelasan detail yang sudah dikerjakan atau disarankan.",
  "steps": ["Langkah 1 selesai", "Langkah 2 selesai", "Langkah 3 selesai"],
  "stage": <integer 0-4, naik jika build diminta>,
  "suggest": ["Saran singkat 1", "Saran singkat 2", "Saran singkat 3"],
  "makeWorkflow": null
}
- Field "makeWorkflow" diisi HANYA jika user minta otomasi/automasi/Make/workflow, isinya object blueprint Make.com scenario. Kalau tidak relevan, isi null.
- Jika makeWorkflow diisi, formatnya:
{
  "name": "Nama Workflow",
  "trigger": "webhook|schedule|email|whatsapp",
  "steps": ["Deskripsi step 1", "Deskripsi step 2"],
  "apps": ["WhatsApp Business", "Gmail", "Google Sheets"]
}`;

    const formattedMessages = [];
    for (const h of history) {
      if (h.role === 'user' && h.text) formattedMessages.push({ role: 'user', content: h.text });
      else if (h.role === 'agent' && h.text) formattedMessages.push({ role: 'assistant', content: h.text });
    }
    if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].content !== userText) {
      formattedMessages.push({ role: 'user', content: userText || 'Mulai rancang platform saya.' });
    }

    // Primary: claude-sonnet-5-5 | Fallback: claude-haiku-5-5
    const candidateModels = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
    let lastError = null;
    let agentResult = null;

    for (const model of candidateModels) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: formattedMessages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model} → ${response.status}: ${errText}`;
          continue;
        }

        const data = await response.json();
        const textBlock = (data.content || []).find(b => b.type === 'text');
        if (textBlock && textBlock.text) {
          let raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          try {
            agentResult = JSON.parse(raw);
            agentResult.model = model;
            break;
          } catch {
            agentResult = {
              text: raw,
              steps: ['Analisis kebutuhan bisnis', 'Menyusun arsitektur platform'],
              stage: Math.min(4, currentStage + 1),
              suggest: ['Tambahkan detail bisnis', 'Aktifkan otomasi Make', 'Jalankan Runnerflo Scout'],
              makeWorkflow: null,
              model
            };
            break;
          }
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (agentResult) return new Response(JSON.stringify(agentResult), { status: 200, headers: corsHeaders });

    return new Response(JSON.stringify({ error: 'Claude API gagal', details: lastError, fallback: true }), {
      status: 502, headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, fallback: true }), { status: 500, headers: corsHeaders });
  }
}
