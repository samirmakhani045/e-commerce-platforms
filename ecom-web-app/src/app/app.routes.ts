import { Routes } from '@angular/router';
import { ShopComponent } from './features/shop/shop.component';

export const routes: Routes = [
  {
    path: '',
    component: ShopComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
