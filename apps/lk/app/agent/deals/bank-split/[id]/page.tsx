'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@housler/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@housler/ui';
import {
  BankSplitStatusBadge,
  DealStepIndicator,
} from '@/components/deals/BankSplitStatusBadge';
import { SplitRecipients } from '@/components/deals/SplitRecipients';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { ContractSection } from '@/components/deals/ContractSection';
import { useAuth } from '@/hooks/useAuth';
import {
  getBankSplitDeal,
  submitForSigning,
  markSigned,
  createInvoice,
  releaseDeal,
  cancelBankSplitDeal,
  getDealTimeline,
  sendPaymentLink,
  regeneratePaymentLink,
  createDispute,
  getDispute,
  confirmServiceCompletion,
  getServiceCompletionStatus,
  getSplitAdjustments,
  requestSplitAdjustment,
  approveSplitAdjustment,
  rejectSplitAdjustment,
  BankSplitDeal,
  TimelineEvent,
  DisputeResponse,
  ServiceCompletionStatus,
  SplitAdjustment,
  BANK_SPLIT_STATUS_LABELS,
  ADJUSTMENT_STATUS_LABELS,
} from '@housler/lib';
import { formatPrice, formatDate, formatDateTime } from '@housler/lib';

const TYPE_LABELS = {
  secondary_sell: 'Продажа вторички',
  secondary_buy: 'Покупка вторички',
  newbuild_booking: 'Бронирование новостройки',
};

const DISPUTE_REASON_LABELS: Record<string, string> = {
  service_not_provided: 'Услуга не оказана',
  service_quality: 'Качество услуги',
  incorrect_amount: 'Неверная сумма',
  duplicate_payment: 'Дублирующий платеж',
  unauthorized_payment: 'Несанкционированный платеж',
  other: 'Другое',
};

export default function BankSplitDealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [deal, setDeal] = useState<BankSplitDeal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    url: string;
    qrCode?: string;
    expiresAt: string;
  } | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [dispute, setDispute] = useState<DisputeResponse | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [completionStatus, setCompletionStatus] = useState<ServiceCompletionStatus | null>(null);

  // Split adjustment state
  const [adjustments, setAdjustments] = useState<SplitAdjustment[]>([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [newSplitPercents, setNewSplitPercents] = useState<Record<number, number>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingAdjustmentId, setRejectingAdjustmentId] = useState<string | null>(null);

  const loadDeal = useCallback(async (id: string) => {
    try {
      const data = await getBankSplitDeal(id);
      setDeal(data);
    } catch (error) {
      console.error('Failed to load deal:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (id: string) => {
    try {
      const events = await getDealTimeline(id);
      setTimeline(events);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    }
  }, []);

  const loadDispute = useCallback(async (id: string) => {
    try {
      const disputeData = await getDispute(id);
      setDispute(disputeData);
    } catch (error) {
      console.error('Failed to load dispute:', error);
    }
  }, []);

  const loadCompletionStatus = useCallback(async (id: string) => {
    try {
      const status = await getServiceCompletionStatus(id);
      setCompletionStatus(status);
    } catch (error) {
      console.error('Failed to load completion status:', error);
    }
  }, []);

  const loadAdjustments = useCallback(async (id: string) => {
    try {
      const result = await getSplitAdjustments(id);
      setAdjustments(result.items);
    } catch (error) {
      console.error('Failed to load adjustments:', error);
    }
  }, []);

  useEffect(() => {
    if (params.id) {
      loadDeal(params.id as string);
      loadTimeline(params.id as string);
      loadDispute(params.id as string);
      loadCompletionStatus(params.id as string);
      loadAdjustments(params.id as string);
    }
  }, [params.id, loadDeal, loadTimeline, loadDispute, loadCompletionStatus, loadAdjustments]);

  const handleAction = async (
    actionFn: () => Promise<unknown>,
    message?: string
  ) => {
    if (!deal) return;

    setActionLoading(true);
    setActionError('');
    setSuccessMessage('');

    try {
      await actionFn();
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
      await loadDispute(deal.id);
      await loadCompletionStatus(deal.id);
      await loadAdjustments(deal.id);
      if (message) {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (error: unknown) {
      console.error('Action failed:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Произошла ошибка'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForSigning = () => {
    if (!deal) return;
    handleAction(() => submitForSigning(deal.id), 'Договор отправлен на подпись');
  };

  const handleMarkSigned = () => {
    if (!deal) return;
    handleAction(() => markSigned(deal.id), 'Договор отмечен как подписанный');
  };

  const handleCreateInvoice = async () => {
    if (!deal) return;

    setActionLoading(true);
    setActionError('');

    try {
      const returnUrl = `${window.location.origin}/agent/deals/bank-split/${deal.id}`;
      const result = await createInvoice(deal.id, returnUrl);
      setPaymentData({
        url: result.payment_url,
        qrCode: result.qr_code,
        expiresAt: result.expires_at,
      });
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
    } catch (error: unknown) {
      console.error('Failed to create invoice:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка создания счета'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = () => {
    if (!deal) return;
    handleAction(() => releaseDeal(deal.id), 'Средства освобождены');
  };

  const handleRetryPayment = async () => {
    if (!deal) return;

    setActionLoading(true);
    setActionError('');
    setSuccessMessage('');

    try {
      const result = await regeneratePaymentLink(deal.id);
      setPaymentData({
        url: result.payment_url,
        expiresAt: result.expires_at,
      });
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
      setSuccessMessage('Платежная ссылка обновлена');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to regenerate payment link:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка создания новой ссылки'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!deal || !disputeReason.trim()) return;

    setActionLoading(true);
    setActionError('');

    try {
      await createDispute(deal.id, {
        reason: disputeReason,
        description: disputeDescription || undefined,
        refund_requested: false,
      });
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeDescription('');
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
      await loadDispute(deal.id);
      setSuccessMessage('Спор открыт');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to create dispute:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка открытия спора'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!deal) return;

    setActionLoading(true);
    setActionError('');

    try {
      await confirmServiceCompletion(deal.id);
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
      await loadCompletionStatus(deal.id);
      setSuccessMessage('Выполнение услуги подтверждено');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to confirm completion:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка подтверждения'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!deal) return;

    const reason = prompt('Укажите причину отмены:');
    if (!reason) return;

    await handleAction(() => cancelBankSplitDeal(deal.id, reason));
  };

  // Split adjustment handlers
  const handleOpenAdjustmentModal = () => {
    if (!deal) return;
    // Initialize with current split from recipients
    const currentSplit: Record<number, number> = {};
    deal.recipients.forEach((r) => {
      if (r.user_id) {
        currentSplit[r.user_id] = r.split_value;
      }
    });
    setNewSplitPercents(currentSplit);
    setAdjustmentReason('');
    setShowAdjustmentModal(true);
  };

  const handleRequestAdjustment = async () => {
    if (!deal || !adjustmentReason.trim()) return;

    // Validate that split sums to 100
    const total = Object.values(newSplitPercents).reduce((sum, v) => sum + v, 0);
    if (total !== 100) {
      setActionError(`Сумма долей должна равняться 100%, текущая: ${total}%`);
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await requestSplitAdjustment(deal.id, {
        new_split: newSplitPercents,
        reason: adjustmentReason,
      });
      setShowAdjustmentModal(false);
      setAdjustmentReason('');
      setNewSplitPercents({});
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
      await loadAdjustments(deal.id);
      setSuccessMessage('Запрос на корректировку отправлен');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to request adjustment:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка запроса корректировки'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAdjustment = async (adjustmentId: string) => {
    setActionLoading(true);
    setActionError('');

    try {
      const result = await approveSplitAdjustment(adjustmentId);
      if (deal) {
        await loadDeal(deal.id);
        await loadTimeline(deal.id);
        await loadAdjustments(deal.id);
      }
      setSuccessMessage(
        result.all_approved ? 'Корректировка применена' : 'Ваше согласие записано'
      );
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to approve adjustment:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка одобрения'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAdjustment = async (adjustmentId: string) => {
    if (!rejectReason.trim()) {
      setActionError('Укажите причину отклонения');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await rejectSplitAdjustment(adjustmentId, rejectReason);
      setRejectingAdjustmentId(null);
      setRejectReason('');
      if (deal) {
        await loadDeal(deal.id);
        await loadTimeline(deal.id);
        await loadAdjustments(deal.id);
      }
      setSuccessMessage('Корректировка отклонена');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      console.error('Failed to reject adjustment:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosError.response?.data?.detail || 'Ошибка отклонения'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPaymentSMS = async () => {
    if (!deal) return;

    setSmsSending(true);
    setSmsResult(null);

    try {
      const result = await sendPaymentLink(deal.id, 'sms');
      setSmsResult({
        success: true,
        message: result.message,
      });
    } catch (error: unknown) {
      console.error('Failed to send SMS:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setSmsResult({
        success: false,
        message: axiosError.response?.data?.detail || 'Ошибка отправки SMS',
      });
    } finally {
      setSmsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-600 mb-4">Сделка не найдена</p>
        <Link href="/agent/deals">
          <Button>Вернуться к списку</Button>
        </Link>
      </div>
    );
  }

  const canCancel = ['draft', 'awaiting_signatures', 'signed'].includes(
    deal.status
  );
  const canSubmitForSigning = deal.status === 'draft';
  const canMarkSigned = deal.status === 'awaiting_signatures';
  const canCreateInvoice = deal.status === 'signed';
  const canRelease = deal.status === 'hold_period';
  const canRetryPayment = deal.status === 'payment_failed' || (deal.status === 'invoiced' && !deal.payment_link_url);
  const canOpenDispute = deal.status === 'hold_period' && !dispute;
  const canConfirmCompletion = deal.status === 'hold_period' && (!completionStatus || !completionStatus.confirmed);
  const hasConfirmedCompletion = completionStatus?.confirmed ?? false;
  const isInDispute = deal.status === 'dispute';
  const isRefunded = deal.status === 'refunded';
  const isPayoutReady = deal.status === 'payout_ready';
  const isPayoutInProgress = deal.status === 'payout_in_progress';

  // Split adjustment flags
  const canRequestAdjustment =
    ['draft', 'awaiting_signatures', 'signed'].includes(deal.status) &&
    deal.recipients.length > 1 &&
    !adjustments.some((a) => a.status === 'pending');
  const pendingAdjustment = adjustments.find((a) => a.status === 'pending');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/agent/deals"
          className="text-gray-600 hover:text-black text-sm"
        >
          ← Назад к списку
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {deal.property_address}
          </h1>
          <p className="text-gray-600 mt-1">
            Создано {formatDate(deal.created_at)}
          </p>
        </div>
        <BankSplitStatusBadge status={deal.status} size="lg" />
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <DealStepIndicator status={deal.status} />
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-900">{successMessage}</p>
        </div>
      )}

      {actionError && (
        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <p className="text-sm text-gray-900">{actionError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Info */}
          <Card>
            <CardHeader>
              <CardTitle>Информация о сделке</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-600">Тип сделки</dt>
                  <dd className="text-base text-gray-900 mt-1">
                    {TYPE_LABELS[deal.type]}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Адрес</dt>
                  <dd className="text-base text-gray-900 mt-1">
                    {deal.property_address}
                  </dd>
                </div>
                {deal.description && (
                  <div>
                    <dt className="text-sm text-gray-600">Описание</dt>
                    <dd className="text-base text-gray-900 mt-1">
                      {deal.description}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <dt className="text-sm text-gray-600">Цена объекта</dt>
                    <dd className="text-lg font-semibold text-gray-900 mt-1">
                      {formatPrice(deal.price)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Комиссия</dt>
                    <dd className="text-lg font-semibold text-gray-900 mt-1">
                      {formatPrice(deal.commission_total)}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Client Info */}
          {(deal.client_name || deal.client_phone || deal.client_email) && (
            <Card>
              <CardHeader>
                <CardTitle>Данные клиента</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {deal.client_name && (
                    <div>
                      <dt className="text-sm text-gray-600">ФИО</dt>
                      <dd className="text-base text-gray-900 mt-1">
                        {deal.client_name}
                      </dd>
                    </div>
                  )}
                  {deal.client_phone && (
                    <div>
                      <dt className="text-sm text-gray-600">Телефон</dt>
                      <dd className="text-base text-gray-900 mt-1">
                        {deal.client_phone}
                      </dd>
                    </div>
                  )}
                  {deal.client_email && (
                    <div>
                      <dt className="text-sm text-gray-600">Email</dt>
                      <dd className="text-base text-gray-900 mt-1">
                        {deal.client_email}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Contracts Section */}
          <ContractSection
            dealId={deal.id}
            dealStatus={deal.status}
            currentUserId={user?.id}
            onContractGenerated={() => loadDeal(deal.id)}
          />

          {/* Payment Info */}
          {(deal.payment_link_url || paymentData) && (
            <Card>
              <CardHeader>
                <CardTitle>Оплата</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deal.paid_at ? (
                    <div className="p-4 bg-gray-50 rounded-lg text-center">
                      <p className="text-gray-900 font-medium">Оплачено</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDateTime(deal.paid_at)}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-4">
                          Ссылка для оплаты клиентом
                        </p>
                        <div className="flex gap-2 items-center justify-center flex-wrap">
                          <code className="bg-gray-100 px-4 py-2 rounded text-sm max-w-xs truncate">
                            {paymentData?.url || deal.payment_link_url}
                          </code>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                paymentData?.url || deal.payment_link_url || ''
                              );
                            }}
                          >
                            Копировать
                          </Button>
                        </div>
                      </div>
                      {paymentData?.qrCode && (
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${paymentData.qrCode}`}
                            alt="QR код для оплаты"
                            className="w-48 h-48"
                          />
                        </div>
                      )}
                      {(paymentData?.expiresAt ||
                        deal.payment_link_expires_at) && (
                          <p className="text-xs text-gray-500 text-center">
                            Действует до:{' '}
                            {formatDateTime(
                              paymentData?.expiresAt ||
                              deal.payment_link_expires_at!
                            )}
                          </p>
                        )}

                      {/* SMS Send Section */}
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-3 text-center">
                          Отправить ссылку клиенту
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSendPaymentSMS}
                          loading={smsSending}
                          disabled={!deal.client_phone}
                          fullWidth
                        >
                          Отправить SMS
                        </Button>
                        {!deal.client_phone && (
                          <p className="text-xs text-gray-400 text-center mt-2">
                            Телефон клиента не указан
                          </p>
                        )}
                        {smsResult && (
                          <div
                            className={`mt-3 p-3 rounded-lg text-sm text-center ${smsResult.success
                                ? 'bg-gray-50 text-gray-900'
                                : 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {smsResult.message}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hold Period Info */}
          {deal.status === 'hold_period' && deal.hold_until && (
            <Card>
              <CardHeader>
                <CardTitle>Период удержания</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Средства будут доступны для выплаты после
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    {formatDateTime(deal.hold_until)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Failed Info */}
          {deal.status === 'payment_failed' && (
            <Card>
              <CardHeader>
                <CardTitle>Ошибка оплаты</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600 mb-4">
                    Оплата не прошла. Вы можете создать новую ссылку для оплаты.
                  </p>
                  <Button
                    onClick={handleRetryPayment}
                    loading={actionLoading}
                  >
                    Создать новую ссылку
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dispute Info */}
          {(isInDispute || dispute) && (
            <Card>
              <CardHeader>
                <CardTitle>Спор по сделке</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dispute && (
                    <>
                      <div className="p-4 bg-gray-100 rounded-lg">
                        <p className="text-sm text-gray-600">Причина</p>
                        <p className="text-gray-900 mt-1">
                          {DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}
                        </p>
                        {dispute.description && (
                          <p className="text-sm text-gray-600 mt-2">{dispute.description}</p>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Статус спора:</span>
                        <span className="font-medium text-gray-900">
                          {dispute.status === 'open' && 'Открыт'}
                          {dispute.status === 'under_review' && 'На рассмотрении'}
                          {dispute.status === 'resolved' && 'Разрешен'}
                          {dispute.status === 'closed' && 'Закрыт'}
                        </span>
                      </div>
                      {dispute.refund_status && dispute.refund_status !== 'none' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Возврат:</span>
                          <span className="font-medium text-gray-900">
                            {dispute.refund_status === 'pending' && 'Ожидает'}
                            {dispute.refund_status === 'processing' && 'Обрабатывается'}
                            {dispute.refund_status === 'completed' && 'Выполнен'}
                            {dispute.refund_status === 'failed' && 'Ошибка'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {!dispute && isInDispute && (
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        По сделке открыт спор. Выплата приостановлена.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refunded Info */}
          {isRefunded && (
            <Card>
              <CardHeader>
                <CardTitle>Возврат средств</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Средства возвращены клиенту
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payout Ready/In Progress Info */}
          {(isPayoutReady || isPayoutInProgress) && (
            <Card>
              <CardHeader>
                <CardTitle>Выплата</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    {isPayoutReady && 'Средства готовы к выплате получателям'}
                    {isPayoutInProgress && 'Выплата средств получателям в процессе'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>История событий</CardTitle>
                <button
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="text-sm text-gray-600 hover:text-black"
                >
                  {showTimeline ? 'Скрыть' : 'Показать'}
                </button>
              </div>
            </CardHeader>
            {showTimeline && (
              <CardContent>
                <DealTimeline events={timeline} />
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Split Recipients */}
          <Card>
            <CardHeader>
              <CardTitle>Распределение</CardTitle>
            </CardHeader>
            <CardContent>
              <SplitRecipients
                recipients={deal.recipients}
                totalCommission={deal.commission_total}
              />
              {canRequestAdjustment && (
                <Button
                  variant="secondary"
                  onClick={handleOpenAdjustmentModal}
                  fullWidth
                  className="mt-4"
                >
                  Изменить пропорции
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pending Adjustment */}
          {pendingAdjustment && (
            <Card>
              <CardHeader>
                <CardTitle>Запрос на изменение пропорций</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600">Причина:</p>
                    <p className="text-gray-900">{pendingAdjustment.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Было:</p>
                      {Object.entries(pendingAdjustment.old_split).map(([userId, percent]) => (
                        <p key={userId} className="text-sm text-gray-900">
                          ID {userId}: {percent}%
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Станет:</p>
                      {Object.entries(pendingAdjustment.new_split).map(([userId, percent]) => (
                        <p key={userId} className="text-sm text-gray-900">
                          ID {userId}: {percent}%
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    Ожидает согласия: {pendingAdjustment.required_approvers.length - pendingAdjustment.approvals.length} из {pendingAdjustment.required_approvers.length}
                  </div>

                  {pendingAdjustment.expires_at && (
                    <div className="text-sm text-gray-500">
                      Истекает: {formatDateTime(pendingAdjustment.expires_at)}
                    </div>
                  )}

                  {rejectingAdjustmentId === pendingAdjustment.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Укажите причину отклонения..."
                        rows={2}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRejectingAdjustmentId(null);
                            setRejectReason('');
                          }}
                          fullWidth
                        >
                          Отмена
                        </Button>
                        <Button
                          onClick={() => handleRejectAdjustment(pendingAdjustment.id)}
                          loading={actionLoading}
                          fullWidth
                        >
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setRejectingAdjustmentId(pendingAdjustment.id)}
                        fullWidth
                      >
                        Отклонить
                      </Button>
                      <Button
                        onClick={() => handleApproveAdjustment(pendingAdjustment.id)}
                        loading={actionLoading}
                        fullWidth
                      >
                        Согласиться
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Действия</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {canSubmitForSigning && (
                  <Button
                    onClick={handleSubmitForSigning}
                    loading={actionLoading}
                    fullWidth
                  >
                    Отправить на подпись
                  </Button>
                )}

                {canMarkSigned && (
                  <Button
                    onClick={handleMarkSigned}
                    loading={actionLoading}
                    fullWidth
                  >
                    Отметить подписанным
                  </Button>
                )}

                {canCreateInvoice && (
                  <Button
                    onClick={handleCreateInvoice}
                    loading={actionLoading}
                    fullWidth
                  >
                    Выставить счет
                  </Button>
                )}

                {canRelease && (
                  <Button
                    onClick={handleRelease}
                    loading={actionLoading}
                    fullWidth
                  >
                    Завершить удержание
                  </Button>
                )}

                {canRetryPayment && (
                  <Button
                    onClick={handleRetryPayment}
                    loading={actionLoading}
                    fullWidth
                  >
                    Новая ссылка оплаты
                  </Button>
                )}

                {canConfirmCompletion && (
                  <Button
                    variant="secondary"
                    onClick={handleConfirmCompletion}
                    loading={actionLoading}
                    fullWidth
                  >
                    Подтвердить выполнение
                  </Button>
                )}

                {hasConfirmedCompletion && deal.status === 'hold_period' && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Вы подтвердили выполнение услуги</p>
                  </div>
                )}

                {canOpenDispute && (
                  <Button
                    variant="secondary"
                    onClick={() => setShowDisputeModal(true)}
                    fullWidth
                  >
                    Открыть спор
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="secondary"
                    onClick={handleCancel}
                    loading={actionLoading}
                    fullWidth
                  >
                    Отменить сделку
                  </Button>
                )}

                {deal.status === 'closed' && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Сделка завершена</p>
                  </div>
                )}

                {deal.status === 'cancelled' && (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600">Сделка отменена</p>
                  </div>
                )}

                {isInDispute && (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600">Спор на рассмотрении</p>
                  </div>
                )}

                {isRefunded && (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600">Средства возвращены</p>
                  </div>
                )}

                {isPayoutReady && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Готово к выплате</p>
                  </div>
                )}

                {isPayoutInProgress && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Выплата в процессе</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deal Meta */}
          <Card>
            <CardContent className="pt-6">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">ID</dt>
                  <dd className="text-gray-900 font-mono text-xs">
                    {deal.id.slice(0, 8)}...
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Модель оплаты</dt>
                  <dd className="text-gray-900">Instant Split</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Создано</dt>
                  <dd className="text-gray-900">{formatDate(deal.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Обновлено</dt>
                  <dd className="text-gray-900">{formatDate(deal.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Открыть спор
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина спора
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Выберите причину</option>
                  <option value="service_not_provided">Услуга не оказана</option>
                  <option value="service_quality">Качество услуги</option>
                  <option value="incorrect_amount">Неверная сумма</option>
                  <option value="duplicate_payment">Дублирующий платеж</option>
                  <option value="unauthorized_payment">Несанкционированный платеж</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание (опционально)
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Опишите ситуацию подробнее..."
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeReason('');
                  setDisputeDescription('');
                }}
                fullWidth
              >
                Отмена
              </Button>
              <Button
                onClick={handleOpenDispute}
                loading={actionLoading}
                disabled={!disputeReason.trim()}
                fullWidth
              >
                Открыть спор
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Split Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Изменить пропорции
            </h3>
            <div className="space-y-4">
              {/* Current recipients with editable percentages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Новые пропорции
                </label>
                <div className="space-y-3">
                  {deal.recipients
                    .filter((r) => r.user_id)
                    .map((recipient) => (
                      <div key={recipient.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 flex-1">
                          {recipient.role === 'agent' ? 'Агент' : 'Со-агент'} (ID: {recipient.user_id})
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newSplitPercents[recipient.user_id!] ?? recipient.split_value}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setNewSplitPercents((prev) => ({
                                ...prev,
                                [recipient.user_id!]: Math.min(100, Math.max(0, value)),
                              }));
                            }}
                            className="w-20 p-2 border border-gray-300 rounded-lg text-right"
                          />
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Сумма: {Object.values(newSplitPercents).reduce((sum, v) => sum + v, 0)}% (должно быть 100%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина изменения
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Укажите причину изменения пропорций (минимум 10 символов)..."
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              <p className="text-xs text-gray-500">
                После отправки запроса все другие участники сделки должны будут согласиться с изменением.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAdjustmentModal(false);
                  setAdjustmentReason('');
                  setNewSplitPercents({});
                }}
                fullWidth
              >
                Отмена
              </Button>
              <Button
                onClick={handleRequestAdjustment}
                loading={actionLoading}
                disabled={
                  !adjustmentReason.trim() ||
                  adjustmentReason.length < 10 ||
                  Object.values(newSplitPercents).reduce((sum, v) => sum + v, 0) !== 100
                }
                fullWidth
              >
                Отправить запрос
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
