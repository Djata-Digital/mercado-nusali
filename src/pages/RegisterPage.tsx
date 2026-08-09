import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Phone,
  User,
  Globe,
  Store,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NusaliLogo } from '../components/NusaliLogo';
import { UserRole } from '../types';

const COUNTRIES = [
  { code: 'GW', name: 'Guiné-Bissau', flag: '🇬🇼', phoneCode: '+245' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', phoneCode: '+55' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', phoneCode: '+351' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', phoneCode: '+244' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', phoneCode: '+238' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', phoneCode: '+221' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', phoneCode: '+1' },
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [step, setStep] = useState<number>(1);

  // Form Fields
  const [country, setCountry] = useState('GW');
  const [accountType, setAccountType] = useState<UserRole>('BUYER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCode, setPhoneCode] = useState('+245');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSymbol;
  const passMatch = password === confirmPassword && confirmPassword.length > 0;

  // Calculate password strength percentage
  const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  const strengthPercentage = (strengthScore / 5) * 100;
  const strengthColor =
    strengthScore <= 2 ? 'bg-red-500' : strengthScore <= 4 ? 'bg-amber-500' : 'bg-emerald-600';
  const strengthLabel =
    strengthScore <= 2 ? 'Fraca' : strengthScore <= 4 ? 'Média' : 'Forte (Segura)';

  const handleCountryChange = (cCode: string) => {
    setCountry(cCode);
    const found = COUNTRIES.find((c) => c.code === cCode);
    if (found) setPhoneCode(found.phoneCode);
  };

  const handleNextStep = () => {
    setErrorMessage(null);
    if (step === 1 && !country) {
      setErrorMessage('Por favor, selecione seu país de residência.');
      return;
    }
    if (step === 3 && (!firstName.trim() || !lastName.trim())) {
      setErrorMessage('Informe seu nome e sobrenome.');
      return;
    }
    if (step === 4) {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Informe um endereço de e-mail válido.');
        return;
      }
      if (!phone.trim()) {
        setErrorMessage('Informe seu número de telefone.');
        return;
      }
    }
    if (step === 5) {
      if (!isPasswordValid) {
        setErrorMessage('Sua senha deve atender a todos os requisitos de segurança.');
        return;
      }
      if (!passMatch) {
        setErrorMessage('A confirmação de senha não coincide.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('Você deve aceitar os Termos de Uso e a Política de Privacidade para prosseguir.');
      return;
    }

    setLoading(true);

    try {
      await register({
        country,
        role: accountType,
        firstName,
        lastName,
        dateOfBirth,
        email,
        phone,
        phoneCode,
        password,
        termsAccepted,
        privacyAccepted,
        marketingConsent,
      });

      // Redirect user to email or phone verification
      navigate('/verify-email');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-slate-900 to-gray-900 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link to="/" className="inline-block hover:opacity-90 transition">
          <NusaliLogo variant="full" size="lg" />
        </Link>
        <h2 className="mt-4 text-2xl font-black text-white tracking-tight">
          Crie sua conta no Mercado Nusali
        </h2>
        <p className="mt-1 text-xs text-blue-200">
          Compre e venda entre a Guiné-Bissau, CPLP e mercados internacionais
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-gray-100">
          {/* Progress bar steps */}
          <div className="mb-6">
            <div className="flex justify-between text-[11px] font-bold text-gray-500 mb-2">
              <span>Etapa {step} de 6</span>
              <span className="text-blue-900 font-extrabold">
                {step === 1 && '1. País'}
                {step === 2 && '2. Tipo de Conta'}
                {step === 3 && '3. Dados Pessoais'}
                {step === 4 && '4. Contato'}
                {step === 5 && '5. Senha Segura'}
                {step === 6 && '6. Aceite & Termos'}
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-900 via-indigo-800 to-emerald-600 h-full transition-all duration-300"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-900 text-xs font-medium animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={step === 6 ? handleSubmit : (e) => { e.preventDefault(); handleNextStep(); }}>
            {/* STEP 1: Country */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-900" /> Selecione seu País de Residência
                </h3>
                <p className="text-xs text-gray-500">
                  O país selecionado definirá sua moeda principal e os métodos de pagamento locais.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountryChange(c.code)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                        country === c.code
                          ? 'border-blue-900 bg-blue-50/50 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-2xl">{c.flag}</span>
                      <div>
                        <div className="font-bold text-xs text-gray-900">{c.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.phoneCode}</div>
                      </div>
                      {country === c.code && (
                        <Check className="w-4 h-4 text-blue-900 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Account Type */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="font-bold text-sm text-gray-900">Qual é o objetivo principal da sua conta?</h3>
                <p className="text-xs text-gray-500">
                  Você poderá comprar e vender no Mercado Nusali com facilidade.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Buyer option */}
                  <button
                    type="button"
                    onClick={() => setAccountType('BUYER')}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      accountType === 'BUYER'
                        ? 'border-blue-900 bg-blue-50/50 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-blue-100 text-blue-900 rounded-lg">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      {accountType === 'BUYER' && <Check className="w-4 h-4 text-blue-900" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-gray-900">Conta Comprador</div>
                      <div className="text-[11px] text-gray-500 mt-1 leading-snug">
                        Para comprar produtos nacionais e importados com segurança Nusali Escrow.
                      </div>
                    </div>
                  </button>

                  {/* Seller option */}
                  <button
                    type="button"
                    onClick={() => setAccountType('SELLER')}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      accountType === 'SELLER'
                        ? 'border-emerald-800 bg-emerald-50/50 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                        <Store className="w-5 h-5" />
                      </div>
                      {accountType === 'SELLER' && <Check className="w-4 h-4 text-emerald-800" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-gray-900">Conta Vendedor / Loja</div>
                      <div className="text-[11px] text-gray-500 mt-1 leading-snug">
                        Para anunciar produtos, criar lojas oficiais e receber pagamentos na Carteira.
                      </div>
                    </div>
                  </button>
                </div>

                {accountType === 'SELLER' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p>
                      <strong>Nota de Vendedor:</strong> Você criará primeiro sua conta de acesso. Depois será direcionado ao processo de verificação de identidade e KYC do vendedor.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Personal Info */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-900" /> Dados Pessoais
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="ex: Bacai"
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Sobrenome *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="ex: Sanhá"
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Data de Nascimento (Opcional)</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: Contact */}
            {step === 4 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-900" /> Informações de Contato
                </h3>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">E-mail Principal *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: seu.email@exemplo.com"
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Enviaremos um código de 6 dígitos para verificar este e-mail.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Telefone / WhatsApp *</label>
                  <div className="flex gap-2">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="bg-gray-50 border border-gray-300 font-bold rounded-xl px-2.5 py-2.5 focus:border-blue-800 focus:outline-hidden"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.phoneCode}>
                          {c.flag} {c.phoneCode}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="955 000 111"
                      className="flex-1 p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Utilizado para notificações de frete e saques na Carteira Orange/MTN.
                  </span>
                </div>
              </div>
            )}

            {/* STEP 5: Password */}
            {step === 5 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-900" /> Criar Senha de Acesso
                </h3>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Senha *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>Força da senha:</span>
                        <span className="text-gray-800">{strengthLabel}</span>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${strengthColor}`}
                          style={{ width: `${strengthPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Confirmar Senha *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-blue-800 focus:outline-hidden"
                  />
                  {confirmPassword.length > 0 && !passMatch && (
                    <span className="text-[10px] text-red-600 mt-1 block">As senhas não coincidem.</span>
                  )}
                </div>

                {/* Rules Checklist */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                    <Check className="w-3.5 h-3.5" /> Pelo menos 8 caracteres
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                    <Check className="w-3.5 h-3.5" /> Letras maiúsculas e minúsculas
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                    <Check className="w-3.5 h-3.5" /> Pelo menos um número (0-9)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                    <Check className="w-3.5 h-3.5" /> Pelo menos um símbolo (!@#$)
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: Terms & Confirmation */}
            {step === 6 && (
              <div className="space-y-4 animate-fadeIn text-xs">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" /> Aceite de Termos e Consentimento
                </h3>

                <div className="space-y-3 pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      type="checkbox"
                      required
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded border-gray-300 focus:ring-blue-800 cursor-pointer mt-0.5 shrink-0"
                    />
                    <span className="text-gray-700 leading-snug">
                      Eu li e concordo com os <strong>Termos de Uso do Mercado Nusali</strong> para operações no mercado Guiné-Bissau e CPLP.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      type="checkbox"
                      required
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded border-gray-300 focus:ring-blue-800 cursor-pointer mt-0.5 shrink-0"
                    />
                    <span className="text-gray-700 leading-snug">
                      Concordo com a <strong>Política de Privacidade</strong> e o tratamento seguro dos meus dados pessoais.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded border-gray-300 focus:ring-blue-800 cursor-pointer mt-0.5 shrink-0"
                    />
                    <span className="text-gray-700 leading-snug">
                      (Opcional) Desejo receber ofertas exclusivas, cupons e atualizações de rastreamento de frete por e-mail e SMS.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-100">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
              ) : (
                <div />
              )}

              {step < 6 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
                >
                  Continuar
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-emerald-900 hover:opacity-95 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-lg cursor-pointer ml-auto disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Criando conta...</span>
                    </div>
                  ) : (
                    <>
                      <span>Finalizar Cadastro</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Footer link to login */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs">
            <p className="text-gray-600">
              Já tem uma conta no Mercado Nusali?{' '}
              <Link to="/login" className="font-bold text-blue-800 hover:text-blue-950 underline ml-1">
                Fazer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
