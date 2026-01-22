'use client';

import React from 'react';
import { cn } from './utils';

export interface StepperProps {
    steps: string[];
    currentStep: number;
    onStepClick?: (step: number) => void;
    clickable?: boolean;
    className?: string;
}

/**
 * Stepper component for multi-step forms/wizards
 * Shows progress and allows navigation between steps
 * 
 * @example
 * <Stepper
 *   steps={['Property', 'Participants', 'Commission']}
 *   currentStep={1}
 *   onStepClick={(step) => setCurrentStep(step)}
 *   clickable
 * />
 */
export function Stepper({
    steps,
    currentStep,
    onStepClick,
    clickable = false,
    className,
}: StepperProps) {
    return (
        <nav aria-label="Progress" className={className}>
            <ol className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isCurrent = stepNumber === currentStep;
                    const isUpcoming = stepNumber > currentStep;
                    const isClickable = clickable && (isCompleted || isCurrent);

                    return (
                        <li
                            key={step}
                            className={cn(
                                'flex items-center',
                                index !== steps.length - 1 && 'flex-1'
                            )}
                        >
                            {/* Step circle */}
                            <button
                                type="button"
                                onClick={() => isClickable && onStepClick?.(stepNumber)}
                                disabled={!isClickable}
                                className={cn(
                                    'flex items-center gap-2 transition-colors',
                                    isClickable && 'cursor-pointer hover:opacity-80',
                                    !isClickable && 'cursor-default'
                                )}
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                <div
                                    className={cn(
                                        'flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors',
                                        isCompleted && 'bg-gray-900 text-white',
                                        isCurrent && 'bg-gray-900 text-white ring-4 ring-gray-200',
                                        isUpcoming && 'bg-gray-200 text-gray-600'
                                    )}
                                >
                                    {isCompleted ? (
                                        <svg
                                            className="w-5 h-5"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    ) : (
                                        stepNumber
                                    )}
                                </div>

                                {/* Step label (hidden on mobile) */}
                                <span
                                    className={cn(
                                        'hidden md:block text-sm font-medium transition-colors',
                                        isCompleted && 'text-gray-900',
                                        isCurrent && 'text-gray-900',
                                        isUpcoming && 'text-gray-600'
                                    )}
                                >
                                    {step}
                                </span>
                            </button>

                            {/* Connector line */}
                            {index !== steps.length - 1 && (
                                <div
                                    className={cn(
                                        'flex-1 h-0.5 mx-2 md:mx-4 transition-colors',
                                        isCompleted ? 'bg-gray-900' : 'bg-gray-200'
                                    )}
                                    aria-hidden="true"
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

// Vertical variant for sidebar layouts
Stepper.Vertical = function VerticalStepper({
    steps,
    currentStep,
    onStepClick,
    clickable = false,
    className,
}: StepperProps) {
    return (
        <nav aria-label="Progress" className={className}>
            <ol className="space-y-4">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isCurrent = stepNumber === currentStep;
                    const isUpcoming = stepNumber > currentStep;
                    const isClickable = clickable && (isCompleted || isCurrent);

                    return (
                        <li key={step} className="flex items-start">
                            <button
                                type="button"
                                onClick={() => isClickable && onStepClick?.(stepNumber)}
                                disabled={!isClickable}
                                className={cn(
                                    'flex items-start gap-3 w-full text-left transition-colors',
                                    isClickable && 'cursor-pointer hover:opacity-80',
                                    !isClickable && 'cursor-default'
                                )}
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                <div
                                    className={cn(
                                        'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                                        isCompleted && 'bg-gray-900 text-white',
                                        isCurrent && 'bg-gray-900 text-white ring-4 ring-gray-200',
                                        isUpcoming && 'bg-gray-200 text-gray-600'
                                    )}
                                >
                                    {isCompleted ? (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    ) : (
                                        stepNumber
                                    )}
                                </div>
                                <div className="pt-1">
                                    <p
                                        className={cn(
                                            'text-sm font-medium transition-colors',
                                            isCompleted && 'text-gray-900',
                                            isCurrent && 'text-gray-900',
                                            isUpcoming && 'text-gray-600'
                                        )}
                                    >
                                        {step}
                                    </p>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
