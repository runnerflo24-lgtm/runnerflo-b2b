// Cloudflare Pages Function: /api/agent (Claude AI Engine for Runnerflo B2B)
export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders
    });
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

    const systemPrompt = `You are the Runnerflo B2B AI Agent Workspace. You are an expert product builder and AI engineer helping clients build high-performance web platforms, edtech solutions, dashboards, and digital products.
Project Name: "${projectName}"
Current Stage: ${currentStage} (0: Inisialisasi, 1: Konsep & Landing Page, 2: Katalog & Modul, 3: Dashboard Progres, 4: Interaktif & Selesai)
Mode: ${mode}
Build Action: ${build}

Strict instructions:
1. Always reply in clear, professional, friendly Indonesian (or match client's language).
2. You MUST return ONLY a raw JSON object with NO markdown formatting, NO \`\`\`json code fences, NO extraneous commentary outside the JSON.
3. The JSON structure MUST be exactly:
{
  "text": "Your detailed explanation of what has been constructed, advised, or configured.",
  "steps": ["Step 1 completed", "Step 2 completed", "Step 3 completed"],
  "stage": <integer 0 to 4, normally advance stage if build requested or keep current stage if just asking>,
  "suggest": ["Short suggestion 1 for next step", "Short suggestion 2", "Short suggestion 3"]
}`;

    const formattedMessages = [];
    // Include last few messages for conversation context
    for (const h of history) {
      if (h.role === 'user' && h.text) {
        formattedMessages.push({ role: 'user', content: h.text });
      } else if (h.role === 'agent' && h.text) {
        formattedMessages.push({ role: 'assistant', content: h.text });
      }
    }
    // Ensure the latest message is added
    if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].content !== userText) {
      formattedMessages.push({ role: 'user', content: userText || 'Mulai rancang platform saya.' });
    }

    const candidateModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku-20241022'
    ];

    let lastError = null;
    let agentResult = null;

    for (const model of candidateModels) {
      try {
        const payload = {
          model: model,
          max_tokens: 1500,
          system: systemPrompt,
          messages: formattedMessages
        };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Claude API error (${model}):`, response.status, errText);
          lastError = `${model} returned status ${response.status}: ${errText}`;
          continue;
        }

        const data = await response.json();
        const textBlock = (data.content || []).find(b => b.type === 'text');
        if (textBlock && textBlock.text) {
          let raw = textBlock.text.trim();
          // Strip potential markdown backticks if returned
          if (raw.startsWith('```')) {
            raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          }
          try {
            agentResult = JSON.parse(raw);
            agentResult.model = model;
            break;
          } catch (pe) {
            // If model returned plain text instead of JSON, format it gracefully
            agentResult = {
              text: raw,
              steps: ['Analisis spesifikasi kebutuhan', 'Menyusun arsitektur sistem'],
              stage: Math.min(4, currentStage + 1),
              suggest: ['Lihat pratinjau live', 'Tambahkan fitur kustom'],
              model: model
            };
            break;
          }
        }
      } catch (e) {
        lastError = e.message;
        console.warn(`Network/fetch error for ${model}:`, e);
      }
    }

    if (agentResult) {
      return new Response(JSON.stringify(agentResult), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      error: 'Claude API invocation failed',
      details: lastError,
      fallback: true
    }), { status: 502, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      fallback: true
    }), { status: 500, headers: corsHeaders });
  }
}
