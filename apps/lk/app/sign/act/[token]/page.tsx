'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ActInfo,
  getActInfo,
  requestActOTP,
  signAct,
  formatDaysRemaining,
  getAutoReleaseWarning,
  createActDispute,
  DisputeReason,
  DISPUTE_REASON_LABELS,
} from '@housler/lib';

type Step = 'loading' | 'info' | 'consent' | 'code' | 'success' | 'error' | 'dispute' | 'dispute-success';

export default function ActSigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<ActInfo | null>(null);
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

  // Dispute
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('service_not_provided');
  const [disputeDescription, setDisputeDescription] = useState('');

  useEffect(() => {
    loadActInfo();
  }, [token]);

  const loadActInfo = async () => {
    try {
      const data = await getActInfo(token);
      setInfo(data);

      if (data.already_signed) {
        setError('Акт уже подписан');
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
      const result = await requestActOTP(token, consentData, consentPep);
      setPhoneMasked(result.phone_masked);
      setStep('code');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (code.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await signAct(token, code);
      setSignedAt(result.signed_at);
      setStep('success');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispute = () => {
    setStep('dispute');
    setError('');
  };

  const handleSubmitDispute = async () => {
    if (!disputeDescription && disputeReason === 'other') {
      setError('Пожалуйста, опишите причину спора');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await createActDispute(token, {
        reason: disputeReason,
        description: disputeDescription || undefined,
      });
      setStep('dispute-success');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Ошибка создания спора');
    } finally {
      setLoading(false);
    }
  };

  const formatDealType = (type: string): string => {
    const types: Record<string, string> = {
      secondary_buy: 'Покупка недвижимости',
      secondary_sell: 'Продажа недвижимости',
      newbuild_booking: 'Бронирование новостройки',
      sale_buy: 'Покупка недвижимости',
      sale_sell: 'Продажа недвижимости',
      rent_tenant: 'Аренда (арендатор)',
      rent_landlord: 'Аренда (арендодатель)',
    };
    return types[type] || 'Сделка с недвижимостью';
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="signing-container">
        <div className="signing-card">
          <div className="loading-spinner" />
          <p>Загрузка акта...</p>
        </div>
        <Styles />
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
        <Styles />
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
          <h1 className="signing-title">Акт подписан</h1>
          <p className="signing-subtitle">
            Спасибо! Акт выполненных работ успешно подписан.
            Выплата исполнителям будет произведена в ближайшее время.
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
              Скачать акт
            </a>
          )}
        </div>
        <Styles />
      </div>
    );
  }

  // Dispute success state
  if (step === 'dispute-success') {
    return (
      <div className="signing-container">
        <div className="signing-card">
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="signing-title">Спор открыт</h1>
          <p className="signing-subtitle">
            Ваш спор зарегистрирован. Мы свяжемся с вами для уточнения деталей
            и решения ситуации.
          </p>
          <p className="signing-hint" style={{ marginTop: '16px' }}>
            Выплата средств приостановлена до разрешения спора.
            Среднее время рассмотрения — 3-5 рабочих дней.
          </p>
        </div>
        <Styles />
      </div>
    );
  }

  const autoReleaseWarning = info ? getAutoReleaseWarning(info.days_until_auto_release) : null;

  return (
    <div className="signing-container">
      <div className="signing-card">
        {/* Header */}
        <div className="signing-header">
          <h1 className="signing-title">Акт выполненных работ</h1>
          <p className="signing-subtitle">
            {info?.executor_name}
          </p>
        </div>

        {/* Auto-release warning */}
        {autoReleaseWarning && step === 'info' && (
          <div className="warning-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{autoReleaseWarning}</span>
          </div>
        )}

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
                      {info.commission_total} руб.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="signing-section">
              <h2 className="signing-section-title">Заказчик</h2>
              <div className="signing-info-grid">
                <div className="signing-info-item">
                  <span className="signing-info-label">ФИО</span>
                  <span className="signing-info-value">{info.client_name}</span>
                </div>
                <div className="signing-info-item">
                  <span className="signing-info-label">Телефон</span>
                  <span className="signing-info-value">{info.phone_masked}</span>
                </div>
              </div>
            </div>

            {info.deadline && (
              <div className="signing-section">
                <div className="deadline-info">
                  <span className="deadline-label">Срок подписания:</span>
                  <span className="deadline-value">
                    до {new Date(info.deadline).toLocaleDateString('ru-RU')}
                    {info.days_until_auto_release !== null && (
                      <> ({formatDaysRemaining(info.days_until_auto_release)})</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {info.document_url && (
              <div className="signing-section">
                <a
                  href={info.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-block"
                >
                  Просмотреть акт
                </a>
              </div>
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={() => setStep('consent')}
            >
              Перейти к подписанию
            </button>

            {/* Dispute button */}
            {info.can_open_dispute && (
              <button
                className="btn btn-danger btn-block"
                onClick={handleOpenDispute}
                style={{ marginTop: '12px' }}
              >
                Открыть спор
              </button>
            )}
          </>
        )}

        {/* Consent Step */}
        {step === 'consent' && (
          <>
            <div className="signing-section">
              <h2 className="signing-section-title">Согласия</h2>
              <p className="signing-hint">
                Для подписания акта электронной подписью необходимо дать согласия:
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
                onClick={handleSign}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Подписание...' : 'Подписать акт'}
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

        {/* Dispute Step */}
        {step === 'dispute' && (
          <>
            <div className="signing-section">
              <h2 className="signing-section-title">Открыть спор</h2>
              <p className="signing-hint">
                Если вы не согласны с оказанной услугой, выберите причину спора:
              </p>

              <div className="radio-group">
                {(Object.keys(DISPUTE_REASON_LABELS) as DisputeReason[]).map((reason) => (
                  <label key={reason} className="radio-label">
                    <input
                      type="radio"
                      name="dispute-reason"
                      checked={disputeReason === reason}
                      onChange={() => setDisputeReason(reason)}
                    />
                    <span>{DISPUTE_REASON_LABELS[reason]}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <label className="input-label">Описание (необязательно)</label>
                <textarea
                  className="input textarea"
                  placeholder="Опишите ситуацию подробнее..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {error && <p className="signing-error">{error}</p>}

            <div className="signing-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStep('info');
                  setError('');
                }}
              >
                Назад
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitDispute}
                disabled={loading}
              >
                {loading ? 'Отправка...' : 'Открыть спор'}
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="signing-footer">
          <p>
            Hash документа: <code>{info?.document_hash?.slice(0, 16)}...</code>
          </p>
        </div>
      </div>

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
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
        margin-bottom: 24px;
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

      .btn-danger {
        background: #fff;
        color: #666;
        border: 1px solid #e5e5e5;
      }

      .btn-danger:hover:not(:disabled) {
        background: #f5f5f5;
        color: #333;
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

      .warning-box {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 24px;
        font-size: 14px;
        color: #333;
      }

      .warning-box svg {
        flex-shrink: 0;
        margin-top: 2px;
      }

      .deadline-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 8px;
      }

      @media (min-width: 640px) {
        .deadline-info {
          flex-direction: row;
          justify-content: space-between;
        }
      }

      .deadline-label {
        color: #666;
        font-size: 14px;
      }

      .deadline-value {
        font-weight: 500;
        font-size: 14px;
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .radio-label {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 8px;
        transition: background 0.2s;
      }

      .radio-label:hover {
        background: #e5e5e5;
      }

      .radio-label input {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .radio-label span {
        font-size: 14px;
        color: #333;
      }

      .input-label {
        display: block;
        font-size: 14px;
        color: #666;
        margin-bottom: 8px;
      }

      .textarea {
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
      }
    `}</style>
  );
}
