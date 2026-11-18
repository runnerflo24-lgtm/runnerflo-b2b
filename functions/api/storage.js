// Cloudflare Pages Function: /api/storage
// Central R2 Cloud Storage Engine for Runnerflo Meta-PaaS
// Persists generated PaaS/SaaS code, assets, and project states per Tenant ID into Cloudflare R2
// Bucket: runnerflo-projects (Binding: PROJECTS_BUCKET)

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id, x-paas-id, x-end-user-id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';
  const r2 = env.PROJECTS_BUCKET || env.runnerflo_projects || env.BUCKET;

  // 1. Health & Status check
  if (action === 'status' || (request.method === 'GET' && !url.searchParams.get('paasId') && action !== 'projects')) {
    return new Response(JSON.stringify({
      ok: true,
      service: 'Runnerflo Meta-PaaS R2 Storage Engine',
      r2Configured: Boolean(r2),
      bucketName: 'runnerflo-projects',
      message: r2
        ? 'Cloudflare R2 Bucket aktif dan siap menyimpan kode tenant.'
        : 'R2 binding PROJECTS_BUCKET belum terhubung.'
    }, null, 2), { status: 200, headers: corsHeaders });
  }

  if (!r2) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'R2 bucket binding PROJECTS_BUCKET tidak ditemukan di context environment.',
      hint: 'Pastikan r2_buckets telah terdaftar di wrangler.jsonc dengan binding PROJECTS_BUCKET.'
    }), { status: 503, headers: corsHeaders });
  }

  // 2. GET: List all projects stored in R2
  if (action === 'projects') {
    try {
      const listing = await r2.list({ prefix: 'tenants/', delimiter: '/' });
      const tenants = (listing.delimitedPrefixes || []).map(p => p.replace(/^tenants\//, '').replace(/\/$/, ''));
      
      // Also fetch metadata for each tenant if available
      const projectList = [];
      for (const t of tenants.slice(0, 50)) {
        let meta = null;
        try {
          const metaObj = await r2.get(`tenants/${t}/meta.json`);
          if (metaObj) {
            meta = await metaObj.json();
          }
        } catch {}
        projectList.push({
          paasId: t,
          name: (meta && meta.name) || t,
          updatedAt: (meta && meta.updatedAt) || null,
          hasIndexHtml: true
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        count: projectList.length,
        projects: projectList
      }), { status: 200, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 3. GET: Get file content or project details from R2
  if (request.method === 'GET' && (action === 'get' || action === 'file')) {
    const paasId = url.searchParams.get('paasId') || url.searchParams.get('tenantId') || '';
    const filePath = url.searchParams.get('file') || url.searchParams.get('path') || 'index.html';
    if (!paasId) {
      return new Response(JSON.stringify({ ok: false, error: 'Parameter paasId wajib diisi.' }), { status: 400, headers: corsHeaders });
    }

    const r2Key = `tenants/${paasId}/${filePath}`;
    try {
      const obj = await r2.get(r2Key);
      if (!obj) {
        return new Response(JSON.stringify({ ok: false, error: `File "${filePath}" tidak ditemukan untuk tenant "${paasId}".` }), { status: 404, headers: corsHeaders });
      }

      const raw = url.searchParams.get('raw') === 'true';
      if (raw) {
        const ct = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : (filePath.endsWith('.json') ? 'application/json' : 'text/plain');
        return new Response(obj.body, { status: 200, headers: { ...corsHeaders, 'Content-Type': ct } });
      }

      const text = await obj.text();
      return new Response(JSON.stringify({
        ok: true,
        paasId,
        filePath,
        r2Key,
        size: obj.size,
        uploaded: obj.uploaded,
        content: text
      }), { status: 200, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 4. POST: Save code or project state to R2 per tenant
  if (request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const paasId = body.paasId || body.paas_id || body.tenantId || url.searchParams.get('paasId') || 'default-paas';
      const filePath = body.file || body.filePath || body.path || 'index.html';
      const content = body.content || body.code || body.htmlCode || '';
      const meta = body.meta || body.metadata || {};

      if (!content && !body.state) {
        return new Response(JSON.stringify({ ok: false, error: 'Field "content" atau "code" wajib diisi.' }), { status: 400, headers: corsHeaders });
      }

      const cleanPaasId = paasId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48);
      const r2Key = `tenants/${cleanPaasId}/${filePath}`;
      const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : (filePath.endsWith('.json') ? 'application/json' : 'text/plain');

      // 1. Save target file (e.g. index.html)
      await r2.put(r2Key, content, {
        httpMetadata: { contentType },
        customMetadata: {
          paasId: cleanPaasId,
          savedAt: new Date().toISOString(),
          version: String(body.version || 1)
        }
      });

      // 2. Also update tenant meta.json
      const metaKey = `tenants/${cleanPaasId}/meta.json`;
      const tenantMeta = {
        paasId: cleanPaasId,
        name: body.projectName || meta.name || cleanPaasId,
        updatedAt: new Date().toISOString(),
        totalumProjectId: body.totalumProjectId || meta.totalumProjectId || null,
        userModel: body.userModel || 'openai/gpt-4o-mini',
        lastFile: filePath,
        lastFileSize: content.length
      };
      await r2.put(metaKey, JSON.stringify(tenantMeta, null, 2), {
        httpMetadata: { contentType: 'application/json' }
      });

      return new Response(JSON.stringify({
        ok: true,
        savedToR2: true,
        bucket: 'runnerflo-projects',
        paasId: cleanPaasId,
        r2Key,
        metaKey,
        size: content.length,
        savedAt: tenantMeta.updatedAt
      }), { status: 200, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: `Method ${request.method} Not Supported` }), { status: 405, headers: corsHeaders });
}
