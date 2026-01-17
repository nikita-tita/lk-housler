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
  hold_period: 'Удержание',
  payout_ready: 'К выплате',
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
  { value: 'hold_period', label: 'Удержание' },
  { value: 'closed', label: 'Закрыты' },
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
  const [filter, setFilter] = useState<string>('all');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    try {
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
    } catch (error) {
      console.error('Failed to load deals:', error);
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Сделки</h1>
          <p className="text-gray-600 mt-1">Управление вашими сделками</p>
        </div>
        <div className="relative">
          <Button onClick={() => setShowCreateMenu(!showCreateMenu)}>
            Создать сделку
            <svg
              className={`w-4 h-4 ml-2 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Button>
          {showCreateMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCreateMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
                <Link
                  href="/agent/deals/new"
                  className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-200"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <div className="font-medium text-gray-900">
                    Обычная сделка
                  </div>
                  <div className="text-sm text-gray-500">
                    Стандартный договор
                  </div>
                </Link>
                <Link
                  href="/agent/deals/bank-split/new"
                  className="block px-4 py-3 hover:bg-gray-50"
                  onClick={() => setShowCreateMenu(false)}
                >
                  <div className="font-medium text-gray-900">
                    Instant Split
                  </div>
                  <div className="text-sm text-gray-500">
                    Автоматическое распределение
                  </div>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
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
              <Link href="/agent/deals/bank-split/new">
                <Button>Создать сделку</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeals.map((deal) => (
                <Link
                  key={`${deal.type}-${deal.id}`}
                  href={getDealLink(deal)}
                  className="block p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{deal.address}</p>
                        {deal.paymentModel && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {deal.paymentModel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Цена: {formatPrice(deal.price)} • Комиссия:{' '}
                        {formatPrice(deal.commission)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Создано {formatDate(deal.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                          deal.status === 'draft'
                            ? 'bg-gray-200 text-gray-900'
                            : deal.status === 'closed'
                            ? 'bg-black text-white'
                            : deal.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-500'
                            : deal.status === 'hold_period'
                            ? 'bg-gray-400 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {deal.statusLabel}
                      </span>
                    </div>
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
