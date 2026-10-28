import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppDialogLayoutComponent } from '../../shared/components/app-dialog-layout/app-dialog-layout.component';

export interface StockLimitDialogData {
  maxQuantity: number;
}

@Component({
  selector: 'app-stock-limit-dialog',
  imports: [MatDialogModule, MatButtonModule, AppDialogLayoutComponent],
  template: `
    <app-dialog-layout title="Stock limit reached" icon="inventory_2" (closed)="close()">
      <p class="stock-limit-message">
        Only {{ data.maxQuantity }} items are in stock.
      </p>

      <button
        dialogFooter
        mat-flat-button
        type="button"
        class="app-dialog-action-btn"
        (click)="close()"
      >
        OK
      </button>
    </app-dialog-layout>
  `,
  styles: `
    .stock-limit-message {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.5;
    }
  `,
})
export class StockLimitDialogComponent {
  protected readonly data = inject<StockLimitDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<StockLimitDialogComponent>);

  protected close(): void {
    this.dialogRef.close();
  }
}
