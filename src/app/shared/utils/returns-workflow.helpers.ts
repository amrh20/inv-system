import type { ReturnsAccountabilityType } from '../models/returns-accountability.model';

/**
 * Canonical JWT / Prisma `permissions.code` values for breakage & lost workflow approvals.
 * Use these (not legacy `*_APPROVE_REJECT`) in guards and `hasPermission` checks.
 */
export const WORKFLOW_PERMISSION_APPROVE_BREAKAGE = 'APPROVE_BREAKAGE' as const;
export const WORKFLOW_PERMISSION_APPROVE_LOST = 'APPROVE_LOST' as const;

export type WorkflowHistoryEntry = {
  stepNumber: number;
  roleCode: string;
  userDisplayName: string;
  accountabilityType: ReturnsAccountabilityType | null;
  comment: string | null;
};

/** Full chain (approved, pending, rejected) for detail pages and timelines. */
export type WorkflowTimelineEntry = WorkflowHistoryEntry & {
  status: string;
};

export type ApprovalStepLike = {
  stepNumber: number;
  status: string;
  comment?: string | null;
  accountabilityType?: string | null;
  requiredRole?: string | { code?: string } | null;
  /** Some APIs expose the role code directly on the step. */
  roleCode?: string | null;
  actedByUser?: { firstName?: string; lastName?: string } | null;
};

/** Normalize role codes for comparison (API may vary casing). */
export function normalizeWorkflowRoleCode(code: string | undefined | null): string {
  return (code ?? '').trim().toUpperCase();
}

function workflowStepNumbersMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || a === null || b === undefined || b === null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return String(a).trim() === String(b).trim();
}

/** `currentStep` as a number for comparisons / arithmetic (API may send string). */
function workflowCurrentStepNumber(currentStep: number | string | undefined | null): number {
  if (currentStep === undefined || currentStep === null) return NaN;
  const n = Number(currentStep);
  return Number.isNaN(n) ? NaN : n;
}

function isWorkflowStepPending(step: ApprovalStepLike | undefined): boolean {
  if (!step) return false;
  return normalizeWorkflowRoleCode(step.status) === 'PENDING';
}

/** Role code required for the current approval step (matches API `requiredRole.code`). */
export function requiredRoleCodeFromStep(step: ApprovalStepLike | undefined): string {
  if (!step) return '';
  const direct = (step as { roleCode?: string | null }).roleCode;
  if (direct) return normalizeWorkflowRoleCode(direct);
  const r = step.requiredRole;
  if (typeof r === 'string') return normalizeWorkflowRoleCode(r);
  return normalizeWorkflowRoleCode(r?.code);
}

/**
 * Whether the user may act on the pending workflow step (strict): JWT role must match
 * `requiredRole.code` on the PENDING step at `currentStep`. No ADMIN / ORG_MANAGER bypass.
 * When `context` includes approval steps, returns false if the chain has moved past the user's step.
 */
export function userMatchesCurrentApprovalChainStep(
  userRole: string | undefined,
  requiredRoleCode: string,
  context?: ReturnsWorkflowDocumentContext | null,
): boolean {
  const u = normalizeWorkflowRoleCode(userRole);
  const req = normalizeWorkflowRoleCode(requiredRoleCode);
  if (!req || !u) return false;
  if (u !== req) return false;

  const ar = context?.approvalRequests?.[0];
  if (!ar?.steps?.length) return true;

  const atCurrent = ar.steps.find((s) => workflowStepNumbersMatch(s.stepNumber, ar.currentStep));
  if (!atCurrent || !isWorkflowStepPending(atCurrent)) return false;
  return normalizeWorkflowRoleCode(requiredRoleCodeFromStep(atCurrent)) === u;
}

export type ReturnsWorkflowDocumentContext = {
  notes?: string | null;
  reason?: string | null;
  approvalRequests?: Array<{
    /** API may send string or number; compared with {@link workflowStepNumbersMatch}. */
    currentStep: number | string;
    steps: ApprovalStepLike[];
  }>;
};

function actorName(u?: { firstName?: string; lastName?: string } | null): string {
  if (!u) return '';
  const t = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return t || '';
}

/**
 * Context for returns (get-pass) breakage / lost approval modals:
 * previous approver comment, or document notes/reason when no prior step exists.
 */
export function previousWorkflowRecommendation(d: ReturnsWorkflowDocumentContext): string {
  const ar = d.approvalRequests?.[0];
  const fallback = (d.notes?.trim() || d.reason?.trim() || '').trim();
  if (!ar?.steps?.length) {
    return fallback;
  }
  const stepNo = workflowCurrentStepNumber(ar.currentStep);
  if (!Number.isFinite(stepNo) || stepNo <= 1) {
    return fallback;
  }
  const prev = ar.steps.find((s) => workflowStepNumbersMatch(s.stepNumber, stepNo - 1));
  return (prev?.comment?.trim() || fallback).trim();
}

/** Step number that supplied the “previous recommendation” (for timeline highlight). */
export function lastRecommendationStepNumber(d: ReturnsWorkflowDocumentContext): number | null {
  const ar = d.approvalRequests?.[0];
  const cur = workflowCurrentStepNumber(ar?.currentStep);
  if (!Number.isFinite(cur) || cur <= 1) {
    return null;
  }
  return cur - 1;
}

/** All workflow steps in order (for detail timelines: approved + pending + rejected). */
export function workflowApprovalTimeline(d: ReturnsWorkflowDocumentContext): WorkflowTimelineEntry[] {
  const steps = d.approvalRequests?.[0]?.steps;
  if (!steps?.length) return [];
  return [...steps]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((s) => ({
      stepNumber: s.stepNumber,
      roleCode:
        typeof s.requiredRole === 'string' ? s.requiredRole : (s.requiredRole?.code ?? '—'),
      userDisplayName: actorName(s.actedByUser),
      accountabilityType: (s.accountabilityType as ReturnsAccountabilityType | undefined) ?? null,
      comment: s.comment?.trim() || null,
      status: s.status,
    }));
}

/** Completed (APPROVED) steps only — modals and compact history (same rows as detail, filtered). */
export function approvedWorkflowHistory(d: ReturnsWorkflowDocumentContext): WorkflowHistoryEntry[] {
  return workflowApprovalTimeline(d)
    .filter((e) => e.status === 'APPROVED')
    .map(({ stepNumber, roleCode, userDisplayName, accountabilityType, comment }) => ({
      stepNumber,
      roleCode,
      userDisplayName,
      accountabilityType,
      comment,
    }));
}

/** True when this row is the step that `previousWorkflowRecommendation` reads from (currentStep − 1). */
export function isHighlightedHistoryStep(
  entry: { stepNumber: number },
  d: ReturnsWorkflowDocumentContext,
): boolean {
  const n = lastRecommendationStepNumber(d);
  return n !== null && entry.stepNumber === n;
}

/** Highlight on full timeline rows (same rule as modal history cards). */
export function isHighlightedTimelineStep(
  entry: WorkflowTimelineEntry,
  d: ReturnsWorkflowDocumentContext,
): boolean {
  return entry.status === 'APPROVED' && isHighlightedHistoryStep(entry, d);
}

/**
 * Role required to act at this document status in the Dept → Cost → Finance → GM chain
 * (aligns with API pending step `requiredRole` when no approvalRequests payload on list rows).
 */
export function workflowPendingRequiredRoleForStatus(status: string): string {
  switch (normalizeWorkflowRoleCode(status)) {
    case 'DRAFT':
      return 'DEPT_MANAGER';
    case 'DEPT_APPROVED':
      return 'COST_CONTROL';
    case 'COST_CONTROL_APPROVED':
      return 'FINANCE_MANAGER';
    case 'FINANCE_APPROVED':
      return 'GENERAL_MANAGER';
    default:
      return '';
  }
}

/**
 * True when the pending step’s required role disagrees with the role implied by document status
 * (stale list payloads). Used to avoid granting “Take action” from status alone when the chain points elsewhere.
 */
function workflowChainDisagreesWithDocumentStatus(step: ApprovalStepLike, docStatus: string): boolean {
  const fromStep = normalizeWorkflowRoleCode(requiredRoleCodeFromStep(step));
  const fromStatus = normalizeWorkflowRoleCode(workflowPendingRequiredRoleForStatus(docStatus));
  if (!fromStep || !fromStatus) return false;
  return fromStep !== fromStatus;
}

/**
 * Strict: user role must equal the actor for the next step implied by document status
 * (e.g. FINANCE_APPROVED → only GENERAL_MANAGER). No org-admin override.
 */
export function userMatchesNextWorkflowStep(role: string | undefined, status: string): boolean {
  if (!role) return false;
  const st = normalizeWorkflowRoleCode(status);
  if (st === 'APPROVED' || st === 'VOID' || st === 'REJECTED') return false;
  const required = workflowPendingRequiredRoleForStatus(status);
  if (!required) return false;
  return normalizeWorkflowRoleCode(role) === normalizeWorkflowRoleCode(required);
}

/**
 * List/detail: user may open “Take action” when they are the pending actor on the chain,
 * or (fallback) when document status implies their role — used when `approvalRequests` is missing
 * or step pointers from the API don’t line up with strict equality.
 */
export function userCanActOnReturnsWorkflowListRow(
  userRole: string | undefined,
  context: ReturnsWorkflowDocumentContext | null | undefined,
  docStatus: string,
): boolean {
  const statusAllows = userMatchesNextWorkflowStep(userRole, docStatus);
  const ar = context?.approvalRequests?.[0];
  if (!ar?.steps?.length) {
    return statusAllows;
  }
  const step = pendingApprovalStepFromContext(context ?? undefined);
  if (!step) {
    return statusAllows;
  }
  const chainAllows = userMatchesCurrentApprovalChainStep(
    userRole,
    requiredRoleCodeFromStep(step),
    context,
  );
  if (chainAllows) {
    return true;
  }
  const reqFromStep = normalizeWorkflowRoleCode(requiredRoleCodeFromStep(step));
  if (!reqFromStep) {
    return statusAllows;
  }
  /** Status fallback when chain matching failed (e.g. type coercion) but step & status agree on who acts next. */
  if (statusAllows && !workflowChainDisagreesWithDocumentStatus(step, docStatus)) {
    return true;
  }
  return false;
}

/**
 * When the user has already approved their step but the document is not final — next role code for UI tag, or null.
 */
export function returnsWorkflowProcessedWaitingNextRole(
  context: ReturnsWorkflowDocumentContext | null | undefined,
  userRole: string | undefined,
  docStatus: string,
): string | null {
  const r = normalizeWorkflowRoleCode(userRole);
  if (!r) return null;
  if (docStatus === 'APPROVED' || docStatus === 'VOID' || docStatus === 'REJECTED' || docStatus === 'DRAFT') {
    return null;
  }
  if (userCanActOnReturnsWorkflowListRow(userRole, context, docStatus)) {
    return null;
  }

  const ar = context?.approvalRequests?.[0];
  if (ar?.steps?.length) {
    const myStep = ar.steps.find((s) => normalizeWorkflowRoleCode(requiredRoleCodeFromStep(s)) === r);
    if (
      myStep &&
      normalizeWorkflowRoleCode(myStep.status) === 'APPROVED' &&
      Number(ar.currentStep) > Number(myStep.stepNumber)
    ) {
      const cur = ar.steps.find((s) => workflowStepNumbersMatch(s.stepNumber, ar.currentStep));
      if (cur && isWorkflowStepPending(cur)) {
        return requiredRoleCodeFromStep(cur);
      }
    }
    return null;
  }

  if (r === 'COST_CONTROL' && docStatus === 'COST_CONTROL_APPROVED') {
    return 'FINANCE_MANAGER';
  }
  if (r === 'FINANCE_MANAGER' && docStatus === 'FINANCE_APPROVED') {
    return 'GENERAL_MANAGER';
  }
  return null;
}

/** Pending step for ApprovalRequest chain (`currentStep` must point at a PENDING step). */
export function pendingApprovalStepFromContext(
  d: ReturnsWorkflowDocumentContext | null | undefined,
): ApprovalStepLike | undefined {
  const ar = d?.approvalRequests?.[0];
  if (!ar?.steps?.length) return undefined;

  const atPointer = ar.steps.find(
    (s) => workflowStepNumbersMatch(s.stepNumber, ar.currentStep) && isWorkflowStepPending(s),
  );
  if (atPointer) {
    return atPointer;
  }

  const pendingSteps = ar.steps.filter((s) => isWorkflowStepPending(s));
  if (pendingSteps.length === 1) {
    return pendingSteps[0];
  }
  return undefined;
}

/** Workflow queue + final archive tabs on breakage/lost list pages (filter by document status). */
export type ReturnsWorkflowListStatusTab =
  | 'IN_PROGRESS'
  | 'DRAFT'
  | 'DEPT_APPROVED'
  | 'COST_CONTROL_APPROVED'
  | 'FINANCE_APPROVED'
  | 'APPROVED';

const PIPELINE_LIST_STATUS_TABS: readonly ReturnsWorkflowListStatusTab[] = [
  'DEPT_APPROVED',
  'COST_CONTROL_APPROVED',
  'FINANCE_APPROVED',
  'APPROVED',
] as const;

/** ADMIN-only: draft queue + full pipeline (only role that sees every tab at once). */
const ADMIN_FULL_LIST_STATUS_TABS: readonly ReturnsWorkflowListStatusTab[] = [
  'DRAFT',
  ...PIPELINE_LIST_STATUS_TABS,
] as const;

/**
 * Which status tabs to show on breakage & lost-items lists for the current user.
 * Only **ADMIN** sees every tab (including Draft). Other roles see a reduced lane + archive.
 * Tab visibility in the UI is gated by {@link showReturnsWorkflowStatusTabBar}.
 */
export function visibleReturnsWorkflowListStatusTabs(
  role: string | undefined,
): ReturnsWorkflowListStatusTab[] {
  const r = (role ?? '').trim();
  if (r === 'ADMIN') {
    return [...ADMIN_FULL_LIST_STATUS_TABS];
  }
  if (r === 'ORG_MANAGER' || r === 'SUPER_ADMIN') {
    return [...PIPELINE_LIST_STATUS_TABS];
  }
  if (r === 'COST_CONTROL') {
    return ['DEPT_APPROVED', 'APPROVED'];
  }
  if (r === 'FINANCE_MANAGER') {
    return ['COST_CONTROL_APPROVED', 'APPROVED'];
  }
  if (r === 'GENERAL_MANAGER') {
    return ['FINANCE_APPROVED', 'APPROVED'];
  }
  /** Only “In Progress” (all in-flight pipeline stages) + final GM archive — no per-stage tabs. */
  if (r === 'DEPT_MANAGER') {
    return ['IN_PROGRESS', 'APPROVED'];
  }
  return [...PIPELINE_LIST_STATUS_TABS];
}

/** Tab bar (workflow stage filters) is shown only for org admins; functional roles get one unified list. */
export function showReturnsWorkflowStatusTabBar(role: string | undefined): boolean {
  const r = (role ?? '').trim();
  return r === 'ADMIN' || r === 'ORG_MANAGER' || r === 'SUPER_ADMIN';
}

/**
 * Single `status` query for list APIs when the workflow tab bar is hidden (functional roles).
 * Dept managers also send `createdById` (see {@link returnsWorkflowListCreatedByIdParam}) to limit to their documents.
 */
export function returnsWorkflowUnifiedListApiStatusParam(role: string | undefined): string {
  const r = (role ?? '').trim();
  if (r === 'COST_CONTROL') {
    return 'DEPT_APPROVED,COST_CONTROL_APPROVED';
  }
  if (r === 'FINANCE_MANAGER') {
    return 'COST_CONTROL_APPROVED,FINANCE_APPROVED';
  }
  if (r === 'GENERAL_MANAGER') {
    return 'FINANCE_APPROVED,APPROVED';
  }
  if (r === 'DEPT_MANAGER') {
    return 'DRAFT,DEPT_APPROVED,COST_CONTROL_APPROVED,FINANCE_APPROVED';
  }
  /** Other roles: full in-flight pipeline (no per-stage tabs). */
  return 'DEPT_APPROVED,COST_CONTROL_APPROVED,FINANCE_APPROVED';
}

/** When true, list requests should include `createdById` = current user (dept manager’s own pending queue). */
export function returnsWorkflowListShouldFilterCreatedBy(role: string | undefined): boolean {
  return (role ?? '').trim() === 'DEPT_MANAGER';
}

/**
 * Next role for “waiting” tag on list rows: approver already acted, or dept manager viewing own in-flight doc.
 */
export function returnsWorkflowListRowWaitingTagRole(
  userRole: string | undefined,
  userId: string | undefined,
  context: ReturnsWorkflowDocumentContext | null | undefined,
  doc: { status: string; createdByUser?: { id?: string } | null },
): string | null {
  const processed = returnsWorkflowProcessedWaitingNextRole(context, userRole, doc.status);
  if (processed) {
    return processed;
  }
  if ((userRole ?? '').trim() !== 'DEPT_MANAGER') {
    return null;
  }
  const cid = doc.createdByUser?.id;
  const uid = userId?.trim();
  if (!cid || !uid || cid !== uid) {
    return null;
  }
  const st = String(doc.status);
  if (st === 'APPROVED' || st === 'REJECTED' || st === 'VOID') {
    return null;
  }
  const next = workflowPendingRequiredRoleForStatus(st);
  if (!next || next === 'DEPT_MANAGER') {
    return null;
  }
  return next;
}

/** API `status` query value (comma list supported by backend). */
export function returnsWorkflowListApiStatusParam(tab: ReturnsWorkflowListStatusTab): string {
  if (tab === 'IN_PROGRESS') {
    return 'DEPT_APPROVED,COST_CONTROL_APPROVED,FINANCE_APPROVED';
  }
  return tab;
}

/**
 * Suffix for `BREAKAGE.STATUS.*` / `LOST_ITEMS.STATUS.*` (virtual tabs such as `IN_PROGRESS` map here).
 */
export function returnsWorkflowListTabTranslationSuffix(tab: ReturnsWorkflowListStatusTab): string {
  if (tab === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }
  return tab;
}

