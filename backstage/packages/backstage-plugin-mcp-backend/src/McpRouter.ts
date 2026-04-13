import { AsyncLocalStorage } from 'async_hooks';
import { Router } from 'express';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {
  AuthService,
  BackstageCredentials,
  DiscoveryService,
  HttpAuthService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import type { CatalogClient } from '@backstage/catalog-client';

import { registerCatalogTools } from './tools/catalog';
import { registerScaffolderTools } from './tools/scaffolder';
import { registerTechDocsTools } from './tools/techdocs';
import { registerPermissionsTools } from './tools/permissions';

export interface McpRouterOptions {
  logger: LoggerService;
  config: Config;
  httpAuth: HttpAuthService;
  auth: AuthService;
  discovery: DiscoveryService;
  permissions: PermissionsService;
  catalogClient: CatalogClient;
}

/**
 * AsyncLocalStorage that carries the caller's Backstage credentials through
 * an MCP request — tool handlers read this to get the per-request identity
 * without needing it threaded through the McpServer registration API.
 */
export const credentialStore = new AsyncLocalStorage<BackstageCredentials>();

export async function createMcpRouter(opts: McpRouterOptions): Promise<Router> {
  const { logger, config, httpAuth, auth, discovery, permissions, catalogClient } = opts;

  const sessionTimeoutMs =
    (config.getOptionalNumber('mcp.sessionTimeoutMinutes') ?? 30) * 60 * 1000;

  // Shared tool options — singletons injected at plugin init time
  const toolOpts: ToolOptions = { auth, discovery, permissions, catalogClient, logger };

  /**
   * Creates a fresh McpServer and registers all 12 tools on it.
   *
   * A new server is created per session because McpServer.connect() stores a
   * single transport reference — sharing one server across sessions would
   * silently overwrite the active transport on the second connect() call.
   */
  function createServer(): McpServer {
    const server = new McpServer({ name: 'backstage', version: '0.1.0' });
    registerCatalogTools(server, toolOpts);
    registerScaffolderTools(server, toolOpts);
    registerTechDocsTools(server, toolOpts);
    registerPermissionsTools(server, toolOpts);
    return server;
  }

  logger.info(
    'Backstage MCP plugin ready — POST /api/mcp to connect an AI agent',
  );

  // ── Session registry ──────────────────────────────────────────────────────
  interface Session {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
    lastSeen: number;
  }
  const sessions = new Map<string, Session>();

  // Periodic cleanup of idle sessions
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastSeen > sessionTimeoutMs) {
        session.transport.close().catch(() => undefined);
        sessions.delete(id);
        logger.debug(`MCP session ${id} closed (idle timeout)`);
      }
    }
  }, Math.min(sessionTimeoutMs, 5 * 60 * 1000));
  cleanupInterval.unref(); // don't keep process alive

  // ── Express router ────────────────────────────────────────────────────────
  const router = Router();
  router.use(express.json());

  // POST /  — MCP requests (initialize + all JSON-RPC messages)
  router.post('/', async (req, res) => {
    let credentials: BackstageCredentials;
    try {
      credentials = await httpAuth.credentials(req, {
        allow: ['user', 'service'],
      });
    } catch {
      res.status(401).json({ error: 'Unauthorized: valid Backstage token required' });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      // New session — create a dedicated server + transport pair
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => uuidv4(),
        onsessioninitialized: (id: string) => {
          sessions.set(id, { server, transport, lastSeen: Date.now() });
          logger.debug(`MCP session ${id} initialised`);
        },
      });

      try {
        await server.connect(transport);
      } catch (err) {
        logger.error('Failed to connect MCP server to transport', err as Error);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      session = { server, transport, lastSeen: Date.now() };
    }

    session.lastSeen = Date.now();

    await credentialStore.run(credentials, () =>
      session!.transport.handleRequest(req, res, req.body),
    );
  });

  // DELETE /  — explicit session termination
  router.delete('/', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        await session.transport.close().catch(() => undefined);
        sessions.delete(sessionId);
        logger.debug(`MCP session ${sessionId} closed by client`);
      }
    }
    res.status(200).end();
  });

  // GET /  — SSE stream (used by some MCP clients for streaming responses)
  router.get('/', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    let credentials: BackstageCredentials;
    try {
      credentials = await httpAuth.credentials(req, {
        allow: ['user', 'service'],
      });
    } catch {
      res.status(401).json({ error: 'Unauthorized: valid Backstage token required' });
      return;
    }

    session.lastSeen = Date.now();

    await credentialStore.run(credentials, () =>
      session!.transport.handleRequest(req, res),
    );
  });

  return router;
}

/**
 * Options passed to each tool registration function.
 */
export interface ToolOptions {
  auth: AuthService;
  discovery: DiscoveryService;
  permissions: PermissionsService;
  catalogClient: CatalogClient;
  logger: LoggerService;
}
