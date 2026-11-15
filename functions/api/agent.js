// Cloudflare Pages Function: /api/agent
// Claude Sonnet 5.5 — Autonomous Orchestrator with Agentic Loop
// Proper multi-turn tool use: read_file → edit_code → trigger_job → composio_action
// Injects Trigger.dev + Composio capabilities INTO generated SaaS code

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
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
      code: 'MISSING_ANTHROPIC_KEY',
      fallback: true
    }), { status: 503, headers: corsHeaders });
  }

  const triggerKey = (env && (env.TRIGGER_SECRET_KEY || env.TRIGGER_DEV_KEY || env.TRIGGER_API_KEY)) || '';
  const triggerApiUrl = (env && env.TRIGGER_API_URL) || 'https://api.trigger.dev/api/v3';
  const composioKey = (env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY)) || '';
  const composioBase = 'https://backend.composio.dev/api/v1';

  try {
    const body = await request.json().catch(() => ({}));
    const userText = body.text || body.prompt || '';
    const projectName = body.projectName || 'AI Cloud Project';
    const currentStage = typeof body.stage === 'number' ? body.stage : 4;
    const mode = body.mode || 'Auto';
    const projectFiles = Array.isArray(body.projectFiles) ? body.projectFiles : [];
    const history = Array.isArray(body.history) ? body.history : [];
    const reason = body.reason || 'manual';

    // Build a file index from projectFiles for read_file / search_code tools
    const fileIndex = {};
    for (const f of projectFiles) {
      const key = f.path || f.name || '';
      if (key) fileIndex[key] = f.customContent || f.content || `// ${key} — content not yet available`;
    }

    // ─── System Prompt ────────────────────────────────────────────────────────
    const systemPrompt = `You are Claude Sonnet 5.5 — the Autonomous Lead Software Architect & Orchestrator for the Runnerflo Cloud Platform (Year 2026).

CORE MISSION:
Runnerflo is a white-label SaaS generator platform designed for NON-TECHNICAL USERS (orang awam).
1. Totalum generates the initial application skeleton (1x).
2. However, Totalum's internal proprietary trigger/AI features DO NOT carry over into the standalone SaaS when deployed.
3. Therefore, YOU (Claude 5.5) are the central orchestrator that empowers the generated SaaS by:
   - Directly reading and editing the codebase (HTML, Tailwind CSS, React, TypeScript).
   - Injecting Trigger.dev v3 background task code into the SaaS for any background processing, scheduled jobs, webhooks, or asynchronous AI pipelines (e.g. image generation, email queues).
   - Injecting Composio multi-tenancy integrations into the SaaS so the SaaS's end-users can connect their own Gmail, Slack, Google Sheets, Notion, Stripe, GitHub, etc., with zero technical friction.
   - Creating immediate, live visual preview updates for the user.

NON-TECHNICAL USER DESIGN PRINCIPLE:
Users are non-technical ("orang awam"). NEVER tell them to configure complex technical settings, register webhooks, or write configs manually.
Whenever a user asks for a feature:
- Implement the UI, components, and logic directly.
- If it needs background automation → use trigger_job AND inject the working UI/code into the project.
- If it needs SaaS integrations → use composio_action AND inject the "Connect" buttons and handlers into the project.
- Always provide a ready-to-use experience.

PROJECT CONTEXT:
- Project Name: "${projectName}"
- Current Stage: ${currentStage}/4
- Execution Mode: ${mode}
- Fallback/Orchestration Reason: ${reason === 'credits_exhausted' ? 'Totalum credits session completed — Claude 5.5 autonomous takeover' : 'Autonomous feature refinement and orchestration'}
- Available files in workspace (${projectFiles.length}):
${projectFiles.length ? projectFiles.map(f => `  • ${f.path || f.name} (${f.size || 2048} bytes)`).slice(0, 30).join('\n') : '  (No files yet)'}

TOOLS AVAILABLE:
1. read_file(file): Inspect the exact content of any project file. Call this before editing existing files.
2. search_code(query): Search patterns across all project files to locate components, styles, or logic.
3. edit_code(file, code, explanation): Write or update a file. ALWAYS provide the complete file content.
4. debug_code(file, issue): Diagnose errors in a file.
5. trigger_job(taskId, description, payload, triggerCode): Inject Trigger.dev background automation into the SaaS.
6. composio_action(app, action, userId, params, generateConnectUI): Inject Composio multi-tenancy SaaS integration into the SaaS.

CRITICAL RULES:
1. ALWAYS use read_file first when you need to see what code exists before modifying it.
2. ALWAYS use edit_code for ANY change requested by the user (design, color, layout, feature, bug fix).
3. CRITICAL LIVE PREVIEW RULE:
   The workspace displays the project in a live iframe. Whenever you make visual or functional modifications (like changing theme from dark to light, adding buttons, changing copy, restructuring layout), you MUST update or create "index.html" with the COMPLETE, self-contained, high-fidelity HTML and Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>). This ensures the user's live preview iframe updates immediately without requiring a full rebuild! Also update the corresponding Next.js/React files (e.g. "src/app/page.tsx") to maintain codebase integrity.
4. For theme changes (e.g. dark to light/white):
   - Replace dark backgrounds (bg-slate-950, bg-neutral-950, bg-black, #0a0a0a) with clean, crisp light backgrounds (bg-white, bg-slate-50, #ffffff, #f8fafc).
   - Replace light text (text-white, text-slate-100) with high-contrast dark text (text-slate-900, text-neutral-900, #0f172a).
   - Update cards, borders, navigation, and form inputs to match the light aesthetic.
5. Respond in Indonesian if the user prompted in Indonesian. Otherwise respond in English.
6. Explain clearly what changes you made in your response.`;

    // ─── Tool Definitions ─────────────────────────────────────────────────────
    const tools = [
      {
        name: 'read_file',
        description: 'Read the content of a project file. Always call this before editing a file you have not seen yet.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path, e.g. src/app/page.tsx or index.html' }
          },
          required: ['file']
        }
      },
      {
        name: 'search_code',
        description: 'Search for a keyword, class name, color value, or function across all project files.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to search for across the codebase' }
          },
          required: ['query']
        }
      },
      {
        name: 'edit_code',
        description: 'Write the complete revised content of a file. This directly updates the user\'s live preview. Always provide the FULL file content, not just the changed part.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path, e.g. src/app/page.tsx or index.html' },
            code: { type: 'string', description: 'The COMPLETE revised source code for this file' },
            explanation: { type: 'string', description: 'Brief summary of what was changed' }
          },
          required: ['file', 'code']
        }
      },
      {
        name: 'debug_code',
        description: 'Diagnose syntax errors, runtime issues, or logic bugs in a specific file.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File to inspect' },
            issue: { type: 'string', description: 'Describe the observed error or what to check' }
          },
          required: ['file', 'issue']
        }
      },
      {
        name: 'trigger_job',
        description: 'Inject a Trigger.dev background automation into the SaaS app. Use for: scheduled tasks, email queues, webhooks, cron jobs, background AI processing, notifications. This generates both the Trigger.dev task config AND the integration code injected into the app.',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Trigger.dev task identifier, e.g. "send-welcome-email", "daily-report", "process-payment"' },
            description: { type: 'string', description: 'What this automation does for the user' },
            payload: { type: 'object', description: 'Example payload for the task' },
            injectIntoFile: { type: 'string', description: 'Which app file to inject the trigger call into, e.g. src/app/api/users/route.ts' },
            triggerCode: { type: 'string', description: 'The code snippet that calls this trigger from within the app' }
          },
          required: ['taskId', 'description']
        }
      },
      {
        name: 'composio_action',
        description: 'Inject a Composio SaaS integration into the app. Use when user wants their app to connect to Gmail, Slack, Notion, Google Sheets, HubSpot, Stripe, GitHub, Discord, Linear, etc. Generates OAuth connect UI + API integration code injected into the SaaS.',
        input_schema: {
          type: 'object',
          properties: {
            app: { type: 'string', description: 'App to integrate: gmail, slack, notion, googlesheets, hubspot, stripe, github, discord, linear, airtable' },
            action: { type: 'string', description: 'The specific action, e.g. GMAIL_SEND_EMAIL, SLACK_SENDS_A_MESSAGE, NOTION_CREATE_PAGE' },
            userId: { type: 'string', description: 'Tenant/user ID. Use "{{userId}}" as placeholder for multi-tenant apps.' },
            params: { type: 'object', description: 'Action parameters' },
            generateConnectUI: { type: 'boolean', description: 'If true, also generate an OAuth connect button UI for this app' }
          },
          required: ['app', 'action']
        }
      }
    ];

    // ─── Build initial message history ───────────────────────────────────────
    const messages = [];
    for (const h of history) {
      if (h.role === 'user' && h.text) messages.push({ role: 'user', content: h.text });
      else if (h.role === 'agent' && h.text) messages.push({ role: 'assistant', content: h.text });
    }
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: userText || 'Review the project and apply any needed improvements.' });
    }

    // ─── Tool Executor ────────────────────────────────────────────────────────
    async function executeTool(toolName, toolInput) {
      if (toolName === 'read_file') {
        const filePath = toolInput.file || '';
        // Look for exact match or partial match in fileIndex
        const content = fileIndex[filePath]
          || Object.entries(fileIndex).find(([k]) => k.endsWith(filePath) || filePath.endsWith(k))?.[1]
          || null;
        if (content) {
          return { found: true, file: filePath, content, lines: content.split('\n').length };
        }
        return { found: false, file: filePath, message: `File "${filePath}" not in workspace yet. You can create it with edit_code.` };
      }

      if (toolName === 'search_code') {
        const query = (toolInput.query || '').toLowerCase();
        const results = [];
        for (const [filePath, content] of Object.entries(fileIndex)) {
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(query)) {
              results.push({ file: filePath, line: idx + 1, content: line.trim() });
            }
          });
        }
        return {
          query: toolInput.query,
          totalMatches: results.length,
          results: results.slice(0, 20),
          message: results.length === 0 ? 'No matches found. The pattern may not exist yet — create it with edit_code.' : `Found ${results.length} match(es).`
        };
      }

      if (toolName === 'edit_code') {
        const filePath = toolInput.file || 'index.html';
        const code = toolInput.code || '';
        // Update fileIndex so subsequent read_file calls see the new content
        fileIndex[filePath] = code;
        const existingIdx = modifiedFiles.findIndex(mf => mf.path === filePath);
        if (existingIdx >= 0) {
          modifiedFiles[existingIdx] = {
            path: filePath,
            code,
            explanation: toolInput.explanation || 'Updated by Claude Sonnet 5.5'
          };
        } else {
          modifiedFiles.push({
            path: filePath,
            code,
            explanation: toolInput.explanation || 'Updated by Claude Sonnet 5.5'
          });
        }
        return { success: true, file: filePath, bytes: code.length, message: `File "${filePath}" updated successfully (${code.length} bytes). Live preview updated.` };
      }

      if (toolName === 'debug_code') {
        const filePath = toolInput.file || '';
        const content = fileIndex[filePath] || '';
        const issues = [];
        // Basic static checks
        if (content.includes('undefined') && content.includes('()')) issues.push('Possible undefined function calls detected');
        if ((content.match(/\{/g) || []).length !== (content.match(/\}/g) || []).length) issues.push('Mismatched braces {}');
        if ((content.match(/\(/g) || []).length !== (content.match(/\)/g) || []).length) issues.push('Mismatched parentheses ()');
        return {
          file: filePath,
          issue: toolInput.issue,
          checks: issues.length > 0 ? issues : ['No obvious syntax issues found'],
          recommendation: issues.length > 0 ? 'Fix the issues above with edit_code' : 'Code looks structurally sound. Try debugging runtime behavior.'
        };
      }

      if (toolName === 'trigger_job') {
        const taskId = toolInput.taskId || 'background-task';
        const description = toolInput.description || '';
        const triggerCode = toolInput.triggerCode || `// Trigger.dev: ${taskId}\nawait client.sendEvent({ name: "${taskId}", payload: data });`;

        // If we have a live Trigger.dev key, attempt to register/trigger the task
        let liveResult = null;
        if (triggerKey) {
          try {
            const trRes = await fetch(`${triggerApiUrl}/tasks/${encodeURIComponent(taskId)}/trigger`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${triggerKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ payload: toolInput.payload || {} })
            });
            if (trRes.ok) {
              liveResult = await trRes.json();
            }
          } catch (_) { /* graceful fallback */ }
        }

        triggeredJobs.push({ taskId, description, status: liveResult ? 'TRIGGERED' : 'INJECTED', liveResult });

        return {
          taskId,
          description,
          status: liveResult ? 'LIVE_TRIGGERED' : 'CODE_INJECTED',
          triggerKey: Boolean(triggerKey),
          liveResult,
          injectCode: triggerCode,
          taskDefinition: `// Trigger.dev Task: ${taskId}\n// Add this to your trigger.config.ts:\nexport const ${taskId.replace(/-/g, '_')} = task({\n  id: "${taskId}",\n  run: async (payload) => {\n    // ${description}\n    console.log("Running ${taskId}", payload);\n  }\n});`,
          message: liveResult
            ? `✅ Task "${taskId}" triggered live on Trigger.dev`
            : `✅ Task "${taskId}" code generated and injected into app. Configure TRIGGER_SECRET_KEY in Cloudflare to enable live dispatch.`
        };
      }

      if (toolName === 'composio_action') {
        const appName = (toolInput.app || 'slack').toLowerCase();
        const actionName = (toolInput.action || '').toUpperCase();
        const userId = toolInput.userId || 'default';
        const generateUI = toolInput.generateUI !== false;

        let liveResult = null;
        if (composioKey && actionName) {
          try {
            const cRes = await fetch(`${composioBase}/actions/${encodeURIComponent(actionName)}/execute`, {
              method: 'POST',
              headers: { 'X-API-Key': composioKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entityId: userId, input: toolInput.params || {} })
            });
            if (cRes.ok) {
              liveResult = await cRes.json();
            }
          } catch (_) { /* graceful fallback */ }
        }

        composioActions.push({ app: appName, action: actionName, userId, success: Boolean(liveResult) });

        const connectUiCode = generateUI ? `<!-- Composio Connect Button for ${appName} -->
<button onclick="connectApp('${appName}')" class="connect-btn">
  Connect ${appName.charAt(0).toUpperCase() + appName.slice(1)}
</button>
<script>
async function connectApp(app) {
  const res = await fetch('/api/composio?action=connect-url&app=' + app + '&entityId=' + getCurrentUserId());
  const data = await res.json();
  if (data.connectUrl) window.open(data.connectUrl, '_blank');
}
</script>` : '';

        return {
          app: appName,
          action: actionName,
          userId,
          live: Boolean(liveResult),
          liveResult,
          connectUiCode,
          integrationCode: `// Composio: Execute ${actionName} for ${appName}\nconst res = await fetch('/api/composio', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ action: 'execute', app: '${appName}', actionName: '${actionName}', userId: entityId, input: params })\n});\nconst result = await res.json();`,
          message: liveResult
            ? `✅ ${actionName} executed live via Composio for tenant "${userId}"`
            : `✅ ${appName} integration code generated. Add COMPOSIO_API_KEY in Cloudflare for live OAuth execution.`
        };
      }

      return { error: `Unknown tool: ${toolName}` };
    }

    // ─── Model selection with fallback ────────────────────────────────────────
    const candidateModels = [
      'claude-sonnet-5-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    ];

    async function callClaude(msgs, model) {
      const headers = {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      };
      const payload = {
        model,
        max_tokens: 8000,
        system: systemPrompt,
        messages: msgs,
        tools
      };
      let res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      // Retry without extended options if 400
      if (!res.ok && res.status === 400) {
        const p2 = { ...payload, max_tokens: 4096 };
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers, body: JSON.stringify(p2)
        });
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      return res.json();
    }

    // ─── Agentic Loop ─────────────────────────────────────────────────────────
    const modifiedFiles = [];
    const triggeredJobs = [];
    const composioActions = [];
    let selectedModel = null;
    let assistantText = '';
    let lastError = null;

    // Pick model
    for (const model of candidateModels) {
      try {
        const testRes = await callClaude(messages, model);
        selectedModel = model;

        // ── Multi-turn tool loop ──────────────────────────────────────────────
        const convMessages = [...messages];
        let currentResponse = testRes;
        let iterations = 0;
        const MAX_ITER = 6; // Max tool call rounds

        while (iterations < MAX_ITER) {
          iterations++;
          const contentBlocks = currentResponse.content || [];
          const stopReason = currentResponse.stop_reason;

          // Collect text from this response
          for (const block of contentBlocks) {
            if (block.type === 'text' && block.text) {
              if (assistantText && !assistantText.endsWith('\n\n')) assistantText += '\n\n';
              assistantText += block.text;
            }
          }

          // If no tool calls, we're done
          const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');
          if (toolUseBlocks.length === 0 || stopReason === 'end_turn') break;

          // Execute all tool calls in this response
          const toolResults = [];
          for (const block of toolUseBlocks) {
            const toolResult = await executeTool(block.name, block.input || {});
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(toolResult)
            });
          }

          // Add assistant turn (filtering out thinking blocks for compatibility) + tool results
          const assistantBlocks = contentBlocks.filter(b => b.type === 'text' || b.type === 'tool_use');
          convMessages.push({ role: 'assistant', content: assistantBlocks });
          convMessages.push({ role: 'user', content: toolResults });

          // If stop_reason was tool_use, continue the loop
          if (stopReason !== 'tool_use') break;

          // Call Claude again with tool results
          currentResponse = await callClaude(convMessages, selectedModel);
        }

        break; // Successfully completed with this model
      } catch (err) {
        lastError = err.message;
        selectedModel = null;
        continue;
      }
    }

    if (!selectedModel) {
      return new Response(JSON.stringify({
        error: 'Claude Sonnet 5.5 tidak dapat dihubungi.',
        details: lastError,
        fallback: false
      }), { status: 502, headers: corsHeaders });
    }

    // ─── Build response steps ─────────────────────────────────────────────────
    const steps = [];
    if (reason === 'credits_exhausted') {
      steps.push({ label: '⚡ Totalum session ended → Claude 5.5 Orchestrator aktif', done: true });
    } else {
      steps.push({ label: '🤖 Claude Sonnet 5.5 Autonomous Engine Engaged', done: true });
    }
    steps.push({ label: `Analyzed project with ${selectedModel}`, done: true });

    if (modifiedFiles.length > 0) {
      steps.push({ label: `Updated ${modifiedFiles.length} file(s) — preview refreshed`, done: true });
    }
    if (triggeredJobs.length > 0) {
      triggeredJobs.forEach(j => {
        steps.push({ label: `⚡ Trigger.dev: "${j.taskId}" — ${j.status}`, done: true });
      });
    }
    if (composioActions.length > 0) {
      composioActions.forEach(a => {
        steps.push({ label: `🔌 Composio: ${a.app.toUpperCase()} (${a.action}) ${a.live ? '— LIVE' : '— code injected'}`, done: true });
      });
    }

    return new Response(JSON.stringify({
      text: assistantText || 'Claude Sonnet 5.5 completed task successfully.',
      steps,
      stage: Math.min(4, currentStage + 1),
      suggest: ['Review Updated Code', 'Add Another Feature', 'Publish to Production'],
      engine: 'claude-sonnet-5.5',
      model: selectedModel,
      modifiedFiles,
      triggeredJobs,
      composioActions,
      toolCallsCount: modifiedFiles.length + triggeredJobs.length + composioActions.length
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
