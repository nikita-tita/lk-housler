'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  ContractListItem,
  ContractType,
  getDealContracts,
  generateContract,
  signContract,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  canSignContract,
  hasUserSigned,
  getMissingSigners,
  getSignedSigners,
  isUserRequiredToSign,
  getContractStatusStyle,
} from '@/lib/api/contracts';
import { formatDateTime } from '@/lib/utils/format';

interface ContractSectionProps {
  dealId: string;
  dealStatus: string;
  currentUserId?: number;
  onContractGenerated?: () => void;
}

export function ContractSection({
  dealId,
  dealStatus,
  currentUserId,
  onContractGenerated,
}: ContractSectionProps) {
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedContractType, setSelectedContractType] = useState<ContractType>('bank_split_agent_agreement');

  const loadContracts = useCallback(async () => {
    try {
      const result = await getDealContracts(dealId);
      setContracts(result.items);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleGenerateContract = async () => {
    setGenerating(true);
    setError('');

    try {
      const result = await generateContract(dealId, selectedContractType);
      // Add the new contract to the list
      const newContract: ContractListItem = {
        id: result.id,
        contract_number: result.contract_number,
        contract_type: result.contract_type,
        status: result.status,
        generated_at: result.generated_at,
        expires_at: result.expires_at,
        required_signers: result.required_signers,
      };
      setContracts((prev) => [newContract, ...prev]);
      setShowGenerateModal(false);
      setSuccessMessage('Договор успешно сгенерирован');
      setTimeout(() => setSuccessMessage(''), 5000);
      onContractGenerated?.();
    } catch (err: unknown) {
      console.error('Failed to generate contract:', err);
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Ошибка генерации договора');
    } finally {
      setGenerating(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    if (!currentUserId) return;

    setSigning(contractId);
    setError('');

    try {
      const result = await signContract(contractId);
      setSuccessMessage('Договор успешно подписан');
      setTimeout(() => setSuccessMessage(''), 5000);

      // Reload contracts to get updated status
      await loadContracts();

      if (result.all_signed) {
        onContractGenerated?.();
      }
    } catch (err: unknown) {
      console.error('Failed to sign contract:', err);
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Ошибка подписания договора');
    } finally {
      setSigning(null);
    }
  };

  const canGenerateContract = ['draft', 'awaiting_signatures'].includes(dealStatus);

  // Available contract types for bank-split deals
  const availableContractTypes: ContractType[] = [
    'bank_split_agent_agreement',
    'bank_split_client_agreement',
    'bank_split_agency_agreement',
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Договоры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-black border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Договоры</CardTitle>
            {canGenerateContract && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGenerateModal(true)}
              >
                Создать договор
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-900">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg">
              <p className="text-sm text-gray-900">{error}</p>
            </div>
          )}

          {contracts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Договоры не созданы</p>
              {canGenerateContract && (
                <p className="text-gray-400 text-xs mt-2">
                  Нажмите «Создать договор» для генерации
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  currentUserId={currentUserId}
                  signing={signing === contract.id}
                  onSignClick={() => handleSignContract(contract.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Contract Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Создать договор
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип договора
                </label>
                <select
                  value={selectedContractType}
                  onChange={(e) => setSelectedContractType(e.target.value as ContractType)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {availableContractTypes.map((type) => (
                    <option key={type} value={type}>
                      {CONTRACT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-gray-500">
                Договор будет сгенерирован на основе данных сделки и выбранного шаблона.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowGenerateModal(false)}
                fullWidth
              >
                Отмена
              </Button>
              <Button
                onClick={handleGenerateContract}
                loading={generating}
                fullWidth
              >
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Contract Card Component
interface ContractCardProps {
  contract: ContractListItem;
  currentUserId?: number;
  signing: boolean;
  onSignClick: () => void;
}

function ContractCard({ contract, currentUserId, signing, onSignClick }: ContractCardProps) {
  const canSign = canSignContract(contract);
  const userHasSigned = currentUserId ? hasUserSigned(contract, currentUserId) : false;
  const userRequiredToSign = currentUserId ? isUserRequiredToSign(contract, currentUserId) : false;
  const missingSigners = getMissingSigners(contract);
  const signedSigners = getSignedSigners(contract);
  const needsUserSignature = canSign && userRequiredToSign && !userHasSigned;

  // Role labels
  const ROLE_LABELS: Record<string, string> = {
    agent: 'Агент',
    client: 'Клиент',
    agency: 'Агентство',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">
            {CONTRACT_TYPE_LABELS[contract.contract_type]}
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            {contract.contract_number}
          </p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${getContractStatusStyle(contract.status)}`}
        >
          {CONTRACT_STATUS_LABELS[contract.status]}
        </span>
      </div>

      {/* Signers */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Подписи:</p>
        {signedSigners.length === 0 ? (
          <p className="text-sm text-gray-400">Нет подписей</p>
        ) : (
          <div className="space-y-1">
            {signedSigners.map((signer) => (
              <div key={signer.user_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {ROLE_LABELS[signer.role] || signer.role}
                </span>
                <span className="text-gray-500 text-xs">
                  {signer.signed_at ? formatDateTime(signer.signed_at) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {missingSigners.length > 0 && canSign && (
          <p className="text-xs text-gray-400 mt-2">
            Ожидает подписи: {missingSigners.map(s => ROLE_LABELS[s.role] || s.role).join(', ')}
          </p>
        )}
      </div>

      {/* Generated date */}
      {contract.generated_at && (
        <div className="mb-4">
          <p className="text-xs text-gray-500">
            Создан: {formatDateTime(contract.generated_at)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {needsUserSignature && (
          <Button size="sm" onClick={onSignClick} loading={signing}>
            Подписать
          </Button>
        )}
        {userHasSigned && canSign && (
          <span className="px-3 py-1.5 text-sm text-gray-500">
            Вы подписали
          </span>
        )}
      </div>

      {/* Expiry warning */}
      {contract.expires_at && canSign && (
        <p className="text-xs text-gray-400 mt-3">
          Срок подписания до: {formatDateTime(contract.expires_at)}
        </p>
      )}
    </div>
  );
}

export default ContractSection;
