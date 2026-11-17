// Cloudflare Pages Function: /api/composio
// Composio Multi-Tenancy & SaaS Integrations Hub for Runnerflo B2B
// Enables generated SaaS apps to connect end-client accounts (Gmail, Slack, Notion, GitHub, Sheets, etc.)

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const composioKey = (env && (env.COMPOSIO_API_KEY || env.COMPOSIO_KEY)) || '';
  const composioBase = 'https://backend.composio.dev/api/v1';

  // Parse parameters from GET query or POST body
  const url = new URL(request.url);
  let action = url.searchParams.get('action') || '';
  let entityId = url.searchParams.get('entityId') || url.searchParams.get('userId') || 'default';
  let appName = url.searchParams.get('appName') || url.searchParams.get('app') || '';
  let actionName = url.searchParams.get('actionName') || '';

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
      action = body.action || action;
      entityId = body.entityId || body.userId || entityId;
      appName = body.appName || body.app || appName;
      actionName = body.actionName || actionName;
    } catch {
      body = {};
    }
  }

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
    if (action === 'status' || !action) {
      return new Response(JSON.stringify({
        ok: true,
        service: 'Runnerflo Composio Multi-Tenancy Hub',
        hasKey: Boolean(composioKey),
        activeTenant: entityId,
        availableAppsCount: POPULAR_APPS.length,
        message: composioKey
          ? 'Composio API Key aktif dan siap untuk OAuth multi-tenancy.'
          : 'COMPOSIO_API_KEY belum disetel di Cloudflare Pages. Berjalan dalam mode simulasi.'
      }, null, 2), { status: 200, headers: corsHeaders });
    }

    // 2. List available apps (catalog)
    if (action === 'apps') {
      if (composioKey) {
        try {
          const compRes = await fetch(`${composioBase}/apps`, {
            headers: {
              'X-API-Key': composioKey,
              'Content-Type': 'application/json'
            }
          });
          if (compRes.ok) {
            const compData = await compRes.json();
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              apps: compData.items || compData.apps || POPULAR_APPS
            }), { status: 200, headers: corsHeaders });
          }
        } catch {
          // Fall back to POPULAR_APPS if upstream fetch times out
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        live: Boolean(composioKey),
        apps: POPULAR_APPS
      }), { status: 200, headers: corsHeaders });
    }

    // 3. Initiate Connection (Generate OAuth Connect URL for specific tenant)
    if (action === 'connect-url' || action === 'initiate') {
      let targetApp = (appName || body.appName || 'google').toLowerCase();
      if (targetApp.includes('google') && !targetApp.includes('sheets') && !targetApp.includes('drive')) {
        targetApp = 'google';
      }
      const redirectUri = body.redirectUri || url.searchParams.get('redirectUri') || 'https://runnerflo-b2b.pages.dev/Agent%20Workspace?composio_connected=1';

      if (composioKey) {
        try {
          const initRes = await fetch(`${composioBase}/connectedAccounts`, {
            method: 'POST',
            headers: {
              'X-API-Key': composioKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              appName: targetApp,
              entityId,
              redirectUri
            })
          });

          if (initRes.ok) {
            const initData = await initRes.json();
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              entityId,
              appName: targetApp,
              connectionId: initData.id || initData.connectedAccountId,
              connectUrl: initData.redirectUrl || initData.connectionUrl || initData.url
            }), { status: 200, headers: corsHeaders });
          } else {
            const errBody = await initRes.text();
            return new Response(JSON.stringify({
              ok: false,
              error: `Composio HTTP ${initRes.status}`,
              details: errBody
            }), { status: initRes.status, headers: corsHeaders });
          }
        } catch (err) {
          return new Response(JSON.stringify({
            ok: false,
            error: err.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Simulated connect URL when API key not yet entered
      return new Response(JSON.stringify({
        ok: true,
        live: false,
        simulated: true,
        entityId,
        appName: targetApp,
        connectUrl: `https://app.composio.dev/connect/${targetApp}?entityId=${encodeURIComponent(entityId)}`,
        note: 'Simulated OAuth connect URL. Add COMPOSIO_API_KEY in Cloudflare Pages for live automatic OAuth handshake.'
      }), { status: 200, headers: corsHeaders });
    }

    // 4. List connected accounts for an entity (tenant)
    if (action === 'connections') {
      if (composioKey) {
        try {
          const connRes = await fetch(`${composioBase}/connectedAccounts?entityId=${encodeURIComponent(entityId)}`, {
            headers: {
              'X-API-Key': composioKey,
              'Content-Type': 'application/json'
            }
          });
          if (connRes.ok) {
            const connData = await connRes.json();
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              entityId,
              connections: connData.items || connData.connectedAccounts || []
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
      const inputPayload = body.input || body.params || {};

      if (!act) {
        return new Response(JSON.stringify({ error: 'Missing actionName for execution' }), { status: 400, headers: corsHeaders });
      }

      if (composioKey) {
        try {
          const execRes = await fetch(`${composioBase}/actions/${encodeURIComponent(act)}/execute`, {
            method: 'POST',
            headers: {
              'X-API-Key': composioKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              entityId,
              input: inputPayload
            })
          });

          if (execRes.ok) {
            const execData = await execRes.json();
            return new Response(JSON.stringify({
              ok: true,
              live: true,
              action: act,
              entityId,
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
      supportedActions: ['status', 'apps', 'connect-url', 'connections', 'execute']
    }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), { status: 500, headers: corsHeaders });
  }
}
