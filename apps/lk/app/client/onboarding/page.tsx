'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@housler/ui';

export default function ClientOnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);

    useEffect(() => {
        // Check if user has seen onboarding
        const hasSeenOnboarding = localStorage.getItem('client_onboarding_seen');
        if (hasSeenOnboarding) {
            router.replace('/client/dashboard');
        }
    }, [router]);

    const handleComplete = () => {
        localStorage.setItem('client_onboarding_seen', 'true');
        router.push('/client/dashboard');
    };

    const handleSkip = () => {
        localStorage.setItem('client_onboarding_seen', 'true');
        router.push('/client/dashboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-2xl w-full">
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">
                            {step === 1 && 'Добро пожаловать в Housler'}
                            {step === 2 && 'Ваши сделки'}
                            {step === 3 && 'Подписание документов'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {step === 1 && (
                            <div className="space-y-6 text-center">
                                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-gray-600 mb-4">
                                        Платформа для безопасных сделок с недвижимостью
                                    </p>
                                    <ul className="text-left space-y-3 max-w-md mx-auto">
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm text-gray-600">
                                                Отслеживайте статус ваших сделок в реальном времени
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm text-gray-600">
                                                Подписывайте документы онлайн с простой электронной подписью
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm text-gray-600">
                                                Безопасные платежи через СБП с защитой от мошенничества
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 text-center">
                                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                        Здесь вы найдёте все свои сделки
                                    </h3>
                                    <p className="text-gray-600 max-w-md mx-auto">
                                        Ваш агент создаст сделку и отправит вам документы для подписания. Вы сможете отследить каждый этап — от подписания до оплаты.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 text-center">
                                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                        Подписание по SMS
                                    </h3>
                                    <p className="text-gray-600 max-w-md mx-auto mb-4">
                                        Для подписания документов мы отправим вам SMS-код на указанный номер. Это простая электронная подпись (ПЭП) по 63-ФЗ — она имеет юридическую силу.
                                    </p>
                                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                                        Никаких сложных настроек — просто введите код из SMS и документ будет подписан.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-between items-center">
                            {step > 1 ? (
                                <Button
                                    variant="secondary"
                                    onClick={() => setStep(step - 1)}
                                >
                                    Назад
                                </Button>
                            ) : (
                                <button
                                    onClick={handleSkip}
                                    className="text-sm text-gray-600 hover:text-black"
                                >
                                    Пропустить
                                </button>
                            )}

                            {step < 3 ? (
                                <Button onClick={() => setStep(step + 1)}>
                                    Далее
                                </Button>
                            ) : (
                                <Button onClick={handleComplete}>
                                    Начать работу
                                </Button>
                            )}
                        </div>

                        <div className="mt-6 flex justify-center gap-2">
                            {[1, 2, 3].map((s) => (
                                <div
                                    key={s}
                                    className={`w-2 h-2 rounded-full ${s === step ? 'bg-gray-900' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
