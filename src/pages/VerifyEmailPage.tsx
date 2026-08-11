import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { NusaliLogo } from '../components/NusaliLogo';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const targetEmail = user?.email || '';

  const [digits, setDigits] = useState<string[]>([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [challengeId, setChallengeId] = useState<string | null>(null);

  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );

  const [isVerified, setIsVerified] = useState(
    user?.isEmailVerified || false,
  );

  const initialSendDone = useRef(false);

  const maskEmail = (email: string) => {
    const parts = email.split('@');

    if (parts.length !== 2) {
      return email;
    }

    const name = parts[0];

    if (!name) {
      return email;
    }

    const maskedName =
      name.length <= 3
        ? `${name[0]}***`
        : `${name[0]}***${name[name.length - 1]}`;

    return `${maskedName}@${parts[1]}`;
  };

  const extractErrorMessage = (error: any) => {
    return (
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Ocorreu um erro inesperado.'
    );
  };

  const requestVerificationCode = async (
    showSuccessMessage = true,
  ) => {
    try {
      setResending(true);
      setErrorMessage(null);

      if (showSuccessMessage) {
        setSuccessMessage(null);
      }

      const response =
        await AuthService.resendVerification('email');

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível enviar o código.',
        );
      }

      const newChallengeId = response.data?.challengeId;

      if (!newChallengeId) {
        throw new Error(
          'O servidor não retornou o identificador da verificação.',
        );
      }

      setChallengeId(newChallengeId);

      setDigits(['', '', '', '', '', '']);

      setTimer(60);
      setCanResend(false);

      if (showSuccessMessage) {
        setSuccessMessage(
          response.data?.message ||
            'Código de verificação enviado com sucesso.',
        );
      }

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (error: any) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  /*
   * Quando o usuário chega nesta página autenticado e ainda
   * não verificado, solicitamos um desafio real ao backend.
   *
   * Isso garante que:
   * - um OTP seja realmente enviado;
   * - o challengeId correspondente seja mantido no frontend.
   */
  useEffect(() => {
    if (
      user &&
      !user.isEmailVerified &&
      !initialSendDone.current
    ) {
      initialSendDone.current = true;

      requestVerificationCode(false);
    }
  }, [user]);

  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }

    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer]);

  const handleChangeDigit = (
    index: number,
    value: string,
  ) => {
    setErrorMessage(null);

    const sanitized = value.replace(/\D/g, '');

    if (sanitized.length > 1) {
      return;
    }

    const newDigits = [...digits];

    newDigits[index] = sanitized;

    setDigits(newDigits);

    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key === 'Backspace' &&
      !digits[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData('text')
      .trim()
      .replace(/\D/g, '');

    if (pasted.length !== 6) {
      setErrorMessage(
        'Cole um código válido de exatamente 6 dígitos.',
      );

      return;
    }

    setDigits(pasted.split(''));

    inputRefs.current[5]?.focus();
  };

  const handleVerifyCode = async () => {
    const code = digits.join('');

    if (code.length !== 6) {
      setErrorMessage(
        'Por favor, informe os 6 dígitos completos do código.',
      );

      return;
    }

    if (!challengeId) {
      setErrorMessage(
        'Não existe um desafio de verificação ativo. Solicite um novo código.',
      );

      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await AuthService.verifyEmail({
        challengeId,
        code,
      });

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Código de verificação inválido.',
        );
      }

      setIsVerified(true);

      if (response.data?.user) {
        updateUser(response.data.user);
      } else if (user) {
        updateUser({
          isEmailVerified: true,
        });
      }

      setSuccessMessage(
        response.data?.message ||
          'E-mail verificado com sucesso!',
      );

      setTimeout(() => {
        navigate('/seller');
      }, 1500);
    } catch (error: any) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || resending) {
      return;
    }

    await requestVerificationCode(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 via-slate-900 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />

          <h1 className="text-lg font-black text-gray-900">
            Sessão necessária
          </h1>

          <p className="text-xs text-gray-600 mt-2">
            Entre novamente na sua conta para continuar a
            verificação do e-mail.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="mt-5 w-full bg-blue-900 text-white font-bold py-3 rounded-xl text-xs"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-slate-900 to-gray-900 flex flex-col justify-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link
          to="/"
          className="inline-block hover:opacity-90 transition"
        >
          <NusaliLogo variant="full" size="lg" />
        </Link>

        <h2 className="mt-6 text-2xl font-black text-white tracking-tight">
          Verificação de E-mail
        </h2>

        <p className="mt-1 text-xs text-blue-200">
          Enviamos um código de 6 dígitos para o e-mail
          cadastrado
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-gray-100">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6 text-center">
            <Mail className="w-6 h-6 text-blue-900 mx-auto mb-1" />

            <div className="text-xs text-gray-600 font-medium">
              Código enviado para:
            </div>

            <div className="font-mono font-bold text-sm text-blue-950 mt-0.5">
              {maskEmail(targetEmail)}
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />

              <div>{successMessage}</div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-900 text-xs font-medium">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />

              <div>{errorMessage}</div>
            </div>
          )}

          {!isVerified ? (
            <div className="space-y-6">
              {resending && !challengeId && (
                <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Enviando código de verificação...
                </div>
              )}

              <div>
                <label className="block text-center text-xs font-bold text-gray-700 mb-3">
                  Digite o código de 6 dígitos
                </label>

                <div className="flex justify-between gap-2">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={
                        index === 0 ? 'one-time-code' : 'off'
                      }
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        handleChangeDigit(
                          index,
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) =>
                        handleKeyDown(index, event)
                      }
                      onPaste={handlePaste}
                      className="w-11 h-12 text-center text-lg font-black font-mono border-2 border-gray-200 rounded-xl focus:border-blue-900 focus:ring-1 focus:ring-blue-900 focus:outline-hidden transition shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={
                  loading ||
                  resending ||
                  !challengeId ||
                  digits.some((digit) => digit === '')
                }
                className="w-full bg-blue-900 hover:bg-blue-950 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Verificar Código</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending}
                    className="text-xs font-extrabold text-blue-900 hover:text-blue-950 flex items-center justify-center gap-1.5 mx-auto underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        resending ? 'animate-spin' : ''
                      }`}
                    />

                    Reenviar código de verificação
                  </button>
                ) : (
                  <div className="text-xs text-gray-500 font-medium">
                    Reenviar novo código em{' '}
                    <strong className="text-blue-900 font-mono">
                      {timer}s
                    </strong>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="p-4 bg-emerald-100 text-emerald-900 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-black text-gray-900">
                E-mail Confirmado!
              </h3>

              <p className="text-xs text-gray-600">
                Seu e-mail foi autenticado com sucesso na sua conta
                Mercado Nusali.
              </p>

              <button
                type="button"
                onClick={() => navigate('/seller')}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Continuar para o Portal do Vendedor
              </button>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
            Não recebeu o código? Verifique a caixa de spam ou lixo
            eletrônico.
          </div>
        </div>
      </div>
    </div>
  );
};