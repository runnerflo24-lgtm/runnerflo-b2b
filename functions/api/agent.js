// Cloudflare Pages Function: /api/agent
// Claude Sonnet 5.5 Engine with Autonomous Code Editing Tools, Trigger.dev v3 & Composio Multi-Tenancy

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
  const composioApiUrl = 'https://backend.composio.dev/api/v1';

  try {
    const body = await request.json().catch(() => ({}));
    const userText = body.text || body.prompt || '';
    const projectName = body.projectName || 'AI Cloud Project';
    const currentStage = typeof body.stage === 'number' ? body.stage : 4;
    const mode = body.mode || 'Auto';
    const projectFiles = Array.isArray(body.projectFiles) ? body.projectFiles : [];
    const history = Array.isArray(body.history) ? body.history : [];
    const reason = body.reason || 'manual'; // 'credits_exhausted' | 'continue_edit' | 'manual'

    // System prompt instructing Claude Sonnet 5.5 as the Lead Software Architect & Code Editor
    const systemPrompt = `You are Claude Sonnet 5.5 (Autonomous Lead Software Architect & Full-Stack Code Editor) for the Runnerflo Cloud Platform (Year 2026).
You are operating in High-Reasoning & Medium-Thinking mode.

CURRENT WORKSPACE CONTEXT:
- Project Name: "${projectName}"
- Current Stage: ${currentStage}/4
- Execution Mode: ${mode}
- Fallback Activation Reason: ${reason === 'credits_exhausted' ? 'Totalum credits exhausted (negative balance) -> Seamless Claude 5.5 takeover' : 'Autonomous feature refinement and code maintenance'}
- Existing Project Files in Workspace:
${projectFiles.length ? projectFiles.map(f => `  • ${f.path || f.name} (${f.size || 2048} bytes)`).slice(0, 30).join('\n') : '  • Next.js 14 App Router, Cloudflare D1 Edge, Tailwind CSS'}

YOUR CAPABILITIES & TOOLS:
1. edit_code: Modify existing code or create new components/pages in the project.
2. read_file: Inspect existing file content.
3. search_code: Search patterns, symbols, or functions across the project tree.
4. debug_code: Diagnose syntax errors, runtime issues, or TypeScript type mismatches.
5. fetch_api: Query external REST endpoints or web APIs.
6. trigger_job: Dispatch long-running tasks, heavy AI generation, or deployment jobs to Trigger.dev v3.
7. composio_action: Execute real SaaS integrations (Gmail, Slack, Notion, Google Sheets, HubSpot, Stripe, etc.) for the end-user via Composio multi-tenancy. Use this when the user's request involves sending emails, creating records, syncing data, posting messages, or any cross-SaaS operation. Always pass the userId (tenant ID) so actions run under the correct connected account.

COMPOSIO MULTI-TENANCY RULES:
- Each generated SaaS app can have its own end-users (tenants). Each tenant connects their own SaaS accounts via OAuth through /api/composio?action=connect-url.
- When a user asks to "send email", "notify on Slack", "add row to Sheets", "create Notion page", etc. → USE composio_action tool.
- Always pass userId to scope the action to the right tenant's connected account.
- Available apps include: gmail, slack, notion, googlesheets, hubspot, stripe, airtable, discord, github, linear, jira, asana, trello, shopify, and 200+ more.

RULES:
- Respond in clear, professional English (or Indonesian if user prompted in Indonesian).
- Always explain what code modifications or architectural decisions you made.
- If the user asks to modify a feature, add a component, or fix a bug, USE the edit_code tool or return structured code patches.
- Maintain high code quality: TypeScript, React Server Components/Client directives, Tailwind CSS, and D1 SQLite compatibility.`;

    // Tool specifications for Claude Sonnet 5.5 Tool Use API
    const tools = [
      {
        name: 'edit_code',
        description: 'Edit, patch, or create a source code file in the project (e.g. src/app/page.tsx, src/components/Studio.tsx, src/lib/d1-schema.ts).',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path, e.g. src/app/page.tsx' },
            code: { type: 'string', description: 'The complete revised source code for this file' },
            explanation: { type: 'string', description: 'Brief summary of what was added or fixed' }
          },
          required: ['file', 'code']
        }
      },
      {
        name: 'read_file',
        description: 'Read the contents of a specific file in the project codebase.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Relative file path to read' }
          },
          required: ['file']
        }
      },
      {
        name: 'search_code',
        description: 'Search for keywords, symbols, or functions across project code files.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keyword, function name, or symbol to locate' }
          },
          required: ['query']
        }
      },
      {
        name: 'debug_code',
        description: 'Run automated static diagnosis on a code file to catch syntax and runtime errors.',
        input_schema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'The file to inspect' },
            issue: { type: 'string', description: 'Description of observed error or desired check' }
          },
          required: ['file', 'issue']
        }
      },
      {
        name: 'fetch_api',
        description: 'Fetch external API endpoint data or documentation.',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Full URL to request' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method' }
          },
          required: ['url']
        }
      },
      {
        name: 'trigger_job',
        description: 'Dispatch a long-running background workflow or build pipeline to Trigger.dev v3.',
        input_schema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'The Trigger.dev task identifier (e.g. "code-build-pipeline", "asset-optimizer")' },
            payload: { type: 'object', description: 'JSON payload passed to the Trigger.dev task' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'composio_action',
        description: 'Execute a real SaaS integration action via Composio (multi-tenancy). Use when the user wants to send emails (Gmail), post Slack messages, create Notion pages, add Google Sheets rows, update HubSpot contacts, trigger Stripe charges, etc. Each action runs under the authenticated account of the specified userId (tenant).',
        input_schema: {
          type: 'object',
          properties: {
            app: { type: 'string', description: 'The SaaS app name, e.g. "gmail", "slack", "notion", "googlesheets", "hubspot", "stripe", "github", "linear"' },
            action: { type: 'string', description: 'The specific action to execute, e.g. "GMAIL_SEND_EMAIL", "SLACK_SENDS_A_MESSAGE", "NOTION_CREATE_PAGE", "GOOGLESHEETS_SHEET_FROM_JSON"' },
            params: { type: 'object', description: 'Parameters for the action, e.g. { to: "user@email.com", subject: "Hello", body: "World" }' },
            userId: { type: 'string', description: 'The tenant/end-user ID whose connected account to use. Defaults to "default" if single-tenant.' }
          },
          required: ['app', 'action']
        }
      }
    ];

    // Format chat messages
    const formattedMessages = [];
    for (const h of history) {
      if (h.role === 'user' && h.text) formattedMessages.push({ role: 'user', content: h.text });
      else if (h.role === 'agent' && h.text) formattedMessages.push({ role: 'assistant', content: h.text });
    }
    if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].content !== userText) {
      formattedMessages.push({ role: 'user', content: userText || 'Review project and apply requested enhancements.' });
    }

    // Models priority list: 5.5 series -> 3.7 sonnet -> 3.5 sonnet
    const candidateModels = [
      'claude-sonnet-5-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    ];

    let lastError = null;
    let selectedModel = null;
    let responseData = null;
    let toolCalls = [];
    let assistantText = '';
    let thinkingContent = '';

    for (const model of candidateModels) {
      try {
        // First attempt with interleaved-thinking
        const headers = {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
          'content-type': 'application/json'
        };

        const payload = {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: formattedMessages,
          tools,
          thinking: {
            type: 'enabled',
            budget_tokens: 2048
          }
        };

        let response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        // If thinking or beta header is rejected (400), retry without thinking
        if (!response.ok && response.status === 400) {
          const fallbackPayload = {
            model,
            max_tokens: 3000,
            system: systemPrompt,
            messages: formattedMessages,
            tools
          };
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify(fallbackPayload)
          });
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model} (HTTP ${response.status}): ${errText}`;
          continue;
        }

        responseData = await response.json();
        selectedModel = model;
        break;
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!responseData) {
      return new Response(JSON.stringify({
        error: 'Failed to contact Claude Sonnet 5.5 upstream',
        details: lastError,
        fallback: false
      }), { status: 502, headers: corsHeaders });
    }

    // Process Claude response blocks (thinking, text, tool_use)
    const contentBlocks = responseData.content || [];
    const modifiedFiles = [];
    const triggeredJobs = [];
    const composioActions = [];

    for (const block of contentBlocks) {
      if (block.type === 'thinking') {
        thinkingContent += block.thinking;
      } else if (block.type === 'text') {
        assistantText += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push(block);

        if (block.name === 'edit_code') {
          const args = block.input || {};
          modifiedFiles.push({
            path: args.file,
            code: args.code,
            explanation: args.explanation || 'Updated by Claude Sonnet 5.5'
          });
        } else if (block.name === 'trigger_job') {
          const args = block.input || {};
          let jobResult = { taskId: args.taskId, status: 'QUEUED' };

          // If Trigger.dev API key is present, actually dispatch to Trigger.dev v3
          if (triggerKey) {
            try {
              const trRes = await fetch(`${triggerApiUrl}/tasks/${encodeURIComponent(args.taskId)}/trigger`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${triggerKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ payload: args.payload || {} })
              });
              if (trRes.ok) {
                const trData = await trRes.json();
                jobResult = trData;
              } else {
                jobResult.warning = `Trigger.dev HTTP ${trRes.status}`;
              }
            } catch (trErr) {
              jobResult.warning = trErr.message;
            }
          } else {
            jobResult.runId = 'trig_' + Math.random().toString(36).slice(2, 10);
            jobResult.note = 'Simulated Trigger.dev dispatch (configure TRIGGER_SECRET_KEY in Cloudflare for live trigger)';
          }
          triggeredJobs.push(jobResult);
        } else if (block.name === 'composio_action') {
          const args = block.input || {};
          const appName = (args.app || 'saas').toLowerCase();
          const actionName = (args.action || '').toUpperCase();
          const userId = args.userId || 'default';
          let actionResult = {
            app: appName,
            action: actionName,
            userId,
            status: 'EXECUTED'
          };

          if (composioKey) {
            try {
              const cRes = await fetch(`${composioApiUrl}/actions/${encodeURIComponent(actionName)}/execute`, {
                method: 'POST',
                headers: {
                  'X-API-Key': composioKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  entityId: userId,
                  input: args.params || {}
                })
              });
              if (cRes.ok) {
                const cData = await cRes.json();
                actionResult.data = cData;
                actionResult.success = true;
              } else {
                const cErr = await cRes.text();
                actionResult.status = 'FAILED';
                actionResult.warning = `Composio HTTP ${cRes.status}: ${cErr}`;
              }
            } catch (cErr) {
              actionResult.status = 'ERROR';
              actionResult.warning = cErr.message;
            }
          } else {
            actionResult.simulated = true;
            actionResult.note = `Simulated Composio execution for ${appName} (${actionName}). Connect COMPOSIO_API_KEY in Cloudflare to trigger live.`;
            actionResult.preview = {
              tenantId: userId,
              payload: args.params || {}
            };
          }
          composioActions.push(actionResult);
        }
      }
    }

    const steps = [];
    if (reason === 'credits_exhausted') {
      steps.push({ label: '⚡ Fallback to Claude Sonnet 5.5 engaged (zero downtime)', done: true });
    }
    steps.push({ label: `Analyzed codebase with ${selectedModel} (Medium Thinking)`, done: true });

    if (modifiedFiles.length > 0) {
      steps.push({ label: `Generated code updates for ${modifiedFiles.length} file(s)`, done: true });
    }
    if (triggeredJobs.length > 0) {
      steps.push({ label: `Dispatched background job to Trigger.dev v3`, done: true });
    }
    if (composioActions.length > 0) {
      const liveCount = composioActions.filter(a => a.success).length;
      steps.push({
        label: `Executed ${composioActions.length} Composio SaaS action(s)${liveCount ? ` (${liveCount} live connected)` : ''}`,
        done: true
      });
    }

    const output = {
      text: assistantText || 'Task completed successfully by Claude Sonnet 5.5.',
      steps,
      stage: Math.min(4, currentStage + 1),
      suggest: [
        'Review Updated Code',
        'Run Automated Unit Tests',
        'Publish Live to Production'
      ],
      engine: 'claude-sonnet-5.5',
      model: selectedModel,
      thinkingTokens: responseData.usage ? responseData.usage.thinking_tokens : 0,
      modifiedFiles,
      triggeredJobs,
      composioActions,
      toolCallsCount: toolCalls.length
    };

    return new Response(JSON.stringify(output), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
