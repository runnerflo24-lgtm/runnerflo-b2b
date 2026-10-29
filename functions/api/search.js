// Cloudflare Pages Function: /api/search
// Runnerflo Scout — AI Pencari Peluang Kerja & Klien
// Stack: Cloudflare AI Web Search (Ceramic.ai) + Claude Haiku 5.5
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

  const anthropicKey = (env && (env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY)) || '';
  if (!anthropicKey) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY belum disetel.',
      fallback: true
    }), { status: 503, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    // skills: keahlian user (dari web yang mereka buat di Runnerflo)
    // e.g. ["video editor", "desain grafis", "foto produk"]
    const skills = Array.isArray(body.skills) ? body.skills : [body.skill || body.query || 'jasa freelance'];
    const location = body.location || 'Indonesia';
    const limit = Math.min(body.limit || 5, 10);
    const portfolioUrl = body.portfolioUrl || ''; // URL web Runnerflo user

    // ── 1. Generate keyword pencarian yang tepat ───────────────────
    const keywords = generateSearchKeywords(skills, location);

    // ── 2. Search via Cloudflare AI Web Search (Ceramic.ai default) ─
    let searchResults = [];
    try {
      // Cloudflare AI Web Search binding
      if (env.AI && typeof env.AI.websearch === 'function') {
        const searchRes = await env.AI.websearch({
          query: keywords,
          limit,
          provider: 'ceramic' // default, bisa diganti 'exa' atau 'linkup'
        });
        const rawResults = await searchRes.json();
        searchResults = rawResults.results || rawResults || [];
      } else {
        // Fallback: gunakan Cloudflare AI REST endpoint
        const cfAccountId = env.CF_ACCOUNT_ID || '';
        const cfAiToken = env.CF_AI_TOKEN || anthropicKey;
        if (cfAccountId) {
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/search`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${cfAiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query: keywords, limit })
            }
          );
          const data = await res.json();
          searchResults = data.result?.results || [];
        }
      }
    } catch (searchErr) {
      console.warn('Web search error:', searchErr.message);
      // Lanjut ke Claude bahkan tanpa search results (mock demo)
    }

    // ── 3. Claude Haiku 5.5 — Analisis & buat proposal ────────────
    const searchContext = searchResults.length > 0
      ? searchResults.slice(0, limit).map((r, i) =>
          `[${i + 1}] ${r.title || 'Tanpa judul'}\nURL: ${r.url || '-'}\nKonten: ${r.content || r.description || r.snippet || '(tidak ada deskripsi)'}`
        ).join('\n\n')
      : 'Tidak ada hasil pencarian tersedia saat ini.';

    const haikusPrompt = `Kamu adalah Runnerflo Scout — AI pencari peluang kerja dan klien untuk freelancer Indonesia.

KEAHLIAN USER: ${skills.join(', ')}
LOKASI: ${location}
PORTOFOLIO: ${portfolioUrl || 'Belum ada URL portofolio'}
KEYWORD DICARI: "${keywords}"

HASIL PENCARIAN WEB:
${searchContext}

TUGASMU:
Analisis hasil pencarian di atas. Identifikasi peluang kerja/klien yang nyata dan relevan dengan keahlian user.
Untuk setiap peluang, buat draft pesan penawaran jasa yang singkat, sopan, dan profesional dalam Bahasa Indonesia.

KEMBALIKAN HANYA JSON mentah (tanpa markdown):
{
  "summary": "Ringkasan singkat hasil pencarian hari ini",
  "opportunities": [
    {
      "title": "Nama/deskripsi peluang",
      "source": "URL sumber",
      "relevance": "Tinggi|Sedang|Rendah",
      "budget": "Estimasi budget jika ada, atau null",
      "contact": "Info kontak jika ada, atau null",
      "proposal": "Draft pesan penawaran jasa siap kirim (maks 3 kalimat, sertakan link portofolio jika ada)"
    }
  ],
  "nextSearch": "Keyword alternatif yang disarankan untuk pencarian berikutnya",
  "searchedAt": "${new Date().toISOString()}"
}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: haikusPrompt }]
      })
    });

    let scoutResult = null;
    if (claudeRes.ok) {
      const claudeData = await claudeRes.json();
      const textBlock = (claudeData.content || []).find(b => b.type === 'text');
      if (textBlock?.text) {
        let raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        try {
          scoutResult = JSON.parse(raw);
        } catch {
          scoutResult = { summary: raw, opportunities: [], searchedAt: new Date().toISOString() };
        }
      }
    }

    if (!scoutResult) {
      // Fallback jika Claude gagal
      scoutResult = {
        summary: `Pencarian "${keywords}" selesai. Ditemukan ${searchResults.length} hasil.`,
        opportunities: searchResults.slice(0, 3).map(r => ({
          title: r.title || 'Peluang Kerja',
          source: r.url || '-',
          relevance: 'Sedang',
          budget: null,
          contact: null,
          proposal: `Halo, saya tertarik dengan kebutuhan Anda. Saya memiliki keahlian ${skills[0]} dan bisa membantu. ${portfolioUrl ? 'Portofolio saya: ' + portfolioUrl : ''}`
        })),
        nextSearch: `lowongan ${skills[0]} Indonesia 2026`,
        searchedAt: new Date().toISOString()
      };
    }

    scoutResult.keywords = keywords;
    scoutResult.skills = skills;
    scoutResult.rawResultsCount = searchResults.length;
    scoutResult.model = 'claude-haiku-5-5';
    scoutResult.searchProvider = 'Cloudflare AI Web Search (Ceramic.ai)';

    return new Response(JSON.stringify(scoutResult), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, fallback: true }), { status: 500, headers: corsHeaders });
  }
}

// Helper: generate smart search keywords dari keahlian user
function generateSearchKeywords(skills, location) {
  const skill = skills[0] || 'freelance';
  const templates = [
    `butuh ${skill} ${location}`,
    `dicari jasa ${skill}`,
    `cari ${skill} freelance Indonesia`,
    `open order ${skill}`,
    `mau order ${skill}`
  ];
  // Pilih template secara rotasi berdasarkan waktu (variasi per jam)
  const idx = Math.floor(Date.now() / 3600000) % templates.length;
  return templates[idx];
}
