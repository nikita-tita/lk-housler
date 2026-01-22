'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { OfferFilters } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  quickOptions?: QuickOption[];
  timestamp: Date;
}

interface QuickOption {
  label: string;
  value: string;
  filters?: Partial<OfferFilters>;
}

interface AiBrokerChatProps {
  currentFilters: OfferFilters;
  totalOffers: number;
  onFiltersChange: (filters: Partial<OfferFilters>) => void;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  content: `Привет! Я ИИ-брокер, помогу найти идеальную квартиру.

Расскажите, что ищете - например:
- "Двушка до 12 млн с отделкой"
- "Квартира для семьи с ребёнком"
- "Студия рядом с метро"

Или просто опишите свои пожелания, я задам уточняющие вопросы.`,
  timestamp: new Date()
};

export function AiBrokerChat({
  currentFilters,
  totalOffers,
  onFiltersChange
}: AiBrokerChatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Фокус на инпут при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async (text: string, quickFilters?: Partial<OfferFilters>) => {
    if (!text.trim() && !quickFilters) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Если есть quickFilters - применяем сразу
    if (quickFilters && Object.keys(quickFilters).length > 0) {
      onFiltersChange(quickFilters);
    }

    try {
      const response = await api.aiBrokerChat({
        messages: [...messages.filter(m => m.id !== 'initial'), userMessage].map(m => ({
          role: m.role,
          content: m.content
        })),
        currentFilters: quickFilters ? { ...currentFilters, ...quickFilters } : currentFilters,
        totalOffers,
        conversationId: conversationId || undefined
      });

      if (response.success && response.data) {
        const { message, extractedFilters, quickOptions, conversationId: newConvId } = response.data;

        // Сохраняем conversationId
        if (newConvId) setConversationId(newConvId);

        // Добавляем ответ AI
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          quickOptions,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);

        // Применяем фильтры если есть
        if (extractedFilters && Object.keys(extractedFilters).length > 0) {
          onFiltersChange(extractedFilters);
        }
      } else {
        // Ошибка от API
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.error || 'Произошла ошибка. Попробуйте ещё раз.',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('AI Broker error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз или используйте обычные фильтры.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentFilters, totalOffers, conversationId, onFiltersChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickOption = (option: QuickOption) => {
    sendMessage(option.value, option.filters);
  };

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    setConversationId(null);
    // Сбрасываем все фильтры через пустой объект
    onFiltersChange({
      rooms: undefined,
      is_studio: undefined,
      price_min: undefined,
      price_max: undefined,
      area_min: undefined,
      area_max: undefined,
      floor_min: undefined,
      floor_max: undefined,
      districts: undefined,
      metro_stations: undefined,
      has_finishing: undefined,
      completion_years: undefined,
      not_first_floor: undefined,
      not_last_floor: undefined,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[400px] pr-1">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Сообщение */}
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[var(--gray-900)] text-white rounded-br-md'
                  : 'bg-[var(--color-bg-gray)] rounded-bl-md'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 flex items-center justify-center bg-[var(--gray-900)] text-white rounded-full text-xs">AI</span>
                    <span className="text-xs font-medium text-[var(--color-text-light)]">ИИ-брокер</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>

            {/* Кнопки быстрого выбора */}
            {msg.quickOptions && msg.quickOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 ml-2">
                {msg.quickOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickOption(opt)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-white border border-[var(--color-border)] rounded-full hover:border-[var(--gray-900)] hover:bg-[var(--color-bg-gray)] transition-colors disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Индикатор загрузки */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-bg-gray)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-[var(--gray-900)] text-white rounded-full text-xs">AI</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--gray-900)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 bg-[var(--gray-900)] text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

      {/* Кнопка сброса */}
      {messages.length > 1 && (
        <button
          onClick={handleReset}
          className="mt-3 text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)] transition-colors text-left"
        >
          ↺ Начать заново
        </button>
      )}
    </div>
  );
}
