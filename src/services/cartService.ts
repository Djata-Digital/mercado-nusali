import { storageService } from './storage/storageService';
import { CartItem, Product } from '../types';

export const CartService = {
  getCart(): CartItem[] {
    return storageService.getCart<CartItem[]>() || [];
  },

  setCart(items: CartItem[]): void {
    storageService.setCart(items);
  },

  addItem(product: Product, quantity = 1, options?: { color?: string; storage?: string }): CartItem[] {
    const current = this.getCart();
    const existingIndex = current.findIndex(
      item =>
        item.product.id === product.id &&
        item.selectedColor === options?.color &&
        item.selectedStorage === options?.storage
    );

    if (existingIndex >= 0) {
      current[existingIndex].quantity += quantity;
    } else {
      current.push({
        product,
        quantity,
        selectedColor: options?.color,
        selectedStorage: options?.storage,
      });
    }

    this.setCart(current);
    return current;
  },

  updateQuantity(productId: string, quantity: number): CartItem[] {
    let current = this.getCart();
    if (quantity <= 0) {
      current = current.filter(item => item.product.id !== productId);
    } else {
      const target = current.find(item => item.product.id === productId);
      if (target) target.quantity = quantity;
    }
    this.setCart(current);
    return current;
  },

  removeItem(productId: string): CartItem[] {
    const filtered = this.getCart().filter(item => item.product.id !== productId);
    this.setCart(filtered);
    return filtered;
  },

  clearCart(): void {
    this.setCart([]);
  }
};
