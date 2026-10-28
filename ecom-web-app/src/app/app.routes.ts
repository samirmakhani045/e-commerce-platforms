import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guard';
import { CheckoutComponent } from './features/checkout/checkout.component';
import { ReportsComponent } from './features/reports/reports.component';
import { ShopComponent } from './features/shop/shop.component';

export const routes: Routes = [
  {
    path: '',
    component: ShopComponent,
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [authGuard],
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
