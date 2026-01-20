'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getDeals, Deal, DealStatus } from '@/lib/api/deals';
import {
  getBankSplitDeals,
  BankSplitDeal,
  BankSplitStatus,
  BANK_SPLIT_STATUS_LABELS,
} from '@/lib/api/bank-split';
import { formatPrice, formatDate } from '@/lib/utils/format';

const STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Черновик',
  awaiting_signatures: 'Ожидает подписания',
  signed: 'Подписано',
  payment_pending: 'Ожидает оплаты',
  in_progress: 'В работе',
  invoiced: 'Счёт создан',
  hold_period: 'Удержание',
  payment_failed: 'Ошибка оплаты',
  payout_ready: 'К выплате',
  payout_in_progress: 'Выплата',
  refunded: 'Возврат',
  closed: 'Закрыта',
  dispute: 'Спор',
  cancelled: 'Отменена',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'awaiting_signatures', label: 'На подписании' },
  { value: 'signed', label: 'Подписаны' },
  { value: 'payment_pending', label: 'Ожидают оплаты' },
  { value: 'payment_failed', label: 'Ошибка оплаты' },
  { value: 'hold_period', label: 'Удержание' },
  { value: 'dispute', label: 'Споры' },
  { value: 'closed', label: 'Закрыты' },
  { value: 'cancelled', label: 'Отменены' },
];

type DealType = 'legacy' | 'bank_split';

interface UnifiedDeal {
  id: string;
  type: DealType;
  address: string;
  price: number;
  commission: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  paymentModel?: string;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<UnifiedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
      setError(null);
      setLoading(true);

      // Load both legacy and bank-split deals
      const [legacyResponse, bankSplitResponse] = await Promise.all([
        getDeals().catch(() => ({ items: [] })),
        getBankSplitDeals().catch(() => ({ items: [] })),
      ]);

      // Convert legacy deals to unified format
      const legacyDeals: UnifiedDeal[] = legacyResponse.items.map((deal: Deal) => ({
        id: deal.id,
        type: 'legacy' as DealType,
        address: deal.address,
        price: deal.price,
        commission: deal.commission_agent,
        status: deal.status,
        statusLabel: STATUS_LABELS[deal.status] || deal.status,
        createdAt: deal.created_at,
      }));

      // Convert bank-split deals to unified format
      const bankSplitDeals: UnifiedDeal[] = bankSplitResponse.items.map(
        (deal: BankSplitDeal) => ({
          id: deal.id,
          type: 'bank_split' as DealType,
          address: deal.property_address,
          price: deal.price,
          commission: deal.commission_total,
          status: deal.status,
          statusLabel: BANK_SPLIT_STATUS_LABELS[deal.status] || deal.status,
          createdAt: deal.created_at,
          paymentModel: 'Instant Split',
        })
      );

      // Combine and sort by creation date
      const allDeals = [...legacyDeals, ...bankSplitDeals].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setDeals(allDeals);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError('Не удалось загрузить сделки. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  }

  const filteredDeals = deals.filter((deal) => {
    if (filter === 'all') return true;
    return deal.status === filter;
  });

  const getDealLink = (deal: UnifiedDeal) => {
    if (deal.type === 'bank_split') {
      return `/agent/deals/bank-split/${deal.id}`;
    }
    return `/agent/deals/${deal.id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-900 mb-4">{error}</p>
              <Button onClick={loadDeals}>Повторить</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Сделки</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Управление вашими сделками</p>
        </div>
        <Link href="/agent/deals/new">
          <Button size="sm">Создать сделку</Button>
        </Link>
      </div>

      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap scrollbar-hide">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  filter === option.value
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список сделок ({filteredDeals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="mb-4">Сделок не найдено</p>
              <Link href="/agent/deals/new">
                <Button>Создать сделку</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredDeals.map((deal) => (
                <Link
                  key={`${deal.type}-${deal.id}`}
                  href={getDealLink(deal)}
                  className="block p-3 sm:p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{deal.address}</p>
                        {deal.paymentModel && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {deal.paymentModel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        {formatPrice(deal.price)} • {formatPrice(deal.commission)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(deal.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`self-start sm:self-center px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full whitespace-nowrap ${
                        deal.status === 'draft'
                          ? 'bg-gray-200 text-gray-900'
                          : deal.status === 'closed'
                          ? 'bg-black text-white'
                          : deal.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-500'
                          : deal.status === 'hold_period'
                          ? 'bg-gray-400 text-white'
                          : deal.status === 'dispute'
                          ? 'bg-gray-900 text-white'
                          : deal.status === 'payment_failed'
                          ? 'bg-gray-300 text-gray-700'
                          : deal.status === 'payout_ready' || deal.status === 'payout_in_progress'
                          ? 'bg-gray-500 text-white'
                          : deal.status === 'refunded'
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {deal.statusLabel}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
