import { ApiResponse } from '../api/apiClient';
import { ProductsApi } from '../api/clients/ProductsApi';
import { CategoriesApi } from '../api/clients/CategoriesApi';
import { BrandsApi } from '../api/clients/BrandsApi';
import { fakeApi } from '../api/fakeApi';
import { API_CONFIG } from '../config/api';
import { Product, Category, FilterState } from '../types';
import { mapPublicCategory, mapPublicProduct } from '../api/adapters/publicCatalog';

export const ProductService = {
  async getProducts(filters?: Partial<FilterState>): Promise<ApiResponse<Product[]>> {
    if (API_CONFIG.USE_FAKE_API) return fakeApi.getProducts(filters);
    const params: any = {};
    if (filters?.query) params.search = filters.query;
    if ((filters as any)?.categoryId) params.categoryId = (filters as any).categoryId;
    if ((filters as any)?.brandId) params.brandId = (filters as any).brandId;
    const res = await ProductsApi.listPublic(params);
    const raw: any = res.data;
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    return { success: res.success, data: items.map(mapPublicProduct), message: res.message, meta: raw ? { page: raw.page, limit: raw.limit, total: raw.total } : undefined };
  },
  async getProductBySlug(slug: string): Promise<ApiResponse<Product | null>> {
    if (API_CONFIG.USE_FAKE_API) return fakeApi.getProductById(slug);
    const res = await ProductsApi.getPublicBySlug(slug);
    return { ...res, data: res.data ? mapPublicProduct(res.data) : null };
  },
  async getProductById(id: string): Promise<ApiResponse<Product | null>> {
    if (API_CONFIG.USE_FAKE_API) return fakeApi.getProductById(id);
    const catalog = await this.getProducts();
    return { success: catalog.success, data: catalog.data?.find((p) => p.id === id) || null };
  },
  async getCategories(): Promise<ApiResponse<Category[]>> {
    if (API_CONFIG.USE_FAKE_API) return fakeApi.getCategories();
    const res = await CategoriesApi.listPublic();
    return { ...res, data: (res.data || []).map(mapPublicCategory) };
  },
  async getBrands(): Promise<ApiResponse<string[]>> {
    if (API_CONFIG.USE_FAKE_API) return fakeApi.getBrands();
    const res = await BrandsApi.listPublic();
    return { success: res.success, data: (res.data || []).map((b: any) => String(b?.name || '')).filter(Boolean), message: res.message };
  },
  async createProduct(productData: Partial<Product>): Promise<ApiResponse<Product>> {
    const res = await ProductsApi.create(productData);
    return res as ApiResponse<Product>;
  },
};
