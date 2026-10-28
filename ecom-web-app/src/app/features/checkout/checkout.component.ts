import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CheckoutCouponOffer,
  CheckoutCouponResult,
  InvalidStockItem,
} from '../../core/models/order.model';
import { AuthService } from '../../core/services/auth.service';
import { CartFlowService } from '../../core/services/cart-flow.service';
import { CartService } from '../../core/services/cart.service';
import { CheckoutCouponService } from '../../core/services/checkout-coupon.service';
import { OrderService } from '../../core/services/order.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';

@Component({
  selector: 'app-checkout',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly cartService = inject(CartService);
  private readonly catalog = inject(ProductCatalogService);
  private readonly orderService = inject(OrderService);
  private readonly checkoutCouponService = inject(CheckoutCouponService);
  private readonly cartFlowService = inject(CartFlowService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  private couponCountdownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly isPaying = signal(false);
  protected readonly payError = signal('');
  protected readonly successMessage = signal('');
  protected readonly couponNotice = signal('');
  protected readonly couponHeldByOther = signal('');
  protected readonly couponExpiresInSeconds = signal<number | null>(null);
  protected readonly appliedOfferCode = signal<string | null>(null);
  protected readonly activeCouponOffer = signal<CheckoutCouponOffer | null>(null);

  protected readonly products = this.catalog.products;
  protected readonly isLoading = this.catalog.isLoading;
  protected readonly loadError = this.catalog.loadError;

  protected readonly cartLines = computed(() => this.cartService.getLines(this.products()));
  protected readonly subtotal = computed(() => this.cartService.getSubtotal(this.cartLines()));
  protected readonly discountAmount = computed(() =>
    this.calculateDiscount(this.subtotal(), this.activeCouponOffer(), this.appliedOfferCode()),
  );
  protected readonly orderTotal = computed(() =>
    Math.max(this.subtotal() - this.discountAmount(), 0),
  );
  protected readonly itemCount = this.cartService.cartCount;
  protected readonly currentUser = this.authService.currentUser;

  protected readonly couponForm = this.formBuilder.nonNullable.group({
    couponCode: [''],
  });

  constructor() {
    effect(() => {
      if (this.isLoading()) {
        return;
      }

      if (this.successMessage()) {
        return;
      }

      if (this.cartService.cartCount() === 0) {
        this.router.navigate(['/']);
      }
    });

    effect(() => {
      const snapshot = this.checkoutCouponService.result();

      if (snapshot && !this.activeCouponOffer()) {
        this.applyCouponResult(snapshot);
      }
    });
  }

  ngOnInit(): void {
    this.catalog.load();

    const fromNavigation = this.readCouponResultFromNavigation();

    if (fromNavigation) {
      this.checkoutCouponService.setSnapshot(fromNavigation);
      this.applyCouponResult(fromNavigation);
      return;
    }

    const snapshot = this.checkoutCouponService.result();

    if (snapshot) {
      this.applyCouponResult(snapshot);
      return;
    }

    this.checkoutCouponService.claimOnce().subscribe({
      next: (result) => this.applyCouponResult(result),
      error: () => this.applyCouponResult({ offer: null }),
    });
  }

  ngOnDestroy(): void {
    this.stopCouponCountdown();
  }

  protected payNow(): void {
    if (this.isPaying() || this.cartLines().length === 0) {
      return;
    }

    this.isPaying.set(true);
    this.payError.set('');
    this.successMessage.set('');

    const couponCode = this.couponForm.controls.couponCode.value.trim() || null;
    const items = this.cartService.buildCheckoutItems(this.products());
    this.cartService.beginCheckoutPay(items.map((item) => item.productId));

    this.orderService.payNow({ items, couponCode }).subscribe({
      next: (response) => {
        this.checkoutCouponService.clear();
        this.cartService.clear();
        this.cartService.endCheckoutPay();
        this.isPaying.set(false);
        this.successMessage.set(
          `Order ${response.data.orderId.slice(0, 8)} placed. Total paid: $${response.data.total.toFixed(2)}`,
        );
      },
      error: (error: HttpErrorResponse) => {
        this.cartService.endCheckoutPay();
        this.isPaying.set(false);

        if (error.status === 409) {
          const invalidItems = (error.error?.data?.invalidItems ?? []) as InvalidStockItem[];

          if (invalidItems.length > 0) {
            const message = this.buildStockErrorMessage(invalidItems);
            this.cartFlowService.requestOpenCart(message);
            this.router.navigate(['/']);
            return;
          }

          this.payError.set(error.error?.message ?? 'Checkout conflict. Try again.');
          return;
        }

        this.payError.set(error.error?.message ?? 'Payment failed. Please try again.');
      },
    });
  }

  private readCouponResultFromNavigation(): CheckoutCouponResult | null {
    const state = history.state as {
      checkoutCouponOffer?: CheckoutCouponOffer | null;
      checkoutCouponMessage?: string;
      checkoutCouponResult?: CheckoutCouponResult | CheckoutCouponOffer | null;
    } | null;

    if (!state) {
      return null;
    }

    if (state.checkoutCouponOffer) {
      return {
        offer: state.checkoutCouponOffer,
        message: state.checkoutCouponMessage ?? '',
      };
    }

    const legacy = state.checkoutCouponResult;

    if (!legacy) {
      return null;
    }

    if (typeof legacy === 'object' && 'code' in legacy && legacy.code) {
      return {
        offer: legacy as CheckoutCouponOffer,
        message: state.checkoutCouponMessage ?? '',
      };
    }

    if (typeof legacy === 'object' && 'offer' in legacy) {
      return legacy as CheckoutCouponResult;
    }

    return null;
  }

  private applyCouponResult(result: CheckoutCouponResult): void {
    const offer = result.offer;

    if (offer?.reservedForYou && offer.code) {
      this.activeCouponOffer.set(offer);
      this.couponForm.controls.couponCode.setValue(offer.code, { emitEvent: true });
      this.appliedOfferCode.set(offer.code);
      this.couponNotice.set(result.message ?? 'This coupon is about to expire. Complete payment soon.');
      this.couponHeldByOther.set('');
      this.startCouponCountdown(
        offer.secondsRemaining ?? result.settings?.reservationSeconds ?? 60,
      );
      return;
    }

    this.stopCouponCountdown();
    this.activeCouponOffer.set(null);
    this.appliedOfferCode.set(null);
    this.couponNotice.set('');
    this.couponHeldByOther.set(result.message ?? result.heldByUserId
      ? 'Milestone coupon is currently held by another shopper. Try again after it expires.'
      : '');
    this.couponForm.controls.couponCode.setValue('');
  }

  private calculateDiscount(
    subtotal: number,
    offer: CheckoutCouponOffer | null,
    appliedCode: string | null,
  ): number {
    if (!offer || !appliedCode || subtotal <= 0) {
      return 0;
    }

    if (appliedCode.toUpperCase() !== offer.code.toUpperCase()) {
      return 0;
    }

    if (offer.discountType === 'percent') {
      return Math.round(subtotal * (offer.discountValue / 100) * 100) / 100;
    }

    return Math.round(Math.min(offer.discountValue, subtotal) * 100) / 100;
  }

  private startCouponCountdown(secondsRemaining: number): void {
    this.stopCouponCountdown();

    let remaining = Math.max(0, Math.floor(secondsRemaining));
    this.couponExpiresInSeconds.set(remaining);

    if (remaining <= 0) {
      return;
    }

    this.couponCountdownTimer = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      this.couponExpiresInSeconds.set(remaining);

      if (remaining <= 0) {
        this.stopCouponCountdown();
        this.couponHeldByOther.set(
          'Reservation time ended. Go back to cart and proceed to checkout again, or pay without a code.',
        );
      }
    }, 1000);
  }

  private stopCouponCountdown(): void {
    if (this.couponCountdownTimer) {
      clearInterval(this.couponCountdownTimer);
      this.couponCountdownTimer = null;
    }

    this.couponExpiresInSeconds.set(null);
  }

  private buildStockErrorMessage(items: InvalidStockItem[]): string {
    if (items.length === 0) {
      return 'Some items in your cart are no longer available. Please review your cart.';
    }

    const preview = items
      .slice(0, 2)
      .map((item) => `${item.name} (requested ${item.requested}, available ${item.available})`)
      .join('; ');

    return `Stock updated: ${preview}. Please adjust quantities in your cart.`;
  }
}
