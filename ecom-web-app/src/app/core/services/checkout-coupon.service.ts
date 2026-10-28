import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { CheckoutCouponResult } from '../models/order.model';
import { OrderService } from './order.service';

@Injectable({ providedIn: 'root' })
export class CheckoutCouponService {
  private readonly orderService = inject(OrderService);

  /** Set once when user clicks Proceed to checkout (or single fallback on /checkout). */
  private readonly snapshot = signal<CheckoutCouponResult | null>(null);

  readonly result = this.snapshot.asReadonly();

  claimOnce(): Observable<CheckoutCouponResult> {
    return this.orderService.getCheckoutCoupon().pipe(
      map((response) => response.data),
      tap((data) => this.snapshot.set(data)),
    );
  }

  setSnapshot(data: CheckoutCouponResult): void {
    this.snapshot.set(data);
  }

  clear(): void {
    this.snapshot.set(null);
  }
}
