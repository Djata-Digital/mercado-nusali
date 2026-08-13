import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Users,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { StoresApi } from '../api/clients/StoresApi';

const extractErrorMessage = (
  error: any,
): string =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível processar o convite.';

export const StoreInvitationPage: React.FC =
  () => {
    const { token } = useParams<{
      token: string;
    }>();

    const navigate = useNavigate();

    const [processing, setProcessing] =
      useState<
        'accept' | 'reject' | null
      >(null);

    const [success, setSuccess] =
      useState<
        'accepted' | 'rejected' | null
      >(null);

    const [error, setError] =
      useState<string | null>(null);

    const handleAccept = async () => {
      if (!token) {
        setError(
          'Token de convite não encontrado.',
        );
        return;
      }

      try {
        setProcessing('accept');
        setError(null);

        const response =
          await StoresApi.acceptInvitation(
            token,
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível aceitar o convite.',
          );
        }

        setSuccess('accepted');
      } catch (err: any) {
        setError(
          extractErrorMessage(err),
        );
      } finally {
        setProcessing(null);
      }
    };

    const handleReject = async () => {
      if (!token) {
        setError(
          'Token de convite não encontrado.',
        );
        return;
      }

      try {
        setProcessing('reject');
        setError(null);

        const response =
          await StoresApi.rejectInvitation(
            token,
          );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Não foi possível rejeitar o convite.',
          );
        }

        setSuccess('rejected');
      } catch (err: any) {
        setError(
          extractErrorMessage(err),
        );
      } finally {
        setProcessing(null);
      }
    };

    if (success === 'accepted') {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="bg-white max-w-lg w-full border border-gray-200 shadow-xl rounded-3xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />

            <h1 className="text-xl font-black text-gray-900 mt-5">
              Convite aceito
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              Você agora faz parte da equipe
              desta loja no Mercado Nusali.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate('/seller')
              }
              className="mt-7 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl"
            >
              Ir para o Mercado Nusali
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    if (success === 'rejected') {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="bg-white max-w-lg w-full border border-gray-200 shadow-xl rounded-3xl p-8 text-center">
            <XCircle className="w-16 h-16 text-gray-500 mx-auto" />

            <h1 className="text-xl font-black text-gray-900 mt-5">
              Convite rejeitado
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              O convite foi rejeitado e não
              será adicionado à sua conta.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate('/')
              }
              className="mt-7 px-6 py-3 border border-gray-300 rounded-xl font-bold"
            >
              Voltar ao Mercado Nusali
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white max-w-lg w-full border border-gray-200 shadow-xl rounded-3xl overflow-hidden">
          <div className="bg-emerald-800 text-white p-7 text-center">
            <Users className="w-12 h-12 mx-auto" />

            <h1 className="text-xl font-black mt-3">
              Convite para Equipe
            </h1>

            <p className="text-sm text-emerald-100 mt-1">
              Mercado Nusali
            </p>
          </div>

          <div className="p-8">
            <p className="text-sm text-gray-600 text-center">
              Você recebeu um convite para
              integrar a equipe de uma loja.
            </p>

            <p className="text-xs text-gray-500 text-center mt-3">
              Para aceitar, você precisa estar
              conectado com exatamente o mesmo
              endereço de e-mail que recebeu o
              convite.
            </p>

            {error && (
              <div className="mt-5 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7">
              <button
                type="button"
                disabled={Boolean(processing)}
                onClick={() =>
                  void handleReject()
                }
                className="border border-red-200 text-red-700 font-bold py-3 rounded-xl hover:bg-red-50 disabled:opacity-50"
              >
                {processing === 'reject' ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Rejeitar Convite'
                )}
              </button>

              <button
                type="button"
                disabled={Boolean(processing)}
                onClick={() =>
                  void handleAccept()
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing === 'accept' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Aceitar Convite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };