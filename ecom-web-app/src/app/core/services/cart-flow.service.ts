import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartFlowService {
  private readonly openCartRequested = signal(false);
  private readonly cartErrorMessage = signal<string | null>(null);

  requestOpenCart(message: string | null = null): void {
    this.cartErrorMessage.set(message);
    this.openCartRequested.set(true);
  }

  consumeOpenCartRequest(): string | null | 'skip' {
    if (!this.openCartRequested()) {
      return 'skip';
    }

    const message = this.cartErrorMessage();
    this.openCartRequested.set(false);
    this.cartErrorMessage.set(null);
    return message;
  }
}
