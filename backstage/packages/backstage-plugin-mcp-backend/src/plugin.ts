import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { createMcpRouter } from './McpRouter';

/**
 * Backstage backend plugin that exposes the service catalog, TechDocs, and
 * scaffolder as MCP (Model Context Protocol) tools.
 *
 * Registers a StreamableHTTP endpoint at POST /api/mcp that any MCP-compatible
 * AI agent (Claude Desktop, Cursor, Gemini CLI, etc.) can connect to.
 *
 * @public
 */
export const mcpPlugin = createBackendPlugin({
  pluginId: 'mcp',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        permissions: coreServices.permissions,
      },
      async init({ logger, config, httpRouter, httpAuth, auth, discovery, permissions }) {
        const catalogClient = new CatalogClient({ discoveryApi: discovery });

        const router = await createMcpRouter({
          logger,
          config,
          httpAuth,
          auth,
          discovery,
          permissions,
          catalogClient,
        });

        httpRouter.use(router);

        // The MCP router handles its own authentication — incoming requests
        // carry a Backstage Bearer token that we validate and forward to each
        // service call. Disable the default Backstage auth middleware so it
        // doesn't reject requests before we can inspect them.
        httpRouter.addAuthPolicy({ path: '/', allow: 'unauthenticated' });
      },
    });
  },
});
