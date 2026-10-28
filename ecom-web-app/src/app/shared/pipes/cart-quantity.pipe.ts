import { Pipe, PipeTransform } from '@angular/core';

export function getCartQuantity(
  quantities: Record<string, number>,
  productId: string,
): number {
  return quantities[productId] ?? 0;
}

@Pipe({
  name: 'cartQuantity',
  pure: true,
})
export class CartQuantityPipe implements PipeTransform {
  transform(
    productId: string,
    quantities: Record<string, number> | null | undefined,
  ): number {
    return getCartQuantity(quantities ?? {}, productId);
  }
}
