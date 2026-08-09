const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/services/sellerService.ts');
if (!fs.existsSync(file)) throw new Error('src/services/sellerService.ts não encontrado.');
const next = "import { ApiResponse } from '../api/apiClient';\nimport { SellerApi } from '../api/clients/SellerApi';\nimport { ProductsApi } from '../api/clients/ProductsApi';\nimport { OrdersApi } from '../api/clients/OrdersApi';\nimport { StoresApi } from '../api/clients/StoresApi';\n\nexport const SellerService = {\n  async getProfile(): Promise<ApiResponse<any>> {\n    return SellerApi.getMyProfile();\n  },\n\n  async getProducts(): Promise<ApiResponse<any>> {\n    return ProductsApi.listMine({ page: 1, limit: 100 } as any);\n  },\n\n  async getOrders(): Promise<ApiResponse<any>> {\n    return OrdersApi.listSeller();\n  },\n\n  async getFinancials(): Promise<ApiResponse<any>> {\n    return {\n      success: false,\n      data: null,\n      message: 'Financeiro Seller ainda não possui contrato real habilitado neste service.',\n    };\n  },\n\n  async updateStore(storeData: any): Promise<ApiResponse<any>> {\n    const storeId = storeData?.id;\n    if (!storeId) {\n      return {\n        success: false,\n        data: null,\n        message: 'storeId real é obrigatório para atualizar a loja.',\n      };\n    }\n\n    const { id, ...payload } = storeData;\n    return StoresApi.updateMine(id, payload);\n  },\n};\n";
fs.writeFileSync(file, next, 'utf8');
console.log('OK src/services/sellerService.ts');
console.log('Hotfix Sprint 8.3.1.1 aplicado.');
