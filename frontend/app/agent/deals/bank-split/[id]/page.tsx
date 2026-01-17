'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  BankSplitStatusBadge,
  DealStepIndicator,
} from '@/components/deals/BankSplitStatusBadge';
import { SplitRecipients } from '@/components/deals/SplitRecipients';
import { DealTimeline } from '@/components/deals/DealTimeline';
import {
  getBankSplitDeal,
  submitForSigning,
  markSigned,
  createInvoice,
  releaseDeal,
  cancelBankSplitDeal,
  getDealTimeline,
  BankSplitDeal,
  TimelineEvent,
  BANK_SPLIT_STATUS_LABELS,
} from '@/lib/api/bank-split';
import { formatPrice, formatDate, formatDateTime } from '@/lib/utils/format';

const TYPE_LABELS = {
  secondary_sell: 'Продажа вторички',
  secondary_buy: 'Покупка вторички',
  newbuild_booking: 'Бронирование новостройки',
};

export default function BankSplitDealDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  useEffect(() => {
    if (params.id) {
      loadDeal(params.id as string);
      loadTimeline(params.id as string);
    }
  }, [params.id, loadDeal, loadTimeline]);

  const handleAction = async (
    actionFn: () => Promise<unknown>,
    successMessage?: string
  ) => {
    if (!deal) return;

    setActionLoading(true);
    setActionError('');

    try {
      await actionFn();
      await loadDeal(deal.id);
      await loadTimeline(deal.id);
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
    handleAction(() => submitForSigning(deal.id));
  };

  const handleMarkSigned = () => {
    if (!deal) return;
    handleAction(() => markSigned(deal.id));
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
    handleAction(() => releaseDeal(deal.id));
  };

  const handleCancel = async () => {
    if (!deal) return;

    const reason = prompt('Укажите причину отмены:');
    if (!reason) return;

    await handleAction(() => cancelBankSplitDeal(deal.id, reason));
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
            </CardContent>
          </Card>

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
    </div>
  );
}
