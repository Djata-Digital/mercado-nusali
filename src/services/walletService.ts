import { ApiResponse } from '../api/apiClient';
import { WalletApi } from '../api/clients/WalletApi';
import { API_CONFIG } from '../config/api';
import { Wallet } from '../types';

export const WalletService = {
  async getWallet(): Promise<ApiResponse<Wallet>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: {
          userId: 'usr_001',
          balance: 85000,
          currency: 'XOF',
          pendingEscrowBalance: 42500,
          transactions: [
            {
              id: 'tx_1',
              userId: 'usr_001',
              amount: 85000,
              currency: 'XOF',
              type: 'credit',
              description: 'Depósito Orange Money Bissau',
              date: '30/07/2026',
            },
          ],
        },
      };
    }
    return WalletApi.filters();
  },

  async addFunds(amount: number, method: string): Promise<ApiResponse<Wallet>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: {
          userId: 'usr_001',
          balance: 85000 + amount,
          currency: 'XOF',
          pendingEscrowBalance: 42500,
          transactions: [],
        },
        message: `Saldo de ${amount} adicionado com sucesso via ${method}!`,
      };
    }
    return WalletApi.create({ amount, method });
  }
};

