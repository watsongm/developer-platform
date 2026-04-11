/**
 * IDP Permission Policy — Role-Based Access Control
 *
 * Roles (assigned via group membership in the catalog):
 *   platform-admin  Full access to everything
 *   team-lead       Manage own team resources, register components, view all
 *   developer       Use templates, view catalog/docs, no admin actions
 *   guest           Read-only catalog and docs (no template execution)
 *
 * Role assignment: add users to groups named exactly:
 *   group:default/platform-admins
 *   group:default/team-leads
 *   group:default/developers
 *   (all others treated as guest)
 */

import { BackstageIdentityResponse } from '@backstage/plugin-auth-node';
import {
  AuthorizeResult,
  PolicyDecision,
  isPermission,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';

import {
  catalogConditions,
  createCatalogConditionalDecision,
} from '@backstage/plugin-catalog-backend/alpha';
import {
  catalogEntityCreatePermission,
  catalogEntityDeletePermission,
  catalogEntityReadPermission,
  catalogEntityRefreshPermission,
  catalogLocationCreatePermission,
  catalogLocationDeletePermission,
} from '@backstage/plugin-catalog-common/alpha';
import {
  scaffolderActionExecutePermission,
  scaffolderTaskCancelPermission,
  scaffolderTaskCreatePermission,
  scaffolderTaskReadPermission,
} from '@backstage/plugin-scaffolder-common/alpha';

// ── Role helpers ──────────────────────────────────────────────────────────────

function getRoles(identity?: BackstageIdentityResponse): Set<string> {
  const roles = new Set<string>();
  if (!identity) return roles;

  for (const ref of identity.identity.ownershipEntityRefs) {
    if (ref === 'group:default/platform-admins') roles.add('platform-admin');
    if (ref === 'group:default/team-leads') roles.add('team-lead');
    if (ref === 'group:default/developers') roles.add('developer');
  }
  return roles;
}

// ── Policy ───────────────────────────────────────────────────────────────────

export class IDPPermissionPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    identity?: BackstageIdentityResponse,
  ): Promise<PolicyDecision> {
    const roles = getRoles(identity);

    // ── Platform Admin: allow everything ──────────────────────────────────
    if (roles.has('platform-admin')) {
      return { result: AuthorizeResult.ALLOW };
    }

    // ── Catalog: read ──────────────────────────────────────────────────────
    if (isPermission(request.permission, catalogEntityReadPermission)) {
      // All authenticated users can read the catalog
      if (identity) return { result: AuthorizeResult.ALLOW };
      return { result: AuthorizeResult.DENY };
    }

    // ── Catalog: create / refresh ──────────────────────────────────────────
    if (
      isPermission(request.permission, catalogEntityCreatePermission) ||
      isPermission(request.permission, catalogEntityRefreshPermission) ||
      isPermission(request.permission, catalogLocationCreatePermission)
    ) {
      if (roles.has('team-lead')) return { result: AuthorizeResult.ALLOW };
      return { result: AuthorizeResult.DENY };
    }

    // ── Catalog: delete ────────────────────────────────────────────────────
    if (
      isPermission(request.permission, catalogEntityDeletePermission) ||
      isPermission(request.permission, catalogLocationDeletePermission)
    ) {
      // Only platform-admin (handled above) may delete catalog entries
      return { result: AuthorizeResult.DENY };
    }

    // ── Scaffolder: create tasks (run templates) ───────────────────────────
    if (isPermission(request.permission, scaffolderTaskCreatePermission)) {
      if (roles.has('team-lead') || roles.has('developer')) {
        return { result: AuthorizeResult.ALLOW };
      }
      return { result: AuthorizeResult.DENY };
    }

    // ── Scaffolder: read tasks ─────────────────────────────────────────────
    if (isPermission(request.permission, scaffolderTaskReadPermission)) {
      if (identity) return { result: AuthorizeResult.ALLOW };
      return { result: AuthorizeResult.DENY };
    }

    // ── Scaffolder: cancel tasks ───────────────────────────────────────────
    if (isPermission(request.permission, scaffolderTaskCancelPermission)) {
      if (roles.has('team-lead') || roles.has('developer')) {
        return { result: AuthorizeResult.ALLOW };
      }
      return { result: AuthorizeResult.DENY };
    }

    // ── Scaffolder: execute actions ────────────────────────────────────────
    if (isPermission(request.permission, scaffolderActionExecutePermission)) {
      if (roles.has('team-lead') || roles.has('developer')) {
        return { result: AuthorizeResult.ALLOW };
      }
      return { result: AuthorizeResult.DENY };
    }

    // ── Default: deny ──────────────────────────────────────────────────────
    return { result: AuthorizeResult.DENY };
  }
}
