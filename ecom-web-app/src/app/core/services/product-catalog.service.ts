import { Injectable, inject, signal } from '@angular/core';
import { Product } from '../models/product.model';
import { ProductStockUpdate } from '../models/stock.model';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly productService = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');

  load(force = false): void {
    if (this.isLoading()) {
      return;
    }

    if (!force && this.products().length > 0) {
      return;
    }

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

  applyStockUpdates(updates: ProductStockUpdate[]): void {
    if (updates.length === 0) {
      return;
    }

    const updateMap = new Map(updates.map((item) => [item.productId, item]));

    this.products.update((current) =>
      current.map((product) => {
        const update = updateMap.get(product.id);

        if (!update) {
          return product;
        }

        return {
          ...product,
          quantity: update.quantity,
        };
      }),
    );
  }

  findProduct(productId: string): Product | undefined {
    return this.products().find((product) => product.id === productId);
  }
}
