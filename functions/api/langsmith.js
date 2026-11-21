// Cloudflare Pages Function: /api/langsmith
// LangSmith Managed Deep Agent Engine — Full Tool Suite
// Runnerflo Meta-PaaS: ReAct Loop, Web Search, Read/Edit Code, Human-in-the-Loop, MCP, Composio, Totalum, R2

// ─── FULL LangSmith Deep Agent Tools — Setara Claude Managed Agent ─────────
const DEEP_AGENT_TOOLS = [
  // ── 1. WEB SEARCH (Tavily-compatible via /api/gateway) ──────────────────────
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information, documentation, news, pricing, APIs, tutorials, or any factual data. Use this whenever you need up-to-date info not in your training data.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query. Be specific and use English for best results." },
          num_results: { type: "integer", description: "Number of results to return (1-5, default 3)" }
        },
        required: ["query"]
      }
    }
  },
  // ── 2. READ CODE / FILE ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "read_code_file",
      description: "Read the full source code of a file in the current project. Use before editing to understand existing structure, logic, and styling.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read (e.g. 'index.html', 'app.js', 'styles.css')" }
        },
        required: ["path"]
      }
    }
  },
  // ── 3. EDIT / WRITE CODE ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "edit_code_file",
      description: "Create or overwrite a code file with new content. ALWAYS call read_code_file first on the target file, then apply targeted changes. Outputs complete valid HTML/JS/CSS.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (e.g. 'index.html')" },
          content: { type: "string", description: "Full new content of the file" },
          summary: { type: "string", description: "One-line summary of what was changed" }
        },
        required: ["path", "content"]
      }
    }
  },
  // ── SEARCH CODE IN PROJECT ──────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for a keyword, function name, class, variable, or text pattern across all code and files in the project. Returns matching file paths, line numbers, and code snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The text or keyword to search for across project files" }
        },
        required: ["query"]
      }
    }
  },
  // ── LIST PROJECT FILES ──────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files in the project along with their file sizes and line counts.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  // ── SURGICAL PATCH CODE FILE ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "patch_code_file",
      description: "Surgically replace a unique block of text (oldText) with newText in an existing file. Keeps the rest of the file untouched. Preferred for targeted updates (theme change, adding a script, fixing a bug) without rewriting the entire file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to patch (e.g. 'index.html')" },
          oldText: { type: "string", description: "The exact unique existing string to replace" },
          newText: { type: "string", description: "The replacement text to insert" }
        },
        required: ["path", "oldText", "newText"]
      }
    }
  },
  // ── DELETE FILE ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete an obsolete, temporary, or unused file from the project workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path of the file to remove (e.g. 'temp.js')" }
        },
        required: ["path"]
      }
    }
  },
  // ── RENAME FILE ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Rename or move a file in the project workspace from oldPath to newPath.",
      parameters: {
        type: "object",
        properties: {
          oldPath: { type: "string", description: "Current file path (e.g. 'styles-old.css')" },
          newPath: { type: "string", description: "New file path (e.g. 'styles.css')" }
        },
        required: ["oldPath", "newPath"]
      }
    }
  },
  // ── 4. HUMAN-IN-THE-LOOP ───────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "ask_human",
      description: "Ask the human user for clarification, approval, or additional context before proceeding. Use when the task is ambiguous or requires a decision from the user. The agent will pause and wait for human input.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask the human user" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of suggested choices the user can pick from"
          }
        },
        required: ["question"]
      }
    }
  },
  // ── 5. EXECUTE JAVASCRIPT SANDBOX ──────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "execute_code",
      description: "Execute a JavaScript expression or utility logic (data transformation, regex, calculation, JSON processing) and get the result. The sandbox has access to Math, JSON, Array, String, Date but NOT external APIs.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "JavaScript expression or multi-line function body to evaluate" },
          description: { type: "string", description: "What this code does" }
        },
        required: ["code"]
      }
    }
  },
  // ── 6. MCP — FETCH URL / BROWSER ───────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch and read the content of any URL (documentation page, API endpoint, JSON data, HTML page). Returns text content. Useful for reading API docs, checking live endpoints, or reading reference pages.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          method: { type: "string", description: "HTTP method: GET or POST (default: GET)" },
          body: { type: "string", description: "Optional JSON body for POST requests" }
        },
        required: ["url"]
      }
    }
  },
  // ── 7. COMPOSIO — EXECUTE SAAS ACTION ──────────────────────────────────────
  {
    type: "function",
    function: {
      name: "composio_execute_action",
      description: "Execute a SaaS action on behalf of this tenant (send Gmail, post Slack message, update Google Sheets, create Notion page, push to GitHub, create Calendar event, etc.).",
      parameters: {
        type: "object",
        properties: {
          actionName: { type: "string", description: "Action slug in SCREAMING_SNAKE_CASE: GMAIL_SEND_EMAIL, SLACK_SENDS_A_MESSAGE, GOOGLESHEETS_BATCH_UPDATE, NOTION_CREATE_PAGE, GITHUB_CREATE_OR_UPDATE_FILE, GOOGLECALENDAR_CREATE_EVENT" },
          params: { type: "object", description: "Parameters for the SaaS action" }
        },
        required: ["actionName"]
      }
    }
  },
  // ── 8. COMPOSIO — OAUTH CONNECT ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "composio_get_connect_url",
      description: "Generate a zero-config OAuth connect URL so the end-user can link their Google, Gmail, Slack, Notion, or GitHub account. No Client ID needed.",
      parameters: {
        type: "object",
        properties: {
          appName: { type: "string", description: "App to connect: gmail, googlecalendar, googlesheets, slack, notion, github, twitter, linkedin" }
        },
        required: ["appName"]
      }
    }
  },
  // ── 9. COMPOSIO — CHECK CONNECTIONS ────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "composio_check_connections",
      description: "Check which third-party SaaS accounts are connected and active for this tenant user.",
      parameters: { type: "object", properties: {} }
    }
  },
  // ── 10. DATABASE QUERY (Totalum D1 / SQLite) ────────────────────────────────
  {
    type: "function",
    function: {
      name: "database_query",
      description: "Query the tenant's cloud database using plain English or SQL. Can list tables, count records, filter rows, or run any database question.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Plain English or SQL query" },
          table: { type: "string", description: "Optional table name to retrieve all rows" }
        },
        required: ["query"]
      }
    }
  },
  // ── DATABASE SCHEMA & TABLE INSPECTOR ───────────────────────────────────────
  {
    type: "function",
    function: {
      name: "database_schema",
      description: "Inspect the database schema, table structures, column definitions, and list all tables in the tenant's Totalum D1 cloud database.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Optional specific table name to inspect in detail" }
        }
      }
    }
  },
  // ── 11. CLOUDFLARE R2 STORAGE ───────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "storage_save",
      description: "Save or update any file, JSON config, or document in the tenant's Cloudflare R2 storage bucket.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "File path/name (e.g. 'notes.json', 'export.csv')" },
          content: { type: "string", description: "Full text/JSON content to persist" }
        },
        required: ["file", "content"]
      }
    }
  },
  // ── 12. STRIPE PAYMENT / CHECKOUT ──────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_payment_checkout",
      description: "Create a Stripe Connect checkout session for a subscription plan or one-time payment. Returns a checkout URL the user can be redirected to.",
      parameters: {
        type: "object",
        properties: {
          plan: { type: "string", description: "Plan name (e.g. 'Pro', 'Starter', 'Enterprise')" },
          amount: { type: "integer", description: "Amount in cents (e.g. 1999 = $19.99)" },
          currency: { type: "string", description: "Currency code (default: usd)" }
        },
        required: ["plan", "amount"]
      }
    }
  },
  // ── 13. TRIGGER.DEV — BACKGROUND JOB ──────────────────────────────────────
  {
    type: "function",
    function: {
      name: "trigger_background_job",
      description: "Dispatch a Trigger.dev v3 background job for async long-running tasks (batch processing, scheduled emails, data pipeline, file generation).",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task identifier defined in the Trigger.dev project" },
          payload: { type: "object", description: "Payload data to send to the background task" }
        },
        required: ["taskId"]
      }
    }
  },
  // ── SAVE SNAPSHOT ───────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "save_snapshot",
      description: "Create a named snapshot/checkpoint of the current project files for safe rollback before performing major architectural changes.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short description of the checkpoint, e.g. 'Before refactoring nav'" }
        },
        required: ["label"]
      }
    }
  },
  // ── ROLLBACK SNAPSHOT ───────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "rollback_snapshot",
      description: "Rollback the project files to a previous snapshot or version if the recent changes were unsatisfactory.",
      parameters: {
        type: "object",
        properties: {
          version: { type: "integer", description: "The snapshot version number to restore (e.g. 1, 2)" }
        },
        required: ["version"]
      }
    }
  },
  // ── 14. COMPOSIO — SEARCH APPS & ACTIONS (1,700+ SaaS Catalog) ─────────────
  {
    type: "function",
    function: {
      name: "composio_search_apps",
      description: "Search across 1,700+ SaaS apps and toolkits in Composio (e.g. 'crm', 'salesforce', 'hubspot', 'whatsapp', 'zendesk', 'shopify', 'jira', 'stripe', 'notion', 'gmail'). Returns matching app IDs, action slugs, and descriptions so you can integrate them.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword for app name or capability (e.g. 'crm', 'accounting', 'email', 'support', 'ecommerce')" }
        },
        required: ["query"]
      }
    }
  },
  // ── 15. OPENROUTER — SEARCH LLM MODELS ─────────────────────────────────────
  {
    type: "function",
    function: {
      name: "search_llm_models",
      description: "Search available frontier and open-weight LLM models on OpenRouter (DeepSeek R1/V3, Claude 3.7 Sonnet, GPT-4o, Llama 3.3 70B, Gemini 2.0 Flash, etc.) to use as the autonomous brain of a child agent. Returns context window, price per 1M tokens, and category.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Model name or keyword (e.g. 'deepseek', 'reasoning', 'coding', 'fast', 'cheap', 'claude')" }
        },
        required: ["query"]
      }
    }
  },
  // ── 16. OCR & IMAGE INSPECTION (Multimodal Vision Matching) ─────────────────
  {
    type: "function",
    function: {
      name: "inspect_image_reference",
      description: "Perform OCR and visual analysis on an uploaded reference image, design mockup, wireframe, or screenshot. Extracts verbatim text, headings, buttons, hex color codes, typography, layout cards, and UI hierarchy so you can match the application code against the design.",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", description: "What to extract: 'all', 'text_ocr', 'color_palette', 'components', 'layout'" }
        }
      }
    }
  },
  // ── 17. GET DATETIME ───────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_datetime",
      description: "Get the current date and time in UTC, ISO string, and Unix epoch timestamp.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  // ── 18. DEBUG CODE ─────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "debug_code",
      description: "Analyze code for syntax errors, unclosed brackets, undefined calls, or common JavaScript bugs in project files.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "File path to inspect (e.g. 'index.html')" },
          issue: { type: "string", description: "Describe the observed bug or what to check" }
        },
        required: ["file", "issue"]
      }
    }
  }
];

async function executeDeepAgentTool(toolName, args, ctx) {
  const { origin, paasId, endUserId, projectFiles, imagePayload, googleKey } = ctx;

  // ── 1. WEB SEARCH ──────────────────────────────────────────────────────────
  if (toolName === 'web_search') {
    const query = args.query || '';
    const numResults = Math.min(args.num_results || 3, 5);
    try {
      // Try Tavily first (via gateway), fallback to DuckDuckGo Instant Answer
      const tavilyKey = ctx.tavilyKey || '';
      if (tavilyKey) {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
          body: JSON.stringify({ query, max_results: numResults, search_depth: 'basic' })
        });
        if (res.ok) {
          const d = await res.json();
          return { ok: true, results: (d.results || []).slice(0, numResults).map(r => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 400) })) };
        }
      }
      // Fallback: DuckDuckGo Instant Answer API
      const ddRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
      if (ddRes.ok) {
        const dd = await ddRes.json();
        const results = [];
        if (dd.AbstractText) results.push({ title: dd.Heading || query, url: dd.AbstractURL || '', snippet: dd.AbstractText.slice(0, 400) });
        (dd.RelatedTopics || []).slice(0, numResults - 1).forEach(t => {
          if (t.Text) results.push({ title: t.Text.slice(0, 80), url: t.FirstURL || '', snippet: t.Text.slice(0, 300) });
        });
        return { ok: true, query, results };
      }
      return { ok: false, error: 'Web search unavailable', query };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 2. READ CODE FILE ───────────────────────────────────────────────────────
  if (toolName === 'read_code_file') {
    const path = args.path || 'index.html';
    const files = projectFiles || [];
    const f = files.find(x => (x.path || x.name) === path);
    if (f && f.content) {
      return { ok: true, path, content: f.content, length: f.content.length };
    }
    return { ok: false, error: `File not found: ${path}`, available: files.map(x => x.path || x.name) };
  }

  // ── 3. EDIT CODE FILE ───────────────────────────────────────────────────────
  if (toolName === 'edit_code_file') {
    const path = args.path || 'index.html';
    const content = args.content || '';
    const summary = args.summary || `Updated ${path}`;
    // Store in context so caller can collect modified files
    if (!ctx.modifiedFiles) ctx.modifiedFiles = [];
    const existing = ctx.modifiedFiles.find(x => x.path === path);
    if (existing) { existing.code = content; existing.summary = summary; }
    else { ctx.modifiedFiles.push({ path, code: content, summary }); }
    return { ok: true, path, length: content.length, summary };
  }

  // ── SURGICAL PATCH CODE FILE ────────────────────────────────────────────────
  if (toolName === 'patch_code_file') {
    const p = args.path || 'index.html';
    const oldText = args.oldText;
    const newText = args.newText !== undefined ? args.newText : '';
    if (!oldText) return { ok: false, error: 'Parameter "oldText" is required for patch_code_file.' };

    let currentContent = '';
    const mod = ctx.modifiedFiles && ctx.modifiedFiles.find(x => x.path === p);
    if (mod) {
      currentContent = mod.code;
    } else {
      const found = (projectFiles || []).find(f => (f.path || f.name) === p || (f.path || '').endsWith(p));
      currentContent = found ? (found.content || '') : '';
    }

    if (!currentContent) return { ok: false, error: `File "${p}" not found in project or is empty.` };

    const first = currentContent.indexOf(oldText);
    if (first < 0) {
      return {
        ok: false,
        error: `Patch conflict: "oldText" was not found in ${p}. Please call read_code_file first or call edit_code_file with the complete file.`,
        searched: oldText.slice(0, 100)
      };
    }
    if (currentContent.indexOf(oldText, first + oldText.length) >= 0) {
      return { ok: false, error: `Patch conflict: "oldText" matches multiple times in ${p}. Include more surrounding context in oldText so it matches uniquely.` };
    }

    const updated = currentContent.slice(0, first) + newText + currentContent.slice(first + oldText.length);
    if (!ctx.modifiedFiles) ctx.modifiedFiles = [];
    const exIdx = ctx.modifiedFiles.findIndex(x => x.path === p);
    if (exIdx >= 0) {
      ctx.modifiedFiles[exIdx] = { path: p, code: updated, summary: `Patched ${p}` };
    } else {
      ctx.modifiedFiles.push({ path: p, code: updated, summary: `Patched ${p}` });
    }
    return { ok: true, path: p, patched: true, bytes: updated.length, summary: `Successfully patched ${p} (${updated.length} bytes).` };
  }

  // ── DELETE FILE ─────────────────────────────────────────────────────────────
  if (toolName === 'delete_file') {
    const p = args.path || '';
    if (!p) return { ok: false, error: 'Path parameter is required for delete_file' };
    if (!ctx.deletedFiles) ctx.deletedFiles = [];
    ctx.deletedFiles.push(p);
    if (ctx.modifiedFiles) ctx.modifiedFiles = ctx.modifiedFiles.filter(x => x.path !== p);
    return { ok: true, path: p, deleted: true, message: `File "${p}" removed from project.` };
  }

  // ── RENAME FILE ─────────────────────────────────────────────────────────────
  if (toolName === 'rename_file') {
    const oldP = args.oldPath || '';
    const newP = args.newPath || '';
    if (!oldP || !newP) return { ok: false, error: 'Both oldPath and newPath are required for rename_file' };

    let content = '';
    const mod = ctx.modifiedFiles && ctx.modifiedFiles.find(x => x.path === oldP);
    if (mod) {
      content = mod.code;
      ctx.modifiedFiles = ctx.modifiedFiles.filter(x => x.path !== oldP);
    } else {
      const found = (projectFiles || []).find(f => (f.path || f.name) === oldP);
      if (found) content = found.content || '';
    }
    if (!content) return { ok: false, error: `File "${oldP}" not found to rename.` };

    if (!ctx.modifiedFiles) ctx.modifiedFiles = [];
    ctx.modifiedFiles.push({ path: newP, code: content, summary: `Renamed ${oldP} to ${newP}` });
    if (!ctx.deletedFiles) ctx.deletedFiles = [];
    ctx.deletedFiles.push(oldP);
    return { ok: true, oldPath: oldP, newPath: newP, renamed: true };
  }

  // ── SEARCH CODE IN PROJECT ──────────────────────────────────────────────────
  if (toolName === 'search_code') {
    const q = (args.query || '').toLowerCase().trim();
    const files = projectFiles || [];
    if (!q) return { ok: false, error: 'Query parameter is required' };
    const matches = [];
    for (const f of files) {
      const fPath = f.path || f.name || 'file';
      const content = f.content || '';
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(q)) {
          matches.push({
            file: fPath,
            line: idx + 1,
            snippet: line.trim().slice(0, 200)
          });
        }
      });
    }
    return {
      ok: true,
      query: q,
      totalMatches: matches.length,
      filesScanned: files.length,
      matches: matches.slice(0, 25)
    };
  }

  // ── LIST PROJECT FILES ──────────────────────────────────────────────────────
  if (toolName === 'list_files') {
    const files = projectFiles || [];
    return {
      ok: true,
      count: files.length,
      files: files.map(f => ({
        path: f.path || f.name,
        size: f.size || (f.content ? f.content.length : 0),
        lines: f.content ? f.content.split('\n').length : 0
      }))
    };
  }

  // ── 4. HUMAN-IN-THE-LOOP ───────────────────────────────────────────────────
  if (toolName === 'ask_human') {
    // Signal the loop to pause and return a human clarification request
    ctx.humanRequest = { question: args.question, options: args.options || [] };
    return { ok: true, status: 'human_input_required', question: args.question, options: args.options || [] };
  }

  // ── 5. EXECUTE JAVASCRIPT SANDBOX ──────────────────────────────────────────
  if (toolName === 'execute_code') {
    const code = args.code || '';
    try {
      // Safe evaluation: only allow pure JS (Math, JSON, Array, String, Date, Number)
      const forbidden = /import|require|fetch|XMLHttpRequest|eval|Function|process|globalThis|__proto__|constructor/;
      if (forbidden.test(code)) {
        return { ok: false, error: 'Forbidden: external access not allowed in sandbox' };
      }
      // eslint-disable-next-line no-new-func
      const fn = new Function('Math', 'JSON', 'Array', 'String', 'Date', 'Number', 'Object', `"use strict";\n${code}`);
      const result = fn(Math, JSON, Array, String, Date, Number, Object);
      return { ok: true, result: typeof result === 'object' ? JSON.stringify(result) : String(result) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 6. MCP — FETCH URL ─────────────────────────────────────────────────────
  if (toolName === 'fetch_url') {
    const url = args.url || '';
    const method = (args.method || 'GET').toUpperCase();
    if (!url.startsWith('http')) return { ok: false, error: 'Invalid URL' };
    try {
      const opts = { method, headers: { 'User-Agent': 'Runnerflo-Agent/1.0' } };
      if (method === 'POST' && args.body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = args.body;
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      return { ok: res.ok, status: res.status, content: text.slice(0, 8000), truncated: text.length > 8000 };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 7. COMPOSIO — EXECUTE SAAS ACTION ──────────────────────────────────────
  if (toolName === 'composio_execute_action') {
    const actName = args.actionName || '';
    const inputPayload = args.params || {};
    try {
      const res = await fetch(`${origin}/api/composio?action=execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', actionName: actName, paasId, endUserId, input: inputPayload })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 8. COMPOSIO — OAUTH CONNECT ────────────────────────────────────────────
  if (toolName === 'composio_get_connect_url') {
    const app = args.appName || 'google';
    try {
      const res = await fetch(`${origin}/api/composio?action=connect-url&appName=${encodeURIComponent(app)}&paasId=${encodeURIComponent(paasId)}&endUserId=${encodeURIComponent(endUserId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 9. COMPOSIO — CHECK CONNECTIONS ────────────────────────────────────────
  if (toolName === 'composio_check_connections') {
    try {
      const res = await fetch(`${origin}/api/composio?action=connections&paasId=${encodeURIComponent(paasId)}&endUserId=${encodeURIComponent(endUserId)}`, { method: 'GET' });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 10. DATABASE QUERY ──────────────────────────────────────────────────────
  if (toolName === 'database_query') {
    const q = args.query || '';
    const tbl = args.table || '';
    try {
      const ep = tbl ? `${origin}/api/totalum?action=database-rows&projectId=${encodeURIComponent(paasId)}` : `${origin}/api/totalum?action=database-ask&projectId=${encodeURIComponent(paasId)}`;
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, table: tbl }) });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── DATABASE SCHEMA & TABLE INSPECTION ──────────────────────────────────────
  if (toolName === 'database_schema') {
    const tbl = args.table || '';
    try {
      const q = tbl ? `PRAGMA table_info(${tbl});` : `SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%';`;
      const res = await fetch(`${origin}/api/totalum?action=database-ask&projectId=${encodeURIComponent(paasId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, table: tbl })
      });
      const data = await res.json();
      return { ok: true, paasId, table: tbl || 'ALL', schema: data.data || data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 11. CLOUDFLARE R2 STORAGE ───────────────────────────────────────────────
  if (toolName === 'storage_save') {
    const f = args.file || 'data.json';
    const c = typeof args.content === 'object' ? JSON.stringify(args.content) : String(args.content || '');
    try {
      const res = await fetch(`${origin}/api/storage?action=save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paasId, file: f, content: c }) });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 12. STRIPE PAYMENT ──────────────────────────────────────────────────────
  if (toolName === 'create_payment_checkout') {
    try {
      const res = await fetch(`${origin}/api/totalum?action=stripe-checkout&projectId=${encodeURIComponent(paasId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paasId, endUserId, plan: args.plan, amount: args.amount, currency: args.currency || 'usd' })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 13. TRIGGER.DEV BACKGROUND JOB ─────────────────────────────────────────
  if (toolName === 'trigger_background_job') {
    try {
      const res = await fetch(`${origin}/api/gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paasId, endUserId, provider: 'trigger', taskId: args.taskId, payload: args.payload || {} })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── SAVE SNAPSHOT ───────────────────────────────────────────────────────────
  if (toolName === 'save_snapshot') {
    const label = args.label || 'Snapshot';
    ctx.snapshotRequest = { action: 'save', label };
    return { ok: true, saved: true, label, message: `Snapshot "${label}" recorded for project ${paasId}.` };
  }

  // ── ROLLBACK SNAPSHOT ───────────────────────────────────────────────────────
  if (toolName === 'rollback_snapshot') {
    const version = args.version || 1;
    ctx.snapshotRequest = { action: 'rollback', version };
    return { ok: true, rollbackRequested: true, version, message: `Rollback to version ${version} requested.` };
  }

  // ── 14. COMPOSIO SEARCH APPS ───────────────────────────────────────────────
  if (toolName === 'composio_search_apps') {
    const q = (args.query || '').toLowerCase().trim();
    try {
      const res = await fetch(`${origin}/api/composio?action=apps`);
      if (res.ok) {
        const d = await res.json();
        const apps = (d.apps || []).filter(a =>
          !q || (a.name + a.id + (a.description || '') + (a.category || '')).toLowerCase().includes(q)
        ).slice(0, 10);
        return { ok: true, query: q, count: apps.length, apps: apps.map(a => ({ id: a.id, name: a.name, category: a.category, actions: a.popularActions, description: a.description })) };
      }
      return { ok: false, error: 'Composio catalog fetch failed' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 15. SEARCH LLM MODELS ──────────────────────────────────────────────────
  if (toolName === 'search_llm_models') {
    const q = (args.query || '').toLowerCase().trim();
    try {
      const res = await fetch(`${origin}/api/catalog?provider=openrouter&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        const models = (d.models || []).slice(0, 8).map(m => ({
          id: m.id,
          name: m.name,
          category: m.category,
          contextLength: m.contextLength,
          pricing: m.retailPrice || m.basePrice,
          description: m.description
        }));
        return { ok: true, query: q, count: models.length, models };
      }
      return { ok: false, error: 'Model catalog fetch failed' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── 16. OCR & IMAGE INSPECTION ─────────────────────────────────────────────
  if (toolName === 'inspect_image_reference' || toolName === 'ocr_image_content') {
    const img = imagePayload;
    if (!img) {
      return { ok: false, error: 'No reference image was attached in this request. Please upload or attach a design screenshot.' };
    }
    if (googleKey) {
      try {
        let b64 = typeof img === 'string' ? img : (img.data || img.base64 || '');
        let mime = (typeof img === 'object' && (img.mimeType || img.type)) || 'image/jpeg';
        if (b64.startsWith('data:')) {
          const parts = b64.split(',');
          const m = parts[0].match(/data:([^;]+);base64/);
          if (m) mime = m[1];
          b64 = parts[1];
        }
        if (b64) {
          const vRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType: mime, data: b64 } },
                  { text: 'Perform a comprehensive UI design analysis and OCR transcript of this reference image. Extract: 1) All visible text verbatim (headings, labels, buttons), 2) Color palette (hex codes, background, accents), 3) Layout structure (grid, navigation, hero, cards, sidebar), 4) Interactive elements (inputs, CTA buttons, badges).' }
                ]
              }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
            })
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            const analysis = vData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return {
              ok: true,
              hasImage: true,
              ocrAnalysis: analysis,
              summary: 'Successfully extracted OCR text, colors, and UI layout components from reference image.'
            };
          }
        }
      } catch (vErr) {
        // Fallback
      }
    }
    return { ok: true, hasImage: true, summary: 'Reference image is attached to agent context.' };
  }

  // ── 17. GET DATETIME ───────────────────────────────────────────────────────
  if (toolName === 'get_datetime') {
    return { ok: true, datetime: new Date().toISOString(), timezone: 'UTC', unix: Date.now() };
  }

  // ── 18. DEBUG CODE ─────────────────────────────────────────────────────────
  if (toolName === 'debug_code') {
    const filePath = args.file || '';
    const fileObj = (projectFiles || []).find(f => (f.path || f.name) === filePath);
    const content = fileObj ? (fileObj.customContent || fileObj.content || '') : '';
    const issues = [];
    if (content.includes('undefined') && content.includes('()')) issues.push('Possible undefined function calls detected');
    if ((content.match(/\{/g) || []).length !== (content.match(/\}/g) || []).length) issues.push('Mismatched braces {}');
    if ((content.match(/\(/g) || []).length !== (content.match(/\)/g) || []).length) issues.push('Mismatched parentheses ()');
    return {
      ok: true,
      file: filePath,
      issue: args.issue,
      checks: issues.length > 0 ? issues : ['No obvious syntax issues found'],
      recommendation: issues.length > 0 ? 'Fix the issues above with patch_code_file or edit_code_file' : 'Code looks structurally sound.'
    };
  }

  return { error: `Unknown tool: "${toolName}"` };
}

// ─── Post-Generation Static Code Validator (Checklist E-03) ─────────────────
function validateAndSanitizePaaSCode(rawCode, paasId) {
  let code = rawCode || '';
  const violations = [];

  // 1. Check for BYOK API key input forms
  const byokRegex = /<input[^>]+(?:placeholder|name|id)=["'][^"']*(?:api[_-]?key|secret[_-]?key|vendor[_-]?key|access[_-]?token)[^"']*["'][^>]*>/gi;
  const byokMatches = code.match(byokRegex);
  if (byokMatches && byokMatches.length > 0) {
    violations.push(`Neutralized ${byokMatches.length} BYOK key input fields for Zero-BYOK compliance`);
    code = code.replace(byokRegex, '<!-- [REMOVED: Zero-BYOK Policy strictly enforced by Runnerflo Meta-PaaS] -->');
  }

  // 2. Check for direct external vendor calls outside Runnerflo Edge Gateway
  const rawVendorRegex = /fetch\s*\(\s*['"`]https?:\/\/(?:api\.openai\.com|api\.anthropic\.com|openrouter\.ai\/api|api\.composio\.dev|api\.smith\.langchain\.com|api\.replicate\.com|api\.fal\.ai)[^'"`]*['"`]/gi;
  const rawMatches = code.match(rawVendorRegex);
  if (rawMatches && rawMatches.length > 0) {
    violations.push(`Found ${rawMatches.length} raw third-party fetch calls outside Runnerflo Gateway`);
  }

  // 3. Check for leaked secret patterns in code
  const secretRegex = /(?:sk-ant-api[a-zA-Z0-9_-]{20,}|sk-or-v1-[a-zA-Z0-9]{30,}|ak_[a-zA-Z0-9_-]{20,}|totalum_[a-zA-Z0-9]{20,})/g;
  const secretMatches = code.match(secretRegex);
  if (secretMatches && secretMatches.length > 0) {
    violations.push(`Redacted ${secretMatches.length} hardcoded vendor secrets`);
    code = code.replace(secretRegex, '/* [REDACTED: Vendor Secret] */');
  }

  // 4. Ensure composite tenant dual-identity is initialized
  if (!code.includes('PAAS_ID') && !code.includes(paasId)) {
    const identityScript = `\n<script>\nconst PAAS_ID = window.PAAS_ID || "${paasId}";\nlet END_USER_ID = localStorage.getItem("rf_end_user_id");\nif (!END_USER_ID) { END_USER_ID = "usr_" + Math.random().toString(36).substring(2, 10); localStorage.setItem("rf_end_user_id", END_USER_ID); }\nconst COMPOSITE_TENANT_ID = PAAS_ID + ":" + END_USER_ID;\n</script>\n`;
    if (code.includes('<head>')) {
      code = code.replace('<head>', `<head>${identityScript}`);
    } else {
      code = identityScript + code;
    }
  }

  return {
    valid: violations.length === 0,
    code,
    violations,
    summary: violations.length === 0
      ? '🛡️ Security & Zero-BYOK Audit: 0 violations, 100% compliant'
      : `🛡️ Security & Zero-BYOK Audit: Auto-sanitized (${violations.join('; ')})`
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-tenant-id, x-paas-id, x-end-user-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const langsmithKey = (env && (env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY || env.LANGSMITH_KEY)) || '';
  const defaultProject = (env && (env.LANGCHAIN_PROJECT || env.LANGSMITH_PROJECT)) || 'default';
  const langsmithWorkspaceId = (env && (env.LANGSMITH_WORKSPACE_ID || env.LANGCHAIN_WORKSPACE_ID || env.LANGSMITH_TENANT_ID)) || 'd2acb410-5fff-4807-9fd8-19010de0fa1f';
  const langgraphBase = (env && env.LANGGRAPH_API_URL) || '';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const requestedProject = url.searchParams.get('project') || '';

  // GET: Health & Status check or Diagnostic
  if (request.method === 'GET') {
    // Diagnostic: List Google AI Studio models
    if (action === 'gemini-models') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      if (!googleKey) {
        return new Response(JSON.stringify({ ok: false, error: 'GOOGLE_AI_API_KEY missing' }), { status: 400, headers: corsHeaders });
      }
      const mRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
      const mData = await mRes.json().catch(() => ({}));
      const models = (mData.models || []).map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods
      }));
      return new Response(JSON.stringify({
        ok: mRes.ok,
        count: models.length,
        models
      }, null, 2), { status: mRes.status, headers: corsHeaders });
    }

    if (action === 'diagnostic') {
      const testTenant = url.searchParams.get('tenantHeader') || (env && env.LANGSMITH_WORKSPACE_ID) || 'd2acb410-5fff-4807-9fd8-19010de0fa1f';
      let results = {};
      let error = null;
      if (langsmithKey) {
        try {
          // 1. Test sessions without tenant header
          const s1 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
            headers: { 'x-api-key': langsmithKey }
          });
          results['sessions_no_tenant'] = { status: s1.status, data: await s1.json().catch(() => ({})) };

          // 2. Test sessions with X-Tenant-ID
          if (testTenant) {
            const s2 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
              headers: { 'x-api-key': langsmithKey, 'X-Tenant-ID': testTenant }
            });
            results[`sessions_with_tenant_${testTenant}`] = { status: s2.status, data: await s2.json().catch(() => ({})) };

            // 3. Test sessions with X-Organization-Id
            const s3 = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=5', {
              headers: { 'x-api-key': langsmithKey, 'X-Organization-Id': testTenant }
            });
            results[`sessions_with_org_${testTenant}`] = { status: s3.status, data: await s3.json().catch(() => ({})) };
          }
        } catch (e) {
          error = e.message;
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        configured: Boolean(langsmithKey),
        results,
        error
      }, null, 2), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      service: 'LangSmith Managed Deep Agent Gateway',
      version: 'v1',
      configured: Boolean(langsmithKey),
      project: defaultProject,
      message: langsmithKey
        ? 'LangSmith API Key aktif dan siap mengorkestrasikan deep agent per tenant.'
        : 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    let body = {};
    try {
      const rawText = await request.text();
      if (rawText && rawText.trim().startsWith('{')) {
        body = JSON.parse(rawText);
      }
    } catch {
      body = {};
    }
    
    // Composite Tenant Identity standard: {paas_id}:{end_user_id}
    const paasId = body.paas_id || body.paasId || body.tenantId || url.searchParams.get('paas_id') || url.searchParams.get('paasId') || url.searchParams.get('tenantId') || request.headers.get('x-paas-id') || request.headers.get('x-tenant-id') || 'default-paas';
    const endUserId = body.end_user_id || body.endUserId || body.userId || url.searchParams.get('end_user_id') || url.searchParams.get('endUserId') || url.searchParams.get('userId') || request.headers.get('x-end-user-id') || request.headers.get('x-user-id') || 'default-user';
    const compositeId = `${paasId}:${endUserId}`;
    
    const subAction = action || body.action || 'run';
    const langsmithProject = body.project || requestedProject || defaultProject;
    const input = body.input || body.prompt || body.messages || {};

    if (!langsmithKey) {
      // Graceful simulated response when key is missing
      return new Response(JSON.stringify({
        ok: false,
        simulated: true,
        tenantId: compositeId,
        paasId,
        endUserId,
        error: 'LANGSMITH_API_KEY belum disetel di Cloudflare Pages Secrets.',
        message: 'Kunci LangSmith belum terpasang. Pasang LANGSMITH_API_KEY di Cloudflare Pages Environment Variables.'
      }), { status: 200, headers: corsHeaders });
    }

    // Common headers for LangSmith REST API v1 with workspace header
    const commonHeaders = {
      'x-api-key': langsmithKey,
      'Content-Type': 'application/json',
      'X-Tenant-ID': langsmithWorkspaceId
    };

    // ─── 1. Thread Management (Isolated per Composite Tenant) ───────────────
    if (subAction === 'thread' || subAction === 'threads') {
      const threadId = body.threadId || `thread-${encodeURIComponent(compositeId)}`;

      if (langgraphBase) {
        const threadRes = await fetch(`${langgraphBase}/threads`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({
            metadata: {
              paas_id: paasId,
              end_user_id: endUserId,
              composite_tenant_id: compositeId,
              project: langsmithProject,
              createdAt: new Date().toISOString()
            }
          })
        }).catch(() => null);

        if (threadRes && threadRes.ok) {
          const threadData = await threadRes.json();
          return new Response(JSON.stringify({
            ok: true,
            tenantId: compositeId,
            paasId,
            endUserId,
            thread: threadData
          }), { status: 200, headers: corsHeaders });
        }
      }

      // Default managed thread response
      return new Response(JSON.stringify({
        ok: true,
        tenantId: compositeId,
        paasId,
        endUserId,
        thread: {
          id: threadId,
          paas_id: paasId,
          end_user_id: endUserId,
          project: langsmithProject,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 2. Deep Agent Run Dispatcher (LangSmith REST API v1) ─────────────────
    if (subAction === 'run' || subAction === 'dispatch') {
      const runId = crypto.randomUUID();
      const startTime = new Date().toISOString();
      const assistantId = body.assistantId || `agent-${paasId}`;

      // Official LangSmith Runs v1 payload schema
      const runPayload = {
        id: runId,
        name: body.name || `deep-agent-${paasId}`,
        run_type: body.run_type || 'chain',
        inputs: typeof input === 'string' ? { prompt: input } : input,
        start_time: startTime,
        session_name: langsmithProject,
        extra: {
          metadata: {
            paas_id: paasId,
            end_user_id: endUserId,
            composite_tenant_id: compositeId,
            assistant_id: assistantId,
            project: langsmithProject
          }
        }
      };

      // 1. Auto-ensure LangSmith project exists first (PAT 403 on unknown project)
      let projectCheckNote = '';
      try {
        const projectRes = await fetch(`https://api.smith.langchain.com/api/v1/sessions?name=${encodeURIComponent(langsmithProject)}`, {
          method: 'GET',
          headers: commonHeaders
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const existing = projectData.find ? projectData.find(p => p.name === langsmithProject) : null;
          if (!existing) {
            // Create the project/session automatically
            await fetch('https://api.smith.langchain.com/api/v1/sessions', {
              method: 'POST',
              headers: commonHeaders,
              body: JSON.stringify({ name: langsmithProject })
            }).catch(() => null);
            projectCheckNote = 'auto-created project';
          } else {
            projectCheckNote = 'project-exists';
          }
        }
      } catch (e) {
        projectCheckNote = `project-check-error: ${e.message}`;
      }

      // 2. Post Run to LangSmith REST API v1
      const traceRes = await fetch('https://api.smith.langchain.com/api/v1/runs', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(runPayload)
      });

      const traceData = await traceRes.json().catch(() => ({}));

      if (!traceRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          source: 'langsmith_runs_api_v1',
          status: traceRes.status,
          tenantId: compositeId,
          paasId,
          endUserId,
          projectNote: projectCheckNote,
          error: traceData.detail || traceData.error || `LangSmith HTTP ${traceRes.status}`,
          hint: traceRes.status === 403 ? `Create project "${langsmithProject}" in LangSmith dashboard at smith.langchain.com/settings then retry.` : undefined,
          raw: traceData
        }), { status: traceRes.status, headers: corsHeaders });
      }

      // 2. Perform Autonomous Deep Agent Inference with Full ReAct Tool-Calling Loop
      let outputData = null;
      const openrouterKey = env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY);
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      const tavilyKey = env && (env.TAVILY_API_KEY || env.TAVILY_KEY);
      const origin = new URL(request.url).origin;
      const imagePayload = body.image || body.imagePayload || body.attachedImage || (input && (input.image || input.imagePayload)) || null;
      const toolCtx = { origin, paasId, endUserId, compositeId, tavilyKey, modifiedFiles: [], projectFiles: body.currentFiles || [], imagePayload, googleKey };

      if (body.execute !== false && (openrouterKey || googleKey)) {
        const userPrompt = typeof input === 'string'
          ? input
          : (input.prompt || input.text || (Array.isArray(input.messages) ? input.messages[input.messages.length - 1]?.content : 'Hello'));

        const systemPrompt = body.systemPrompt ||
          `You are an autonomous LangSmith Deep Agent running on child PaaS (${paasId}) for end-user (${endUserId}).
Orchestrated by Runnerflo Meta-PaaS with full tool access — equal to Claude Managed Agent.

AVAILABLE TOOLS (26 TOOLS — FULL DEVELOPER SUITE, EQUAL TO CLAUDE MANAGED AGENT):
1. web_search — Search real-time web for docs, APIs, tutorials, pricing
2. read_code_file — Read current source code before editing
3. edit_code_file — Write/update code files (ALWAYS read first)
4. patch_code_file — Surgically replace unique text block without rewriting entire file
5. search_code — Search keyword, function name, class, variable, or text pattern across all project code files
6. list_files — List all files in the project with sizes and line counts
7. delete_file — Remove an obsolete or unused file from workspace
8. rename_file — Rename or move a file from oldPath to newPath
9. ask_human — Ask user for clarification (Human-in-the-Loop)
10. execute_code — Run JavaScript sandbox for data processing
11. fetch_url — Read any URL/API endpoint (MCP browser)
12. composio_execute_action — Execute Gmail, Slack, Sheets, Notion, GitHub actions
13. composio_get_connect_url — Generate OAuth connect URL (zero-config Google/SaaS login)
14. composio_check_connections — Check user's connected SaaS accounts
15. composio_search_apps — Search across 1,700+ SaaS apps & actions in Composio
16. database_query — Query tenant's cloud D1 database
17. database_schema — Inspect database table structures and columns
18. storage_save — Save files to Cloudflare R2 bucket
19. create_payment_checkout — Create Stripe payment/subscription checkout
20. trigger_background_job — Dispatch Trigger.dev v3 async background jobs
21. save_snapshot — Create a named restore point before major changes
22. rollback_snapshot — Restore project to a previous snapshot version
23. search_llm_models — Search frontier LLM models (DeepSeek, Gemini, Claude, GPT-4o, Llama 3.3)
24. inspect_image_reference — Perform OCR & visual analysis on attached reference image/screenshot to match against UI design
25. get_datetime — Get current UTC date, time, and Unix timestamp
26. debug_code — Diagnose syntax errors or logic bugs in code files

AGENTIC DISCOVERY & HUMAN-IN-THE-LOOP WORKFLOW:
- When a user asks for an agent involving third-party apps (e.g. HubSpot, Zendesk, Salesforce, WhatsApp), call composio_search_apps to discover available integrations.
- When an agent requires an LLM brain (OpenRouter / Google), call search_llm_models to inspect available models and prices. Default to Gemini (google/gemini-3.8-flash) if the user does not specify an LLM!
- When user provides an image or design screenshot, call inspect_image_reference to extract exact text, buttons, and colors to match!
- If the model choice or app selection is ambiguous, call ask_human to present clear multiple-choice options to the user before building!
- Think step-by-step before acting. Call read_code_file BEFORE editing any file.
- Always call edit_code_file when you modify code.
- Chain multiple tools when needed (search → read → edit → verify).

Respond in Indonesian if the user writes in Indonesian. Otherwise respond in English.`;

        const conversationMessages = Array.isArray(input.messages)
          ? input.messages.slice()
          : [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ];

        if (!conversationMessages.some(m => m.role === 'system')) {
          conversationMessages.unshift({ role: 'system', content: systemPrompt });
        }

        const modelChoice = body.model || 'google/gemini-3.8-flash';
        const agentSteps = [];
        let finalReply = '';
        let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 };
        let loopCount = 0;
        const maxLoops = 12; // Deeper reasoning loops

        while (loopCount < maxLoops) {
          loopCount++;

          // Try OpenRouter first, fallback to Gemini native
          let llmData = null;
          if (openrouterKey) {
            const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://runnerflo-b2b.pages.dev',
                'X-Title': 'Runnerflo LangSmith Deep Agent',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: modelChoice,
                messages: conversationMessages,
                tools: DEEP_AGENT_TOOLS,
                tool_choice: 'auto',
                temperature: 0.5,
                max_tokens: 8192
              })
            }).catch(() => null);
            if (llmRes && llmRes.ok) llmData = await llmRes.json().catch(() => null);
          }

          // Gemini fallback if OpenRouter failed or no key
          if (!llmData && googleKey) {
            const GEMINI_MODELS = [
              'gemini-3.8-flash',
              'gemini-3.5-flash-lite',
              'gemini-3-flash-preview',
              'gemini-2.5-flash',
              'gemini-2.0-flash',
              'gemini-1.5-flash'
            ];
            const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
            const gMessages = conversationMessages.filter(m => m.role !== 'tool').map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }));
            for (const mdl of GEMINI_MODELS) {
              try {
                const gRes = await fetch(`${GEMINI_BASE}/${mdl}:generateContent?key=${googleKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: gMessages, generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } })
                });
                if (gRes.ok) {
                  const gData = await gRes.json();
                  const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (text) { llmData = { choices: [{ message: { role: 'assistant', content: text } }] }; break; }
                }
              } catch (e) { /* try next */ }
            }
          }

          if (!llmData) { finalReply = 'Agent inference failed — no LLM available.'; break; }

          const choice = llmData.choices?.[0];
          const assistantMsg = choice?.message;

          if (llmData.usage) {
            totalUsage.prompt_tokens += (llmData.usage.prompt_tokens || 0);
            totalUsage.completion_tokens += (llmData.usage.completion_tokens || 0);
            totalUsage.total_tokens += (llmData.usage.total_tokens || 0);
            totalUsage.cost += (llmData.usage.cost || 0);
          }

          if (!assistantMsg) break;

          if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            conversationMessages.push(assistantMsg);

            for (const tc of assistantMsg.tool_calls) {
              const toolName = tc.function?.name || '';
              let toolArgs = {};
              try { toolArgs = JSON.parse(tc.function?.arguments || '{}'); } catch { toolArgs = {}; }

              // Post tool span to LangSmith trace
              const toolRunId = crypto.randomUUID();
              await fetch('https://api.smith.langchain.com/api/v1/runs', {
                method: 'POST', headers: commonHeaders,
                body: JSON.stringify({ id: toolRunId, name: `tool:${toolName}`, run_type: 'tool', parent_run_id: runId, inputs: toolArgs, start_time: new Date().toISOString(), session_name: langsmithProject, extra: { metadata: { paas_id: paasId, end_user_id: endUserId, tool_name: toolName } } })
              }).catch(() => null);

              const toolResult = await executeDeepAgentTool(toolName, toolArgs, toolCtx);

              await fetch(`https://api.smith.langchain.com/api/v1/runs/${toolRunId}`, {
                method: 'PATCH', headers: commonHeaders,
                body: JSON.stringify({ outputs: toolResult, end_time: new Date().toISOString() })
              }).catch(() => null);

              agentSteps.push({ tool: toolName, input: toolArgs, output: toolResult });

              // Human-in-the-loop: return immediately with question
              if (toolName === 'ask_human' && toolCtx.humanRequest) {
                await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
                  method: 'PATCH', headers: commonHeaders,
                  body: JSON.stringify({ outputs: { status: 'needs_clarification', question: toolCtx.humanRequest.question }, end_time: new Date().toISOString() })
                }).catch(() => null);
                return new Response(JSON.stringify({
                  ok: true, source: 'langsmith_deep_agent_v1', runId,
                  status: 'needs_clarification',
                  question: toolCtx.humanRequest.question,
                  options: toolCtx.humanRequest.options,
                  steps: agentSteps, tenantId: compositeId, paasId, endUserId
                }), { status: 200, headers: corsHeaders });
              }

              conversationMessages.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify(toolResult) });
            }
          } else {
            finalReply = assistantMsg.content || '';
            break;
          }
        }

        outputData = {
          output: finalReply,
          model: modelChoice,
          stepsCount: agentSteps.length,
          steps: agentSteps,
          modifiedFiles: toolCtx.modifiedFiles || [],
          usage: totalUsage
        };

        await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
          method: 'PATCH', headers: commonHeaders,
          body: JSON.stringify({ outputs: outputData, end_time: new Date().toISOString() })
        }).catch(() => null);
      }

      return new Response(JSON.stringify({
        ok: true,
        source: 'langsmith_deep_agent_v1',
        runId,
        tenantId: compositeId,
        paasId,
        endUserId,
        project: langsmithProject,
        result: outputData?.output || null,
        modifiedFiles: outputData?.modifiedFiles || [],
        steps: outputData?.steps || [],
        stepsCount: outputData?.stepsCount || 0,
        output: outputData,
        data: traceData
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 3. EDIT-CODE — LangSmith Full ReAct Edit Agent (Gemini + All Tools) ──
    // This is the MAIN EDIT ENGINE: replaces Totalum for follow-up prompts.
    // Tools: read_code_file, edit_code_file, web_search, fetch_url, ask_human, execute_code, composio, database, storage, stripe, trigger.dev
    if (subAction === 'edit-code') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      const openrouterKey = env && (env.OPENROUTER_API_KEY || env.OPENROUTER_KEY);
      const tavilyKey = env && (env.TAVILY_API_KEY || env.TAVILY_KEY);

      if (!googleKey && !openrouterKey) {
        return new Response(JSON.stringify({ ok: false, error: 'No LLM key available (GOOGLE_AI_API_KEY or OPENROUTER_API_KEY)', fallback: false }), { status: 200, headers: corsHeaders });
      }

      const userPrompt = typeof input === 'string' ? input : (input.prompt || input.text || 'Update the application');
      const projectName = body.projectName || paasId;
      const userLlmModel = body.userModel || 'google/gemini-3.8-flash';
      const userLlmProvider = body.userProvider || 'google';
      const currentFiles = (body.currentFiles || []).map(f => ({ path: f.path, content: f.content || '', name: f.name || f.path }));
      const currentHtmlFile = currentFiles.find(f => (f.path || f.name) === 'index.html') || currentFiles[0];
      const currentHtmlCode = currentHtmlFile ? currentHtmlFile.content : '';
      const history = body.history || [];

      // LangSmith: open edit-code trace
      const editRunId = crypto.randomUUID();
      await fetch('https://api.smith.langchain.com/api/v1/runs', {
        method: 'POST', headers: commonHeaders,
        body: JSON.stringify({
          id: editRunId,
          name: `gemini-edit-code-${paasId}`,
          run_type: 'chain',
          inputs: { prompt: userPrompt, projectName, filesCount: currentFiles.length },
          start_time: new Date().toISOString(),
          session_name: langsmithProject,
          extra: { metadata: { paas_id: paasId, end_user_id: endUserId, composite_tenant_id: compositeId, engine: 'edit-code', userLlmModel } }
        })
      }).catch(() => null);

      const origin = new URL(request.url).origin;
      const imagePayload = body.image || body.imagePayload || body.attachedImage || (input && (input.image || input.imagePayload)) || null;
      const toolCtx = {
        origin, paasId, endUserId, compositeId, tavilyKey,
        modifiedFiles: [],
        projectFiles: currentFiles,
        imagePayload,
        googleKey
      };

      // Build system prompt for edit — mirrors Claude Managed Agent system prompt
      const editSystemPrompt = `You are an Autonomous Lead Software Architect & Code Editor for Runnerflo Cloud Platform (Year 2026).
You are running as a LangSmith Managed Deep Agent for child PaaS: "${projectName}" (paasId: ${paasId}).

MISSION: Edit, improve, or update the existing application code as requested by the user.

MANDATORY WORKFLOW:
1. ALWAYS call read_code_file("index.html") or search_code/list_files to understand the current code
2. If you need research (e.g. library docs, API references), call web_search
3. If user provided a reference image or design mockup, call inspect_image_reference to extract exact text and UI components
4. Plan your changes carefully, then call edit_code_file with the COMPLETE updated file
5. If the task is ambiguous, call ask_human before proceeding
6. If you need to run a calculation or data transformation, use execute_code
7. After editing, write a clear summary of what changed

AVAILABLE TOOLS (26 TOOLS): read_code_file, edit_code_file, patch_code_file, search_code, list_files, delete_file, rename_file, web_search, fetch_url, ask_human, execute_code, composio_execute_action, composio_get_connect_url, composio_check_connections, composio_search_apps, database_query, database_schema, storage_save, create_payment_checkout, trigger_background_job, save_snapshot, rollback_snapshot, search_llm_models, inspect_image_reference, get_datetime, debug_code

AGENTIC AGENT CREATION & DISCOVERY:
- If user wants an agent for any of Composio's 1,700+ apps (e.g. CRM, email, social, support), call composio_search_apps to find exact app IDs and action names.
- If user wants to choose or change the LLM brain (OpenRouter models), call search_llm_models to get available models.
- If user does NOT specify an LLM model, default directly to Gemini via LangSmith Managed Deep Agent (google/gemini-3.8-flash, provider: google).
- When user provides an image or design screenshot, call inspect_image_reference to extract exact text, buttons, and colors to match!
- If user requirements need clarification, call ask_human with a question and options list so the user can choose directly.

ZERO-BYOK MANDATE: NEVER add API key input forms. ALL external API calls MUST use Runnerflo's centralized endpoints:
- LLM: fetch('/api/gateway', { body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: '${userLlmProvider}', model: '${userLlmModel}', input: { messages: [...] } }) })
- Agent: fetch('/api/langsmith', { body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, action: 'run', model: '${userLlmModel}', provider: '${userLlmProvider}', input: { prompt: '...' } }) })
- Composio OAuth: fetch('/api/composio?action=connect-url&app=google&paasId='+PAAS_ID+'&endUserId='+END_USER_ID)
- Database: fetch('/api/totalum?action=database-ask&projectId='+PAAS_ID, { method: 'POST', body: JSON.stringify({ question: '...' }) })
- Storage: fetch('/api/storage?action=save', { method: 'POST', body: JSON.stringify({ paasId: PAAS_ID, file: 'name.json', content: '...' }) })
- Stripe: fetch('/api/totalum?action=stripe-checkout&projectId='+PAAS_ID, { method: 'POST', body: JSON.stringify({ plan: 'Pro', amount: 1999 }) })

TENANT DUAL-IDENTITY (inject if not present):
const PAAS_ID = window.PAAS_ID || '${paasId}';
let END_USER_ID = localStorage.getItem('rf_end_user_id');
if (!END_USER_ID) { END_USER_ID = 'usr_' + Math.random().toString(36).substring(2,10); localStorage.setItem('rf_end_user_id', END_USER_ID); }

CHILD PAAS FULL TOOL INJECTION — INJECT ALL THESE HELPER FUNCTIONS IN THE GENERATED CODE:
\`\`\`javascript
// === RUNNERFLO CHILD PAAS FULL TOOL SUITE ===
async function callLangSmithAgent(prompt, history=[]) {
  const res = await fetch('/api/langsmith', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, action: 'run',
      model: '${userLlmModel}', provider: '${userLlmProvider}', input: { prompt, messages: history } }) });
  return await res.json();
}
async function callLLM(messages) {
  const res = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: '${userLlmProvider}', model: '${userLlmModel}', input: { messages } }) });
  return await res.json();
}
async function loginWithGoogle() {
  const res = await fetch('/api/composio?action=connect-url&app=google&paasId='+PAAS_ID+'&endUserId='+END_USER_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json(); if (data.connectUrl) { window.open(data.connectUrl, '_blank') || (window.top.location.href = data.connectUrl); }
}
async function checkConnection(app='google') {
  const res = await fetch('/api/composio?action=connections&paasId='+PAAS_ID+'&endUserId='+END_USER_ID); return await res.json();
}
async function executeSaaS(actionName, params={}) {
  const res = await fetch('/api/composio?action=execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionName, paasId: PAAS_ID, endUserId: END_USER_ID, input: params }) });
  return await res.json();
}
async function queryDB(question, table='') {
  const res = await fetch('/api/totalum?action=database-ask&projectId='+PAAS_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, table }) });
  return await res.json();
}
async function saveToCloud(fileName, content) {
  const res = await fetch('/api/storage?action=save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paasId: PAAS_ID, file: fileName, content }) });
  return await res.json();
}
async function createPayment(plan, amountCents, currency='usd') {
  const res = await fetch('/api/totalum?action=stripe-checkout&projectId='+PAAS_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, plan, amount: amountCents, currency }) });
  const data = await res.json(); if (data.checkoutUrl) window.location.href = data.checkoutUrl; return data;
}
async function triggerJob(taskId, payload={}) {
  const res = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'trigger', taskId, payload }) });
  return await res.json();
}
// === END RUNNERFLO TOOL SUITE ===
\`\`\`

PROJECT CONTEXT:
- Name: "${projectName}" | paasId: ${paasId}
- User's LLM: ${userLlmModel} (${userLlmProvider})
- Current files: ${currentFiles.map(f => f.path).join(', ') || 'index.html'}
${currentHtmlCode ? `\nCURRENT APPLICATION CODE (${currentHtmlFile ? (currentHtmlFile.path || 'index.html') : 'index.html'} — ${currentHtmlCode.length} bytes):\n\`\`\`html\n${currentHtmlCode.slice(0, 50000)}\n\`\`\`\n` : ''}
EDITING RULES:
1. You are EDITING the existing application above. DO NOT build a brand new unrelated project from scratch!
2. Retain all existing styling, layout, components, and functions unless the user specifically asks to change them.
3. MANDATORY DUAL-LAYER ARCHITECTURE (LANDING PAGE + APP DASHBOARD):
   If user asks: "kok engga ada landing page", "tambahkan landing page", "landing page terlalu sederhana", or says "continue/lanjutkan":
   - You MUST ensure "index.html" has BOTH:
     Layer 1: Full Public Landing Page (<div id="landingView">):
       * Header/Navbar: Brand Logo, Links (Fitur, Demo, Harga, Testimoni, Kontak), "Masuk dengan Google" button, and prominent CTA "Buka Dashboard" (with onclick="switchView('app')").
       * Hero Section: Headline, description, badges, and primary CTA ("Buka Dashboard / Mulai Sekarang").
       * Features Grid: 3-6 beautifully styled feature cards showcasing the platform's core tools.
       * Live Preview / Interactive Showcase: Interactive demo previewing what the tool does.
       * Pricing Section: Clear tiered cards (Gratis, Pro, Enterprise) with CTA buttons.
       * Testimonials & Stats: User ratings, reviews, trust badges.
       * Comprehensive Footer: Company info, links, copyright, social icons.
     Layer 2: Functional App Workspace / Dashboard (<div id="appView" style="display:none">):
       * Top bar with "← Kembali ke Beranda" button (onclick="switchView('landing')") and user profile/auth status.
       * The complete interactive tool/studio (all existing functions preserved and enhanced).
   - Provide a clean JavaScript toggle:
     function switchView(view) {
       var lv = document.getElementById('landingView');
       var av = document.getElementById('appView');
       if (lv) lv.style.display = (view === 'landing' ? 'block' : 'none');
       if (av) av.style.display = (view === 'app' ? 'block' : 'none');
       window.scrollTo(0, 0);
     }
4. Call "edit_code_file" with the complete updated code, or output the full updated HTML code wrapped in an html code block.

Respond in Indonesian if the prompt is in Indonesian. Otherwise respond in English.
After editing: write a one-line summary of what changed.`;

      // Build conversation with history
      const editMessages = [{ role: 'system', content: editSystemPrompt }];
      history.slice(-4).forEach(h => { if (h.role && h.text) editMessages.push({ role: h.role === 'agent' ? 'assistant' : h.role, content: h.text }); });
      editMessages.push({ role: 'user', content: userPrompt });

      const agentSteps = [];
      let finalReply = '';
      let loopCount = 0;
      const maxLoops = 10;

      while (loopCount < maxLoops) {
        loopCount++;

        // Try OpenRouter first (supports tool_calls natively), fallback to Gemini
        let llmData = null;
        if (openrouterKey) {
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openrouterKey}`, 'HTTP-Referer': 'https://runnerflo-b2b.pages.dev', 'X-Title': 'Runnerflo LangSmith Edit Agent', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: userLlmModel.includes('/') ? userLlmModel : `openai/${userLlmModel}`, messages: editMessages, tools: DEEP_AGENT_TOOLS, tool_choice: 'auto', temperature: 0.3, max_tokens: 32768 })
          }).catch(() => null);
          if (r && r.ok) llmData = await r.json().catch(() => null);
        }

        // Gemini native fallback (native function calling + multimodal vision OCR)
        if (!llmData && googleKey) {
          const GEMINI_MODELS = [
            'gemini-3.8-flash',
            'gemini-3.5-flash-lite',
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash'
          ];
          const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
          const gContents = editMessages.filter(m => m.role !== 'tool').map(m => ({
            role: m.role === 'assistant' ? 'model' : (m.role === 'system' ? 'user' : m.role),
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
          }));

          // Attach multimodal image payload to Gemini user prompt for OCR & visual matching
          if (imagePayload) {
            let b64 = typeof imagePayload === 'string' ? imagePayload : (imagePayload.data || imagePayload.base64 || '');
            let mime = (typeof imagePayload === 'object' && (imagePayload.mimeType || imagePayload.type)) || 'image/jpeg';
            if (b64.startsWith('data:')) {
              const parts = b64.split(',');
              const m = parts[0].match(/data:([^;]+);base64/);
              if (m) mime = m[1];
              b64 = parts[1];
            }
            if (b64) {
              const lastUser = [...gContents].reverse().find(c => c.role === 'user');
              if (lastUser && lastUser.parts && !lastUser.parts.some(p => p.inlineData)) {
                lastUser.parts.unshift({ inlineData: { mimeType: mime, data: b64 } });
              }
            }
          }

          const gTools = [{ function_declarations: DEEP_AGENT_TOOLS.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }];
          for (const mdl of GEMINI_MODELS) {
            try {
              const gRes = await fetch(`${GEMINI_BASE}/${mdl}:generateContent?key=${googleKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: gContents, tools: gTools, generationConfig: { temperature: 0.3, maxOutputTokens: 32768 } })
              });
              if (gRes.ok) {
                const gData = await gRes.json();
                const part = gData.candidates?.[0]?.content?.parts?.[0];
                if (part?.functionCall) {
                  // Normalize Gemini function call to OpenAI format
                  llmData = { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: `call_${Math.random().toString(36).slice(2)}`, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) } }] } }] };
                } else if (part?.text) {
                  llmData = { choices: [{ message: { role: 'assistant', content: part.text } }] };
                }
                if (llmData) break;
              }
            } catch (e) { /* try next */ }
          }
        }

        if (!llmData) { finalReply = 'Edit agent inference failed — no LLM key available.'; break; }

        const choice = llmData.choices?.[0];
        const assistantMsg = choice?.message;
        if (!assistantMsg) break;

        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          editMessages.push(assistantMsg);
          for (const tc of assistantMsg.tool_calls) {
            const toolName = tc.function?.name || '';
            let toolArgs = {};
            try { toolArgs = JSON.parse(tc.function?.arguments || '{}'); } catch { toolArgs = {}; }

            // LangSmith tool span
            const toolRunId = crypto.randomUUID();
            await fetch('https://api.smith.langchain.com/api/v1/runs', {
              method: 'POST', headers: commonHeaders,
              body: JSON.stringify({ id: toolRunId, name: `tool:${toolName}`, run_type: 'tool', parent_run_id: editRunId, inputs: toolArgs, start_time: new Date().toISOString(), session_name: langsmithProject, extra: { metadata: { paas_id: paasId, tool_name: toolName } } })
            }).catch(() => null);

            const toolResult = await executeDeepAgentTool(toolName, toolArgs, toolCtx);

            await fetch(`https://api.smith.langchain.com/api/v1/runs/${toolRunId}`, {
              method: 'PATCH', headers: commonHeaders,
              body: JSON.stringify({ outputs: toolResult, end_time: new Date().toISOString() })
            }).catch(() => null);

            agentSteps.push({ tool: toolName, input: toolArgs, output: toolResult, done: true, label: `${toolName}: ${toolArgs.path || toolArgs.query || toolArgs.question || ''}`.slice(0, 80) });

            // Human-in-the-loop: pause and return question to frontend
            if (toolName === 'ask_human' && toolCtx.humanRequest) {
              await fetch(`https://api.smith.langchain.com/api/v1/runs/${editRunId}`, {
                method: 'PATCH', headers: commonHeaders,
                body: JSON.stringify({ outputs: { status: 'needs_clarification' }, end_time: new Date().toISOString() })
              }).catch(() => null);
              return new Response(JSON.stringify({
                ok: true, source: 'langsmith_edit_agent', runId: editRunId,
                status: 'needs_clarification',
                question: toolCtx.humanRequest.question,
                options: toolCtx.humanRequest.options || [],
                steps: agentSteps, paasId, endUserId
              }), { status: 200, headers: corsHeaders });
            }

            editMessages.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: JSON.stringify(toolResult) });
          }
        } else {
          finalReply = assistantMsg.content || '';
          break;
        }
      }

      // Collect all edited files from toolCtx
      const modifiedFiles = toolCtx.modifiedFiles || [];
      const primaryFile = modifiedFiles.find(f => f.path === 'index.html') || modifiedFiles[0];
      let htmlCode = primaryFile ? primaryFile.code : null;

      // If agent didn't call edit_code_file but output HTML code in text — extract it!
      if (!htmlCode && finalReply) {
        const htmlMatch = finalReply.match(/```(?:html|xml)?\s*([\s\S]*?)```/i);
        if (htmlMatch && htmlMatch[1]) {
          htmlCode = htmlMatch[1].trim();
        } else if (finalReply.includes('<!DOCTYPE') || finalReply.includes('<html')) {
          const bare = finalReply.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
          if (bare) htmlCode = bare[0].trim();
        }
        if (htmlCode) {
          modifiedFiles.push({ path: 'index.html', code: htmlCode, summary: 'Updated via text output' });
        }
      }

      // Run Zero-BYOK validator on the edited code
      let auditResult = null;
      if (htmlCode) {
        auditResult = validateAndSanitizePaaSCode(htmlCode, paasId);
        if (primaryFile) primaryFile.code = auditResult.code;
      }

      // Auto-save to R2 if code was edited
      if (htmlCode) {
        await fetch(`${origin}/api/storage?action=save`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paasId, projectName, file: 'index.html', content: htmlCode, totalumProjectId: null })
        }).catch(() => null);
      }

      // Patch LangSmith trace with outputs
      await fetch(`https://api.smith.langchain.com/api/v1/runs/${editRunId}`, {
        method: 'PATCH', headers: commonHeaders,
        body: JSON.stringify({ outputs: { output: finalReply, filesEdited: modifiedFiles.length, audit: auditResult }, end_time: new Date().toISOString() })
      }).catch(() => null);

      return new Response(JSON.stringify({
        ok: true,
        source: 'langsmith_edit_agent',
        runId: editRunId,
        tenantId: compositeId,
        paasId,
        endUserId,
        htmlCode: htmlCode || null,
        code: htmlCode || null,
        modifiedFiles,
        summary: finalReply,
        steps: agentSteps,
        audit: auditResult
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 3b. Deep Agent Interactive Consultation (Turn-by-turn Architecture Intake) ──
    if (subAction === 'consult') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      const userPrompt = typeof input === 'string' ? input : (input.prompt || input.text || '');
      const currentStep = (body.step || (input && input.step) || 1);
      const pathway = body.pathway || (input && input.pathway) || '';
      const chatHistory = Array.isArray(body.history) ? body.history.slice(-8) : [];
      const confirmedSpecs = body.confirmedSpecs || (input && input.confirmedSpecs) || {};

      const consultSystemPrompt = `You are the Friendly AI Solutions Architect & Co-Founder Consultant at Runnerflo.
Your goal: Conduct a warm, encouraging, step-by-step consultation for a user who wants to build an AI platform or autonomous agent.

CRITICAL COMMUNICATION GUIDELINES:
1. ADAPTIVE LANGUAGE:
   - If user asks or writes in Indonesian, reply in natural, polite, friendly, and encouraging Indonesian.
   - If user asks or writes in English, reply in English.
2. NO CONFUSING JARGON (HUMAN-FRIENDLY FOR NON-TECH FOUNDERS):
   - Never use intimidating technical terms like "ReAct supervisor loop", "multimodal tensor pipeline", or "REST webhooks".
   - Instead explain clearly:
     * "AI Agent": Karyawan digital otonom yang bekerja menyelesaikan tugas nyata di background tanpa perlu diawasi terus-menerus.
     * "Composio": Jembatan koneksi ke 1.700+ aplikasi harian (WhatsApp, Gmail, Sheets, Notion, Stripe).
     * "SaaS AI": Website/aplikasi tempat pelanggan datang untuk menggunakan alat AI (video reels, gambar, tulisan).
     * "Replicate / Fal.ai / Wavespeed": Mesin AI cepat untuk bikin video, avatar, atau gambar.
3. THE TWO PATHWAYS:
   - Jalur 1: AI Agent (Karyawan Otonom untuk tugas: follow-up sales, CS 24 jam, pencatatan keuangan, pencari leads).
   - Jalur 2: SaaS AI (Aplikasi produk web yang menjual tools AI ke orang lain: video reels generator, copywriting, desain produk).
4. TURN-BY-TURN INTERACTION:
   - Handle ONE step at a time! Do NOT dump 5 questions in one turn.
   - If user asks a question (e.g., "apa bedanya?", "bisa sambung ke WhatsApp?"), answer their question warmly and clearly first, then guide them forward.
   - If user says "langsung buatkan", "generate sekarang", "rekomendasi terbaikmu", or has completed the steps, set "readyToBuild": true.
5. STEPS:
   - Step 1: Jalur Produk (AI Agent vs SaaS AI)
   - Step 2: Tugas / Hasil Kerja Nyata (Outcome)
   - Step 3: Alat yang Dihubungkan (Composio apps & AI models)
   - Step 4: Alur Kontrol (100% Otonom vs Butuh Persetujuan User)
   - Step 5: Model Bisnis & Pembayaran (Bayar per hasil, saldo token, atau langganan)

OUTPUT STRICTLY IN JSON FORMAT:
{
  "reply": "Pesan konsultasi ramah, santai, dan jelas untuk user",
  "nextStep": 2,
  "pathway": "agent or saas",
  "suggestedChips": ["Chip 1", "Chip 2", "Chip 3", "🚀 Langsung Bangun Sekarang"],
  "readyToBuild": false,
  "confirmedSpecs": {
    "pathway": "AI Agent | SaaS AI",
    "outcome": "...",
    "tools": "...",
    "workflow": "...",
    "monetization": "..."
  }
}`;

      let consultData = null;
      if (googleKey) {
        const GEMINI_MODELS = [
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash'
        ];
        const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
        const gContents = [
          { role: 'user', parts: [{ text: `User Prompt: ${userPrompt}\nCurrent Step: ${currentStep}\nPathway: ${pathway}\nConfirmed Specs: ${JSON.stringify(confirmedSpecs)}\nChat History: ${JSON.stringify(chatHistory)}` }] }
        ];

        for (const mdl of GEMINI_MODELS) {
          try {
            const gRes = await fetch(`${GEMINI_BASE}/${mdl}:generateContent?key=${googleKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: consultSystemPrompt }] },
                contents: gContents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: 'application/json' }
              })
            });
            if (gRes.ok) {
              const resJson = await gRes.json();
              const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text) {
                try { consultData = JSON.parse(text); break; } catch(e) {
                  const m = text.match(/\{[\s\S]*\}/);
                  if (m) { consultData = JSON.parse(m[0]); break; }
                }
              }
            }
          } catch(e) {}
        }
      }

      if (!consultData) {
        const isEn = /^(?:hello|hi|build|create|what|can)\b/i.test(userPrompt);
        consultData = {
          reply: isEn
            ? 'Great idea! To tailor your platform, what is the core outcome your users or business will achieve?'
            : 'Pilihan yang sangat bagus! Agar platform ini menghasilkan nilai nyata, apa tugas utama atau hasil akhir yang ingin diselesaikan?',
          nextStep: Math.min(currentStep + 1, 5),
          pathway: pathway || 'agent',
          suggestedChips: isEn
            ? ['Automated Sales Leads', 'Customer Support 24/7', 'Video & Media Production', '🚀 Build Platform Now']
            : ['Cari Calon Pembeli & Kirim Penawaran', 'Layanan Chat CS 24 Jam', 'Pencatatan Keuangan Otomatis', '🚀 Langsung Bangun Sekarang'],
          readyToBuild: /buatkan|bangun|generate|build now|start now/i.test(userPrompt),
          confirmedSpecs
        };
      }

      return new Response(JSON.stringify({
        ok: true,
        source: 'langsmith_consultant',
        data: consultData
      }), { status: 200, headers: corsHeaders });
    }

    // ─── 4. Gemini UI/UX Generator (LangSmith Deep Agent — Google AI Studio) ──
    // Orkestrasi: LangSmith trace → Gemini generate UI/UX → inject capabilities
    // Fallback chain: gemini-2.5-flash → gemini-2.0-flash-lite → gemini-1.5-flash
    if (subAction === 'generate-ui') {
      const googleKey = env && (env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);

      if (!googleKey) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'GOOGLE_AI_API_KEY belum disetel di Cloudflare Pages. Tambahkan via Settings > Environment Variables.',
          fallback: 'claude'
        }), { status: 200, headers: corsHeaders });
      }

      const userPrompt = typeof input === 'string'
        ? input
        : (input.prompt || input.text || 'Build a modern SaaS application');
      const projectName = body.projectName || paasId.replace(/[^a-z0-9-]+/g, '-') || 'runnerflo-app';
      const userLlmModel = body.userModel || 'google/gemini-3.8-flash';
      const userLlmProvider = body.userProvider || 'google';

      // LangSmith: open trace run BEFORE inference
      const runId = crypto.randomUUID();
      const startTime = new Date().toISOString();
      await fetch('https://api.smith.langchain.com/api/v1/runs', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          id: runId,
          name: `gemini-ui-generator-${paasId}`,
          run_type: 'llm',
          inputs: { prompt: userPrompt, projectName },
          start_time: startTime,
          session_name: langsmithProject,
          extra: { metadata: { paas_id: paasId, end_user_id: endUserId, composite_tenant_id: compositeId, engine: 'gemini-ui-generator' } }
        })
      }).catch(() => null);

      // ── System Prompt: SAMA PERSIS dengan Claude Managed Agent ──────────────
      const geminiSystemPrompt = `You are an Autonomous Lead Software Architect & Orchestrator for the Runnerflo Cloud Platform (Year 2026).

CORE MISSION: META-PAAS (PLATFORM-AS-A-SERVICE THAT BUILDS PAAS & SAAS)
Runnerflo is a META-PAAS: an enterprise platform that autonomously constructs complete, production-ready PaaS and SaaS platforms for customers.
Every generated application is a full, turnkey platform operating with an isolated tenant ID (e.g. "${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}").

CRITICAL 4-ENGINE AI & AGENT GATEWAY ARCHITECTURE (STRICT RUNNERFLO TOPOLOGY):
Runnerflo provides a centralized, turnkey Edge Gateway at "/api/gateway" and LangSmith agent dispatcher at "/api/langsmith".
The platform owner manages ALL API keys centrally in Cloudflare Pages Secrets.

TENANT DUAL-IDENTITY STANDARD (paas_id + end_user_id):
Every generated child PaaS operates with two distinct identities that must never be mixed up:
1. paasId: The unique identifier of the generated child PaaS (e.g. "${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}").
2. endUserId: The specific end-user using the child PaaS (persisted in client localStorage or session).
Composite Tenant Identity format: "${projectName}:{endUserId}".
In every client script, initialize tenant identity:
\`\`\`javascript
const PAAS_ID = window.PAAS_ID || '${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}';
let END_USER_ID = localStorage.getItem('rf_end_user_id');
if (!END_USER_ID) {
  END_USER_ID = 'usr_' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('rf_end_user_id', END_USER_ID);
}
const COMPOSITE_TENANT_ID = PAAS_ID + ':' + END_USER_ID;
\`\`\`

STRICT TOPOLOGY MANDATE:
All generated PaaS and SaaS applications MUST send their API calls EXCLUSIVELY to Runnerflo internal endpoints ("/api/gateway", "/api/langsmith", "/api/composio").
NEVER make direct calls to third-party APIs from the generated code!
Runnerflo acts as the single central hub holding all credentials, metering, and tenant isolation.

THE 4 UNIVERSAL ENGINES:
1. Engine 1 — LLM (User's chosen model: ${userLlmModel} via ${userLlmProvider}):
   Call: fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: '${userLlmProvider}', model: '${userLlmModel}', input: { messages: [...] } }) })
2. Engine 2 — Replicate (Video, audio, speech-to-text):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'replicate', model: 'owner/model', input: {...} }) })
3. Engine 3 — WaveSpeed (Real-time video & avatar):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'wavespeed', model: '...', input: {...} }) })
4. Engine 4 — fal.ai (Fast diffusion: Flux, Kling, Wan2.1):
   Call: fetch('/api/gateway', {..., body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'fal', model: 'fal-ai/...', input: {...} }) })

LANGSMITH MANAGED DEEP AGENT & COMPOSIO MANAGED APIS (ZERO-CONFIG GOOGLE OAUTH):
- LangSmith Deep Agent (user's chosen AI model: ${userLlmModel}):
  Call: fetch('/api/langsmith', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, action: 'run', model: '${userLlmModel}', provider: '${userLlmProvider}', input: { prompt: '...' } }) })

- COMPOSIO MANAGED APPS GOOGLE OAUTH (MANDATORY PATTERN):
  Every generated PaaS that needs user login MUST use Composio Managed Auth.
  DO NOT ask end-users for Google Cloud Client IDs or Secrets!
  \`\`\`javascript
  async function loginWithGoogle() {
    const redirectUri = window.location.href;
    const res = await fetch('/api/composio?action=connect-url&app=google&paasId=' + encodeURIComponent(PAAS_ID) + '&endUserId=' + encodeURIComponent(END_USER_ID) + '&redirectUri=' + encodeURIComponent(redirectUri));
    const data = await res.json();
    if (data.connectUrl) { window.open(data.connectUrl, '_blank') || (window.top.location.href = data.connectUrl); }
  }
  async function checkGoogleConnection() {
    const res = await fetch('/api/composio?action=connections&paasId=' + encodeURIComponent(PAAS_ID) + '&endUserId=' + encodeURIComponent(END_USER_ID));
    const data = await res.json();
    return Boolean(data.connections && data.connections.some(c => c.appName.toLowerCase().includes('google') || c.status === 'ACTIVE'));
  }
  \`\`\`

TWO MANDATORY ARCHITECTURAL INJECTIONS IN THE GENERATED UI/UX:

INJECTION 1: TOTALUM CLOUD INFRASTRUCTURE (HOSTING, DB, DOMAIN, STRIPE PAYMENT):
The generated application runs on Totalum Cloud infrastructure. Provide working client-side helper functions for Totalum Database and Stripe Connect:
  \`\`\`javascript
  // 1. Totalum Cloud Database Query (D1/SQLite per tenant)
  async function queryTenantDatabase(question) {
    const res = await fetch('/api/totalum?action=database-ask&projectId=' + encodeURIComponent(PAAS_ID), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    return await res.json();
  }

  // 2. Cloudflare R2 Cloud Storage Sync (per tenant bucket)
  async function saveToCloudStorage(fileName, content) {
    const res = await fetch('/api/storage?action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, file: fileName, content })
    });
    return await res.json();
  }

  // 3. Stripe Connect Payment Gateway Checkout
  async function initiateStripePayment(planName, amountCents) {
    const res = await fetch('/api/totalum?action=stripe-checkout&projectId=' + encodeURIComponent(PAAS_ID), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, plan: planName, amount: amountCents })
    });
    const data = await res.json();
    if (data.checkoutUrl) { window.location.href = data.checkoutUrl; }
    return data;
  }
  \`\`\`

INJECTION 2: FULL RUNNERFLO CHILD PAAS TOOL SUITE (LANGSMITH + COMPOSIO + TRIGGER.DEV + STRIPE):
Inject ALL these helper functions — every child PaaS must have full autonomous agent capabilities:
  \`\`\`javascript
  // === RUNNERFLO CHILD PAAS FULL TOOL SUITE ===
  async function callLangSmithAgent(prompt, history=[]) {
    const res = await fetch('/api/langsmith', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, action: 'run',
        model: '\${userLlmModel}', provider: '\${userLlmProvider}', input: { prompt, messages: history } }) });
    return await res.json();
  }
  async function callLLM(messages) {
    const res = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: '\${userLlmProvider}', model: '\${userLlmModel}', input: { messages } }) });
    return await res.json();
  }
  async function loginWithGoogle() {
    const res = await fetch('/api/composio?action=connect-url&app=google&paasId='+PAAS_ID+'&endUserId='+END_USER_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json(); if (data.connectUrl) { window.open(data.connectUrl, '_blank') || (window.top.location.href = data.connectUrl); }
  }
  async function checkConnection() {
    const res = await fetch('/api/composio?action=connections&paasId='+PAAS_ID+'&endUserId='+END_USER_ID); return await res.json();
  }
  async function executeSaaS(actionName, params={}) {
    const res = await fetch('/api/composio?action=execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionName, paasId: PAAS_ID, endUserId: END_USER_ID, input: params }) });
    return await res.json();
  }
  async function queryDB(question, table='') {
    const res = await fetch('/api/totalum?action=database-ask&projectId='+PAAS_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, table }) });
    return await res.json();
  }
  async function saveToCloud(fileName, content) {
    const res = await fetch('/api/storage?action=save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, file: fileName, content }) });
    return await res.json();
  }
  async function createPayment(plan, amountCents, currency='usd') {
    const res = await fetch('/api/totalum?action=stripe-checkout&projectId='+PAAS_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, plan, amount: amountCents, currency }) });
    const data = await res.json(); if (data.checkoutUrl) window.location.href = data.checkoutUrl; return data;
  }
  async function triggerJob(taskId, payload={}) {
    const res = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paasId: PAAS_ID, endUserId: END_USER_ID, provider: 'trigger', taskId, payload }) });
    return await res.json();
  }
  // === END RUNNERFLO TOOL SUITE ===
  \`\`\`

ABSOLUTE NO-BYOK (BRING YOUR OWN KEY) MANDATE:
- NEVER output UI forms asking end-users to input API keys. That is strictly prohibited!
- All AI, 3D, video, and agent capabilities must be wired directly to "/api/gateway", "/api/langsmith", or "/api/composio".

CRITICAL DIRECTIVE: CREATING NEW APPLICATION FROM ZERO
1. YOU ARE IN CREATION MODE. Build a brand new, production-grade application for: "${userPrompt}".
2. You MUST produce a COMPLETE, self-contained, browser-executable HTML5 file as "index.html".
3. Use Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>) and working interactive JavaScript.
4. MANDATORY DUAL-LAYER ARCHITECTURE (LANDING PAGE + APP DASHBOARD):
   Every generated platform MUST include BOTH layers in a single responsive HTML5 file:
   - Layer 1: High-converting Public Landing Page (<div id="landingView">):
     * Modern Navbar with Brand Logo, Navigation Links (Fitur, Demo, Harga, Testimoni), "Masuk dengan Google" button, and prominent CTA "Buka Dashboard" (with onclick="switchView('app')").
     * Hero Section with compelling headline, subtitle, social proof badges, and primary CTA ("Mulai Sekarang / Buka Dashboard").
     * Features Grid: 3-6 beautifully styled feature cards with icons and descriptions.
     * Live Interactive Preview / Demo Section: An embedded preview demonstrating the core value.
     * Pricing Table: Clear tiered pricing (Gratis, Pro, Enterprise) with Stripe-ready CTA buttons.
     * Testimonials & Stats: User ratings, reviews, and trust metrics.
     * Comprehensive Footer: Multi-column footer with company details, links, copyright, and social icons.
   - Layer 2: Fully Functional Application / Dashboard (<div id="appView" style="display:none">):
     * Accessible via CTA: Clicking "Buka Dashboard" or "Mulai Sekarang" switches view to appView.
     * Top navigation bar with "← Kembali ke Beranda" button (onclick="switchView('landing')") so users can toggle back at any time.
     * Full interactive application matching the prompt (video reel generator, AI creator, workspace, etc.).
   - Include working JavaScript view switcher:
     function switchView(view) {
       var lv = document.getElementById('landingView');
       var av = document.getElementById('appView');
       if (lv) lv.style.display = (view === 'landing' ? 'block' : 'none');
       if (av) av.style.display = (view === 'app' ? 'block' : 'none');
       window.scrollTo(0, 0);
     }
5. DO NOT default to dark theme unless explicitly requested. Use crisp light backgrounds (bg-white, bg-slate-50).
6. Output ONLY the complete HTML code inside a single html code block (wrapped in triple backticks with "html" language tag).

PROJECT CONTEXT:
- Project Name: "${projectName}"
- Tenant ID: "${paasId}"
- User's LLM Choice: ${userLlmModel} (${userLlmProvider})

Respond in Indonesian if the prompt is in Indonesian. Otherwise respond in English.`;

      // Gemini model fallback chain: gemini-3.8-flash -> gemini-3.5-flash-lite -> gemini-3-flash-preview -> 2.5-flash -> 2.0-flash -> 1.5-flash
      const GEMINI_MODELS = [
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ];
      const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

      let geminiResult = null;
      let usedModel = '';
      let geminiError = '';

      for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const mdl = GEMINI_MODELS[i];
        try {
          const gRes = await fetch(`${GEMINI_BASE}/${mdl}:generateContent?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: geminiSystemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 65536 }
            })
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text && text.length > 100) {
              geminiResult = text;
              usedModel = mdl;
              break;
            }
          } else {
            const errBody = await gRes.text().catch(() => '');
            geminiError = `${mdl}: HTTP ${gRes.status} — ${errBody.slice(0, 200)}`;
          }
        } catch (e) {
          geminiError = `${mdl}: ${e.message}`;
        }
      }

      // If all Gemini models failed → signal frontend to fall back to Claude
      if (!geminiResult) {
        await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
          method: 'PATCH', headers: commonHeaders,
          body: JSON.stringify({ outputs: { error: geminiError }, end_time: new Date().toISOString(), error: geminiError })
        }).catch(() => null);

        return new Response(JSON.stringify({
          ok: false,
          fallback: 'claude',
          runId,
          tenantId: compositeId,
          paasId,
          endUserId,
          error: geminiError || 'All Gemini models failed',
          hint: 'Frontend should activate Claude Managed Agent fallback.'
        }), { status: 200, headers: corsHeaders });
      }

      // Extract HTML from Gemini output
      let htmlCode = '';
      const htmlMatch = geminiResult.match(/```(?:html|xml)?\s*([\s\S]*?```)/i);
      if (htmlMatch && htmlMatch[1]) {
        htmlCode = htmlMatch[1].replace(/```\s*$/, '').trim();
      } else if (geminiResult.includes('<!DOCTYPE') || geminiResult.includes('<html')) {
        const bare = geminiResult.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
        htmlCode = bare ? bare[0].trim() : geminiResult.trim();
      } else {
        htmlCode = geminiResult.trim();
      }

      // Checklist E-03: Post-Generation Static Code Validator (Zero-BYOK & Secrets Sanitizer)
      const auditResult = validateAndSanitizePaaSCode(htmlCode, paasId);
      htmlCode = auditResult.code;

      // PATCH LangSmith run with output
      await fetch(`https://api.smith.langchain.com/api/v1/runs/${runId}`, {
        method: 'PATCH', headers: commonHeaders,
        body: JSON.stringify({
          outputs: {
            htmlLength: htmlCode.length,
            model: usedModel,
            projectName,
            audit: auditResult
          },
          end_time: new Date().toISOString()
        })
      }).catch(() => null);

      return new Response(JSON.stringify({
        ok: true,
        source: 'gemini_ui_generator',
        runId,
        tenantId: compositeId,
        paasId,
        endUserId,
        model: usedModel,
        htmlCode,
        audit: auditResult,
        projectName,
        userLlmModel,
        userLlmProvider
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: `Unknown action: "${subAction}". Supported: run, thread, dispatch, generate-ui, edit-code.`
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
