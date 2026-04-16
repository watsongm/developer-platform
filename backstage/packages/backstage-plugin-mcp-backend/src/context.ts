import { AsyncLocalStorage } from 'async_hooks';
import type {
  AuthService,
  BackstageCredentials,
  DiscoveryService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import type { CatalogClient } from '@backstage/catalog-client';

/**
 * AsyncLocalStorage that carries the caller's Backstage credentials through
 * an MCP request — tool handlers read this to get the per-request identity
 * without needing it threaded through the McpServer registration API.
 */
export const credentialStore = new AsyncLocalStorage<BackstageCredentials>();

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
