import {
  WORKFLOW_PERMISSION_APPROVE_BREAKAGE,
  WORKFLOW_PERMISSION_APPROVE_LOST,
} from '../../shared/utils/returns-workflow.helpers';

/**
 * Permissions that grant access to Breakage / Lost Items in the sidebar and matching routes.
 * Keep in sync with `permissionGuard` `data.permissionsAny` for `/breakage` and `/lost-items`.
 */
export const BREAKAGE_NAV_PERMISSIONS_ANY = [
  'INVENTORY_VIEW',
  'BREAKAGE_VIEW',
  'READ_BREAKAGE',
  WORKFLOW_PERMISSION_APPROVE_BREAKAGE,
] as const;

export const LOST_ITEMS_NAV_PERMISSIONS_ANY = [
  'LOST_ITEMS_VIEW',
  'READ_LOST',
  WORKFLOW_PERMISSION_APPROVE_LOST,
] as const;
