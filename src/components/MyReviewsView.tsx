import React, { useState } from 'react';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Package,
  Sparkles,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BuyerNavHeader } from './BuyerNavHeader';

export const MyReviewsView: React.FC = () => {
  const { orders, products, showToast, openProductDetail } = useMarketplace();
  const [activeTab, setActiveTab] = useState<'pending' | 'published'>('pending');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedProductIdToReview, setSelectedProductIdToReview] = useState<string | null>(null);

  const [publishedReviews, setPublishedReviews] = useState([
    {
      id: 'rev-101',
      productTitle: 'Smartphone Samsung Galaxy A55 5G 256GB - Azul Escuro',
      productImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&auto=format&fit=crop&q=80',
      rating: 5,
      date: 'Há 5 dias',
      comment: 'Chegou rápido demais em Bissau! Aparelho super rápido, câmera sensacional e veio com nota fiscal.',
      sellerReply: 'Olá! Muito obrigado pela confiança no Mercado Nusali. Conte sempre conosco!',
    },
  ]);

  const handlePublishReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      showToast('Por favor, escreva um comentário para a avaliação.');
      return;
    }

    const newRev = {
      id: `rev-${Date.now()}`,
      productTitle: 'Produto Selecionado',
      productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=80',
      rating: reviewRating,
      date: 'Agora mesmo',
      comment: reviewComment,
      sellerReply: undefined,
    };

    setPublishedReviews(prev => [newRev, ...prev]);
    setReviewComment('');
    setSelectedProductIdToReview(null);
    setActiveTab('published');
    showToast('Sua avaliação foi publicada com sucesso!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Minhas Avaliações & Opiniões</h1>
            <p className="text-xs text-gray-500">Ajude outros compradores no Mercado Nusali compartilhando sua experiência de compra.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex items-center gap-8 text-sm font-bold">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Pendentes para Avaliar
        </button>
        <button
          onClick={() => setActiveTab('published')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'published'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Avaliações Publicadas ({publishedReviews.length})
        </button>
      </div>

      {/* Tab 1: Pending */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 mb-4">Escolha um produto entregue para avaliar:</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.slice(0, 3).map((prod) => (
                <div key={prod.id} className="p-4 border border-gray-200 rounded-xl flex items-center justify-between gap-4 hover:border-emerald-500 transition">
                  <div className="flex items-center gap-3">
                    <img src={prod.image} alt={prod.title} className="w-14 h-14 object-cover rounded-lg border border-gray-200" referrerPolicy="no-referrer" />
                    <div>
                      <h3 className="font-bold text-xs text-gray-900 line-clamp-1">{prod.title}</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Entregue no seu endereço</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedProductIdToReview(prod.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition whitespace-nowrap"
                  >
                    Avaliar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Form Modal / Modal inline */}
          {selectedProductIdToReview && (
            <form onSubmit={handlePublishReview} className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-md animate-fadeIn">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Escrever Avaliação</h3>
              <p className="text-xs text-gray-600 mb-4">Como foi o produto e a velocidade de entrega?</p>

              {/* Star selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">Sua Nota:</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star className={`w-7 h-7 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-700 ml-2">{reviewRating} de 5 estrelas</span>
                </div>
              </div>

              {/* Text area */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">Comentário Detalhado:</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Conte o que achou da qualidade, embalagem e rapidez..."
                  rows={3}
                  className="w-full p-3 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProductIdToReview(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-xs transition shadow-xs"
                >
                  Publicar Avaliação
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Published */}
      {activeTab === 'published' && (
        <div className="space-y-4">
          {publishedReviews.map((rev) => (
            <div key={rev.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <img src={rev.productImage} alt={rev.productTitle} className="w-16 h-16 object-cover rounded-xl border border-gray-200" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{rev.productTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-500' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400">• {rev.date}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-700 mt-4 leading-relaxed font-medium">
                "{rev.comment}"
              </p>

              {rev.sellerReply && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-bold block mb-1">Resposta do Vendedor:</span>
                  <p className="italic text-gray-700">{rev.sellerReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
