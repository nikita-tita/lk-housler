'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@housler/ui';

interface SigningState {
    step: 'loading' | 'viewing' | 'requesting' | 'entering' | 'success' | 'error';
    error?: string;
}

export default function DocumentSignPage() {
    const params = useParams();
    const router = useRouter();
    const [state, setState] = useState<SigningState>({ step: 'loading' });
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [documentUrl, setDocumentUrl] = useState<string>('');

    useEffect(() => {
        // Mock: load document details
        setTimeout(() => {
            setDocumentUrl('/api/placeholder-document.pdf');
            setState({ step: 'viewing' });
        }, 1000);
    }, [params.id]);

    const handleRequestCode = () => {
        setState({ step: 'requesting' });

        // Mock: send SMS code
        setTimeout(() => {
            setState({ step: 'entering' });
        }, 1500);
    };

    const handleCodeChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            nextInput?.focus();
        }

        // Auto-submit when all filled
        if (newCode.every(d => d)) {
            handleSubmit(newCode.join(''));
        }
    };

    const handleSubmit = (fullCode?: string) => {
        const codeToSubmit = fullCode || code.join('');

        if (codeToSubmit.length !== 6) {
            setState({ step: 'error', error: 'Введите полный код' });
            return;
        }

        setState({ step: 'loading' });

        // Mock: verify signature
        setTimeout(() => {
            if (codeToSubmit === '123456' || codeToSubmit.match(/^\d{6}$/)) {
                setState({ step: 'success' });

                // Redirect to deals list after success
                setTimeout(() => {
                    router.push('/client/dashboard');
                }, 2000);
            } else {
                setState({ step: 'error', error: 'Неверный код. Попробуйте ещё раз.' });
                setCode(['', '', '', '', '', '']);
            }
        }, 1000);
    };

    if (state.step === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
            </div>
        );
    }

    if (state.step === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            Документ подписан
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Ваша подпись успешно применена к документу
                        </p>
                        <p className="text-sm text-gray-500">
                            Перенаправление на главную...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-600 hover:text-black text-sm"
                    >
                        ← Назад
                    </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Document Viewer */}
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Документ для подписания</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-gray-100 rounded-lg aspect-[3/4] flex items-center justify-center">
                                    <div className="text-center text-gray-600">
                                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-sm">PDF Viewer (Placeholder)</p>
                                        <p className="text-xs mt-1">Договор оказания услуг</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Signing Panel */}
                    <div className="md:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Подписание</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {state.step === 'viewing' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-600">
                                            Ознакомьтесь с документом. После этого запросите код подтверждения для подписания.
                                        </p>
                                        <Button onClick={handleRequestCode} fullWidth>
                                            Запросить код по SMS
                                        </Button>
                                    </div>
                                )}

                                {state.step === 'requesting' && (
                                    <div className="space-y-4 text-center">
                                        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full mx-auto" />
                                        <p className="text-sm text-gray-600">
                                            Отправляем код на ваш номер...
                                        </p>
                                    </div>
                                )}

                                {state.step === 'entering' && (
                                    <div className="space-y-4">
                                        <div className="text-center mb-4">
                                            <p className="text-sm text-gray-600 mb-2">
                                                Код отправлен на +7 (999) ***-**-67
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Введите 6-значный код
                                            </p>
                                        </div>

                                        <div className="flex gap-2 justify-center">
                                            {code.map((digit, index) => (
                                                <input
                                                    key={index}
                                                    id={`code-${index}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleCodeChange(index, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace' && !digit && index > 0) {
                                                            const prevInput = document.getElementById(`code-${index - 1}`);
                                                            prevInput?.focus();
                                                        }
                                                    }}
                                                    className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                                                />
                                            ))}
                                        </div>

                                        <Button
                                            onClick={() => handleSubmit()}
                                            fullWidth
                                            disabled={code.some(d => !d)}
                                        >
                                            Подписать документ
                                        </Button>

                                        <button
                                            onClick={handleRequestCode}
                                            className="w-full text-sm text-gray-600 hover:text-black"
                                        >
                                            Отправить код повторно
                                        </button>
                                    </div>
                                )}

                                {state.step === 'error' && state.error && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <p className="text-sm text-gray-900">{state.error}</p>
                                        </div>
                                        <Button onClick={() => setState({ step: 'entering' })} fullWidth>
                                            Попробовать снова
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="mt-4">
                            <CardContent className="pt-4">
                                <h3 className="font-medium text-gray-900 mb-2 text-sm">
                                    Что такое ПЭП?
                                </h3>
                                <p className="text-xs text-gray-600">
                                    Простая электронная подпись (ПЭП) по 63-ФЗ. Ваша подпись будет иметь юридическую силу.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
