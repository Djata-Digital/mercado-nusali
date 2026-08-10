import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  User,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  AdminApi,
  AdminKycDocument,
} from '../../api/clients/AdminApi';

interface AdminKycReviewProps {
  showToast: (msg: string) => void;
}

export const AdminKycReview: React.FC<AdminKycReviewProps> = ({
  showToast,
}) => {
  const [kycQueue, setKycQueue] = useState<AdminKycDocument[]>([]);
  const [selectedDoc, setSelectedDoc] =
    useState<AdminKycDocument | null>(null);

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadPendingDocuments = async () => {
    try {
      setLoading(true);

      const response = await AdminApi.getKycDocuments({
        status: 'PENDING',
        page: 1,
        limit: 20,
      });

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message ||
            'Não foi possível carregar a fila KYC.',
        );
      }

      setKycQueue(response.data.items || []);
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Erro ao carregar documentos KYC.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDocuments();
  }, []);

  const handleView = async (document: AdminKycDocument) => {
    try {
      setSelectedDoc(document);
      setDocumentUrl(null);

      const response =
        await AdminApi.getKycDocumentDownloadUrl(document.id);

      if (!response.success || !response.data?.downloadUrl) {
        throw new Error(
          response.error?.message ||
            'Não foi possível abrir o documento.',
        );
      }

      setDocumentUrl(response.data.downloadUrl);
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Erro ao abrir documento.',
      );
    }
  };

  const handleApproveDocument = async (documentId: string) => {
    try {
      setActionLoading(documentId);

      const response =
        await AdminApi.approveKycDocument(documentId);

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível aprovar o documento.',
        );
      }

      showToast('Documento KYC aprovado com sucesso.');

      setSelectedDoc(null);
      setDocumentUrl(null);

      await loadPendingDocuments();
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Erro ao aprovar documento.',
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDocument = async (
    documentId: string,
    reason?: string,
  ) => {
    const finalReason = reason?.trim();

    if (!finalReason) {
      showToast('Informe o motivo da rejeição.');
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

      showToast('Documento KYC rejeitado.');

      setSelectedDoc(null);
      setDocumentUrl(null);
      setRejectionReason('');

      await loadPendingDocuments();
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Erro ao rejeitar documento.',
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveSeller = async (
    sellerId: string,
  ) => {
    try {
      setActionLoading(`seller-${sellerId}`);

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

      showToast('Vendedor aprovado e verificado com sucesso.');

      await loadPendingDocuments();
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Não foi possível aprovar o vendedor.',
      );
    } finally {
      setActionLoading(null);
    }
  };

  const documentTypeLabel = (type: string) => {
    switch (type) {
      case 'IDENTITY_DOCUMENT':
        return 'Documento de Identidade';
      case 'PASSPORT':
        return 'Passaporte';
      case 'ADDRESS_PROOF':
        return 'Comprovante de Endereço';
      case 'SELFIE':
        return 'Selfie';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            Fila de Análise KYC
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Revise documentos enviados pelos vendedores antes de
            aprovar a conta.
          </p>
        </div>

        <button
          onClick={loadPendingDocuments}
          disabled={loading}
          className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          Atualizar fila
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando documentos pendentes...
        </div>
      ) : kycQueue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />

          <h2 className="font-bold text-gray-900">
            Nenhum documento pendente
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            A fila de análise KYC está vazia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {kycQueue.map((document) => {
            const seller = document.seller;
            const user = seller?.user;

            const sellerName =
              seller?.tradeName ||
              seller?.legalName ||
              `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
              'Vendedor';

            return (
              <div
                key={document.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4 hover:border-purple-300 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900">
                      {sellerName}
                    </h3>

                    <p className="text-xs text-purple-700 font-bold">
                      {seller?.sellerType || 'SELLER'}
                    </p>
                  </div>

                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                    {document.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl text-xs border border-gray-100">
                  <div>
                    <span className="text-gray-400 text-[10px] block font-bold">
                      Documento
                    </span>

                    <span className="font-bold text-gray-900">
                      {documentTypeLabel(document.documentType)}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block font-bold">
                      Arquivo
                    </span>

                    <span className="font-bold text-gray-900 break-all">
                      {document.fileName}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block font-bold">
                      Tamanho
                    </span>

                    <span className="font-bold text-gray-900">
                      {(document.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block font-bold">
                      Vendedor
                    </span>

                    <span className="font-bold text-gray-900">
                      {seller?.status || '-'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <button
                    onClick={() => handleView(document)}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs px-3 py-2 rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleView(document)}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-2 rounded-xl"
                    >
                      Revisar / Rejeitar
                    </button>

                    <button
                      onClick={() =>
                        handleApproveDocument(document.id)
                      }
                      disabled={actionLoading === document.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl disabled:opacity-50"
                    >
                      {actionLoading === document.id
                        ? 'Aprovando...'
                        : 'Aprovar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Documento KYC
                </h3>

                <p className="text-xs text-gray-500">
                  {documentTypeLabel(selectedDoc.documentType)}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setDocumentUrl(null);
                  setRejectionReason('');
                }}
                className="text-gray-400 hover:text-gray-700 font-bold"
              >
                X
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 min-h-[300px] flex items-center justify-center overflow-hidden">
              {!documentUrl ? (
                <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
              ) : selectedDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={documentUrl}
                  title="Documento KYC"
                  className="w-full h-[500px]"
                />
              ) : (
                <img
                  src={documentUrl}
                  alt="Documento KYC"
                  className="max-w-full max-h-[500px] object-contain"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 block">
                  Vendedor
                </span>

                <strong>
                  {selectedDoc.seller?.tradeName ||
                    selectedDoc.seller?.legalName}
                </strong>
              </div>

              <div>
                <span className="text-gray-400 block">
                  Documento
                </span>

                <strong>{selectedDoc.fileName}</strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Motivo da rejeição
              </label>

              <textarea
                value={rejectionReason}
                onChange={(e) =>
                  setRejectionReason(e.target.value)
                }
                placeholder="Informe o motivo somente se for rejeitar..."
                className="w-full border border-gray-300 rounded-xl p-3 text-xs min-h-[90px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
              <button
                onClick={() =>
                  handleApproveSeller(selectedDoc.sellerId)
                }
                disabled={
                  actionLoading ===
                  `seller-${selectedDoc.sellerId}`
                }
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <User className="w-4 h-4" />
                Aprovar Vendedor
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleRejectDocument(
                      selectedDoc.id,
                      rejectionReason,
                    )
                  }
                  disabled={actionLoading === selectedDoc.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  Rejeitar Documento
                </button>

                <button
                  onClick={() =>
                    handleApproveDocument(selectedDoc.id)
                  }
                  disabled={actionLoading === selectedDoc.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  Aprovar Documento
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />

              <p className="text-[11px] text-amber-800">
                A aprovação do vendedor só será aceita pelo backend
                quando todos os documentos obrigatórios estiverem
                aprovados.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};