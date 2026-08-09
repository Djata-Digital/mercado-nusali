import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, PackagePlus, Upload, Warehouse, X } from 'lucide-react';
import { CategoriesApi } from '../../api/clients/CategoriesApi';
import { BrandsApi } from '../../api/clients/BrandsApi';
import { CurrenciesApi } from '../../api/clients/CurrenciesApi';
import { ProductsApi } from '../../api/clients/ProductsApi';
import { ProductVariantsApi } from '../../api/clients/ProductVariantsApi';
import { ProductImagesApi } from '../../api/clients/ProductImagesApi';
import { InventoryApi } from '../../api/clients/InventoryApi';
import { WarehousesApi } from '../../api/clients/WarehousesApi';

interface Props {
  storeId: string;
  storeCountryCode: string;
  onCancel: () => void;
  onComplete: (productId: string) => void;
}

const unwrapList = (response: any): any[] => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const SellerProductWizard: React.FC<Props> = ({
  storeId,
  storeCountryCode,
  onCancel,
  onComplete,
}) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [condition, setCondition] = useState('NEW');
  const [productType, setProductType] = useState('PHYSICAL');
  const [saleScope, setSaleScope] = useState('LOCAL');
  const [saleType, setSaleType] = useState('RETAIL');
  const [countryOfOriginCode, setCountryOfOriginCode] = useState(storeCountryCode || '');
  const [weight, setWeight] = useState('');

  const [sku, setSku] = useState('');
  const [variantName, setVariantName] = useState('Padrão');
  const [price, setPrice] = useState('');
  const [promotionalPrice, setPromotionalPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minimumWholesaleQuantity, setMinimumWholesaleQuantity] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');

  const [image, setImage] = useState<File | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [stock, setStock] = useState('1');

  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseCode, setNewWarehouseCode] = useState('');
  const [newWarehouseCity, setNewWarehouseCity] = useState('');

  const loadBase = async () => {
    setLoadingBase(true);
    try {
      const [catRes, brandRes, currRes, whRes] = await Promise.all([
        CategoriesApi.listPublic(),
        BrandsApi.listPublic(),
        CurrenciesApi.list(),
        WarehousesApi.listMine(),
      ]);
      const nextCategories = unwrapList(catRes);
      const nextBrands = unwrapList(brandRes);
      const nextCurrencies = unwrapList(currRes);
      const nextWarehouses = unwrapList(whRes);
      setCategories(nextCategories);
      setBrands(nextBrands);
      setCurrencies(nextCurrencies);
      setWarehouses(nextWarehouses);
      if (!categoryId && nextCategories[0]) setCategoryId(nextCategories[0].id);
      if (!currencyCode) {
        const preferred =
          nextCurrencies.find((c: any) => c.code === 'XOF') ||
          nextCurrencies[0];
        if (preferred) setCurrencyCode(preferred.code);
      }
      if (!warehouseId && nextWarehouses[0]) setWarehouseId(nextWarehouses[0].id);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível carregar dados reais do cadastro.');
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!slug && title) setSlug(slugify(title));
  }, [title, slug]);

  const imageError = useMemo(() => {
    if (!image) return 'Uma imagem real é obrigatória.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      return 'Use JPG, PNG ou WEBP.';
    }
    if (image.size > 5 * 1024 * 1024) return 'A imagem deve ter no máximo 5MB.';
    return null;
  }, [image]);

  const createWarehouse = async () => {
    if (!newWarehouseName.trim() || !newWarehouseCode.trim() || !storeCountryCode) {
      setMessage('Informe nome, código e país da loja para criar o armazém.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await WarehousesApi.create({
        countryCode: storeCountryCode,
        name: newWarehouseName.trim(),
        code: newWarehouseCode.trim().toUpperCase(),
        type: 'SELLER_WAREHOUSE',
        city: newWarehouseCity.trim() || undefined,
      });
      const created = res.data;
      await loadBase();
      if (created?.id) setWarehouseId(created.id);
      setNewWarehouseName('');
      setNewWarehouseCode('');
      setNewWarehouseCity('');
      setMessage('Armazém do vendedor criado com sucesso.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível criar o armazém.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const priceNumber = Number(price);
    const stockNumber = Number(stock);
    const weightNumber = Number(weight);

    if (!storeId || !categoryId || !title.trim() || !slug.trim() || !description.trim()) {
      setMessage('Preencha loja, categoria, título, slug e descrição.');
      return;
    }
    if (!sku.trim() || !variantName.trim() || !currencyCode || !(priceNumber > 0)) {
      setMessage('Preencha SKU, variante, moeda e preço válido.');
      return;
    }
    if (!warehouseId) {
      setMessage('Selecione ou crie um armazém real antes de cadastrar estoque.');
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 1) {
      setMessage('O estoque inicial precisa ser um inteiro maior ou igual a 1.');
      return;
    }
    if (productType === 'PHYSICAL' && !(weightNumber > 0)) {
      setMessage('Produto físico precisa de peso maior que zero para cotação real de frete.');
      return;
    }
    if ((saleScope === 'INTERNATIONAL' || saleScope === 'BOTH') && !countryOfOriginCode) {
      setMessage('Informe o país de origem para venda internacional.');
      return;
    }
    if (imageError) {
      setMessage(imageError);
      return;
    }

    setSaving(true);
    let productId = '';
    try {
      const productRes = await ProductsApi.create({
        storeId,
        categoryId,
        ...(brandId ? { brandId } : {}),
        title: title.trim(),
        slug: slugify(slug),
        description: description.trim(),
        condition,
        productType,
        saleScope,
        saleType,
        ...(countryOfOriginCode ? { countryOfOriginCode } : {}),
        ...(productType === 'PHYSICAL' ? { weight: weightNumber } : {}),
      });
      const product = productRes.data;
      if (!product?.id) throw new Error('A API não retornou o produto criado.');
      productId = product.id;

      const variantRes = await ProductVariantsApi.create(product.id, {
        sku: sku.trim().toUpperCase(),
        name: variantName.trim(),
        price: priceNumber,
        ...(promotionalPrice ? { promotionalPrice: Number(promotionalPrice) } : {}),
        ...(wholesalePrice ? { wholesalePrice: Number(wholesalePrice) } : {}),
        ...(wholesalePrice && minimumWholesaleQuantity
          ? { minimumWholesaleQuantity: Number(minimumWholesaleQuantity) }
          : {}),
        currencyCode,
      });
      const variant = variantRes.data;
      if (!variant?.id) throw new Error('A API não retornou a variante criada.');

      const imageRes = await ProductImagesApi.upload(product.id, image!);
      if (!imageRes.data?.id) throw new Error('A imagem não foi persistida.');

      await InventoryApi.adjust({
        variantId: variant.id,
        warehouseId,
        newQuantity: stockNumber,
        reason: 'Estoque inicial cadastrado pelo Seller Product Authoring',
      });

      await ProductsApi.submit(product.id);
      setMessage('Produto criado, imagem enviada, estoque registrado e anúncio enviado para análise.');
      onComplete(product.id);
    } catch (error: any) {
      const detail = error?.response?.data?.message || error?.message || 'Falha no cadastro.';
      setMessage(
        productId
          ? `Cadastro interrompido: ${detail} O produto ${productId} foi preservado como rascunho para correção; não houve falso sucesso.`
          : `Cadastro não iniciado: ${detail}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingBase) {
    return <div className="py-16 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-700" /> Cadastrar produto real
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            O anúncio nasce como DRAFT e só é enviado para moderação após variante, imagem e estoque reais.
          </p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100" title="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      {message && <div className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">{message}</div>}

      <form onSubmit={submit} className="space-y-7">
        <section className="space-y-4">
          <h3 className="font-black text-sm text-gray-900">1. Produto</h3>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <label className="space-y-1">
              <span className="font-bold">Título *</span>
              <input value={title} onChange={(e) => { setTitle(e.target.value); setSlug(slugify(e.target.value)); }} className="w-full p-2.5 border rounded-xl" />
            </label>
            <label className="space-y-1">
              <span className="font-bold">Slug *</span>
              <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="w-full p-2.5 border rounded-xl" />
            </label>
            <label className="space-y-1">
              <span className="font-bold">Categoria *</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="">Selecione</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">Marca</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="">Sem marca cadastrada</option>
                {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">Condição *</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="NEW">Novo</option>
                <option value="USED">Usado</option>
                <option value="REFURBISHED">Recondicionado</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">Tipo *</span>
              <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="PHYSICAL">Físico</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">Escopo *</span>
              <select value={saleScope} onChange={(e) => setSaleScope(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="LOCAL">Local</option>
                <option value="INTERNATIONAL">Internacional</option>
                <option value="BOTH">Local + Internacional</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">Venda *</span>
              <select value={saleType} onChange={(e) => setSaleType(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                <option value="RETAIL">Varejo</option>
                <option value="WHOLESALE">Atacado</option>
                <option value="BOTH">Varejo + Atacado</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold">País de origem</span>
              <input value={countryOfOriginCode} onChange={(e) => setCountryOfOriginCode(e.target.value.toUpperCase())} maxLength={2} className="w-full p-2.5 border rounded-xl" />
            </label>
            {productType === 'PHYSICAL' && (
              <label className="space-y-1">
                <span className="font-bold">Peso em kg *</span>
                <input type="number" min="0.001" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2.5 border rounded-xl" />
              </label>
            )}
          </div>
          <label className="block space-y-1 text-xs">
            <span className="font-bold">Descrição *</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full p-3 border rounded-xl" />
          </label>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-black text-sm text-gray-900">2. Variante e preço</h3>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1"><span className="font-bold">SKU *</span><input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            <label className="space-y-1"><span className="font-bold">Nome da variante *</span><input value={variantName} onChange={(e) => setVariantName(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            <label className="space-y-1">
              <span className="font-bold">Moeda *</span>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                {currencies.map((c: any) => <option key={c.id || c.code} value={c.code}>{c.code}{c.symbol ? ` — ${c.symbol}` : ''}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="font-bold">Preço *</span><input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            <label className="space-y-1"><span className="font-bold">Preço promocional</span><input type="number" min="0" step="0.01" value={promotionalPrice} onChange={(e) => setPromotionalPrice(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            <label className="space-y-1"><span className="font-bold">Preço atacado</span><input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            {wholesalePrice && (
              <label className="space-y-1"><span className="font-bold">Qtd. mínima atacado</span><input type="number" min="1" step="1" value={minimumWholesaleQuantity} onChange={(e) => setMinimumWholesaleQuantity(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            )}
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-black text-sm text-gray-900">3. Imagem real</h3>
          <label className="flex items-center gap-3 p-4 border border-dashed rounded-xl cursor-pointer text-xs">
            <Upload className="w-5 h-5 text-emerald-700" />
            <div>
              <div className="font-bold">{image ? image.name : 'Selecionar JPG, PNG ou WEBP'}</div>
              <div className="text-gray-500">Máximo 5MB. A primeira imagem será principal.</div>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </label>
          {imageError && <p className="text-xs text-amber-700">{imageError}</p>}
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-black text-sm text-gray-900 flex items-center gap-2"><Warehouse className="w-4 h-4" /> 4. Estoque real</h3>
          {warehouses.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <label className="space-y-1">
                <span className="font-bold">Armazém *</span>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white">
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} — {w.code}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className="font-bold">Quantidade inicial *</span><input type="number" min="1" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full p-2.5 border rounded-xl" /></label>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs">
              <p className="font-bold text-amber-900">Nenhum armazém do vendedor foi encontrado. Crie um para registrar estoque real.</p>
              <div className="grid md:grid-cols-3 gap-3">
                <input placeholder="Nome do armazém" value={newWarehouseName} onChange={(e) => setNewWarehouseName(e.target.value)} className="p-2.5 border rounded-xl" />
                <input placeholder="Código único, ex. WH-GW-001" value={newWarehouseCode} onChange={(e) => setNewWarehouseCode(e.target.value)} className="p-2.5 border rounded-xl" />
                <input placeholder="Cidade" value={newWarehouseCity} onChange={(e) => setNewWarehouseCity(e.target.value)} className="p-2.5 border rounded-xl" />
              </div>
              <button type="button" disabled={saving} onClick={() => void createWarehouse()} className="bg-amber-700 text-white px-4 py-2 rounded-xl font-bold">Criar armazém real</button>
            </div>
          )}
        </section>

        <div className="border-t pt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 border rounded-xl text-xs font-bold">Cancelar</button>
          <button disabled={saving || warehouses.length === 0} type="submit" className="bg-emerald-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar e enviar para análise
          </button>
        </div>
      </form>
    </div>
  );
};
