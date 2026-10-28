import { Injectable, effect, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { ProductStockUpdatedEvent, StockAdjustDialogData } from '../models/stock.model';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { ProductCatalogService } from './product-catalog.service';
import { getCartQuantity } from '../../shared/pipes/cart-quantity.pipe';
import { StockAdjustDialogComponent } from '../../features/shop/stock-adjust-dialog.component';

@Injectable({ providedIn: 'root' })
export class StockSocketService {
  private readonly authService = inject(AuthService);
  private readonly catalog = inject(ProductCatalogService);
  private readonly cartService = inject(CartService);
  private readonly dialog = inject(MatDialog);

  private socket: Socket | null = null;

  constructor() {
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.disconnect();

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
    });

    this.socket.on('product:stock-updated', (payload: ProductStockUpdatedEvent) => {
      this.handleStockUpdates(payload?.products ?? []);
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleStockUpdates(updates: ProductStockUpdatedEvent['products']): void {
    this.catalog.applyStockUpdates(updates);

    for (const update of updates) {
      if (this.cartService.isCheckoutPayProduct(update.productId)) {
        continue;
      }

      const cartQuantity = getCartQuantity(this.cartService.quantities(), update.productId);

      if (cartQuantity === 0) {
        continue;
      }

      if (update.quantity === 0) {
        this.cartService.remove(update.productId);
        this.openAdjustDialog({
          type: 'out_of_stock',
          productName: update.name,
        });
        continue;
      }

      if (cartQuantity > update.quantity) {
        this.cartService.clampQuantity(update.productId, update.quantity);
        this.openAdjustDialog({
          type: 'partial',
          productName: update.name,
          requested: cartQuantity,
          available: update.quantity,
        });
      }
    }
  }

  private openAdjustDialog(data: StockAdjustDialogData): void {
    this.dialog.open(StockAdjustDialogComponent, {
      width: '400px',
      panelClass: 'app-dialog-panel',
      data,
    });
  }
}
