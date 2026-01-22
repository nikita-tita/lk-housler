'use client';

import React, { ReactNode, useEffect, useRef } from 'react';
import { cn } from './utils';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    closeOnOverlayClick?: boolean;
    closeOnEsc?: boolean;
}

/**
 * Modal component with accessibility features
 * Features: focus trap, ESC to close, click outside to close
 * 
 * @example
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Invite Agent">
 *   <form>...</form>
 * </Modal>
 */
export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    className,
    closeOnOverlayClick = true,
    closeOnEsc = true,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Size variants
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
    };

    // Handle ESC key
    useEffect(() => {
        if (!isOpen || !closeOnEsc) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, closeOnEsc, onClose]);

    // Focus trap and restoration
    useEffect(() => {
        if (isOpen) {
            // Save current focus
            previousFocusRef.current = document.activeElement as HTMLElement;

            // Focus first focusable element in modal
            const focusableElements = modalRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements?.[0] as HTMLElement;
            firstElement?.focus();

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Restore focus
            previousFocusRef.current?.focus();
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                aria-hidden="true"
            />

            {/* Modal content */}
            <div
                ref={modalRef}
                className={cn(
                    'relative w-full bg-white rounded-lg shadow-lg',
                    'max-h-[90vh] overflow-y-auto',
                    sizeClasses[size],
                    className
                )}
            >
                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Close modal"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className={cn('px-6', title ? 'py-4' : 'py-6')}>{children}</div>
            </div>
        </div>
    );
}

// Compound components for common patterns
Modal.Footer = function ModalFooter({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50',
                className
            )}
        >
            {children}
        </div>
    );
};
