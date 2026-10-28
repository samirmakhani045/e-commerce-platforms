import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { CartLine } from '../../core/models/cart.model';
import { CartService } from '../../core/services/cart.service';
import { CheckoutCouponService } from '../../core/services/checkout-coupon.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { AppDialogLayoutComponent } from '../../shared/components/app-dialog-layout/app-dialog-layout.component';
import { QuantityStepperComponent } from '../../shared/components/quantity-stepper/quantity-stepper.component';
import { StockLimitDialogComponent } from '../shop/stock-limit-dialog.component';

export interface CartDialogData {
  errorMessage?: string;
}

@Component({
  selector: 'app-cart-dialog',
  imports: [
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AppDialogLayoutComponent,
    QuantityStepperComponent,
  ],
  templateUrl: './cart-dialog.component.html',
  styleUrl: './cart-dialog.component.css',
})
export class CartDialogComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly catalog = inject(ProductCatalogService);
  private readonly checkoutCouponService = inject(CheckoutCouponService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<CartDialogComponent>);
  private readonly router = inject(Router);
  private readonly dialogData = inject<CartDialogData>(MAT_DIALOG_DATA, { optional: true });

  protected readonly bannerMessage = signal(this.dialogData?.errorMessage ?? '');
  protected readonly isProceedingToCheckout = signal(false);

  protected readonly products = this.catalog.products;
  protected readonly isLoading = this.catalog.isLoading;
  protected readonly loadError = this.catalog.loadError;

  protected readonly cartLines = computed(() => this.cartService.getLines(this.products()));
  protected readonly subtotal = computed(() => this.cartService.getSubtotal(this.cartLines()));
  protected readonly itemCount = this.cartService.cartCount;

  ngOnInit(): void {
    this.catalog.load();
  }

  protected closeDialog(): void {
    this.dialogRef.close();
  }

  protected goToCheckout(): void {
    if (this.cartLines().length === 0 || this.isProceedingToCheckout()) {
      return;
    }

    this.isProceedingToCheckout.set(true);

    this.checkoutCouponService.claimOnce().subscribe({
      next: (result) => {
        this.checkoutCouponService.setSnapshot(result);
        this.isProceedingToCheckout.set(false);
        this.dialogRef.close();
        this.router.navigate(['/checkout'], {
          state: {
            checkoutCouponOffer: result.offer,
            checkoutCouponMessage: result.message ?? '',
          },
        });
      },
      error: () => {
        const emptyResult = { offer: null };
        this.checkoutCouponService.setSnapshot(emptyResult);
        this.isProceedingToCheckout.set(false);
        this.dialogRef.close();
        this.router.navigate(['/checkout'], {
          state: {
            checkoutCouponOffer: null,
            checkoutCouponMessage: '',
          },
        });
      },
    });
  }

  protected onIncrease(line: CartLine): void {
    const result = this.cartService.increase(line.product);

    if (result === 'stock_limit') {
      this.openStockLimitDialog(line.product.quantity);
    }
  }

  protected onDecrease(line: CartLine): void {
    this.cartService.decrease(line.product);
  }

  private openStockLimitDialog(maxQuantity: number): void {
    this.dialog.open(StockLimitDialogComponent, {
      width: '380px',
      panelClass: 'app-dialog-panel',
      data: { maxQuantity },
    });
  }
}
