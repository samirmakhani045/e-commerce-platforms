import { Product } from './product.model';

export interface CartLine {
  product: Product;
  quantity: number;
  lineTotal: number;
}

export type CartStockResult = 'success' | 'stock_limit';
