import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { credentialStore, type ToolOptions } from '../McpRouter';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerCatalogTools(server: McpServer, opts: ToolOptions): void {
  const { auth, discovery, catalogClient } = opts;

  // Helper: get a plugin request token scoped to the MCP caller's identity
  async function catalogToken() {
    const credentials = credentialStore.getStore();
    if (!credentials) throw new Error('No credentials in context');
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: 'catalog',
    });
    return token;
  }

  // ── search_catalog ──────────────────────────────────────────────────────
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
      const credentials = credentialStore.getStore();
      if (!credentials) throw new Error('No credentials in context');

      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: credentials,
        targetPluginId: 'search',
      });

      const searchBase = await discovery.getBaseUrl('search');
      const params = new URLSearchParams({ term: query, pageLimit: String(limit) });
      if (kind) params.set('filters[kind]', kind);

      const res = await fetch(`${searchBase}/query?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Search API ${res.status}: ${text}`);
      }
      return ok(await res.json());
    },
  );

  // ── get_entity ──────────────────────────────────────────────────────────
  server.tool(
    'get_entity',
    'Get full details of a catalog entity by kind, namespace, and name.',
    {
      kind: z.string().describe('Entity kind, e.g. Component, API, System, Group'),
      namespace: z.string().default('default').describe('Entity namespace (usually "default")'),
      name: z.string().describe('Entity name, e.g. payment-service'),
    },
    async ({ kind, namespace, name }) => {
      const token = await catalogToken();
      const entity = await catalogClient.getEntityByRef(
        `${kind}:${namespace}/${name}`,
        { token },
      );
      if (!entity) throw new Error(`Entity ${kind}:${namespace}/${name} not found`);
      return ok(entity);
    },
  );

  // ── list_entities ───────────────────────────────────────────────────────
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
      const token = await catalogToken();
      const filters: Record<string, string>[] = [];
      if (kind) filters.push({ kind });
      if (filter) {
        const eqIdx = filter.indexOf('=');
        if (eqIdx > 0) {
          const key = filter.slice(0, eqIdx);
          const value = filter.slice(eqIdx + 1);
          filters.push({ [key]: value });
        }
      }
      const { items } = await catalogClient.getEntities(
        { filter: filters.length ? filters : undefined, limit },
        { token },
      );
      return ok(items);
    },
  );

  // ── get_system ──────────────────────────────────────────────────────────
  server.tool(
    'get_system',
    'Get a system entity and all components that belong to it.',
    {
      name: z.string().describe('System name, e.g. checkout-platform'),
    },
    async ({ name }) => {
      const token = await catalogToken();
      const [system, { items: components }] = await Promise.all([
        catalogClient.getEntityByRef(`system:default/${name}`, { token }),
        catalogClient.getEntities(
          { filter: [{ kind: 'Component', 'spec.system': name }], limit: 50 },
          { token },
        ),
      ]);
      if (!system) throw new Error(`System ${name} not found`);
      return ok({ system, components });
    },
  );

  // ── list_apis ───────────────────────────────────────────────────────────
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
      const token = await catalogToken();
      const filter: Record<string, string> = { kind: 'API' };
      if (type) filter['spec.type'] = type;
      const { items } = await catalogClient.getEntities({ filter: [filter], limit: 100 }, { token });
      return ok(items);
    },
  );

  // ── list_teams ──────────────────────────────────────────────────────────
  server.tool(
    'list_teams',
    'List all Group entities — teams, squads, and their members.',
    {},
    async () => {
      const token = await catalogToken();
      const { items } = await catalogClient.getEntities(
        { filter: [{ kind: 'Group' }], limit: 100 },
        { token },
      );
      return ok(items);
    },
  );

  // ── register_component ──────────────────────────────────────────────────
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
        return ok({
          status: 'dry-run',
          message: 'Validation passed. Set dry_run=false to register.',
          url: catalog_url,
        });
      }
      const token = await catalogToken();
      const result = await catalogClient.addLocation(
        { type: 'url', target: catalog_url },
        { token },
      );
      return ok(result);
    },
  );
}
