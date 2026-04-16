import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { credentialStore, type ToolOptions } from '../context';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerPermissionsTools(server: McpServer, opts: ToolOptions): void {
  const { permissions } = opts;

  // ── check_permission ────────────────────────────────────────────────────
  server.tool(
    'check_permission',
    'Check whether the current token has a given Backstage permission.',
    {
      permission: z.string().describe('Permission name, e.g. catalog.entity.read'),
      resource_ref: z
        .string()
        .optional()
        .describe(
          'Entity ref to check against for resource permissions, e.g. component:default/my-service',
        ),
    },
    async ({ permission: permissionName, resource_ref: _resource_ref }) => {
      const credentials = credentialStore.getStore();
      if (!credentials) throw new Error('No credentials in context');

      // Use basic permission type for inspection — works for the majority of
      // named Backstage permissions. Resource-scoped checks are approximate
      // (the result may differ from a full resource-permission evaluation).
      const perm = {
        name: permissionName,
        attributes: {},
        type: 'basic' as const,
      };

      const [decision] = await permissions.authorize(
        [{ permission: perm }],
        { credentials },
      );

      return ok({
        permission: permissionName,
        result: decision.result,
        allowed: decision.result === 'ALLOW',
      });
    },
  );
}
