import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Product } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CartFlowService } from '../../core/services/cart-flow.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { CartDialogComponent } from '../cart/cart-dialog.component';
import { LoginDialogComponent } from '../login/login-dialog.component';
import { CartQuantityPipe } from '../../shared/pipes/cart-quantity.pipe';
import { QuantityStepperComponent } from '../../shared/components/quantity-stepper/quantity-stepper.component';
import { StockLimitDialogComponent } from './stock-limit-dialog.component';

type LoginIntent =
  | { type: 'addToCart'; productId: string }
  | { type: 'selectProduct'; productId: string }
  | { type: 'openCart' };

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
    QuantityStepperComponent,
    RouterLink,
  ],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css',
})
export class ShopComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly catalog = inject(ProductCatalogService);
  private readonly cartService = inject(CartService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly cartFlowService = inject(CartFlowService);

  private pendingLoginIntent: LoginIntent | null = null;

  protected readonly selectedProduct = signal<Product | null>(null);

  protected readonly products = this.catalog.products;
  protected readonly isLoading = this.catalog.isLoading;
  protected readonly loadError = this.catalog.loadError;
  protected readonly cartQuantities = this.cartService.quantities;
  protected readonly cartCount = this.cartService.cartCount;
  protected readonly currentUser = this.authService.currentUser;
  protected readonly isLoggedIn = this.authService.isLoggedIn;
  protected readonly isAdmin = this.authService.isAdmin;

  ngOnInit(): void {
    this.catalog.load();
    this.handleCartFlowRequest();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.handleCartFlowRequest());
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

  protected openCartDialog(errorMessage?: string): void {
    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'openCart' });
      return;
    }

    this.dialog.open(CartDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      panelClass: 'app-dialog-panel',
      autoFocus: false,
      data: errorMessage ? { errorMessage } : undefined,
    });
  }

  protected logout(): void {
    this.authService.logout();
    this.cartService.clear();
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

    if (product.quantity === 0) {
      return;
    }

    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'addToCart', productId: product.id });
      return;
    }

    this.addFirstToCart(product);
  }

  protected onIncreaseQuantity(product: Product, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.isLoggedIn()) {
      this.openLoginDialog({ type: 'addToCart', productId: product.id });
      return;
    }

    const result = this.cartService.increase(product);

    if (result === 'stock_limit') {
      this.openStockLimitDialog(product.quantity);
    }
  }

  protected onDecreaseQuantity(product: Product, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.isLoggedIn()) {
      this.openLoginDialog();
      return;
    }

    this.cartService.decrease(product);
  }

  private addFirstToCart(product: Product): void {
    const result = this.cartService.setQuantity(product, 1);

    if (result === 'stock_limit') {
      this.openStockLimitDialog(product.quantity);
    }
  }

  private completePendingLoginIntent(): void {
    if (!this.pendingLoginIntent) {
      return;
    }

    if (this.pendingLoginIntent.type === 'openCart') {
      this.openCartDialog();
      return;
    }

    const intent = this.pendingLoginIntent;

    if (intent.type === 'addToCart' || intent.type === 'selectProduct') {
      const product = this.products().find((item) => item.id === intent.productId);

      if (!product) {
        return;
      }

      if (intent.type === 'addToCart') {
        this.addFirstToCart(product);
      } else {
        this.selectedProduct.set(product);
      }
    }
  }

  private openStockLimitDialog(maxQuantity: number): void {
    this.dialog.open(StockLimitDialogComponent, {
      width: '380px',
      panelClass: 'app-dialog-panel',
      data: { maxQuantity },
    });
  }

  private handleCartFlowRequest(): void {
    const cartMessage = this.cartFlowService.consumeOpenCartRequest();

    if (cartMessage === 'skip') {
      return;
    }

    this.catalog.load(true);
    this.openCartDialog(cartMessage || undefined);
  }
}
