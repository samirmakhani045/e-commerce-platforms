export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  quantity: number;
  sellingPrice: number;
}

export interface ProductListResponse {
  success: boolean;
  message: string;
  data: Product[];
}
