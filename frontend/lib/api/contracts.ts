import { apiClient } from './client';

// Contract status matching backend
export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'partially_signed'
  | 'fully_signed'
  | 'cancelled'
  | 'expired';

// Contract types for bank-split
export type ContractType =
  | 'secondary_buy'
  | 'secondary_sell'
  | 'newbuild_booking'
  | 'act'
  | 'additional_agreement'
  | 'termination'
  | 'pd_consent'
  | 'bank_split_agent_agreement'
  | 'bank_split_client_agreement'
  | 'bank_split_agency_agreement';

// Signature method
export type SignatureMethod = 'pep_sms' | 'ukep';

// Required signer from backend
export interface RequiredSigner {
  user_id: number;
  role: string;
  signed_at?: string;
}

// Contract response from list endpoint
export interface ContractListItem {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;
  generated_at?: string;
  signed_at?: string;
  expires_at?: string;
  required_signers: RequiredSigner[];
}

// Full contract response from get endpoint
export interface Contract {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;
  html_content?: string;
  document_hash?: string;
  contract_data?: Record<string, unknown>;
  commission_amount?: number;
  generated_at?: string;
  signed_at?: string;
  expires_at?: string;
  required_signers: RequiredSigner[];
}

// Contract list response
export interface ContractsListResponse {
  items: ContractListItem[];
  total: number;
}

// Generate contract response (backend returns flat object)
export interface GenerateContractResponse {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  status: ContractStatus;
  generated_at: string;
  expires_at?: string;
  required_signers: RequiredSigner[];
}

// Sign contract response
export interface SignContractResponse {
  message: string;
  signed_at: string;
  contract_status: ContractStatus;
  all_signed: boolean;
}

// Human-readable labels
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Черновик',
  pending_signature: 'Ожидает подписи',
  partially_signed: 'Частично подписан',
  fully_signed: 'Полностью подписан',
  cancelled: 'Отменен',
  expired: 'Истек',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  secondary_buy: 'Договор на покупку вторички',
  secondary_sell: 'Договор на продажу вторички',
  newbuild_booking: 'Договор бронирования новостройки',
  act: 'Акт выполненных работ',
  additional_agreement: 'Дополнительное соглашение',
  termination: 'Соглашение о расторжении',
  pd_consent: 'Согласие на обработку ПД',
  bank_split_agent_agreement: 'Договор с агентом',
  bank_split_client_agreement: 'Договор с клиентом',
  bank_split_agency_agreement: 'Договор с агентством',
};

export const SIGNATURE_METHOD_LABELS: Record<SignatureMethod, string> = {
  pep_sms: 'ПЭП (SMS)',
  ukep: 'УКЭП',
};

// API functions

/**
 * Get all contracts for a deal
 */
export async function getDealContracts(dealId: string): Promise<ContractsListResponse> {
  const { data } = await apiClient.get<ContractsListResponse>(
    `/bank-split/${dealId}/contracts`
  );
  return data;
}

/**
 * Get a specific contract by ID
 */
export async function getContract(contractId: string): Promise<Contract> {
  const { data } = await apiClient.get<Contract>(`/bank-split/contracts/${contractId}`);
  return data;
}

/**
 * Generate a new contract for a deal
 */
export async function generateContract(
  dealId: string,
  contractType: ContractType = 'bank_split_agent_agreement'
): Promise<GenerateContractResponse> {
  const { data } = await apiClient.post<GenerateContractResponse>(
    `/bank-split/${dealId}/contracts/generate?contract_type=${contractType}`
  );
  return data;
}

/**
 * Get contract PDF URL (redirects to download)
 */
export function getContractPdfUrl(contractId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/bank-split/contracts/${contractId}/download`;
}

/**
 * Sign a contract
 */
export async function signContract(contractId: string): Promise<SignContractResponse> {
  const { data } = await apiClient.post<SignContractResponse>(
    `/bank-split/contracts/${contractId}/sign`
  );
  return data;
}

// Helper functions

/**
 * Check if contract is fully signed
 */
export function isContractFullySigned(contract: ContractListItem | Contract): boolean {
  return contract.status === 'fully_signed';
}

/**
 * Check if contract can be signed
 */
export function canSignContract(contract: ContractListItem | Contract): boolean {
  return ['pending_signature', 'partially_signed'].includes(contract.status);
}

/**
 * Check if user has signed the contract
 */
export function hasUserSigned(contract: ContractListItem | Contract, userId: number): boolean {
  const signer = contract.required_signers.find((s) => s.user_id === userId);
  return signer?.signed_at !== undefined && signer.signed_at !== null;
}

/**
 * Check if user is required to sign the contract
 */
export function isUserRequiredToSign(contract: ContractListItem | Contract, userId: number): boolean {
  return contract.required_signers.some((s) => s.user_id === userId);
}

/**
 * Get missing signers (who hasn't signed yet)
 */
export function getMissingSigners(contract: ContractListItem | Contract): RequiredSigner[] {
  return contract.required_signers.filter((s) => !s.signed_at);
}

/**
 * Get signed signers
 */
export function getSignedSigners(contract: ContractListItem | Contract): RequiredSigner[] {
  return contract.required_signers.filter((s) => s.signed_at);
}

/**
 * Format contract status for display with appropriate styling class
 */
export function getContractStatusStyle(status: ContractStatus): string {
  switch (status) {
    case 'fully_signed':
      return 'bg-gray-900 text-white';
    case 'pending_signature':
    case 'partially_signed':
      return 'bg-gray-200 text-gray-900';
    case 'cancelled':
    case 'expired':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
