import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { credentialStore, type ToolOptions } from '../context';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerScaffolderTools(server: McpServer, opts: ToolOptions): void {
  const { auth, discovery, catalogClient } = opts;

  async function scaffolderFetch(path: string, init?: RequestInit) {
    const credentials = credentialStore.getStore();
    if (!credentials) throw new Error('No credentials in context');

    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: 'scaffolder',
    });

    const base = await discovery.getBaseUrl('scaffolder');
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Scaffolder API ${res.status}: ${text}`);
    }
    return res.json();
  }

  // ── list_templates ──────────────────────────────────────────────────────
  // Note: scaffold_service and get_scaffolder_task require
  // @backstage/plugin-scaffolder-backend to be registered in the host app.
  server.tool(
    'list_templates',
    'List all available Backstage software templates (self-service scaffolding recipes).',
    {
      tag: z
        .string()
        .optional()
        .describe('Filter templates by tag, e.g. "recommended" or "library"'),
    },
    async ({ tag }) => {
      const credentials = credentialStore.getStore();
      if (!credentials) throw new Error('No credentials in context');

      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: credentials,
        targetPluginId: 'catalog',
      });

      const { items } = await catalogClient.getEntities(
        { filter: [{ kind: 'Template' }], limit: 100 },
        { token },
      );

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

  // ── scaffold_service ────────────────────────────────────────────────────
  server.tool(
    'scaffold_service',
    'Trigger a Backstage software template to scaffold a new service, library, or documentation site.',
    {
      template_name: z
        .string()
        .describe('Template name, e.g. "microservice" or "shared-library"'),
      values: z
        .record(z.string(), z.unknown())
        .describe(
          'Parameter values for the template. Use list_templates to discover required parameters.',
        ),
    },
    async ({ template_name, values }) => {
      const task = await scaffolderFetch('/v2/tasks', {
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

  // ── get_scaffolder_task ─────────────────────────────────────────────────
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
        .describe(
          'Return only events with sequence number > this value (use 0 for all events)',
        ),
    },
    async ({ task_id, after }) => {
      const [task, events] = await Promise.all([
        scaffolderFetch(`/v2/tasks/${task_id}`),
        scaffolderFetch(`/v2/tasks/${task_id}/events?after=${after}`).catch(() => []),
      ]);
      return ok({ task, events });
    },
  );
}
