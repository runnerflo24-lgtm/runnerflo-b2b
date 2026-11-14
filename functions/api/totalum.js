// Cloudflare Pages Function: /api/totalum
// Bridge to Totalum VCaaS API (Autonomous Next.js 14 + SQLite D1 Full-Stack App Builder)
// Base URL: https://builder-api.totalum.app/api/v1/vcaas

const TOTALUM_BASE_URL = 'https://builder-api.totalum.app/api/v1/vcaas';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-totalum-key, x-api-key',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. Resolve Totalum API Key
  // Prioritas 1: Cloudflare Environment Variables (TOTALUM_API_KEY / TOTALUM_KEY / TLM_API_KEY)
  // Prioritas 2: Header x-totalum-key atau Authorization Bearer
  const envKey = (env && (env.TOTALUM_API_KEY || env.TOTALUM_KEY || env.TLM_API_KEY)) || '';
  const headerKey = request.headers.get('x-totalum-key') ||
                    (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
                    request.headers.get('x-api-key') || '';
  const apiKey = (envKey || headerKey || '').trim();

  const action = url.searchParams.get('action') || '';
  const projectId = url.searchParams.get('projectId') || '';

  // Diagnostic / Health check endpoint
  if (action === 'health' || action === 'status' || (!action && request.method === 'GET' && !projectId)) {
    return new Response(JSON.stringify({
      status: 'active',
      configured: Boolean(apiKey),
      source: envKey ? 'cloudflare_env' : (headerKey ? 'request_header' : 'none'),
      message: apiKey
        ? 'Totalum API Key terdeteksi dan aktif.'
        : 'TOTALUM_API_KEY belum disetel di Cloudflare Pages Environment Variables.'
    }), { status: 200, headers: corsHeaders });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({
      errors: {
        errorCode: 'MISSING_TOTALUM_API_KEY',
        errorMessage: 'Totalum API key belum disetel. Tambahkan TOTALUM_API_KEY di Cloudflare Pages Settings > Environment Variables, atau kirimkan via header x-totalum-key.'
      },
      data: null
    }), { status: 401, headers: corsHeaders });
  }

  const commonHeaders = {
    'api-key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    // -------------------------------------------------------------
    // ACTION: launch (Create project and trigger first prompt)
    // POST /api/totalum?action=launch
    // -------------------------------------------------------------
    if (action === 'launch' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const payload = {
        projectId: (body.projectId || ('app-' + Math.random().toString(36).slice(2, 8))).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        prompt: body.prompt || 'Build a modern web application',
        label: body.label || body.projectId || 'Runnerflo App',
        engineVersion: 'v2',
        tier: body.tier || 'auto'
      };

      if (body.creditLimits) payload.creditLimits = body.creditLimits;
      if (body.files && Array.isArray(body.files)) payload.files = body.files;
      if (body.liveHostSuffix) payload.liveHostSuffix = body.liveHostSuffix;

      const res = await fetch(`${TOTALUM_BASE_URL}/projects/launch`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: prompt (Send additional prompt to existing project)
    // POST /api/totalum?action=prompt&projectId=:id
    // -------------------------------------------------------------
    if (action === 'prompt' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const payload = {
        prompt: body.prompt || '',
        tier: body.tier || 'auto'
      };
      if (body.inputFiles && Array.isArray(body.inputFiles)) payload.inputFiles = body.inputFiles;

      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/agent/start`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: agent-status (Poll agent status)
    // GET /api/totalum?action=agent-status&projectId=:id
    // -------------------------------------------------------------
    if (action === 'agent-status') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/agent/status`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: agent-progress (Poll detailed agent build progress)
    // GET /api/totalum?action=agent-progress&projectId=:id
    // -------------------------------------------------------------
    if (action === 'agent-progress') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/agent/progress`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: project (Get full project details: preview URL, live URL, domain, etc.)
    // GET /api/totalum?action=project&projectId=:id
    // -------------------------------------------------------------
    if (action === 'project') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: deploy (Publish to live production)
    // POST /api/totalum?action=deploy&projectId=:id
    // -------------------------------------------------------------
    if (action === 'deploy' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const payload = {
        confirmDestructive: Boolean(body.confirmDestructive)
      };

      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/deployments/deploy`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: deploy-status (Check publish deployment status)
    // GET /api/totalum?action=deploy-status&projectId=:id
    // -------------------------------------------------------------
    if (action === 'deploy-status') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/deployments/status`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: domain (Bind custom domain to published project)
    // POST/PUT /api/totalum?action=domain&projectId=:id
    // -------------------------------------------------------------
    if ((action === 'domain') && (request.method === 'POST' || request.method === 'PUT')) {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const hostname = (body.hostname || body.domain || '').trim().toLowerCase();
      if (!hostname) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_HOSTNAME', errorMessage: 'Hostname custom domain wajib diisi (contoh: app.domainanda.com).' }, data: null }), { status: 400, headers: corsHeaders });
      }

      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/domain`, {
        method: 'PUT',
        headers: commonHeaders,
        body: JSON.stringify({ hostname })
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: secret (Create / Update / Delete environment variable secret)
    // POST /api/totalum?action=secret&projectId=:id
    // DELETE /api/totalum?action=secret&projectId=:id&secretName=:name
    // -------------------------------------------------------------
    if (action === 'secret') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const secretName = (body.secretName || body.name || '').trim().toUpperCase();
        const secretValue = (body.secretValue || body.value || '').trim();
        const environment = body.environment || 'both';

        if (!secretName || !secretValue) {
          return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_SECRET_FIELDS', errorMessage: 'secretName dan secretValue wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
        }

        const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/secrets`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({ secretName, secretValue, environment })
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
      }

      if (request.method === 'DELETE') {
        const secretName = url.searchParams.get('secretName') || '';
        if (!secretName) {
          return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_SECRET_NAME', errorMessage: 'Parameter secretName wajib diisi untuk menghapus secret.' }, data: null }), { status: 400, headers: corsHeaders });
        }
        const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(secretName)}`, {
          method: 'DELETE',
          headers: commonHeaders
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
      }
    }

    // -------------------------------------------------------------
    // ACTION: secrets (List secrets for project)
    // GET /api/totalum?action=secrets&projectId=:id
    // -------------------------------------------------------------
    if (action === 'secrets') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      const secrets = (data && data.data && data.data.secrets) ? data.data.secrets : [];
      return new Response(JSON.stringify({ errors: data.errors, data: secrets }), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: schema (Get Cloudflare D1 database schema)
    // GET /api/totalum?action=schema&projectId=:id
    // -------------------------------------------------------------
    if (action === 'schema') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/database/schema`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: database-rows (Get records from table)
    // POST /api/totalum?action=database-rows&projectId=:id
    // -------------------------------------------------------------
    if (action === 'database-rows' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const payload = {
        env: body.env || 'dev',
        table: body.table || '',
        page: { limit: body.limit || 25, offset: body.offset || 0 }
      };
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/database/rows`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: database-ask (Ask AI plain English questions about data)
    // POST /api/totalum?action=database-ask&projectId=:id
    // -------------------------------------------------------------
    if (action === 'database-ask' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const question = body.question || '';
      const payload = {
        env: body.env || 'dev',
        questionBase64: btoa(unescape(encodeURIComponent(question)))
      };
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/database/ask`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: agent-stop (Stop running agent task)
    // POST /api/totalum?action=agent-stop&projectId=:id
    // -------------------------------------------------------------
    if (action === 'agent-stop' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/agent/stop`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: agent-clear (Clear conversation memory for fresh build)
    // POST /api/totalum?action=agent-clear&projectId=:id
    // -------------------------------------------------------------
    if (action === 'agent-clear' && request.method === 'POST') {
      if (!projectId) {
        return new Response(JSON.stringify({ errors: { errorCode: 'MISSING_PROJECT_ID', errorMessage: 'Parameter projectId wajib diisi.' }, data: null }), { status: 400, headers: corsHeaders });
      }
      const res = await fetch(`${TOTALUM_BASE_URL}/projects/${encodeURIComponent(projectId)}/agent/clear-context`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // ACTION: projects (List projects)
    // GET /api/totalum?action=projects
    // -------------------------------------------------------------
    if (action === 'projects') {
      const limit = url.searchParams.get('limit') || '20';
      const res = await fetch(`${TOTALUM_BASE_URL}/projects?limit=${limit}&sortField=lastModified&sortDirection=desc`, {
        method: 'GET',
        headers: commonHeaders
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders });
    }

    // Unknown action
    return new Response(JSON.stringify({
      errors: { errorCode: 'UNKNOWN_ACTION', errorMessage: `Action "${action}" tidak dikenali.` },
      data: null
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      errors: { errorCode: 'INTERNAL_SERVER_ERROR', errorMessage: err.message },
      data: null
    }), { status: 500, headers: corsHeaders });
  }
}
