import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';

import {
  AdminApi,
  AdminKycDocument,
} from '../../api/clients/AdminApi';

interface AdminKycReviewProps {
  showToast: (msg: string) => void;
}

type RequiredDocument = {
  key: string;
  label: string;
  acceptedTypes: string[];
};

type SellerGroup = {
  sellerId: string;
  seller: NonNullable<AdminKycDocument['seller']>;
  documents: AdminKycDocument[];
};

const extractErrorMessage = (
  error: any,
): string =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const documentTypeLabel = (
  type: string,
): string => {
  switch (type) {
    case 'IDENTITY_DOCUMENT':
      return 'Documento de Identidade';

    case 'PASSPORT':
      return 'Passaporte';

    case 'SELFIE':
      return 'Selfie';

    case 'ADDRESS_PROOF':
      return 'Comprovante de Endereço';

    case 'BUSINESS_REGISTRATION':
      return 'Registro Comercial';

    case 'TAX_DOCUMENT':
      return 'Documento Fiscal';

    case 'OWNER_IDENTITY_DOCUMENT':
      return 'Identidade do Responsável';

    case 'BANK_PROOF':
      return 'Comprovante Bancário';

    case 'TRADEMARK_REGISTRATION':
      return 'Registro de Marca';

    case 'BRAND_AUTHORIZATION':
      return 'Autorização da Marca';

    default:
      return type.replace(/_/g, ' ');
  }
};

const sellerTypeLabel = (
  sellerType?: string,
): string => {
  switch (sellerType) {
    case 'INDIVIDUAL':
      return 'Pessoa Física';

    case 'SOLE_PROPRIETOR':
      return 'Empresário Individual';

    case 'COMPANY':
      return 'Empresa';

    case 'OFFICIAL_BRAND':
      return 'Marca Oficial';

    case 'INTERNATIONAL':
      return 'Vendedor Internacional';

    default:
      return sellerType || 'Vendedor';
  }
};

const sellerStatusLabel = (
  status?: string,
): string => {
  switch (status) {
    case 'PENDING':
      return 'Pendente';

    case 'UNDER_REVIEW':
      return 'Em análise';

    case 'VERIFIED':
      return 'Verificado';

    case 'REJECTED':
      return 'Rejeitado';

    case 'SUSPENDED':
      return 'Suspenso';

    case 'BLOCKED':
      return 'Bloqueado';

    default:
      return status || '-';
  }
};

const getRequiredDocuments = (
  sellerType?: string,
): RequiredDocument[] => {
  const base: RequiredDocument[] = [
    {
      key: 'identity',
      label:
        sellerType === 'INDIVIDUAL'
          ? 'Documento de Identidade / Passaporte'
          : 'Documento do Responsável',
      acceptedTypes: [
        'IDENTITY_DOCUMENT',
        'PASSPORT',
        'OWNER_IDENTITY_DOCUMENT',
      ],
    },

    {
      key: 'selfie',
      label: 'Selfie',
      acceptedTypes: ['SELFIE'],
    },

    {
      key: 'address',
      label: 'Comprovante de Endereço',
      acceptedTypes: ['ADDRESS_PROOF'],
    },
  ];

  if (
    sellerType === 'COMPANY' ||
    sellerType === 'SOLE_PROPRIETOR' ||
    sellerType === 'INTERNATIONAL' ||
    sellerType === 'OFFICIAL_BRAND'
  ) {
    base.push(
      {
        key: 'business',
        label: 'Registro Comercial',
        acceptedTypes: [
          'BUSINESS_REGISTRATION',
        ],
      },
      {
        key: 'tax',
        label: 'Documento Fiscal',
        acceptedTypes: ['TAX_DOCUMENT'],
      },
    );
  }

  if (sellerType === 'OFFICIAL_BRAND') {
    base.push({
      key: 'brand',
      label:
        'Registro ou Autorização da Marca',
      acceptedTypes: [
        'TRADEMARK_REGISTRATION',
        'BRAND_AUTHORIZATION',
      ],
    });
  }

  return base;
};

const getRequirementDocument = (
  documents: AdminKycDocument[],
  requirement: RequiredDocument,
) => {
  const candidates = documents
    .filter(
      (document) =>
        document.isCurrent &&
        requirement.acceptedTypes.includes(
          document.documentType,
        ),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );

  return candidates[0];
};

const requirementStatus = (
  document?: AdminKycDocument,
) => {
  if (!document) {
    return {
      label: 'Não enviado',
      complete: false,
      className:
        'bg-gray-100 text-gray-600',
    };
  }

  switch (document.status) {
    case 'APPROVED':
      return {
        label: 'Aprovado',
        complete: true,
        className:
          'bg-emerald-100 text-emerald-800',
      };

    case 'REJECTED':
      return {
        label: 'Rejeitado',
        complete: false,
        className:
          'bg-red-100 text-red-700',
      };

    case 'UNDER_REVIEW':
      return {
        label: 'Em análise',
        complete: false,
        className:
          'bg-blue-100 text-blue-700',
      };

    case 'EXPIRED':
      return {
        label: 'Expirado',
        complete: false,
        className:
          'bg-orange-100 text-orange-700',
      };

    default:
      return {
        label: 'Pendente',
        complete: false,
        className:
          'bg-amber-100 text-amber-800',
      };
  }
};

export const AdminKycReview: React.FC<
  AdminKycReviewProps
> = ({ showToast }) => {
  const [documents, setDocuments] =
    useState<AdminKycDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState<string | null>(null);

  const [
    selectedDoc,
    setSelectedDoc,
  ] =
    useState<AdminKycDocument | null>(
      null,
    );

  const [
    documentUrl,
    setDocumentUrl,
  ] =
    useState<string | null>(null);

  const [
    rejectionReason,
    setRejectionReason,
  ] = useState('');

  const [
    sellerRejectId,
    setSellerRejectId,
  ] =
    useState<string | null>(null);

  const [
    sellerRejectReason,
    setSellerRejectReason,
  ] = useState('');

  const loadDocuments =
    async () => {
      try {
        setLoading(true);

        const response =
          await AdminApi.getKycDocuments({
            page: 1,
            limit: 100,
          });

        if (
          !response.success ||
          !response.data
        ) {
          throw new Error(
            response.error?.message ||
              'Não foi possível carregar os documentos KYC.',
          );
        }

        setDocuments(
          response.data.items || [],
        );
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const sellerGroups =
    useMemo<SellerGroup[]>(() => {
      const map = new Map<
        string,
        SellerGroup
      >();

      for (const document of documents) {
        if (!document.seller) {
          continue;
        }

        const existing = map.get(
          document.sellerId,
        );

        if (existing) {
          existing.documents.push(
            document,
          );
        } else {
          map.set(document.sellerId, {
            sellerId:
              document.sellerId,
            seller:
              document.seller,
            documents: [document],
          });
        }
      }

      return Array.from(
        map.values(),
      ).sort((a, b) => {
        if (
          a.seller.status ===
            'VERIFIED' &&
          b.seller.status !==
            'VERIFIED'
        ) {
          return 1;
        }

        if (
          b.seller.status ===
            'VERIFIED' &&
          a.seller.status !==
            'VERIFIED'
        ) {
          return -1;
        }

        return 0;
      });
    }, [documents]);

  const handleView =
    async (
      document: AdminKycDocument,
    ) => {
      try {
        setSelectedDoc(document);
        setDocumentUrl(null);
        setRejectionReason('');

        const response =
          await AdminApi.getKycDocumentDownloadUrl(
            document.id,
          );

        if (
          !response.success ||
          !response.data?.downloadUrl
        ) {
          throw new Error(
            response.error?.message ||
              'Não foi possível abrir o documento.',
          );
        }

        setDocumentUrl(
          response.data.downloadUrl,
        );
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      }
    };

  const handleApproveDocument =
    async (
      documentId: string,
    ) => {
      try {
        setActionLoading(documentId);

        const response =
          await AdminApi.approveKycDocument(
            documentId,
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível aprovar o documento.',
          );
        }

        showToast(
          'Documento KYC aprovado com sucesso.',
        );

        setSelectedDoc(null);
        setDocumentUrl(null);

        await loadDocuments();
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      } finally {
        setActionLoading(null);
      }
    };

  const handleRejectDocument =
    async (
      documentId: string,
      reason: string,
    ) => {
      const finalReason =
        reason.trim();

      if (!finalReason) {
        showToast(
          'Informe o motivo da rejeição.',
        );
        return;
      }

      try {
        setActionLoading(documentId);

        const response =
          await AdminApi.rejectKycDocument(
            documentId,
            finalReason,
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível rejeitar o documento.',
          );
        }

        showToast(
          'Documento KYC rejeitado.',
        );

        setSelectedDoc(null);
        setDocumentUrl(null);
        setRejectionReason('');

        await loadDocuments();
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      } finally {
        setActionLoading(null);
      }
    };

  const handleApproveSeller =
    async (
      sellerId: string,
    ) => {
      try {
        setActionLoading(
          `seller-${sellerId}`,
        );

        const response =
          await AdminApi.approveSellerKyc(
            sellerId,
            'KYC aprovado através do painel administrativo.',
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível aprovar o vendedor.',
          );
        }

        showToast(
          'Vendedor aprovado. Status alterado para VERIFIED.',
        );

        await loadDocuments();
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      } finally {
        setActionLoading(null);
      }
    };

  const handleRejectSeller =
    async () => {
      if (!sellerRejectId) {
        return;
      }

      const reason =
        sellerRejectReason.trim();

      if (!reason) {
        showToast(
          'Informe o motivo da rejeição do KYC.',
        );
        return;
      }

      try {
        setActionLoading(
          `seller-reject-${sellerRejectId}`,
        );

        const response =
          await AdminApi.rejectSellerKyc(
            sellerRejectId,
            reason,
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível rejeitar o vendedor.',
          );
        }

        showToast(
          'KYC do vendedor rejeitado.',
        );

        setSellerRejectId(null);
        setSellerRejectReason('');

        await loadDocuments();
      } catch (error: any) {
        showToast(
          extractErrorMessage(error),
        );
      } finally {
        setActionLoading(null);
      }
    };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <span className="text-sm">
          Carregando análise KYC...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            Verificação e Aprovação de
            Vendedores
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Analise os documentos reais e
            aprove o vendedor somente após
            todos os requisitos obrigatórios
            estarem cumpridos.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadDocuments()
          }
          className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {!sellerGroups.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />

          <h2 className="font-black">
            Nenhum vendedor com documentos
            KYC
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            Quando vendedores enviarem
            documentos, eles aparecerão aqui.
          </p>
        </div>
      ) : (
        sellerGroups.map((group) => {
          const {
            seller,
            sellerId,
            documents:
              sellerDocuments,
          } = group;

          const requirements =
            getRequiredDocuments(
              seller.sellerType,
            );

          const requirementResults =
            requirements.map(
              (requirement) => {
                const document =
                  getRequirementDocument(
                    sellerDocuments,
                    requirement,
                  );

                return {
                  requirement,
                  document,
                  status:
                    requirementStatus(
                      document,
                    ),
                };
              },
            );

          const canApprove =
            requirementResults.every(
              (item) =>
                item.status.complete,
            );

          const missingCount =
            requirementResults.filter(
              (item) =>
                !item.status.complete,
            ).length;

          const sellerName =
            seller.tradeName ||
            seller.legalName ||
            `${seller.user?.firstName || ''} ${
              seller.user?.lastName || ''
            }`.trim() ||
            'Vendedor';

          const alreadyVerified =
            seller.status === 'VERIFIED';

          const rejected =
            seller.status === 'REJECTED';

          return (
            <div
              key={sellerId}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs"
            >
              <div className="bg-slate-950 text-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">
                      {sellerName}
                    </h2>

                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        alreadyVerified
                          ? 'bg-emerald-500 text-white'
                          : rejected
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {sellerStatusLabel(
                        seller.status,
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 mt-2 space-y-1">
                    <div>
                      {sellerTypeLabel(
                        seller.sellerType,
                      )}
                    </div>

                    <div>
                      {seller.user?.email ||
                        seller.businessEmail ||
                        ''}
                    </div>
                  </div>
                </div>

                {!alreadyVerified && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSellerRejectId(
                          sellerId,
                        );
                        setSellerRejectReason(
                          '',
                        );
                      }}
                      className="px-4 py-2 border border-red-400 text-red-200 hover:bg-red-950 rounded-xl text-xs font-bold"
                    >
                      Rejeitar KYC
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canApprove ||
                        actionLoading ===
                          `seller-${sellerId}`
                      }
                      onClick={() =>
                        void handleApproveSeller(
                          sellerId,
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {actionLoading ===
                      `seller-${sellerId}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}

                      Aprovar Vendedor
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-black text-gray-900">
                      Requisitos para aprovação
                    </h3>

                    {canApprove ? (
                      <span className="text-xs font-bold text-emerald-700">
                        Todos os requisitos
                        cumpridos
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700">
                        {missingCount}{' '}
                        requisito(s) pendente(s)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {requirementResults.map(
                      ({
                        requirement,
                        document,
                        status,
                      }) => (
                        <div
                          key={
                            requirement.key
                          }
                          className="border border-gray-200 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-black text-gray-900">
                                {
                                  requirement.label
                                }
                              </p>

                              <p className="text-[10px] text-gray-400 mt-1">
                                {document
                                  ? documentTypeLabel(
                                      document.documentType,
                                    )
                                  : 'Documento ainda não encontrado'}
                              </p>
                            </div>

                            <span
                              className={`text-[10px] font-black px-2 py-1 rounded-full ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          {document && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleView(
                                  document,
                                )
                              }
                              className="mt-3 text-xs font-bold text-purple-700 flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Revisar documento
                            </button>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-gray-900 mb-3">
                    Todos os documentos
                  </h3>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3">
                            Documento
                          </th>

                          <th className="text-left p-3">
                            Arquivo
                          </th>

                          <th className="text-left p-3">
                            Status
                          </th>

                          <th className="text-right p-3">
                            Ação
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {sellerDocuments.map(
                          (document) => (
                            <tr
                              key={
                                document.id
                              }
                            >
                              <td className="p-3 font-bold">
                                {documentTypeLabel(
                                  document.documentType,
                                )}
                              </td>

                              <td className="p-3 text-gray-500">
                                {
                                  document.fileName
                                }
                              </td>

                              <td className="p-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                    requirementStatus(
                                      document,
                                    )
                                      .className
                                  }`}
                                >
                                  {
                                    requirementStatus(
                                      document,
                                    ).label
                                  }
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleView(
                                      document,
                                    )
                                  }
                                  className="text-purple-700 font-bold"
                                >
                                  Abrir
                                </button>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!canApprove &&
                  !alreadyVerified && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />

                      <div className="text-xs text-amber-900">
                        <strong>
                          Aprovação bloqueada.
                        </strong>{' '}
                        Aprove ou solicite a
                        correção dos documentos
                        obrigatórios antes de
                        verificar este vendedor.
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })
      )}

      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  Revisão do Documento
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  {documentTypeLabel(
                    selectedDoc.documentType,
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedDoc(null);
                  setDocumentUrl(null);
                  setRejectionReason('');
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 border rounded-xl min-h-[320px] flex items-center justify-center overflow-hidden">
              {!documentUrl ? (
                <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
              ) : selectedDoc.mimeType ===
                'application/pdf' ? (
                <iframe
                  src={documentUrl}
                  title="Documento KYC"
                  className="w-full h-[520px]"
                />
              ) : (
                <img
                  src={documentUrl}
                  alt="Documento KYC"
                  className="max-w-full max-h-[520px] object-contain"
                />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs bg-gray-50 border rounded-xl p-4">
              <div>
                <span className="text-gray-400 block">
                  Vendedor
                </span>

                <strong>
                  {selectedDoc.seller
                    ?.tradeName ||
                    selectedDoc.seller
                      ?.legalName}
                </strong>
              </div>

              <div>
                <span className="text-gray-400 block">
                  Arquivo
                </span>

                <strong>
                  {selectedDoc.fileName}
                </strong>
              </div>
            </div>

            {selectedDoc.status ===
              'REJECTED' &&
              selectedDoc.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
                  <strong>
                    Motivo da rejeição:
                  </strong>{' '}
                  {
                    selectedDoc.rejectionReason
                  }
                </div>
              )}

            {selectedDoc.status ===
              'PENDING' && (
              <>
                <div>
                  <label className="text-xs font-bold block mb-1">
                    Motivo da rejeição
                  </label>

                  <textarea
                    value={
                      rejectionReason
                    }
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value,
                      )
                    }
                    placeholder="Preencha apenas se for rejeitar o documento."
                    className="w-full border rounded-xl p-3 min-h-[90px] text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={
                      actionLoading ===
                      selectedDoc.id
                    }
                    onClick={() =>
                      void handleRejectDocument(
                        selectedDoc.id,
                        rejectionReason,
                      )
                    }
                    className="px-4 py-2.5 border border-red-300 text-red-700 rounded-xl text-xs font-bold"
                  >
                    Rejeitar Documento
                  </button>

                  <button
                    type="button"
                    disabled={
                      actionLoading ===
                      selectedDoc.id
                    }
                    onClick={() =>
                      void handleApproveDocument(
                        selectedDoc.id,
                      )
                    }
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    {actionLoading ===
                    selectedDoc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}

                    Aprovar Documento
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sellerRejectId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Rejeitar KYC do Vendedor
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  Esta decisão altera o status
                  real do vendedor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSellerRejectId(null);
                  setSellerRejectReason('');
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={
                sellerRejectReason
              }
              onChange={(event) =>
                setSellerRejectReason(
                  event.target.value,
                )
              }
              placeholder="Informe claramente o motivo da rejeição..."
              className="w-full border rounded-xl p-3 min-h-[120px] text-xs"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSellerRejectId(null);
                  setSellerRejectReason('');
                }}
                className="px-4 py-2 border rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleRejectSeller()
                }
                disabled={
                  actionLoading ===
                  `seller-reject-${sellerRejectId}`
                }
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black disabled:opacity-50"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};