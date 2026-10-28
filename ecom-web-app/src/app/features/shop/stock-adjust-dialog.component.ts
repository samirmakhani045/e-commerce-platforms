import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { StockAdjustDialogData } from '../../core/models/stock.model';
import { AppDialogLayoutComponent } from '../../shared/components/app-dialog-layout/app-dialog-layout.component';

@Component({
  selector: 'app-stock-adjust-dialog',
  imports: [MatDialogModule, MatButtonModule, AppDialogLayoutComponent],
  template: `
    <app-dialog-layout [title]="title" icon="inventory_2" (closed)="close()">
      <p class="message">{{ message }}</p>

      <button dialogFooter mat-flat-button type="button" class="app-dialog-action-btn" (click)="close()">
        OK
      </button>
    </app-dialog-layout>
  `,
  styles: `
    .message {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.5;
    }
  `,
})
export class StockAdjustDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<StockAdjustDialogComponent>);
  protected readonly data = inject<StockAdjustDialogData>(MAT_DIALOG_DATA);

  protected get title(): string {
    return this.data.type === 'out_of_stock' ? 'Out of stock' : 'Stock updated';
  }

  protected get message(): string {
    if (this.data.type === 'out_of_stock') {
      return `${this.data.productName} is now out of stock. It was removed from your cart.`;
    }

    return `Only ${this.data.available} units of ${this.data.productName} are left. Your cart quantity was updated from ${this.data.requested} to ${this.data.available}.`;
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
