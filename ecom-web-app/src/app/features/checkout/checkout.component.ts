import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InvalidStockItem } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { CartFlowService } from '../../core/services/cart-flow.service';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';

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
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly cartFlowService = inject(CartFlowService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly isLoading = signal(true);
  protected readonly isPaying = signal(false);
  protected readonly loadError = signal('');
  protected readonly payError = signal('');
  protected readonly successMessage = signal('');
  protected readonly products = signal<Product[]>([]);

  protected readonly cartLines = computed(() => this.cartService.getLines(this.products()));
  protected readonly subtotal = computed(() => this.cartService.getSubtotal(this.cartLines()));
  protected readonly itemCount = this.cartService.cartCount;
  protected readonly currentUser = this.authService.currentUser;

  protected readonly couponForm = this.formBuilder.nonNullable.group({
    couponCode: [''],
  });

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);

        if (this.cartLines().length === 0) {
          this.router.navigate(['/']);
        }
      },
      error: () => {
        this.loadError.set('Unable to load checkout details.');
        this.isLoading.set(false);
      },
    });
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

    this.orderService.payNow({ items, couponCode }).subscribe({
      next: (response) => {
        this.isPaying.set(false);
        this.cartService.clear();
        this.successMessage.set(
          `Order ${response.data.orderId.slice(0, 8)} placed. Total paid: $${response.data.total.toFixed(2)}`,
        );
      },
      error: (error: HttpErrorResponse) => {
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
