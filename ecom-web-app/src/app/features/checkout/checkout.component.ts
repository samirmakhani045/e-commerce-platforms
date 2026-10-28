import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InvalidStockItem } from '../../core/models/order.model';
import { AuthService } from '../../core/services/auth.service';
import { CartFlowService } from '../../core/services/cart-flow.service';
import { CartService } from '../../core/services/cart.service';
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
export class CheckoutComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly catalog = inject(ProductCatalogService);
  private readonly orderService = inject(OrderService);
  private readonly cartFlowService = inject(CartFlowService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly isPaying = signal(false);
  protected readonly payError = signal('');
  protected readonly successMessage = signal('');

  protected readonly products = this.catalog.products;
  protected readonly isLoading = this.catalog.isLoading;
  protected readonly loadError = this.catalog.loadError;

  protected readonly cartLines = computed(() => this.cartService.getLines(this.products()));
  protected readonly subtotal = computed(() => this.cartService.getSubtotal(this.cartLines()));
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

      if (this.cartLines().length === 0) {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnInit(): void {
    this.catalog.load();
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
          const message = this.buildStockErrorMessage(invalidItems);
          this.cartFlowService.requestOpenCart(message);
          this.router.navigate(['/']);
          return;
        }

        this.payError.set(error.error?.message ?? 'Payment failed. Please try again.');
      },
    });
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
