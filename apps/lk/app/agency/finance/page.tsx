'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@housler/ui';

// Mock data
const mockFinanceData = {
  totalRevenue: 2450000,
  totalPending: 380000,
  totalPaid: 2070000,
  monthlyData: [
    { month: 'Янв', revenue: 180000 },
    { month: 'Фев', revenue: 220000 },
    { month: 'Мар', revenue: 310000 },
    { month: 'Апр', revenue: 290000 },
    { month: 'Май', revenue: 410000 },
    { month: 'Июн', revenue: 450000 },
  ],
  topAgents: [
    { name: 'Иван Петров', deals: 12, commission: 680000 },
    { name: 'Мария Сидорова', deals: 9, commission: 520000 },
    { name: 'Александр Козлов', deals: 7, commission: 390000 },
  ],
};

export default function FinancePage() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);

    // Mock export delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    alert(`Экспорт в ${format.toUpperCase()} начался. Файл будет скачан автоматически.`);
    setExporting(false);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate max for chart scaling
  const maxRevenue = Math.max(...mockFinanceData.monthlyData.map(d => d.revenue));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Финансы</h1>
          <p className="text-gray-600 mt-1">Финансовая аналитика за последние 6 месяцев</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('excel')}
            loading={exporting}
          >
            Экспорт Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('pdf')}
            loading={exporting}
          >
            Экспорт PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardDescription>Общая выручка</CardDescription>
            <CardTitle className="text-3xl">{formatPrice(mockFinanceData.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>К выплате</CardDescription>
            <CardTitle className="text-3xl text-gray-700">
              {formatPrice(mockFinanceData.totalPending)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Выплачено</CardDescription>
            <CardTitle className="text-3xl">{formatPrice(mockFinanceData.totalPaid)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Динамика выручки</CardTitle>
          <CardDescription>Помесячная выручка агентства</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2">
            {mockFinanceData.monthlyData.map((data) => {
              const height = (data.revenue / maxRevenue) * 100;
              return (
                <div
                  key={data.month}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    className="w-full bg-gray-900 rounded-t hover:bg-gray-700 transition-colors cursor-pointer relative group"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${data.month}: ${formatPrice(data.revenue)}`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatPrice(data.revenue)}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    {data.month}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Топ агентов</CardTitle>
          <CardDescription>Агенты с наибольшей выручкой</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Агент
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Сделок
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Комиссия
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockFinanceData.topAgents.map((agent, index) => (
                  <tr key={agent.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{agent.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-4 px-4 text-gray-900">
                      {agent.deals}
                    </td>
                    <td className="text-right py-4 px-4 font-semibold text-gray-900">
                      {formatPrice(agent.commission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
