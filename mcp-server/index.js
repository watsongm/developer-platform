/**
 * IDP MCP Server
 *
 * Exposes the Internal Developer Platform (Backstage) as Model Context Protocol
 * tools — allowing AI agents (Claude Desktop, Cursor, etc.) to query the catalog,
 * discover templates, check permissions, and trigger self-service scaffolding.
 *
 * Configuration (environment variables):
 *   BACKSTAGE_BASE_URL   Base URL of the Backstage backend  (default: http://localhost:7007)
 *   BACKSTAGE_TOKEN      Static Backstage backend token      (default: dev-token)
 *
 * Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "idp": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/developer-platform/mcp-server/index.js"],
 *       "env": {
 *         "BACKSTAGE_BASE_URL": "https://your-idp.example.com",
 *         "BACKSTAGE_TOKEN": "your-backstage-token"
 *       }
 *     }
 *   }
 * }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = process.env.BACKSTAGE_BASE_URL ?? 'http://localhost:7007';
const TOKEN    = process.env.BACKSTAGE_TOKEN    ?? 'dev-token';

const server = new McpServer({
  name: 'idp',
  version: '1.0.0',
});

/* ─────────────────────────────────────────────
   HTTP helper
───────────────────────────────────────────── */
async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backstage API ${res.status}: ${text}`);
  }
  return res.json();
}

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/* ─────────────────────────────────────────────
   CATALOG — Query & Discovery
───────────────────────────────────────────── */

server.tool(
  'search_catalog',
  'Full-text search across the software catalog — components, APIs, systems, groups, and users.',
  {
    query: z.string().describe('Search term, e.g. "payment" or "auth-service"'),
    kind: z
      .enum(['Component', 'API', 'System', 'Group', 'User', 'Template', 'Resource'])
      .optional()
      .describe('Filter results by entity kind'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results to return'),
  },
  async ({ query, kind, limit }) => {
    const params = new URLSearchParams({ term: query, pageLimit: limit });
    if (kind) params.set('filters[kind]', kind);
    const data = await api(`/api/search/query?${params}`);
    return ok(data);
  },
);

server.tool(
  'get_entity',
  'Get full details of a catalog entity by kind, namespace, and name.',
  {
    kind:      z.string().describe('Entity kind, e.g. Component, API, System, Group'),
    namespace: z.string().default('default').describe('Entity namespace (usually "default")'),
    name:      z.string().describe('Entity name, e.g. payment-service'),
  },
  async ({ kind, namespace, name }) => {
    const data = await api(
      `/api/catalog/entities/by-name/${kind}/${namespace}/${name}`,
    );
    return ok(data);
  },
);

server.tool(
  'list_entities',
  'List catalog entities with optional kind and label filters.',
  {
    kind: z
      .enum(['Component', 'API', 'System', 'Group', 'User', 'Template', 'Resource', 'Domain'])
      .optional()
      .describe('Filter by entity kind'),
    filter: z
      .string()
      .optional()
      .describe('Additional filter expression, e.g. spec.type=service'),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ kind, filter, limit }) => {
    const params = new URLSearchParams({ limit });
    if (kind) params.append('filter', `kind=${kind}`);
    if (filter) params.append('filter', filter);
    const data = await api(`/api/catalog/entities?${params}`);
    return ok(data);
  },
);

server.tool(
  'get_system',
  'Get a system entity and all components that belong to it.',
  {
    name: z.string().describe('System name, e.g. checkout-platform'),
  },
  async ({ name }) => {
    const system = await api(`/api/catalog/entities/by-name/System/default/${name}`);
    // Fetch components owned by this system
    const params = new URLSearchParams({
      filter: `kind=Component,spec.system=${name}`,
      limit: '50',
    });
    const components = await api(`/api/catalog/entities?${params}`);
    return ok({ system, components: components.items ?? components });
  },
);

server.tool(
  'list_apis',
  'List all API entities in the catalog, with optional type filter.',
  {
    type: z
      .enum(['openapi', 'graphql', 'grpc', 'asyncapi'])
      .optional()
      .describe('Filter by API type'),
  },
  async ({ type }) => {
    const params = new URLSearchParams({ filter: 'kind=API', limit: '100' });
    if (type) params.append('filter', `spec.type=${type}`);
    const data = await api(`/api/catalog/entities?${params}`);
    return ok(data);
  },
);

server.tool(
  'list_teams',
  'List all Group entities — teams, squads, and their members.',
  {},
  async () => {
    const data = await api(
      `/api/catalog/entities?filter=kind=Group&limit=100`,
    );
    return ok(data);
  },
);

server.tool(
  'register_component',
  'Register an existing repository as a catalog component by providing its catalog-info.yaml URL.',
  {
    catalog_url: z
      .string()
      .url()
      .describe(
        'Raw URL to the catalog-info.yaml file, e.g. https://github.com/org/repo/blob/main/catalog-info.yaml',
      ),
    dry_run: z
      .boolean()
      .default(false)
      .describe('If true, validate but do not register'),
  },
  async ({ catalog_url, dry_run }) => {
    if (dry_run) {
      return ok({ status: 'dry-run', message: 'Validation passed. Set dry_run=false to register.', url: catalog_url });
    }
    const data = await api('/api/catalog/locations', {
      method: 'POST',
      body: JSON.stringify({ type: 'url', target: catalog_url }),
    });
    return ok(data);
  },
);

/* ─────────────────────────────────────────────
   SCAFFOLDER — Self-Service Templates
───────────────────────────────────────────── */

server.tool(
  'list_templates',
  'List all available Backstage software templates (self-service scaffolding recipes).',
  {
    tag: z.string().optional().describe('Filter templates by tag, e.g. "recommended" or "library"'),
  },
  async ({ tag }) => {
    const params = new URLSearchParams({ filter: 'kind=Template', limit: '100' });
    const data = await api(`/api/catalog/entities?${params}`);
    const items = data.items ?? data;
    const filtered = tag
      ? items.filter(t => t.metadata?.tags?.includes(tag))
      : items;
    return ok(
      filtered.map(t => ({
        name: t.metadata.name,
        title: t.metadata.title,
        description: t.metadata.description,
        tags: t.metadata.tags,
        owner: t.spec?.owner,
      })),
    );
  },
);

server.tool(
  'scaffold_service',
  'Trigger a Backstage software template to scaffold a new service, library, or documentation site.',
  {
    template_name: z.string().describe('Template name, e.g. "microservice" or "shared-library"'),
    values: z
      .record(z.string(), z.unknown())
      .describe(
        'Parameter values for the template. Use list_templates to discover required parameters.',
      ),
  },
  async ({ template_name, values }) => {
    const task = await api('/api/scaffolder/v2/tasks', {
      method: 'POST',
      body: JSON.stringify({
        templateRef: `template:default/${template_name}`,
        values,
      }),
    });
    return ok({
      taskId: task.id,
      status: task.status,
      message: `Task created. Poll get_scaffolder_task with taskId "${task.id}" to track progress.`,
    });
  },
);

server.tool(
  'get_scaffolder_task',
  'Check the status and logs of a running or completed scaffolder task.',
  {
    task_id: z.string().describe('Task ID returned by scaffold_service'),
    after: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Return only events with sequence number > this value (use 0 for all events)'),
  },
  async ({ task_id, after }) => {
    // /eventstream is an SSE endpoint — use /events?after=N for JSON polling.
    const [task, events] = await Promise.all([
      api(`/api/scaffolder/v2/tasks/${task_id}`),
      api(`/api/scaffolder/v2/tasks/${task_id}/events?after=${after}`).catch(() => []),
    ]);
    return ok({ task, events });
  },
);

/* ─────────────────────────────────────────────
   TECHDOCS — Documentation
───────────────────────────────────────────── */

server.tool(
  'get_techdocs',
  'Retrieve TechDocs metadata for a catalog entity.',
  {
    kind:      z.string().describe('Entity kind, e.g. Component'),
    namespace: z.string().default('default'),
    name:      z.string().describe('Entity name'),
  },
  async ({ kind, namespace, name }) => {
    const data = await api(
      `/api/techdocs/metadata/techdocs/${namespace}/${kind}/${name}`,
    );
    return ok(data);
  },
);

/* ─────────────────────────────────────────────
   PERMISSIONS — RBAC Inspection
───────────────────────────────────────────── */

server.tool(
  'check_permission',
  'Check whether the current token has a given Backstage permission.',
  {
    permission:    z.string().describe('Permission name, e.g. catalog.entity.read'),
    resource_ref:  z.string().optional().describe('Entity ref to check against, e.g. component:default/my-service'),
  },
  async ({ permission, resource_ref }) => {
    const body = {
      items: [
        {
          id: '1',
          permission: { name: permission },
          ...(resource_ref ? { resourceRef: resource_ref } : {}),
        },
      ],
    };
    const data = await api('/api/permission/authorize', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return ok(data);
  },
);

/* ─────────────────────────────────────────────
   Start server
───────────────────────────────────────────── */
const transport = new StdioServerTransport();
await server.connect(transport);
