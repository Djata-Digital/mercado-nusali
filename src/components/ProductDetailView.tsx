import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Heart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Zap,
  MapPin,
  CheckCircle2,
  HelpCircle,
  ThumbsUp,
  MessageSquare,
  ChevronRight,
  Share2,
  Building2,
  Award,
} from 'lucide-react';
import { useProduct, useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { useFavorites } from '../hooks/useFavorites';
import { usePreferences } from '../context/PreferencesContext';

export const ProductDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fetchedProduct } = useProduct(id || '');
  const { data: allProducts = [] } = useProducts();
  const product = fetchedProduct || allProducts.find((p) => p.id === id) || allProducts[0];

  const { addItem } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { selectedCountry } = usePreferences();

  const userLocation = { city: 'Bissau', country: selectedCountry };

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [newQuestion, setNewQuestion] = useState('');
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 font-medium">Carregando detalhes do produto...</p>
      </div>
    );
  }

  const favorited = isFavorite(product.id);

  const images = product.galleryImages && product.galleryImages.length > 0
    ? product.galleryImages
    : [product.image];

  const installmentAmount = (product.price / product.installmentsMax).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedPrice = product.price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedOriginalPrice = product.originalPrice?.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || isAnsweringQuestion) return;

    const questionText = newQuestion.trim();
    setNewQuestion('');
    setIsAnsweringQuestion(true);

    try {
      const res = await fetch('/api/gemini/seller-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTitle: product.title,
          productSpecs: product.specs,
          question: questionText,
        }),
      });
      const data = await res.json();
      const answer = data.answer || 'Olá! Sim, temos o produto em estoque para envio imediato com Nota Fiscal!';
      console.log('Pergunta enviada:', questionText, answer);
    } catch (err) {
      console.error(err);
    } finally {

      setIsAnsweringQuestion(false);
      setQuestionSubmitted(true);
      setTimeout(() => setQuestionSubmitted(false), 3000);
    }
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    navigate('/checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = () => {
    addItem(product, quantity);
    navigate('/cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 overflow-x-auto no-scrollbar">
        <button onClick={() => navigate('/products')} className="hover:text-blue-600">
          Voltar à lista
        </button>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="capitalize">{product.category}</span>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="font-semibold text-gray-800 truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Grid: Left Gallery + Middle Product Info + Right Buy Box */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Gallery (5 cols) */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row gap-4">
          {/* Thumbnails */}
          <div className="flex sm:flex-col gap-2 order-2 sm:order-1 overflow-x-auto sm:overflow-y-auto no-scrollbar">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImageIndex(idx)}
                className={`w-16 h-16 rounded-md border p-1 bg-gray-50 overflow-hidden shrink-0 transition ${
                  selectedImageIndex === idx
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <img src={imgUrl} alt={`Vista ${idx + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>

          {/* Main Image */}
          <div className="flex-1 h-80 sm:h-96 bg-gray-50 rounded-lg p-4 flex items-center justify-center border border-gray-100 order-1 sm:order-2 relative group">
            <img
              src={images[selectedImageIndex]}
              alt={product.title}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110 cursor-zoom-in"
            />
          </div>
        </div>

        {/* Center Column: Details, Price & Description (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Condition & Ratings */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {product.condition === 'novo' ? 'Novo' : 'Usado'} | {product.salesCount}+ vendidos
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-1 hover:text-blue-600 flex items-center gap-1 font-medium"
              >
                <Share2 className="w-4 h-4" />
                {copiedLink ? <span className="text-green-600 font-bold">Copiado!</span> : null}
              </button>
              <button
                onClick={() => toggleFavorite(product.id)}
                className="p-1 hover:text-red-500"
                title="Favoritar"
              >
                <Heart className={`w-5 h-5 ${favorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-gray-900 leading-snug">{product.title}</h1>

          {/* Rating */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="ml-1 font-bold text-gray-900 text-sm">{product.rating}</span>
            </div>
            <span className="text-gray-400">({product.reviewsCount} avaliações)</span>
          </div>

          {/* Price Block */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2">
            {product.originalPrice && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 line-through">
                  R$ {formattedOriginalPrice}
                </span>
                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-xs">
                  {product.discountPercentage}% OFF
                </span>
              </div>
            )}

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">R$ {formattedPrice}</span>
            </div>

            <p className="text-sm font-semibold text-green-700">
              em {product.installmentsMax}x de R$ {installmentAmount} {product.installmentsInterestFree && 'sem juros'}
            </p>

            <p className="text-xs text-blue-700 font-medium hover:underline cursor-pointer">
              Ver os meios de pagamento
            </p>
          </div>

          {/* Highlights / Specs */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              O que você precisa saber sobre este produto:
            </h3>
            <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside leading-relaxed">
              {Object.entries(product.specs).slice(0, 4).map(([key, val]) => (
                <li key={key}>
                  <strong className="text-gray-900">{key}:</strong> {val}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Buy Box & Seller Info (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Buy Box Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
            {/* Shipping Calculator */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                <Truck className="w-5 h-5 text-green-600" />
                <span>Frete GRÁTIS Nusali Logística</span>
              </div>
              <p className="text-xs text-gray-600 pl-7">
                Chega <strong className="text-green-700">Amanhã</strong> em {userLocation.city}
              </p>
            </div>

            {/* Stock status */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-900">Estoque disponível</p>
              <p className="text-xs text-gray-500">
                Quantidade em estoque: <span className="font-semibold text-gray-800">{product.stock} unidades</span>
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Quantidade:</span>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-md p-1.5 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'unidade' : 'unidades'}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleBuyNow}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-4 rounded-md shadow-xs transition transform active:scale-98 text-sm"
              >
                Comprar agora
              </button>
              <button
                onClick={handleAddToCart}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold py-3 px-4 rounded-md transition text-sm border border-blue-200"
              >
                Adicionar ao carrinho
              </button>
            </div>

            {/* Trust Policies */}
            <div className="space-y-2 text-xs text-gray-600 pt-3 border-t border-gray-100">
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-blue-600 font-semibold">Devolução grátis.</strong> Você tem 30 dias a partir da data de recebimento.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-blue-600 font-semibold">Compra Garantida.</strong> Receba o produto que está esperando ou devolvemos o dinheiro.
                </p>
              </div>
            </div>
          </div>

          {/* Seller Reputation Meter Box */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Informações sobre o vendedor
            </p>

            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-700" />
              <div>
                <p className="text-xs font-bold text-gray-900">{product.seller.name}</p>
                {product.seller.isOfficialStore && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-xs">
                    Loja Oficial Mercado Nusali
                  </span>
                )}
              </div>
            </div>

            {/* Reputation Level Indicator */}
            {product.seller.reputationLevel === 'platinum' && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 p-2 rounded-md border border-green-200">
                <Award className="w-4 h-4 text-green-600 shrink-0" />
                <span>Vendedor Platinum Nusali</span>
              </div>
            )}

            {/* Color Bar Reputation Scale */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-500">Reputação do vendedor:</p>
              <div className="grid grid-cols-5 gap-1 h-2">
                <div className="bg-red-300 rounded-l-xs" />
                <div className="bg-orange-300" />
                <div className="bg-yellow-300" />
                <div className="bg-lime-400" />
                <div className="bg-green-600 rounded-r-xs shadow-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-600 pt-2 border-t border-gray-100">
              <div>
                <p className="font-extrabold text-gray-900 text-xs">{product.seller.salesCount}+</p>
                <p>Vendas nos últimos 60 dias</p>
              </div>
              <div>
                <p className="font-extrabold text-green-700 text-xs">Excelente</p>
                <p>Presta bom atendimento</p>
              </div>
              <div>
                <p className="font-extrabold text-green-700 text-xs">No prazo</p>
                <p>Entrega os produtos sem atrasos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Description Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">
          Descrição do produto
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {product.description}
        </p>

        {/* Specs Table */}
        <div className="pt-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Especificações Técnicas Completas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-4 rounded-lg border border-gray-100 text-xs">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="flex justify-between py-1.5 border-b border-gray-200/60 last:border-none">
                <span className="font-semibold text-gray-600">{key}</span>
                <span className="text-gray-900 text-right font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Perguntas e Respostas (Q&A Section) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">
          Perguntas e respostas
        </h2>

        {/* Question Form */}
        <form onSubmit={handleAskQuestion} className="space-y-3">
          <label className="block text-sm font-semibold text-gray-800">
            Pergunte ao vendedor:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Escreva sua dúvida aqui... Ex: Tem a pronta entrega?"
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={isAnsweringQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-md text-sm transition disabled:opacity-60 shrink-0"
            >
              {isAnsweringQuestion ? 'Vendedor respondendo...' : 'Perguntar'}
            </button>
          </div>
          {questionSubmitted && (
            <p className="text-xs text-green-700 font-semibold bg-green-50 p-2 rounded-md">
              ✓ Pergunta enviada ao vendedor!
            </p>
          )}
        </form>

        {/* Question List */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Últimas perguntas feitas:
          </h3>
          {product.questions.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Nenhuma pergunta feita ainda. Seja o primeiro a perguntar!</p>
          ) : (
            product.questions.map((q) => (
              <div key={q.id} className="space-y-1.5 text-xs border-b border-gray-100 pb-3">
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {q.question}
                </p>
                {q.answer && (
                  <p className="text-gray-600 pl-5 bg-gray-50 p-2 rounded-md border-l-2 border-blue-500">
                    <strong className="text-gray-800">Resposta do vendedor:</strong> {q.answer}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Opinions & Reviews */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-3">
          Opiniões dos compradores
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Rating Summary */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
            <span className="text-4xl font-black text-gray-900">{product.rating}</span>
            <div className="flex items-center text-amber-400 my-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs text-gray-500 font-medium">Média baseada em {product.reviewsCount} avaliações</p>
          </div>

          {/* Review items */}
          <div className="md:col-span-8 space-y-4">
            {product.reviews.map((rev) => (
              <div key={rev.id} className="border-b border-gray-100 pb-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                    <span className="font-bold text-gray-900 ml-2">{rev.title}</span>
                  </div>
                  <span className="text-gray-400 text-[11px]">{rev.date}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{rev.comment}</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-1">
                  <span className="text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" /> Compra verificada
                  </span>
                  <button className="hover:text-blue-600 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> É útil ({rev.likes})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
