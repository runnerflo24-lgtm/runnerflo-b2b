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

    // Check if user is asking to build a brand new application from scratch
    const isNewAppRequest = /^\s*(?:build|create|make|buat|buatkan|generate)\b/i.test(userText) ||
      body.isNewApp === true ||
      body.reason === 'new_project' ||
      body.reason === 'from_scratch';

    // Determine if we are editing an existing application (e.g. changing theme, fixing bug, adding feature)
    let isEditingExisting = false;
    let previewFetchStatus = 'none';

    if (!isNewAppRequest) {
      if (body.reason === 'continue_edit' || body.reason === 'manual_edit' || /^\s*(?:ubah|ganti|edit|modify|change|fix|perbaiki|tambah|tambahkan|add|make it|buatkan agar|set)\b/i.test(userText)) {
        isEditingExisting = true;
      }
    }

    const previewUrl = (body.previewUrl || '').trim();
    if (isEditingExisting && previewUrl && previewUrl.startsWith('http')) {
      try {
        const pRes = await fetch(previewUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 Runnerflo-Agent' }
        });
        if (pRes.ok) {
          const liveHtml = await pRes.text();
          if (liveHtml && liveHtml.length > 200) {
            fileIndex['index.html'] = liveHtml;
            previewFetchStatus = `Successfully fetched ${liveHtml.length} bytes from ${previewUrl}`;
          }
        }
      } catch (pErr) {
        previewFetchStatus = `Failed to fetch previewUrl: ${pErr.message}`;
      }
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

${isEditingExisting ? `CRITICAL DIRECTIVE: EDITING EXISTING PRODUCTION APPLICATION (BOLT.DIY MCP ENGINE)
1. YOU ARE IN EDIT MODE for an EXISTING PRODUCTION APPLICATION.
2. The current live application code is loaded in "index.html" (${fileIndex['index.html'] ? fileIndex['index.html'].length : 0} bytes).
3. DO NOT BUILD A NEW GENERIC TEMPLATE FROM ZERO.
4. PRESERVE 100% OF THE BRAND IDENTITY, LOGO & COPYWRITING:
   - If the project is "Vesper Atelier", it MUST REMAIN "Vesper Atelier"! NEVER rename it to "AI Studio" or any generic name!
   - Hero headlines (e.g. "A sentence in. A finished image out."), subtitles, navigation, luxury aesthetics, and image showcases MUST BE 100% PRESERVED!
5. PREFERRED EDITING TOOL: "project_patch_file"
   - First call "project_read_file({ path: 'index.html' })" to inspect the code.
   - Use "project_patch_file({ path: 'index.html', oldText: '...', newText: '...' })" for targeted edits.
   - When the user asks to change theme (e.g. "buatkan agar webnya jadi putih", "ubah jadi tema putih/terang"):
     * Patch dark backgrounds: bg-[#0c0d10] → bg-white, bg-zinc-900 → bg-stone-50, bg-zinc-950 → bg-[#faf9f6].
     * Patch text colors: text-zinc-100 / text-white → text-stone-900 / text-zinc-900, text-zinc-400 → text-stone-600.
     * Patch borders: border-zinc-800 → border-stone-200.
     * Keep all text copy, branding ("Vesper Atelier"), and layout untouched!
6. If you use "project_write_file" or "edit_code", you MUST supply the COMPLETE revised file retaining all original copywriting and sections (never a stripped-down placeholder)!` : `CRITICAL DIRECTIVE: CREATING NEW APPLICATION FROM ZERO (BOLT.DIY MCP ENGINE)
1. YOU ARE IN CREATION MODE. Build a brand new, production-grade application for: "${userText}".
2. You MUST produce a COMPLETE, self-contained, browser-executable HTML5 file in "index.html".
3. Use Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and working interactive JavaScript.
4. Render high-fidelity UI: clean navigation, interactive buttons, realistic mock data, and functional controls.
5. Call "project_write_file({ path: 'index.html', content: '...', replacementReason: 'Initial build from user prompt' })" with the COMPLETE code!`}

CRITICAL PRESERVATION & DESIGN INTEGRITY RULES (BOLT.DIY ARCHITECTURE):
1. ALWAYS inspect "index.html" with project_read_file before editing existing files.
2. STANDALONE RUNNABLE HTML REQUIREMENT:
   The workspace displays the project in a browser iframe.
   "index.html" MUST be a COMPLETE, self-contained, browser-executable HTML5 file with Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and working interactive JavaScript.
3. NEVER leave tool content empty.
4. MANDATORY ACTION OVER CHATTER:
   Do not merely reply with a conversational explanation or plan without executing tool calls. You MUST call "project_patch_file", "project_write_file", or "edit_code" to actually implement the user's request.

NON-TECHNICAL USER DESIGN PRINCIPLE:
Users are non-technical ("orang awam").
- Implement UI, styling, and functionality directly.
- If it needs background automation → use trigger_job AND inject working Trigger.dev client code into the app.
- If it needs SaaS integrations → use composio_action AND inject OAuth connect buttons into the app.

PROJECT CONTEXT:
- Mode: ${isEditingExisting ? 'EDIT_EXISTING_APPLICATION (PRESERVE BRAND, LAYOUT & COPY)' : 'CREATE_NEW_APPLICATION_FROM_SCRATCH'}
- Project Name: "${projectName}"
- Current Stage: ${currentStage}/4
- Execution Mode: ${mode}
- Live Application Preview URL: "${previewUrl || 'none'}" (${previewFetchStatus})
- Available files in workspace (${projectFiles.length}):
${projectFiles.length ? projectFiles.map(f => `  • ${f.path || f.name} (${f.size || 2048} bytes)`).slice(0, 30).join('\n') : '  (No files yet)'}

BOLT.DIY MCP TOOLS:
1. project_read_file({ path }): Read the full content of a project file.
2. project_patch_file({ path, oldText, newText }): Surgically replace oldText with newText. Keeps the rest of the file untouched!
3. project_write_file({ path, content, replacementReason }): Full file creation or overwrite.
4. project_list_paths({ path }): List files in the workspace.
5. project_search_content({ query }): Search across all workspace files.
6. trigger_job(taskId, description, payload, triggerCode): Inject Trigger.dev v3 background task pipeline.
7. composio_action(app, action, userId, params, generateConnectUI): Inject Composio multi-tenancy SaaS OAuth/action.
(Aliases: read_file, edit_code, search_code are also supported)

Respond in Indonesian if the user prompted in Indonesian. Otherwise respond in English. Always summarize what code changes were made.`;

    // ─── Tool Definitions (Bolt.diy MCP + Trigger.dev + Composio) ─────────────
    const tools = [
      {
        name: 'project_read_file',
        description: 'Read the complete UTF-8 content of a project file. Always call this before modifying an existing file.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path, e.g. "index.html" or "src/app/page.tsx"' }
          },
          required: ['path']
        }
      },
      {
        name: 'project_patch_file',
        description: 'Replace one exact, unique text block (oldText) in a file with newText. Read the file first with project_read_file. Recommended for targeted changes, theme/color updates, component additions, and style adjustments without rewriting the entire file.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path, e.g. "index.html"' },
            oldText: { type: 'string', description: 'The exact existing text to replace. Must match uniquely in the file.' },
            newText: { type: 'string', description: 'The replacement text to insert in place of oldText.' }
          },
          required: ['path', 'oldText', 'newText']
        }
      },
      {
        name: 'project_write_file',
        description: 'Create a new file or completely overwrite an existing file. For existing files prefer project_patch_file unless performing a complete rewrite from zero.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path, e.g. "index.html"' },
            content: { type: 'string', description: 'The full source code content (never leave empty)' },
            replacementReason: { type: 'string', description: 'Explanation for writing/replacing the file' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'project_list_paths',
        description: 'List all available files and directories in the active project.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Optional directory prefix, e.g. "src" or "."' }
          }
        }
      },
      {
        name: 'project_search_content',
        description: 'Search for text, class names, color codes, or function names across all project files.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text or keyword to search for' }
          },
          required: ['query']
        }
      },
      // Aliases for backward compatibility
      {
        name: 'read_file',
        description: 'Alias for project_read_file. Inspect the content of a project file.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path, e.g. "index.html"' }
          },
          required: ['file']
        }
      },
      {
        name: 'search_code',
        description: 'Alias for project_search_content. Search across codebase.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to search for' }
          },
          required: ['query']
        }
      },
      {
        name: 'edit_code',
        description: 'Alias for project_write_file. Write or update a file. Always provide complete code.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path, e.g. "index.html"' },
            code: { type: 'string', description: 'Complete source code content' },
            explanation: { type: 'string', description: 'Reason for update' }
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

    // ─── Tool Executor (Bolt.diy Engine) ──────────────────────────────────────
    async function executeTool(toolName, toolInput) {
      // 1. project_patch_file: surgical precision edit (never hallucinate / never overwrite entire file)
      if (toolName === 'project_patch_file') {
        const filePath = toolInput.path || toolInput.file || 'index.html';
        const currentContent = fileIndex[filePath];
        if (typeof currentContent !== 'string') {
          return { error: `File "${filePath}" does not exist in workspace. Available files: ${Object.keys(fileIndex).join(', ')}` };
        }
        const oldText = toolInput.oldText;
        const newText = toolInput.newText !== undefined ? toolInput.newText : '';
        if (!oldText) {
          return { error: 'Parameter "oldText" is required for project_patch_file.' };
        }
        const first = currentContent.indexOf(oldText);
        if (first < 0) {
          return {
            error: `Patch conflict: "oldText" was not found in ${filePath}. Please use project_read_file to verify current contents.`,
            hint: `Searched for: ${oldText.slice(0, 80)}...`
          };
        }
        if (currentContent.indexOf(oldText, first + oldText.length) >= 0) {
          return {
            error: `Patch conflict: "oldText" is ambiguous (matches multiple times in ${filePath}). Include more surrounding context in "oldText" so it matches uniquely.`
          };
        }
        const updated = currentContent.slice(0, first) + newText + currentContent.slice(first + oldText.length);
        fileIndex[filePath] = updated;

        const existingIdx = modifiedFiles.findIndex(mf => mf.path === filePath);
        if (existingIdx >= 0) {
          modifiedFiles[existingIdx] = { path: filePath, code: updated, explanation: `Patched ${filePath}` };
        } else {
          modifiedFiles.push({ path: filePath, code: updated, explanation: `Patched ${filePath}` });
        }
        return { success: true, path: filePath, patched: true, bytes: updated.length, message: `Successfully patched ${filePath} (${updated.length} bytes).` };
      }

      // 2. project_write_file / edit_code: full write
      if (toolName === 'project_write_file' || toolName === 'edit_code') {
        const filePath = toolInput.path || toolInput.file || 'index.html';
        const code = toolInput.content || toolInput.code || toolInput.html || toolInput.source || toolInput.file_content || toolInput.new_content || toolInput.body || '';
        if (!code || code.trim().length === 0) {
          return { error: 'Content cannot be empty. Please provide the complete source code.' };
        }
        fileIndex[filePath] = code;
        const existingIdx = modifiedFiles.findIndex(mf => mf.path === filePath);
        const explanation = toolInput.replacementReason || toolInput.explanation || `Updated ${filePath}`;
        if (existingIdx >= 0) {
          modifiedFiles[existingIdx] = { path: filePath, code, explanation };
        } else {
          modifiedFiles.push({ path: filePath, code, explanation });
        }
        return { success: true, path: filePath, written: true, bytes: code.length, message: `Successfully wrote ${filePath} (${code.length} bytes).` };
      }

      // 3. project_read_file / read_file: inspect file
      if (toolName === 'project_read_file' || toolName === 'read_file') {
        const filePath = toolInput.path || toolInput.file || 'index.html';
        const content = fileIndex[filePath]
          || Object.entries(fileIndex).find(([k]) => k.endsWith(filePath) || filePath.endsWith(k))?.[1]
          || null;
        if (content !== null && content !== undefined) {
          return { path: filePath, content, bytes: content.length, lines: content.split('\n').length };
        }
        return { error: `File "${filePath}" not found. Available files: ${Object.keys(fileIndex).join(', ')}` };
      }

      // 4. project_list_paths: explorer
      if (toolName === 'project_list_paths') {
        return { paths: Object.keys(fileIndex) };
      }

      // 5. project_search_content / search_code: search
      if (toolName === 'project_search_content' || toolName === 'search_code') {
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
          message: results.length === 0 ? 'No matches found.' : `Found ${results.length} match(es).`
        };
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

    // ─── Model selection with dynamic discovery ──────────────────────────────
    let discoveredModels = [];
    try {
      const mListRes = await fetch('https://api.anthropic.com/v1/models?limit=20', {
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }
      });
      if (mListRes.ok) {
        const mJson = await mListRes.json();
        if (Array.isArray(mJson.data)) {
          discoveredModels = mJson.data.map(m => m.id);
        }
      }
    } catch (_) {}

    const candidateModels = (discoveredModels.length > 0 ? discoveredModels : [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-latest',
      'claude-3-7-sonnet-20250219',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229'
    ]).filter((v, i, a) => a.indexOf(v) === i);

    async function callClaude(msgs, model) {
      const headers = {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      };
      const payload = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: msgs,
        tools
      };
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${model} HTTP ${res.status}: ${errText}`);
      }
      return res.json();
    }

    // ─── Agentic Loop ─────────────────────────────────────────────────────────
    const modifiedFiles = [];
    const triggeredJobs = [];
    const composioActions = [];
    const modelAttempts = [];
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

          // If no tool calls, check if Claude only responded with conversational text
          const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');
          if (toolUseBlocks.length === 0) {
            // If Claude only chatted/analyzed and hasn't written or patched any files yet, FORCE Claude to write the code!
            if (modifiedFiles.length === 0 && iterations < MAX_ITER) {
              const assistantBlocks = contentBlocks.filter(b => b.type === 'text');
              convMessages.push({
                role: 'assistant',
                content: assistantBlocks.length ? assistantBlocks : [{ type: 'text', text: assistantText || 'Saya siap memperbarui kode.' }]
              });
              convMessages.push({
                role: 'user',
                content: `PERINTAH SISTEM WAJIB: Anda BELUM memperbarui kode apapun di workspace (modifiedFiles masih kosong)! Permintaan pengguna adalah: "${userText.replace(/"/g, "'")}". Anda WAJIB langsung memanggil "${isEditingExisting ? 'project_patch_file' : 'project_write_file'}" (atau "edit_code") SEKARANG untuk membuat/memperbarui "index.html" dengan kode HTML5 & Tailwind CSS lengkap dan interaktif. Panggil tool sekarang!`
              });
              currentResponse = await callClaude(convMessages, selectedModel);
              continue;
            }
            break;
          }

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

          // If stop_reason was tool_use, or if Claude only read/searched files and hasn't modified code yet, continue loop
          if (stopReason === 'tool_use' || (modifiedFiles.length === 0 && iterations < MAX_ITER)) {
            currentResponse = await callClaude(convMessages, selectedModel);
            continue;
          }

          break;
        }

        break; // Successfully completed with this model
      } catch (err) {
        modelAttempts.push({ model, error: err.message });
        lastError = err.message;
        selectedModel = null;
        continue;
      }
    }

    if (!selectedModel) {
      return new Response(JSON.stringify({
        error: 'Claude Sonnet 5.5 tidak dapat dihubungi.',
        details: lastError,
        modelAttempts,
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
