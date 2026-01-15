export { apiClient } from "./client";
export { authApi } from "./auth";
export { categoriesApi } from "./categories";
export { analyticsApi } from "./analytics";
export { notificationsApi } from "./notifications";
export { itemsApi } from "./items";
export { locationsApi } from "./locations";
export { containersApi } from "./containers";
export { borrowersApi } from "./borrowers";
export { loansApi } from "./loans";
export { inventoryApi } from "./inventory";

export type { User, Workspace, AuthTokenResponse, RegisterData } from "./auth";
export type { Category, CategoryCreate, CategoryUpdate } from "./categories";
export type {
  OutOfStockItem,
  DashboardStats,
  RecentActivity,
  AnalyticsSummary,
  CategoryStats,
  LocationInventoryValue,
  ConditionBreakdown,
  StatusBreakdown,
  TopBorrower,
  MonthlyLoanActivity,
  LoanStats,
} from "./analytics";
export type {
  Notification,
  NotificationType,
  UnreadCountResponse,
  NotificationListResponse,
} from "./notifications";
