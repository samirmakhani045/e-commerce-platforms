import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialog-layout',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './app-dialog-layout.component.html',
  styleUrl: './app-dialog-layout.component.css',
})
export class AppDialogLayoutComponent {
  readonly title = input.required<string>();
  readonly icon = input<string | null>(null);

  readonly closed = output<void>();

  protected onClose(): void {
    this.closed.emit();
  }
}
