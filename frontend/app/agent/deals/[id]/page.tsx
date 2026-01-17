'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getDeal, sendForSigning, cancelDeal, Deal, DealStatus, DealType } from '@/lib/api/deals';
import { formatPrice, formatDate } from '@/lib/utils/format';

const STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  payment_pending: 'Ожидает оплаты',
  in_progress: 'В работе',
  hold_period: 'Удержание',
  payout_ready: 'К выплате',
  closed: 'Закрыта',
  dispute: 'Спор',
  cancelled: 'Отменена',
};

const TYPE_LABELS: Record<DealType, string> = {
  secondary_sell: 'Продажа вторички',
  secondary_buy: 'Покупка вторички',
  newbuild_booking: 'Бронирование новостройки',
};

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [signingResult, setSigningResult] = useState<{ url: string; smsSent: boolean } | null>(null);

  useEffect(() => {
    if (params.id) {
      loadDeal(params.id as string);
    }
  }, [params.id]);

  async function loadDeal(id: string) {
    try {
      const data = await getDeal(id);
      setDeal(data);
    } catch (error) {
      console.error('Failed to load deal:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendForSigning() {
    if (!deal) return;

    setActionLoading(true);
    try {
      const result = await sendForSigning(deal.id);
      setSigningResult({ url: result.signing_url, smsSent: result.sms_sent });
      await loadDeal(deal.id);
    } catch (error: unknown) {
      console.error('Failed to send for signing:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      alert(axiosError.response?.data?.detail || 'Ошибка отправки на подпись');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!deal) return;
    
    if (!confirm('Вы уверены что хотите отменить сделку?')) return;
    
    setActionLoading(true);
    try {
      await cancelDeal(deal.id);
      router.push('/agent/deals');
    } catch (error) {
      console.error('Failed to cancel deal:', error);
      alert('Ошибка отмены сделки');
    } finally {
      setActionLoading(false);
    }
  }

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/agent/deals" className="text-gray-600 hover:text-black text-sm">
          ← Назад к списку
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{deal.address}</h1>
          <p className="text-gray-600 mt-1">
            Создано {formatDate(deal.created_at)}
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-lg ${
            deal.status === 'draft'
              ? 'bg-gray-200 text-gray-900'
              : deal.status === 'closed'
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          {STATUS_LABELS[deal.status]}
        </span>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Информация о сделке</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-600">Тип сделки</dt>
                <dd className="text-base text-gray-900 mt-1">{TYPE_LABELS[deal.type]}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Адрес</dt>
                <dd className="text-base text-gray-900 mt-1">{deal.address}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Цена</dt>
                <dd className="text-base text-gray-900 mt-1 font-semibold">
                  {formatPrice(deal.price)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Комиссия агента</dt>
                <dd className="text-base text-gray-900 mt-1 font-semibold">
                  {formatPrice(deal.commission_agent)}
                </dd>
              </div>
              {deal.client_name && (
                <div>
                  <dt className="text-sm text-gray-600">Клиент</dt>
                  <dd className="text-base text-gray-900 mt-1">
                    {deal.client_name}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {signingResult && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-green-600 mb-2">
                  {signingResult.smsSent
                    ? 'Ссылка для подписания отправлена клиенту по SMS'
                    : 'Ссылка для подписания создана (SMS не отправлен)'}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  Вы также можете скопировать и отправить ссылку вручную:
                </div>
                <div className="flex gap-2 items-center justify-center">
                  <code className="bg-gray-100 px-4 py-2 rounded text-sm max-w-md truncate">
                    {signingResult.url}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(signingResult.url);
                      alert('Ссылка скопирована');
                    }}
                  >
                    Копировать
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {deal.status === 'draft' && (
          <div className="flex gap-4">
            <Button onClick={handleSendForSigning} loading={actionLoading} fullWidth>
              Отправить на подпись
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancel}
              loading={actionLoading}
              fullWidth
            >
              Отменить сделку
            </Button>
          </div>
        )}

        {deal.status === 'awaiting_signatures' && !signingResult && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-600">
                Ожидаем подписания клиентом. Ссылка была отправлена по SMS.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

