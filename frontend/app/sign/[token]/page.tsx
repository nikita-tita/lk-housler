'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  SigningInfo,
  getSigningInfo,
  requestSigningOTP,
  verifyAndSign,
  formatDealType,
  formatPartyRole,
} from '@/lib/api/signing';

type Step = 'loading' | 'info' | 'consent' | 'code' | 'success' | 'error';

export default function SigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<SigningInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Consent checkboxes
  const [consentData, setConsentData] = useState(false);
  const [consentPep, setConsentPep] = useState(false);

  // OTP
  const [code, setCode] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');

  // Success
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    loadSigningInfo();
  }, [token]);

  const loadSigningInfo = async () => {
    try {
      const data = await getSigningInfo(token);
      setInfo(data);

      if (data.already_signed) {
        setError('Документ уже подписан');
        setStep('error');
      } else {
        setStep('info');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Ссылка недействительна или истекла');
      setStep('error');
    }
  };

  const handleRequestOTP = async () => {
    if (!consentData || !consentPep) {
      setError('Необходимо дать согласия для продолжения');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await requestSigningOTP(token, consentData, consentPep);
      setPhoneMasked(result.phone_masked);
      setStep('code');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await verifyAndSign(token, code);
      setSignedAt(result.signed_at);
      setStep('success');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="signing-container">
        <div className="signing-card">
          <div className="loading-spinner" />
          <p>Загрузка документа...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="signing-container">
        <div className="signing-card">
          <h1 className="signing-title">Ошибка</h1>
          <p className="signing-error">{error}</p>
          <p className="signing-hint">
            Если вы считаете это ошибкой, свяжитесь с вашим агентом.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="signing-container">
        <div className="signing-card">
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="signing-title">Документ подписан</h1>
          <p className="signing-subtitle">
            Спасибо! Договор успешно подписан электронной подписью.
          </p>
          {signedAt && (
            <p className="signing-meta">
              Дата подписания: {new Date(signedAt).toLocaleString('ru-RU')}
            </p>
          )}
          {info?.document_url && (
            <a
              href={info.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-block"
              style={{ marginTop: '24px' }}
            >
              Скачать документ
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="signing-container">
      <div className="signing-card">
        {/* Header */}
        <div className="signing-header">
          <h1 className="signing-title">Подписание договора</h1>
          <p className="signing-subtitle">
            {info?.executor_name}
          </p>
        </div>

        {/* Document Info */}
        {step === 'info' && info && (
          <>
            <div className="signing-section">
              <h2 className="signing-section-title">Информация о сделке</h2>
              <div className="signing-info-grid">
                <div className="signing-info-item">
                  <span className="signing-info-label">Тип сделки</span>
                  <span className="signing-info-value">{formatDealType(info.deal_type)}</span>
                </div>
                <div className="signing-info-item">
                  <span className="signing-info-label">Адрес объекта</span>
                  <span className="signing-info-value">{info.property_address}</span>
                </div>
                {info.commission_total && (
                  <div className="signing-info-item">
                    <span className="signing-info-label">Сумма комиссии</span>
                    <span className="signing-info-value">
                      {Number(info.commission_total).toLocaleString('ru-RU')} руб.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="signing-section">
              <h2 className="signing-section-title">Подписант</h2>
              <div className="signing-info-grid">
                <div className="signing-info-item">
                  <span className="signing-info-label">Роль</span>
                  <span className="signing-info-value">{formatPartyRole(info.party_role)}</span>
                </div>
                <div className="signing-info-item">
                  <span className="signing-info-label">ФИО</span>
                  <span className="signing-info-value">{info.party_name}</span>
                </div>
                <div className="signing-info-item">
                  <span className="signing-info-label">Телефон</span>
                  <span className="signing-info-value">{info.phone_masked}</span>
                </div>
              </div>
            </div>

            {info.document_url && (
              <div className="signing-section">
                <a
                  href={info.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-block"
                >
                  Просмотреть документ
                </a>
              </div>
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={() => setStep('consent')}
            >
              Перейти к подписанию
            </button>
          </>
        )}

        {/* Consent Step */}
        {step === 'consent' && (
          <>
            <div className="signing-section">
              <h2 className="signing-section-title">Согласия</h2>
              <p className="signing-hint">
                Для подписания документа электронной подписью необходимо дать согласия:
              </p>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consentData}
                  onChange={(e) => setConsentData(e.target.checked)}
                />
                <span>
                  Даю согласие на обработку персональных данных в соответствии с{' '}
                  <a href="/doc/privacy" target="_blank">Политикой конфиденциальности</a>
                </span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consentPep}
                  onChange={(e) => setConsentPep(e.target.checked)}
                />
                <span>
                  Подтверждаю согласие на использование простой электронной подписи (ПЭП)
                  в соответствии с 63-ФЗ. Ключом ПЭП является код, полученный по SMS.
                </span>
              </label>
            </div>

            {error && <p className="signing-error">{error}</p>}

            <div className="signing-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('info')}
              >
                Назад
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRequestOTP}
                disabled={loading || !consentData || !consentPep}
              >
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </div>
          </>
        )}

        {/* OTP Code Step */}
        {step === 'code' && (
          <>
            <div className="signing-section">
              <h2 className="signing-section-title">Введите код из SMS</h2>
              <p className="signing-hint">
                Код отправлен на номер {phoneMasked}
              </p>

              <input
                type="text"
                className="input input-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
              />
            </div>

            {error && <p className="signing-error">{error}</p>}

            <div className="signing-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStep('consent');
                  setCode('');
                  setError('');
                }}
              >
                Назад
              </button>
              <button
                className="btn btn-primary"
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Проверка...' : 'Подписать'}
              </button>
            </div>

            <button
              className="btn btn-ghost btn-block"
              onClick={handleRequestOTP}
              disabled={loading}
              style={{ marginTop: '12px' }}
            >
              Отправить код повторно
            </button>
          </>
        )}

        {/* Footer */}
        <div className="signing-footer">
          <p>
            Hash документа: <code>{info?.document_hash?.slice(0, 16)}...</code>
          </p>
        </div>
      </div>

      <style jsx>{`
        .signing-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #fafafa;
        }

        .signing-card {
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 20px;
          max-width: 480px;
          width: 100%;
        }

        @media (min-width: 640px) {
          .signing-card {
            padding: 32px;
          }
        }

        .signing-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .signing-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 8px;
        }

        @media (min-width: 640px) {
          .signing-title {
            font-size: 24px;
          }
        }

        .signing-subtitle {
          color: #666;
          margin: 0;
        }

        .signing-section {
          margin-bottom: 24px;
        }

        .signing-section-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
        }

        .signing-info-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .signing-info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        @media (min-width: 640px) {
          .signing-info-item {
            flex-direction: row;
            justify-content: space-between;
            gap: 0;
          }
        }

        .signing-info-label {
          color: #666;
          font-size: 14px;
        }

        .signing-info-value {
          font-weight: 500;
        }

        @media (min-width: 640px) {
          .signing-info-value {
            text-align: right;
          }
        }

        .signing-hint {
          color: #666;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .signing-error {
          color: #dc2626;
          font-size: 14px;
          margin: 16px 0;
        }

        .signing-meta {
          color: #666;
          font-size: 14px;
        }

        .signing-buttons {
          display: flex;
          gap: 12px;
        }

        .signing-buttons .btn {
          flex: 1;
        }

        .signing-footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
        }

        .signing-footer p {
          color: #999;
          font-size: 12px;
          margin: 0;
        }

        .signing-footer code {
          font-family: monospace;
        }

        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
          cursor: pointer;
        }

        .checkbox-label input {
          margin-top: 4px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .checkbox-label span {
          font-size: 14px;
          color: #333;
        }

        .checkbox-label a {
          color: #000;
          text-decoration: underline;
        }

        .input-code {
          font-size: 24px;
          text-align: center;
          letter-spacing: 6px;
          padding: 14px;
        }

        @media (min-width: 640px) {
          .input-code {
            font-size: 32px;
            letter-spacing: 8px;
            padding: 16px;
          }
        }

        .btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          font-size: 16px;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #000;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #333;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #000;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e5e5;
        }

        .btn-ghost {
          background: transparent;
          color: #666;
        }

        .btn-ghost:hover:not(:disabled) {
          background: #f5f5f5;
        }

        .btn-block {
          width: 100%;
        }

        .input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 16px;
        }

        .input:focus {
          outline: none;
          border-color: #000;
        }

        .success-icon {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
          color: #000;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e5e5;
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
