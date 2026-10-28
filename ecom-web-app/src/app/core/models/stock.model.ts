export interface ProductStockUpdate {
  productId: string;
  name: string;
  quantity: number;
}

export interface ProductStockUpdatedEvent {
  products: ProductStockUpdate[];
}

export type StockAdjustDialogData =
  | {
      type: 'out_of_stock';
      productName: string;
    }
  | {
      type: 'partial';
      productName: string;
      requested: number;
      available: number;
    };
