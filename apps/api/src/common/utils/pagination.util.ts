export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  countryId?: string;
  storeId?: string;
  sellerId?: string;
  categoryId?: string;
  brandId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number = 1,
  limit: number = 20,
) {
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const totalPages = Math.ceil(total / limitNum) || 0;

  return {
    items,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages,
  };
}
