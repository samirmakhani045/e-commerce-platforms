import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-quantity-stepper',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './quantity-stepper.component.html',
  styleUrl: './quantity-stepper.component.css',
})
export class QuantityStepperComponent {
  readonly quantity = input.required<number>();
  /** Full-width pill stepper on product cards (default). */
  readonly compact = input(false);

  readonly increaseClick = output<void>();
  readonly decreaseClick = output<void>();
}
