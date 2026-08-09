import { ApiResponse } from '../api/apiClient';
import { ReviewsApi } from '../api/clients/ReviewsApi';
import { API_CONFIG } from '../config/api';

export const ReviewService = {
  async getReviewsForProduct(productId: string): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: [
          {
            id: 'rev_1',
            user: 'Sene Bissau',
            rating: 5,
            date: '28 de Julho',
            title: 'Qualidade Excepcional',
            comment: 'Excelente produto, chegou super rápido pelo Nusali Express!',
            likes: 12,
            verifiedPurchase: true,
          },
        ],
      };
    }
    return ReviewsApi.list(productId);
  },

  async addReview(productId: string, rating: number, title: string, comment: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: { id: 'rev_' + Date.now(), rating, title, comment, date: 'Hoje', verifiedPurchase: true },
        message: 'Avaliação enviada com sucesso!',
      };
    }
    return ReviewsApi.create({ productId, rating, title, comment });
  }
};

