'use client';

import React, { ReactNode } from 'react';
import { cn } from './utils';

export interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

/**
 * EmptyState component for displaying empty list states
 * Provides consistent UX when no data is available
 * 
 * @example
 * <EmptyState
 *   title="No deals yet"
 *   description="Create your first deal to get started"
 *   action={<Button>Create Deal</Button>}
 * />
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center',
                className
            )}
        >
            {icon && (
                <div className="mb-4 text-gray-400" aria-hidden="true">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-gray-600 mb-6 max-w-md">{description}</p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
}

// Preset variants for common scenarios
EmptyState.NoDeals = function NoDeals({ action }: { action?: ReactNode }) {
    return (
        <EmptyState
            icon={
                <svg
                    className="w-16 h-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            }
            title="У вас пока нет сделок"
            description="Создайте первую сделку, чтобы начать работу с платформой"
            action={action}
        />
    );
};

EmptyState.NoAgents = function NoAgents({ action }: { action?: ReactNode }) {
    return (
        <EmptyState
            icon={
                <svg
                    className="w-16 h-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                </svg>
            }
            title="Нет агентов в команде"
            description="Пригласите агентов для совместной работы"
            action={action}
        />
    );
};

EmptyState.NoDocuments = function NoDocuments({ action }: { action?: ReactNode }) {
    return (
        <EmptyState
            icon={
                <svg
                    className="w-16 h-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                </svg>
            }
            title="Нет документов"
            description="Документы появятся после создания сделки"
            action={action}
        />
    );
};

EmptyState.SearchEmpty = function SearchEmpty() {
    return (
        <EmptyState
            icon={
                <svg
                    className="w-16 h-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            }
            title="Ничего не найдено"
            description="Попробуйте изменить параметры поиска"
        />
    );
};
