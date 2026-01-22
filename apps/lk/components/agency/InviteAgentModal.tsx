'use client';

import { useState } from 'react';
import { Modal, Button, Input, Select } from '@housler/ui';
import { z } from 'zod';

const inviteSchema = z.object({
    contact: z.string().min(5, 'Введите email или телефон'),
    role: z.enum(['agent', 'admin'], {
        required_error: 'Выберите роль',
        invalid_type_error: 'Неверная роль',
    }),
});

type InviteData = z.infer<typeof inviteSchema>;

interface InviteAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function InviteAgentModal({ isOpen, onClose, onSuccess }: InviteAgentModalProps) {
    const [formData, setFormData] = useState<Partial<InviteData>>({
        role: 'agent',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        try {
            inviteSchema.parse(formData);
            setLoading(true);

            // Mock API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Success callback
            onSuccess?.();

            // Reset form and close
            setFormData({ role: 'agent' });
            onClose();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                error.errors.forEach((err) => {
                    if (err.path[0]) {
                        newErrors[err.path[0] as string] = err.message;
                    }
                });
                setErrors(newErrors);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Пригласить агента">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        Email или телефон
                    </label>
                    <Input
                        value={formData.contact || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, contact: e.target.value })
                        }
                        placeholder="example@mail.ru или +79991234567"
                    />
                    {errors.contact && (
                        <p className="text-sm text-gray-900 mt-1">{errors.contact}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        Роль
                    </label>
                    <Select
                        value={formData.role || 'agent'}
                        onChange={(e) =>
                            setFormData({ ...formData, role: e.target.value as InviteData['role'] })
                        }
                    >
                        <option value="agent">Агент</option>
                        <option value="admin">Администратор</option>
                    </Select>
                    {errors.role && (
                        <p className="text-sm text-gray-900 mt-1">{errors.role}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-2">
                        {formData.role === 'agent'
                            ? 'Агент может создавать сделки и работать с клиентами'
                            : 'Администратор имеет полный доступ к управлению агентством'}
                    </p>
                </div>

                <Modal.Footer>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Отмена
                    </Button>
                    <Button type="submit" loading={loading}>
                        Отправить приглашение
                    </Button>
                </Modal.Footer>
            </form>
        </Modal>
    );
}
