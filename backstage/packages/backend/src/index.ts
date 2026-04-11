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

// ── Core backend ─────────────────────────────────────────────────────────────
const backend = createBackend();

// App
backend.add(import('@backstage/plugin-app-backend/alpha'));

// Auth
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// Catalog
backend.add(import('@backstage/plugin-catalog-backend/alpha'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github/alpha'));

// Scaffolder (self-service templates)
backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

// TechDocs
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));

// Search
backend.add(import('@backstage/plugin-search-backend/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-catalog/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

// Proxy
backend.add(import('@backstage/plugin-proxy-backend/alpha'));

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

backend.start();
