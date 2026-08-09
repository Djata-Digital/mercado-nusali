import { useQuery } from '@tanstack/react-query';
import { OrderService } from '../services/orderService';

export const useOrders = () =>
  useQuery({
    queryKey: ['buyer-orders'],
    queryFn: async () => {
      const response = await OrderService.getOrders();
      return response.data || [];
    },
  });

export const useOrder = (id: string) =>
  useQuery({
    queryKey: ['buyer-order', id],
    queryFn: async () => {
      const response = await OrderService.getOrderById(id);
      return response.data;
    },
    enabled: Boolean(id),
  });

export const useOrderTracking = (orderId: string) =>
  useQuery({
    queryKey: ['buyer-order-tracking', orderId],
    queryFn: async () => {
      const response = await OrderService.getOrderTracking(orderId);
      return response.data;
    },
    enabled: Boolean(orderId),
    retry: false,
  });
