import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductListResponse } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts() {
    return this.http
      .get<ProductListResponse>(`${environment.apiUrl}/products`)
      .pipe(map((response) => response.data));
  }
}
