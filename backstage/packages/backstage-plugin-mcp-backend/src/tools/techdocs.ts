import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { credentialStore, type ToolOptions } from '../McpRouter';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerTechDocsTools(server: McpServer, opts: ToolOptions): void {
  const { auth, discovery } = opts;

  // ── get_techdocs ────────────────────────────────────────────────────────
  server.tool(
    'get_techdocs',
    'Retrieve TechDocs metadata for a catalog entity.',
    {
      kind: z.string().describe('Entity kind, e.g. Component'),
      namespace: z.string().default('default'),
      name: z.string().describe('Entity name'),
    },
    async ({ kind, namespace, name }) => {
      const credentials = credentialStore.getStore();
      if (!credentials) throw new Error('No credentials in context');

      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: credentials,
        targetPluginId: 'techdocs',
      });

      const base = await discovery.getBaseUrl('techdocs');
      const res = await fetch(
        `${base}/metadata/techdocs/${namespace}/${kind}/${name}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TechDocs API ${res.status}: ${text}`);
      }

      return ok(await res.json());
    },
  );
}
