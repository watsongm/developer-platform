/**
 * IDP Backend — Backstage new backend system
 *
 * Registers all plugins and the custom RBAC permission policy.
 */
import { createBackend } from '@backstage/backend-defaults';
import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  policyExtensionPoint,
} from '@backstage/plugin-permission-node/alpha';
import { IDPPermissionPolicy } from './plugins/permission';

// ── Production safety checks ──────────────────────────────────────────────────
if (
  process.env.NODE_ENV === 'production' &&
  process.env.BACKSTAGE_TOKEN === 'dev-token'
) {
  // eslint-disable-next-line no-console
  console.error(
    'FATAL: BACKSTAGE_TOKEN is set to the insecure default "dev-token".' +
      ' Set a strong random token before running in production.' +
      ' Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
  process.exit(1);
}

// ── Core backend ─────────────────────────────────────────────────────────────
const backend = createBackend();

// App
backend.add(import('@backstage/plugin-app-backend'));

// Auth
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// Guest provider is only available outside production to prevent anonymous
// access on live deployments.
if (process.env.NODE_ENV !== 'production') {
  backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
}

// Catalog
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github/alpha'));

// Scaffolder (self-service templates)
// NOTE: isolated-vm (scaffolder's sandbox engine) requires Node ≤20.
// Uncomment these once running on Node 18 or 20.
// backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));
// backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

// TechDocs
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));

// Search
backend.add(import('@backstage/plugin-search-backend/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

// Proxy
backend.add(import('@backstage/plugin-proxy-backend'));

// ── Permission (RBAC) ─────────────────────────────────────────────────────────
// Custom module that injects our IDP permission policy
const idpPermissionModule = createBackendModule({
  pluginId: 'permission',
  moduleId: 'idp-permission-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new IDPPermissionPolicy());
      },
    });
  },
});

backend.add(import('@backstage/plugin-permission-backend/alpha'));
backend.add(idpPermissionModule);

// MCP — exposes catalog, TechDocs, and scaffolder as AI agent tools
// Connect any MCP-compatible agent to POST /api/mcp
backend.add(import('backstage-plugin-mcp-backend'));

backend.start();
