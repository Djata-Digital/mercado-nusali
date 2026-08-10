import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  User,
  Building,
  Camera,
  ChevronRight,
  ChevronLeft,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { SellerProfileData } from '../../data/mockSellerData';
import {
  SellerDocumentsApi,
  SellerDocument,
  SellerDocumentType,
} from '../../api/clients/SellerDocumentsApi';

interface SellerKycProps {
  profile: SellerProfileData;
  showToast: (msg: string) => void;
  onNavigateSection: (sec: any) => void;
}

type UploadState = {
  identity?: File;
  address?: File;
  selfie?: File;
};

const formatStatus = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'Aprovado';
    case 'REJECTED':
      return 'Rejeitado';
    case 'PENDING':
      return 'Em análise';
    default:
      return 'Não enviado';
  }
};

export const SellerKyc: React.FC<SellerKycProps> = ({
  profile,
  showToast,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [docType, setDocType] = useState<'IDENTITY_DOCUMENT' | 'PASSPORT'>(
    'IDENTITY_DOCUMENT',
  );
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [files, setFiles] = useState<UploadState>({});
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const steps = [
    { num: 1, title: 'Tipo de Conta', icon: User },
    { num: 2, title: 'Responsável Legal', icon: Building },
    { num: 3, title: 'Identidade', icon: FileText },
    { num: 4, title: 'Comprovante', icon: FileText },
    { num: 5, title: 'Selfie', icon: Camera },
  ];

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await SellerDocumentsApi.getMyDocuments();

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || 'Não foi possível carregar os documentos.',
        );
      }

      setDocuments(response.data);
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
    loadDocuments();
  }, []);

  const currentIdentity = useMemo(
    () =>
      documents.find(
        (doc) =>
          doc.isCurrent &&
          ['IDENTITY_DOCUMENT', 'PASSPORT'].includes(doc.documentType),
      ),
    [documents],
  );

  const currentAddress = useMemo(
    () =>
      documents.find(
        (doc) => doc.isCurrent && doc.documentType === 'ADDRESS_PROOF',
      ),
    [documents],
  );

  const currentSelfie = useMemo(
    () =>
      documents.find(
        (doc) => doc.isCurrent && doc.documentType === 'SELFIE',
      ),
    [documents],
  );

  const isApproved =
    currentIdentity?.status === 'APPROVED' &&
    currentAddress?.status === 'APPROVED' &&
    currentSelfie?.status === 'APPROVED';

  const hasPending =
    currentIdentity?.status === 'PENDING' ||
    currentAddress?.status === 'PENDING' ||
    currentSelfie?.status === 'PENDING';

  const hasRejected =
    currentIdentity?.status === 'REJECTED' ||
    currentAddress?.status === 'REJECTED' ||
    currentSelfie?.status === 'REJECTED';

  const handleFileChange = (
    key: keyof UploadState,
    file?: File,
  ) => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      showToast('O arquivo deve ter no máximo 10 MB.');
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast('Formato não permitido. Use JPG, PNG ou PDF.');
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [key]: file,
    }));
  };

  const uploadDocument = async (
    type: SellerDocumentType,
    file?: File,
  ) => {
    if (!file) {
      showToast('Selecione um arquivo antes de enviar.');
      return;
    }

    try {
      setUploadingType(type);

      const response = await SellerDocumentsApi.upload(type, file);

      if (!response.success) {
        throw new Error(
          response.error?.message || 'Falha ao enviar documento.',
        );
      }

      showToast('Documento enviado com sucesso para análise.');
      await loadDocuments();
    } catch (error: any) {
      showToast(
        error?.response?.data?.error?.message ||
          error?.message ||
          'Erro ao enviar documento.',
      );
    } finally {
      setUploadingType(null);
    }
  };

  const renderStatus = (document?: SellerDocument) => {
    if (!document) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 font-bold text-xs px-3 py-1 rounded-full">
          <AlertCircle className="w-4 h-4" />
          Não enviado
        </span>
      );
    }

    if (document.status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-4 h-4" />
          Aprovado
        </span>
      );
    }

    if (document.status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 font-bold text-xs px-3 py-1 rounded-full border border-red-200">
          <XCircle className="w-4 h-4" />
          Rejeitado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1 rounded-full border border-amber-200">
        <Clock className="w-4 h-4" />
        Em análise
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              isApproved
                ? 'bg-emerald-100 text-emerald-800'
                : hasRejected
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-gray-900">
              Verificação de Identidade & KYC
            </h1>

            <p className="text-xs text-gray-500 mt-0.5">
              Envie seus documentos oficiais. A aprovação é feita pela equipe
              de verificação do Mercado Nusali.
            </p>
          </div>
        </div>

        {isApproved ? (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            KYC Aprovado
          </span>
        ) : hasPending ? (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Em análise
          </span>
        ) : (
          <span className="text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            Verificação incompleta
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <h2 className="text-sm font-bold text-gray-900 mb-4">
          Etapas do Processo de Verificação
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCurrent = step.num === currentStep;

            return (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num)}
                className={`p-2.5 rounded-xl text-center border transition flex flex-col items-center gap-1 ${
                  isCurrent
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-black leading-tight">
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">
              Etapa 1: Tipo de Conta
            </h3>

            <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-700">
                O tipo de conta é definido no cadastro do vendedor e usado
                pelo backend para determinar os documentos obrigatórios.
              </p>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">
              Etapa 2: Responsável Legal
            </h3>

            <div>
              <label className="block text-gray-700 font-bold mb-1 text-xs">
                Nome
              </label>

              <input
                type="text"
                value={profile.fullName}
                readOnly
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-900">
                Etapa 3: Documento de Identidade
              </h3>

              {renderStatus(currentIdentity)}
            </div>

            <select
              value={docType}
              onChange={(e) =>
                setDocType(
                  e.target.value as
                    | 'IDENTITY_DOCUMENT'
                    | 'PASSPORT',
                )
              }
              className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-xs font-bold"
            >
              <option value="IDENTITY_DOCUMENT">
                Bilhete de Identidade / RG / CNI
              </option>
              <option value="PASSPORT">Passaporte</option>
            </select>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) =>
                handleFileChange('identity', e.target.files?.[0])
              }
              className="block w-full text-xs"
            />

            {files.identity && (
              <p className="text-xs text-gray-500">
                Selecionado: {files.identity.name}
              </p>
            )}

            <button
              onClick={() =>
                uploadDocument(docType, files.identity)
              }
              disabled={uploadingType !== null}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {uploadingType === docType ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Enviar documento
            </button>

            {currentIdentity?.rejectionReason && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                Motivo da rejeição: {currentIdentity.rejectionReason}
              </p>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-900">
                Etapa 4: Comprovante de Endereço
              </h3>

              {renderStatus(currentAddress)}
            </div>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) =>
                handleFileChange('address', e.target.files?.[0])
              }
              className="block w-full text-xs"
            />

            {files.address && (
              <p className="text-xs text-gray-500">
                Selecionado: {files.address.name}
              </p>
            )}

            <button
              onClick={() =>
                uploadDocument('ADDRESS_PROOF', files.address)
              }
              disabled={uploadingType !== null}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {uploadingType === 'ADDRESS_PROOF' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Enviar comprovante
            </button>

            {currentAddress?.rejectionReason && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                Motivo da rejeição: {currentAddress.rejectionReason}
              </p>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-900">
                Etapa 5: Selfie de Validação
              </h3>

              {renderStatus(currentSelfie)}
            </div>

            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              capture="user"
              onChange={(e) =>
                handleFileChange('selfie', e.target.files?.[0])
              }
              className="block w-full text-xs"
            />

            {files.selfie && (
              <p className="text-xs text-gray-500">
                Selecionado: {files.selfie.name}
              </p>
            )}

            <button
              onClick={() =>
                uploadDocument('SELFIE', files.selfie)
              }
              disabled={uploadingType !== null}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {uploadingType === 'SELFIE' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Enviar selfie
            </button>

            {currentSelfie?.rejectionReason && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                Motivo da rejeição: {currentSelfie.rejectionReason}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {currentStep < 5 && (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1"
            >
              Próxima Etapa
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <h2 className="text-sm font-bold text-gray-900 mb-4">
          Documentos enviados
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando documentos...
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nenhum documento KYC enviado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl"
              >
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {document.documentType.replace(/_/g, ' ')}
                  </p>

                  <p className="text-[11px] text-gray-500 mt-1">
                    {document.fileName}
                  </p>
                </div>

                {renderStatus(document)}
              </div>
            ))}
          </div>
        )}
      </div>

      {isApproved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Documentação obrigatória aprovada
          </div>

          <p className="text-xs text-emerald-700 mt-2">
            Seus documentos obrigatórios foram aprovados. O status final do
            vendedor continuará sendo definido pelo backend e pela equipe de
            verificação.
          </p>
        </div>
      )}
    </div>
  );
};