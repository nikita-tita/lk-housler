'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatPrice, formatDateTime } from '@/lib/utils/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface PaymentInfo {
  deal_id: string;
  property_address: string;
  amount: number;
  payment_url: string;
  qr_code?: string;
  expires_at: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  client_name?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.dealId) {
      loadPaymentInfo(params.dealId as string);
    }
  }, [params.dealId]);

  async function loadPaymentInfo(dealId: string) {
    try {
      const url = `${API_URL}/bank-split/${dealId}/payment-info`;
      console.log('Fetching:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Счет не найден или уже оплачен');
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data: PaymentInfo = await response.json();
      setPaymentInfo(data);
    } catch (err: unknown) {
      console.error('Failed to load payment info:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки информации об оплате');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Ошибка
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/">
              <Button variant="secondary">На главную</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentInfo) {
    return null;
  }

  if (paymentInfo.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-black rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Оплата получена
            </h1>
            <p className="text-gray-600 mb-4">
              Комиссия за сделку успешно оплачена
            </p>
            <div className="text-sm text-gray-500">
              {paymentInfo.property_address}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentInfo.status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Срок оплаты истек
            </h1>
            <p className="text-gray-600 mb-4">
              Пожалуйста, свяжитесь с вашим агентом для получения новой ссылки
              на оплату.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentInfo.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Сделка отменена
            </h1>
            <p className="text-gray-600">Оплата по данной сделке невозможна.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending payment
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-lg sm:text-xl font-bold">H</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Оплата комиссии
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Housler</p>
          </div>

          {/* Deal Info */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <dl className="space-y-2">
              <div>
                <dt className="text-xs sm:text-sm text-gray-600">Объект</dt>
                <dd className="text-sm sm:text-base text-gray-900 font-medium">
                  {paymentInfo.property_address}
                </dd>
              </div>
              {paymentInfo.client_name && (
                <div>
                  <dt className="text-xs sm:text-sm text-gray-600">Плательщик</dt>
                  <dd className="text-sm sm:text-base text-gray-900">
                    {paymentInfo.client_name}
                  </dd>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200">
                <dt className="text-xs sm:text-sm text-gray-600">Сумма к оплате</dt>
                <dd className="text-xl sm:text-2xl font-bold text-gray-900">
                  {formatPrice(paymentInfo.amount)}
                </dd>
              </div>
            </dl>
          </div>

          {/* QR Code */}
          {paymentInfo.qr_code && (
            <div className="text-center mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                Отсканируйте QR-код для оплаты через приложение банка
              </p>
              <div className="inline-block p-3 sm:p-4 bg-white border border-gray-200 rounded-lg">
                <img
                  src={`data:image/png;base64,${paymentInfo.qr_code}`}
                  alt="QR код для оплаты"
                  className="w-40 h-40 sm:w-48 sm:h-48"
                />
              </div>
            </div>
          )}

          {/* Payment Button */}
          <div className="space-y-4">
            <a
              href={paymentInfo.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button fullWidth size="lg">
                Перейти к оплате
              </Button>
            </a>

            <p className="text-xs text-center text-gray-500">
              Ссылка действительна до {formatDateTime(paymentInfo.expires_at)}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Безопасная оплата через T-Bank
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Ваши платежные данные защищены
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
