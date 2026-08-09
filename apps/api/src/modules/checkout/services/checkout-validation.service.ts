import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CheckoutValidationInput {
  userId: string;
  cartId: string;
  addressId: string;
}

@Injectable()
export class CheckoutValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executa validações estritas de negócio antes de iniciar a sessão de checkout.
   */
  async validateCheckout(input: CheckoutValidationInput) {
    // 1. Buscar Endereço e País de Destino
    const address = await this.prisma.address.findUnique({
      where: { id: input.addressId },
      include: { country: true },
    });

    if (!address || !address.isActive || (address as any).deletedAt) {
      throw new NotFoundException(`Endereço id ${input.addressId} não encontrado ou inativo.`);
    }

    if (address.userId !== input.userId) {
      throw new BadRequestException('O endereço informado pertence a outro usuário.');
    }

    // 2. Buscar Carrinho e Itens
    const cart = await this.prisma.cart.findUnique({
      where: { id: input.cartId },
      include: {
        items: {
          include: {
            product: { include: { store: { include: { seller: true } } } },
            variant: { include: { inventoryItems: true } },
          },
        },
      },
    });

    if (!cart || cart.status !== 'ACTIVE') {
      throw new NotFoundException(`Carrinho id ${input.cartId} não encontrado ou inativo.`);
    }

    if (cart.items.length === 0) {
      throw new BadRequestException('Não é possível realizar checkout com um carrinho vazio.');
    }

    const destCountryId = address.countryId;

    // 3. Validar cada item do carrinho
    for (const item of cart.items) {
      const product = item.product;
      const variant = item.variant;
      const store = product?.store;
      const seller = store?.seller;

      if (!product || (product as any).status === 'INACTIVE' || (product as any).deletedAt) {
        throw new BadRequestException(`O produto '${product?.title || item.productId}' está inativo ou foi removido.`);
      }

      if (!variant || (variant as any).status === 'INACTIVE' || (variant as any).deletedAt) {
        throw new BadRequestException(`A variante '${variant?.sku || item.variantId}' está inativa.`);
      }

      if (!store || store.status !== 'ACTIVE' || (store as any).deletedAt) {
        throw new BadRequestException(`A loja '${store?.name || item.storeId}' está inativa ou suspensa.`);
      }

      const sellerStatus = (seller as any)?.status || (seller as any)?.kycStatus;
      if (!seller || (sellerStatus !== 'APPROVED' && sellerStatus !== 'ACTIVE')) {
        throw new BadRequestException(`O vendedor da loja '${store.name}' não possui cadastro verificado (KYC pendente).`);
      }

      // Estocagem
      const availableStock = variant.inventoryItems.reduce((acc, inv) => acc + inv.quantityAvailable, 0);
      if (item.quantity > availableStock) {
        throw new ConflictException(
          `Estoque insuficiente para o produto '${product.title}'. Solicitado: ${item.quantity}, Disponível: ${availableStock}.`,
        );
      }

      // Restrições de Venda Internacional / País
      const originCountryId = store.countryId || (seller as any).countryId;
      if (originCountryId && originCountryId !== destCountryId) {
        const supportsIntl = (product as any).supportsInternational || (store as any).supportsInternational || false;
        if (!supportsIntl) {
          throw new BadRequestException(
            `O produto '${product.title}' da loja '${store.name}' não está disponível para entrega internacional no seu país.`,
          );
        }
      }
    }

    return { address, cart };
  }
}
