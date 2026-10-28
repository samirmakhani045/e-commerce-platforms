import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Product } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { LoginDialogComponent } from '../login/login-dialog.component';
import { getCartQuantity, CartQuantityPipe } from '../../shared/pipes/cart-quantity.pipe';
import { StockLimitDialogComponent } from './stock-limit-dialog.component';

type LoginIntent =
  | { type: 'addToCart'; productId: string }
  | { type: 'selectProduct'; productId: string };

@Component({
  selector: 'app-shop',
  imports: [
    CurrencyPipe,
    MatToolbarModule,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    CartQuantityPipe,
  ],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css',
})
export class ShopComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly dialog = inject(MatDialog);

  private pendingLoginIntent: LoginIntent | null = null;

  protected readonly products = signal<Product[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly cartQuantities = signal<Record<string, number>>({});
  protected readonly cartCount = signal(0);
  protected readonly selectedProduct = signal<Product | null>(null);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isLoggedIn = this.authService.isLoggedIn;

  ngOnInit(): void {
    this.loadProducts();
  }

  protected openLoginDialog(intent: LoginIntent | null = null): void {
    this.pendingLoginIntent = intent;

    const dialogRef = this.dialog.open(LoginDialogComponent, {
      width: '420px',
      autoFocus: true,
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((success) => {
      if (success && this.isLoggedIn()) {
        this.completePendingLoginIntent();
      }
      this.pendingLoginIntent = null;
    });
  }

  protected logout(): void {
    this.authService.logout();
    this.cartQuantities.set({});
    this.cartCount.set(0);
    this.selectedProduct.set(null);
  }

  protected onProductSelected(product: Product): void {
    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'selectProduct', productId: product.id });
      return;
    }

    this.selectedProduct.set(product);
  }

  protected onAddToCart(product: Product, event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'addToCart', productId: product.id });
      return;
    }

    this.setProductQuantity(product, 1);
  }

  protected onIncreaseQuantity(product: Product, event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'addToCart', productId: product.id });
      return;
    }

    const current = getCartQuantity(this.cartQuantities(), product.id);

    if (current >= product.quantity) {
      this.openStockLimitDialog(product.quantity);
      return;
    }

    this.setProductQuantity(product, current + 1);
  }

  protected onDecreaseQuantity(product: Product, event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isLoggedIn()) {
      this.openLoginDialog();
      return;
    }

    const current = getCartQuantity(this.cartQuantities(), product.id);

    if (current <= 1) {
      this.removeProductFromCart(product.id);
      return;
    }

    this.setProductQuantity(product, current - 1);
  }

  private completePendingLoginIntent(): void {
    if (!this.pendingLoginIntent) {
      return;
    }

    const product = this.products().find(
      (item) => item.id === this.pendingLoginIntent?.productId,
    );

    if (!product) {
      return;
    }

    if (this.pendingLoginIntent.type === 'addToCart') {
      this.setProductQuantity(product, 1);
    }

    if (this.pendingLoginIntent.type === 'selectProduct') {
      this.selectedProduct.set(product);
    }
  }

  private setProductQuantity(product: Product, quantity: number): void {
    if (quantity > product.quantity) {
      this.openStockLimitDialog(product.quantity);
      return;
    }

    this.cartQuantities.update((current) => ({
      ...current,
      [product.id]: quantity,
    }));
    this.syncCartCount();
  }

  private removeProductFromCart(productId: string): void {
    this.cartQuantities.update((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    this.syncCartCount();
  }

  private syncCartCount(): void {
    const total = Object.values(this.cartQuantities()).reduce((sum, qty) => sum + qty, 0);
    this.cartCount.set(total);
  }

  private openStockLimitDialog(maxQuantity: number): void {
    this.dialog.open(StockLimitDialogComponent, {
      width: '380px',
      panelClass: 'app-dialog-panel',
      data: { maxQuantity },
    });
  }

  private loadProducts(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load products. Make sure the API server is running.');
        this.isLoading.set(false);
      },
    });
  }
}
