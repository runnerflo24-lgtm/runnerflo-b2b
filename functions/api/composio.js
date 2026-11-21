// Cloudflare Pages Function: /api/composio
// Composio Multi-Tenancy & SaaS Integrations Hub for Runnerflo B2B
// Enables generated SaaS apps to connect end-client accounts (Gmail, Slack, Notion, GitHub, Sheets, etc.)

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

  // Detect key type: ak_... = Project REST API key, ck_... = MCP consumer key
  const composioKey = (env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY)) || '';
  const isProjectKey = composioKey.startsWith('ak_');
  const isConsumerKey = composioKey.startsWith('ck_');
  // Build auth headers based on key type
  const composioAuthHeaders = isProjectKey
    ? { 'x-api-key': composioKey }
    : isConsumerKey
      ? { 'x-consumer-api-key': composioKey }
      : composioKey ? { 'x-api-key': composioKey } : {};
  const composioBase = 'https://backend.composio.dev/api/v3.1';

  // Parse parameters from GET query or POST body
  const url = new URL(request.url);
  let action = url.searchParams.get('action') || '';
  let entityId = url.searchParams.get('entityId') || url.searchParams.get('userId') || '';
  let appName = url.searchParams.get('appName') || url.searchParams.get('app') || '';
  let actionName = url.searchParams.get('actionName') || '';

  let body = {};
  if (request.method === 'POST') {
    try {
      const text = await request.text();
      if (text && text.trim().startsWith('{')) {
        body = JSON.parse(text);
      }
      action = body.action || action;
      entityId = body.entityId || body.userId || entityId;
      appName = body.appName || body.app || appName;
      actionName = body.actionName || actionName;
    } catch {
      body = {};
    }
  }

  // Composite Tenant Identity standard: {paas_id}:{end_user_id}
  const paasId = body.paas_id || body.paasId || body.tenantId || url.searchParams.get('paas_id') || url.searchParams.get('paasId') || url.searchParams.get('tenantId') || request.headers.get('x-paas-id') || request.headers.get('x-tenant-id') || 'default-paas';
  const endUserId = body.end_user_id || body.endUserId || body.userId || url.searchParams.get('end_user_id') || url.searchParams.get('endUserId') || url.searchParams.get('userId') || (entityId && entityId !== 'default' && !entityId.includes(':') ? entityId : '') || request.headers.get('x-end-user-id') || request.headers.get('x-user-id') || 'default-user';
  const compositeId = (entityId && entityId.includes(':')) ? entityId : `${paasId}:${endUserId}`;
  entityId = compositeId;

  // Pre-configured popular SaaS catalog for instant zero-latency UI rendering
  const POPULAR_APPS = [
    {
      id: 'google',
      name: 'Google Workspace & Sign-In',
      category: 'Authentication & SSO',
      icon: '🌐',
      description: 'Zero-config Google OAuth sign-in, account authentication, and Google Workspace connection via Composio Managed Apps.',
      popularActions: ['GOOGLE_SIGN_IN', 'GOOGLE_GET_PROFILE', 'GOOGLE_VERIFY_TOKEN']
    },
    {
      id: 'gmail',
      name: 'Gmail',
      category: 'Email & Communication',
      icon: '✉️',
      description: 'Send emails, draft responses, and read incoming client emails autonomously.',
      popularActions: ['GMAIL_SEND_EMAIL', 'GMAIL_CREATE_DRAFT', 'GMAIL_FETCH_EMAILS']
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'Team Collaboration',
      icon: '💬',
      description: 'Post automated notifications, chat with team channels, and create incident alerts.',
      popularActions: ['SLACK_SENDS_A_MESSAGE', 'SLACK_CREATE_CHANNEL', 'SLACK_ADD_REACTION']
    },
    {
      id: 'googlesheets',
      name: 'Google Sheets',
      category: 'Data & Spreadsheets',
      icon: '📊',
      description: 'Append rows, sync leads, update dashboards, and export CSV reports in real-time.',
      popularActions: ['GOOGLESHEETS_SHEET_FROM_JSON', 'GOOGLESHEETS_BATCH_UPDATE', 'GOOGLESHEETS_GET_SPREADSHEET_VALUES']
    },
    {
      id: 'notion',
      name: 'Notion',
      category: 'Productivity & Docs',
      icon: '📝',
      description: 'Create task pages, append notes, query databases, and update CRM tables.',
      popularActions: ['NOTION_CREATE_PAGE', 'NOTION_QUERY_DATABASE', 'NOTION_UPDATE_PAGE_ATTRIBUTES_BLOCK']
    },
    {
      id: 'github',
      name: 'GitHub',
      category: 'Developer Tools',
      icon: '🐙',
      description: 'Trigger pull requests, create issues, star repositories, and sync code branches.',
      popularActions: ['GITHUB_CREATE_AN_ISSUE', 'GITHUB_CREATE_PULL_REQUEST', 'GITHUB_GET_REPOSITORY']
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      category: 'CRM & Sales',
      icon: '🎯',
      description: 'Create contacts, update sales deals, log meetings, and manage customer tickets.',
      popularActions: ['HUBSPOT_CREATE_CONTACT', 'HUBSPOT_UPDATE_DEAL', 'HUBSPOT_GET_COMPANY']
    },
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'Payments & Billing',
      icon: '💳',
      description: 'Generate payment links, query customer subscriptions, and track invoice statuses.',
      popularActions: ['STRIPE_CREATE_PAYMENT_LINK', 'STRIPE_LIST_CUSTOMERS', 'STRIPE_CREATE_CUSTOMER']
    },
    {
      id: 'discord',
      name: 'Discord',
      category: 'Community & Chat',
      icon: '🎮',
      description: 'Send webhooks, manage announcements, and alert community channels.',
      popularActions: ['DISCORD_SEND_MESSAGE', 'DISCORD_CREATE_CHANNEL']
    },
    {
      id: 'airtable',
      name: 'Airtable',
      category: 'Databases & Workflows',
      icon: '🗂️',
      description: 'Create base records, query tables, and sync user feedback into relational tables.',
      popularActions: ['AIRTABLE_CREATE_RECORD', 'AIRTABLE_SEARCH_RECORDS']
    },
    {
      id: 'linear',
      name: 'Linear',
      category: 'Issue Tracking',
      icon: '⚡',
      description: 'Create engineering tickets, assign cycles, and update project milestone progress.',
      popularActions: ['LINEAR_CREATE_ISSUE', 'LINEAR_UPDATE_ISSUE', 'LINEAR_LIST_ISSUES']
    }
  ];

  try {
    // 1. Status / Diagnostic check
    if (action === 'status' || (!action && request.method === 'GET')) {
      return new Response(JSON.stringify({
        ok: true,
        service: 'Runnerflo Composio Multi-Tenancy Hub',
        hasKey: Boolean(composioKey),
        activeTenant: entityId,
        paasId,
        endUserId,
        availableAppsCount: POPULAR_APPS.length,
        message: composioKey
          ? 'Composio API Key aktif dan siap untuk OAuth multi-tenancy.'
          : 'COMPOSIO_API_KEY belum disetel di Cloudflare Pages. Berjalan dalam mode simulasi.'
      }, null, 2), { status: 200, headers: corsHeaders });
    }

    // 1c. List official Composio toolkits
    if (action === 'toolkits') {
      if (composioKey) {
        const tkRes = await fetch('https://backend.composio.dev/api/v3/toolkits?limit=100', {
          headers: { 'x-api-key': composioKey }
        }).catch(() => null);
        if (tkRes) {
          const tkData = await tkRes.json().catch(() => ({}));
          const list = (tkData.items || tkData.data || tkData.toolkits || []).map(t => ({ slug: t.slug, name: t.name }));
          return new Response(JSON.stringify({
            ok: tkRes.ok,
            count: list.length,
            googleRelated: list.filter(t => t.slug && (t.slug.includes('goog') || t.slug.includes('mail') || t.slug.includes('drive') || t.slug.includes('sheet'))),
            toolkits: list
          }, null, 2), { status: 200, headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify({ ok: false, error: 'COMPOSIO_API_KEY missing' }), { status: 400, headers: corsHeaders });
    }

    // 1b. Inspect Auth Configs (multi-header diagnostic)
    if (action === 'auth-configs') {
      if (composioKey) {
        const tests = {};

        // Test 1: x-api-key on v3.1/auth_configs
        try {
          const r1 = await fetch('https://backend.composio.dev/api/v3.1/auth_configs', {
            headers: { 'x-api-key': composioKey }
          });
          tests['x_api_key_v31'] = { status: r1.status, data: await r1.json().catch(() => ({})) };
        } catch (e) { tests['x_api_key_v31'] = { error: e.message }; }

        // Test 2: Bearer on v3.1/auth_configs
        try {
          const r2 = await fetch('https://backend.composio.dev/api/v3.1/auth_configs', {
            headers: { 'Authorization': `Bearer ${composioKey}` }
          });
          tests['bearer_v31'] = { status: r2.status, data: await r2.json().catch(() => ({})) };
        } catch (e) { tests['bearer_v31'] = { error: e.message }; }

        // Test 3: x-org-api-key on v3.1/auth_configs
        try {
          const r3 = await fetch('https://backend.composio.dev/api/v3.1/auth_configs', {
            headers: { 'x-org-api-key': composioKey }
          });
          tests['x_org_api_key_v31'] = { status: r3.status, data: await r3.json().catch(() => ({})) };
        } catch (e) { tests['x_org_api_key_v31'] = { error: e.message }; }

        // Test 4: x-api-key on v1/apps
        try {
          const r4 = await fetch('https://backend.composio.dev/api/v1/apps', {
            headers: { 'x-api-key': composioKey }
          });
          tests['x_api_key_v1_apps'] = { status: r4.status, data: await r4.json().catch(() => ({})) };
        } catch (e) { tests['x_api_key_v1_apps'] = { error: e.message }; }

        // Test 5: Bearer on v1/apps
        try {
          const r5 = await fetch('https://backend.composio.dev/api/v1/apps', {
            headers: { 'Authorization': `Bearer ${composioKey}` }
          });
          tests['bearer_v1_apps'] = { status: r5.status, data: await r5.json().catch(() => ({})) };
        } catch (e) { tests['bearer_v1_apps'] = { error: e.message }; }

        return new Response(JSON.stringify({
          ok: true,
          keyPrefix: composioKey.substring(0, 5) + '...',
          tests
        }, null, 2), { status: 200, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: false, error: 'COMPOSIO_API_KEY missing' }), { status: 400, headers: corsHeaders });
    }

    // 2. List available apps (catalog)
    if (action === 'apps') {
      if (composioKey) {
        try {
          const compRes = await fetch('https://backend.composio.dev/api/v3/toolkits?limit=100', {
            headers: {
              'x-api-key': composioKey
            }
          });
          if (compRes.ok) {
            const compData = await compRes.json();
            const list = compData.items || compData.toolkits || compData.data || [];
            if (list.length > 0) {
              const mapped = list.map(t => ({
                id: t.slug,
                name: t.name,
                category: t.category || 'SaaS Integration',
                icon: t.logo || '⚡',
                description: t.description || `Integrasi resmi ${t.name} via Composio Managed Auth.`,
                popularActions: []
              }));
              return new Response(JSON.stringify({
                ok: true,
                live: true,
                count: mapped.length,
                apps: mapped
              }), { status: 200, headers: corsHeaders });
            }
          }
        } catch {
          // Fall back to POPULAR_APPS if upstream fetch times out
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        live: Boolean(composioKey),
        count: POPULAR_APPS.length,
        apps: POPULAR_APPS
      }), { status: 200, headers: corsHeaders });
    }

    // 3. Initiate Connection (Generate OAuth Connect URL for specific tenant)
    if (action === 'connect-url' || action === 'initiate') {
      const TOOLKIT_SLUG_MAP = {
        'google': 'gmail',
        'google-workspace': 'gmail',
        'google-sign-in': 'gmail',
        'google_sign_in': 'gmail',
        'sheets': 'googlesheets',
        'google-sheets': 'googlesheets',
        'drive': 'googledrive',
        'google-drive': 'googledrive',
        'calendar': 'googlecalendar',
        'google-calendar': 'googlecalendar',
        'docs': 'googledocs',
        'google-docs': 'googledocs'
      };
      const rawApp = (appName || body.appName || 'gmail').toLowerCase().trim();
      const targetApp = TOOLKIT_SLUG_MAP[rawApp] || rawApp;
      const redirectUri = body.redirectUri || url.searchParams.get('redirectUri') || 'https://runnerflo-b2b.pages.dev/oauth_callback.html';

      if (composioKey) {
        let authConfigId = '';
        let upstreamDetail = null;

        // 1. Check existing auth configs for this toolkit
        try {
          const authConfRes = await fetch(`https://backend.composio.dev/api/v3.1/auth_configs?toolkit_slug=${encodeURIComponent(targetApp)}`, {
            headers: { 'x-api-key': composioKey }
          });
          if (authConfRes.ok) {
            const authConfData = await authConfRes.json();
            const configs = authConfData.items || authConfData.auth_configs || authConfData.data || [];
            if (configs.length > 0) {
              authConfigId = configs[0].id || configs[0].auth_config_id || '';
            }
          }
        } catch (e) {
          upstreamDetail = { searchError: e.message };
        }

        // 2. If no auth config exists yet, create one using Composio managed auth
        if (!authConfigId) {
          try {
            const createConfRes = await fetch('https://backend.composio.dev/api/v3.1/auth_configs', {
              method: 'POST',
              headers: {
                'x-api-key': composioKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                toolkit: { slug: targetApp },
                auth_config: {
                  type: 'use_composio_managed_auth'
                }
              })
            });
            if (createConfRes.ok) {
              const created = await createConfRes.json();
              authConfigId = created.id || created.auth_config_id || (created.data && created.data.id) || '';
            } else {
              const errTxt = await createConfRes.text().catch(() => '');
              upstreamDetail = { createConfigStatus: createConfRes.status, createConfigError: errTxt };
            }
          } catch (e) {
            upstreamDetail = { createConfigException: e.message };
          }
        }

        // 3. Request real connect link session via POST /api/v3.1/connected_accounts/link
        let connectUrl = '';
        let connectionId = '';
        let isComposioLive = false;

        if (authConfigId) {
          try {
            const linkRes = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/link', {
              method: 'POST',
              headers: {
                'x-api-key': composioKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                auth_config_id: authConfigId,
                user_id: entityId,
                callback_url: redirectUri
              })
            });
            if (linkRes.ok) {
              const linkData = await linkRes.json();
              connectUrl = linkData.redirect_url || linkData.url || linkData.link || linkData.connection_url || '';
              connectionId = linkData.id || linkData.connected_account_id || '';
              isComposioLive = Boolean(connectUrl);
            } else {
              const errTxt = await linkRes.text().catch(() => '');
              upstreamDetail = { ...upstreamDetail, linkStatus: linkRes.status, linkError: errTxt };
            }
          } catch (e) {
            upstreamDetail = { ...upstreamDetail, linkException: e.message };
          }
        }

        // 4. Fallback if upstream link creation couldn't complete
        if (!connectUrl) {
          connectUrl = `https://app.composio.dev/connect/${encodeURIComponent(targetApp)}?entityId=${encodeURIComponent(entityId)}&redirectUri=${encodeURIComponent(redirectUri)}`;
        }

        return new Response(JSON.stringify({
          ok: true,
          live: true,
          isComposioDirect: isComposioLive,
          entityId,
          paasId,
          endUserId,
          appName: targetApp,
          authConfigId: authConfigId || 'managed',
          connectionId: connectionId || `conn-${entityId}`,
          connectUrl,
          upstream: upstreamDetail
        }), { status: 200, headers: corsHeaders });
      }

      // Simulated connect URL when API key not yet entered
      return new Response(JSON.stringify({
        ok: true,
        live: false,
        simulated: true,
        entityId,
        paasId,
        endUserId,
        appName: targetApp,
        connectUrl: `https://app.composio.dev/connect/${targetApp}?entityId=${encodeURIComponent(entityId)}`,
        note: 'Simulated OAuth connect URL. Add COMPOSIO_API_KEY in Cloudflare Pages for live automatic OAuth handshake.'
      }), { status: 200, headers: corsHeaders });
    }

    // 4. List connected accounts for an entity (tenant)
    if (action === 'connections') {
      if (composioKey) {
        try {
          const connRes = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(entityId)}`, {
            headers: {
              'x-api-key': composioKey,
              'Content-Type': 'application/json'
            }
          });
          if (connRes.ok) {
            const connData = await connRes.json();
            const items = connData.items || connData.connected_accounts || connData.connectedAccounts || [];
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              entityId,
              paasId,
              endUserId,
              connections: items
            }), { status: 200, headers: corsHeaders });
          }
        } catch (err) {
          return new Response(JSON.stringify({
            ok: false,
            error: err.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        live: false,
        entityId,
        paasId,
        endUserId,
        connections: [
          {
            id: 'mock_slack_conn',
            appName: 'slack',
            status: 'ACTIVE',
            entityId,
            createdAt: new Date().toISOString()
          }
        ],
        note: 'Mock active connection. Add COMPOSIO_API_KEY in Cloudflare to see real tenant OAuth connections.'
      }), { status: 200, headers: corsHeaders });
    }

    // 5. Execute Action (Trigger SaaS operation on behalf of tenant)
    if (action === 'execute') {
      const act = (actionName || body.actionName || '').toUpperCase();
      const inputPayload = body.input || body.params || body.arguments || {};

      if (!act) {
        return new Response(JSON.stringify({ error: 'Missing actionName for execution' }), { status: 400, headers: corsHeaders });
      }

      if (composioKey) {
        try {
          const execRes = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${encodeURIComponent(act)}`, {
            method: 'POST',
            headers: {
              'x-api-key': composioKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: entityId,
              arguments: inputPayload
            })
          });

          if (execRes.ok) {
            const execData = await execRes.json();
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              action: act,
              entityId,
              paasId,
              endUserId,
              result: execData
            }), { status: 200, headers: corsHeaders });
          } else {
            const errTxt = await execRes.text();
            return new Response(JSON.stringify({
              ok: false,
              error: `Composio action execution failed (HTTP ${execRes.status})`,
              details: errTxt
            }), { status: execRes.status, headers: corsHeaders });
          }
        } catch (err) {
          return new Response(JSON.stringify({
            ok: false,
            error: err.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Simulated execution
      return new Response(JSON.stringify({
        ok: true,
        live: false,
        simulated: true,
        action: act,
        entityId,
        paasId,
        endUserId,
        input: inputPayload,
        result: {
          status: 'SUCCESS',
          message: `Simulated execution of ${act} for tenant ${entityId}. Add COMPOSIO_API_KEY in Cloudflare for live execution.`
        }
      }), { status: 200, headers: corsHeaders });
    }

    // Unknown action
    return new Response(JSON.stringify({
      error: `Unknown action: "${action}"`,
      supportedActions: ['status', 'auth-configs', 'apps', 'connect-url', 'connections', 'execute']
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
