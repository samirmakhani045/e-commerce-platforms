import { computed, Injectable, signal } from '@angular/core';
import { CartLine, CartStockResult } from '../models/cart.model';
import { Product } from '../models/product.model';
import { getCartQuantity } from '../../shared/pipes/cart-quantity.pipe';

@Injectable({ providedIn: 'root' })
export class CartService {
  /** Products in an in-flight Pay now request — skip socket cart warnings for these. */
  private checkoutPayProductIds = new Set<string>();

  private readonly quantitiesSignal = signal<Record<string, number>>({});

  readonly quantities = this.quantitiesSignal.asReadonly();

  readonly cartCount = computed(() =>
    Object.values(this.quantitiesSignal()).reduce((sum, quantity) => sum + quantity, 0),
  );

  getLines(products: Product[]): CartLine[] {
    const quantities = this.quantitiesSignal();

    return products
      .map((product) => {
        const quantity = getCartQuantity(quantities, product.id);

        if (quantity === 0) {
          return null;
        }

        return {
          product,
          quantity,
          lineTotal: product.sellingPrice * quantity,
        };
      })
      .filter((line): line is CartLine => line !== null);
  }

  getSubtotal(lines: CartLine[]): number {
    return lines.reduce((sum, line) => sum + line.lineTotal, 0);
  }

  addOne(product: Product): CartStockResult {
    const current = getCartQuantity(this.quantitiesSignal(), product.id);
    return this.setQuantity(product, current + 1);
  }

  increase(product: Product): CartStockResult {
    return this.addOne(product);
  }

  decrease(product: Product): void {
    const current = getCartQuantity(this.quantitiesSignal(), product.id);

    if (current <= 1) {
      this.remove(product.id);
      return;
    }

    this.patchQuantity(product.id, current - 1);
  }

  setQuantity(product: Product, quantity: number): CartStockResult {
    if (quantity <= 0) {
      this.remove(product.id);
      return 'success';
    }

    if (quantity > product.quantity) {
      return 'stock_limit';
    }

    this.patchQuantity(product.id, quantity);
    return 'success';
  }

  clampQuantity(productId: string, maxQuantity: number): void {
    if (maxQuantity <= 0) {
      this.remove(productId);
      return;
    }

    this.patchQuantity(productId, maxQuantity);
  }

  remove(productId: string): void {
    this.quantitiesSignal.update((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  clear(): void {
    this.quantitiesSignal.set({});
  }

  beginCheckoutPay(productIds: string[]): void {
    this.checkoutPayProductIds = new Set(productIds);
  }

  endCheckoutPay(): void {
    this.checkoutPayProductIds.clear();
  }

  isCheckoutPayProduct(productId: string): boolean {
    return this.checkoutPayProductIds.has(productId);
  }

  buildCheckoutItems(products: Product[]): { productId: string; quantity: number }[] {
    return this.getLines(products).map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));
  }

  private patchQuantity(productId: string, quantity: number): void {
    this.quantitiesSignal.update((current) => ({
      ...current,
      [productId]: quantity,
    }));
  }
}
