import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  CheckoutCouponResponse,
  PayNowRequest,
  PayNowResponse,
  ReportsResponse,
} from '../models/order.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  getCheckoutCoupon() {
    return this.http.get<CheckoutCouponResponse>(`${environment.apiUrl}/orders/checkout-coupon`);
  }

  payNow(payload: PayNowRequest) {
    return this.http.post<PayNowResponse>(`${environment.apiUrl}/orders/pay`, payload);
  }

  getReportsDashboard() {
    return this.http.get<ReportsResponse>(`${environment.apiUrl}/orders/reports/dashboard`);
  }
}
