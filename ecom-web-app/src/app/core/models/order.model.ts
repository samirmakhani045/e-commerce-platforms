export interface CheckoutItemPayload {
  productId: string;
  quantity: number;
}

export interface PayNowRequest {
  items: CheckoutItemPayload[];
  couponCode?: string | null;
}

export interface PayNowResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    subtotal: number;
    discountAmount: number;
    total: number;
    totalCost: number;
    grossProfit: number;
    couponCode: string | null;
  };
}

export interface InvalidStockItem {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

export interface ReportSummary {
  orderCount: number;
  revenue: number;
  totalDiscount: number;
  totalProfit: number;
  totalCost: number;
}

export interface ReportChartPoint {
  date: string;
  orderCount: number;
  revenue: number;
  discount: number;
  profit: number;
}

export interface RecentOrder {
  id: string;
  total: number;
  discountAmount: number;
  grossProfit: number;
  couponCode: string | null;
  createdAt: string;
}

export interface ReportsDashboard {
  summary: ReportSummary;
  chart: ReportChartPoint[];
  recentOrders: RecentOrder[];
}

export interface ReportsResponse {
  success: boolean;
  message: string;
  data: ReportsDashboard;
}
