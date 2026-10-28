import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CartLine } from '../../core/models/cart.model';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { AppDialogLayoutComponent } from '../../shared/components/app-dialog-layout/app-dialog-layout.component';
import { QuantityStepperComponent } from '../../shared/components/quantity-stepper/quantity-stepper.component';
import { StockLimitDialogComponent } from '../shop/stock-limit-dialog.component';

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
  private readonly productService = inject(ProductService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<CartDialogComponent>);

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly products = signal<Product[]>([]);

  protected readonly cartLines = computed(() => this.cartService.getLines(this.products()));
  protected readonly subtotal = computed(() => this.cartService.getSubtotal(this.cartLines()));
  protected readonly itemCount = this.cartService.cartCount;

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load cart items. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  protected closeDialog(): void {
    this.dialogRef.close();
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
