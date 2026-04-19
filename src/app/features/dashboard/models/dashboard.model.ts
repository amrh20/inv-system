/** Backend `meta.dashboardProfile` — drives adaptive widgets. */
export type DashboardProfile = 'executive' | 'operations' | 'department' | 'security';

export interface DashboardSummaryMeta {
  dashboardProfile: DashboardProfile;
  /** Present when `dashboardProfile === 'department'` */
  departmentScoped?: boolean;
  departmentId?: string;
}

export interface PendingApprovalPreviewRow {
  id: string;
  documentNo: string;
  movementType: string;
  status: string;
}

export interface MyRequestStatusRow {
  status: string;
  count: number;
}

export interface SecurityDashboardSnapshot {
  pendingGateApprovals: number;
  activeOutPasses: number;
}

/**
 * Dashboard summary API response — matches backend dashboard.service getDashboardSummary
 */
export interface InventoryOverview {
  totalValue: number;
  totalStores: number;
  totalActiveItems: number;
  totalQtyOnHand: number;
  valueByDepartment?: ValueByDepartment[];
}

export interface ValueByDepartment {
  departmentName: string;
  value: number;
}

export interface MonthlyPerformance {
  consumptionValue: number;
  consumptionDelta: number;
  transfersCount: number;
  lossValue: number;
  lossDelta: number;
  fillRate: number;
  totalRequisitions: number;
  fulfilledRequisitions: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  value: number;
}

export interface TopSlowItem {
  itemName: string;
  qtyOnHand: number;
  value: number;
  lastMovement: string | null;
}

export interface RiskIndicators {
  aging: AgingBucket[];
  topConsumed: { itemName: string; totalQty: number; totalValue: number }[];
  topSlow: TopSlowItem[];
  lossVsConsumptionPct?: number;
}

export interface OperationalHealthDetail {
  id: string;
  transferNo?: string;
  documentNo?: string;
  grnNumber?: string;
  reportNo?: string;
  passNo?: string;
  status?: string;
}

export interface OperationalHealth {
  openReqsCount: number;
  pendingTransfersCount: number;
  pendingGrnsCount: number;
  pendingLossCount: number;
  overdueLoansCount: number;
  pendingStockReportsCount: number;
  details?: {
    openReqs: unknown[];
    pendingTransfers: OperationalHealthDetail[];
    pendingGrns: OperationalHealthDetail[];
    pendingLoss: OperationalHealthDetail[];
    overdueLoans: OperationalHealthDetail[];
    pendingStockReports: OperationalHealthDetail[];
  };
}

/** Control Tower — extended analytics from GET /dashboard/summary */
export interface ControlTowerMonthlyLoss {
  totalValue: number;
  documentCount: number;
}

export interface WorkflowHealthRow {
  status: string;
  count: number;
}

export interface StockAlertRow {
  itemId: string;
  itemName: string;
  qtyOnHand: number;
  minQty: number;
  shortfall: number;
}

export interface AccountabilityDistribution {
  companyLoss: number;
  employeeDeduction: number;
  targetHotelCompensation: number;
  unspecified: number;
}

export interface LossVsBreakage {
  breakageValue: number;
  lostValue: number;
}

export interface TopVulnerableItem {
  itemName: string;
  eventCount: number;
  totalCost: number;
}

export interface ControlTowerSummary {
  monthlyApprovedLosses: ControlTowerMonthlyLoss;
  workflowHealth: WorkflowHealthRow[];
  stockAlerts: StockAlertRow[];
  accountabilityDistribution: AccountabilityDistribution;
  lossVsBreakage: LossVsBreakage;
  topVulnerableItems: TopVulnerableItem[];
  pendingMyActionCount: number;
  activeUsersCount: number;
  /** Present for `operations` profile */
  pendingApprovalsPreview?: PendingApprovalPreviewRow[];
}

export interface DashboardSummary {
  meta?: DashboardSummaryMeta;
  inventoryOverview: InventoryOverview | null;
  monthlyPerformance: MonthlyPerformance | null;
  riskIndicators: RiskIndicators | null;
  operationalHealth: OperationalHealth | null;
  /** Optional — present when API returns Control Tower payload */
  controlTower?: ControlTowerSummary | null;
  /** Department managers — breakage/lost documents created by the user, grouped by status */
  myRequestStatus?: MyRequestStatusRow[];
  /** Security profile — gate workload snapshot */
  securitySnapshot?: SecurityDashboardSnapshot;
  generatedAt: string;
}

export interface DashboardSummaryResponse {
  data: DashboardSummary;
  meta?: { responseTimeMs?: number };
}

export interface ChartData {
  consumptionByMonth?: { month: string; consumption: number; breakage: number; transactions: number }[];
  deptBreakdown?: { name: string; value: number; items?: number }[];
  topConsumed?: { name: string; qty: number }[];
  lowStockData?: { name: string; value: number; fill: string }[];
}

/** Single branch / hotel row from GET /dashboard/organization-summary */
export interface BranchSummary {
  /** Display name from API (`branchName`) */
  branchName: string;
  /** Used for tenant switch — API may omit; falls back to `branchName` */
  tenantSlug: string;
  inventoryValue: number;
  /** Mapped from API `consumption` */
  consumptionValue: number;
  /** Mapped from API `waste` */
  wasteValue: number;
  pendingTasks: number;
}

export interface OrganizationGroupTotals {
  totalInventoryValue: number;
  totalConsumption: number;
  totalPendingTasks: number;
}

/** Response body for organization comparison dashboard (object shape) or wrapped as array-only `data` from API */
export interface OrganizationDashboardSummary {
  parentTenantId?: string;
  totals?: OrganizationGroupTotals;
  branches: BranchSummary[];
  generatedAt?: string;
}
