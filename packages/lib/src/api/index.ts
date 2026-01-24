// Exports from admin.ts
export * from './admin';

// Exports from analytics.ts
export * from './analytics';

// Exports from auth.ts
export type {
  AuthResponse,
  SendSmsResult,
  SendEmailResult,
  AgentRegisterData,
  ClientRegisterData,
  AgencyRegisterData,
  EmployeeInviteInfo,
  EmployeeRegisterData,
  ConsentInput,
} from './auth';

export {
  sendSMS,
  verifySMS,
  sendEmail,
  verifyEmail,
  loginAgency,
  getCurrentUser,
  registerAgent,
  registerClient,
  registerAgency,
  getEmployeeInvite,
  registerEmployee,
} from './auth';

// Exports from bank-split.ts
export type {
  BankSplitDealType, // Enum or Type? Assuming Enum creates value. If Enum, do not use type.
  BankSplitStatus, // Enum likely
  PaymentModel,
  RecipientRole, // Type
  RecipientInput,
  Recipient,
  BankSplitDealCreate,
  BankSplitDeal,
  InvoiceResponse,
  BankSplitDealsListResponse,
  SendPaymentLinkResponse,
  RegeneratePaymentLinkResponse,
  DisputeCreateRequest,
  DisputeResponse,
  ServiceCompletionRequest,
  ServiceCompletionResponse,
  ServiceCompletionStatus, // Enum?
  SplitAdjustmentApproval,
  SplitAdjustment,
  SplitAdjustmentCreateRequest,
  SplitAdjustmentCreateResponse,
  SplitAdjustmentsListResponse,
  ClientPassportUpdate,
  ClientPassportResponse,
  ClientPassportStatus, // Enum?
  TimelineEvent,
} from './bank-split';

export {
  createBankSplitDeal,
  getBankSplitDeal,
  getBankSplitDeals,
  submitForSigning,
  markSigned,
  createInvoice,
  releaseDeal,
  cancelBankSplitDeal,
  getDealTimeline,
  sendPaymentLink,
  regeneratePaymentLink,
  createDispute,
  getDispute,
  confirmServiceCompletion,
  getServiceCompletionStatus,
  requestSplitAdjustment,
  getSplitAdjustments,
  approveSplitAdjustment,
  rejectSplitAdjustment,
  updateClientPassport,
  getClientPassportStatus,
  // Enums/Constants
  BANK_SPLIT_STATUS_LABELS,
  BANK_SPLIT_STATUS_STYLES,
  RECIPIENT_ROLE_LABELS,
  ADJUSTMENT_STATUS_LABELS,
  ADJUSTMENT_STATUS_STYLES,
} from './bank-split';

// Exports from client.ts
export { apiClient, authClient } from './client';

// Exports from contracts.ts
export type {
  ContractType,
  SignatureMethod,
  RequiredSigner,
  ContractListItem,
  Contract,
  ContractsListResponse,
  GenerateContractResponse,
  SignContractResponse,
  ContractStatus,
} from './contracts';

export {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  SIGNATURE_METHOD_LABELS,
  getDealContracts,
  getContract,
  generateContract,
  getContractPdfUrl,
  signContract,
  isContractFullySigned,
  canSignContract,
  hasUserSigned,
  isUserRequiredToSign,
  getMissingSigners,
  getSignedSigners,
  getContractStatusStyle,
} from './contracts';

// Exports from deals.ts
export type {
  DealType, // Enum?
  PropertyType, // Enum?
  PaymentType, // Enum?
  DealStatus, // Enum?
  DealCreateSimple,
  CommissionCalculateRequest,
  PaymentStep,
  CommissionCalculateResponse,
  Deal,
  DealsListResponse,
  SendForSigningResponse,
  AdvanceType,
  AddressInput,
} from './deals';

export {
  getDeals,
  getAgencyDeals,
  getDeal,
  createDeal,
  updateDeal,
  submitDeal,
  cancelDeal,
  sendForSigning,
  calculateCommission,
  DEAL_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  ADVANCE_TYPE_LABELS,
} from './deals';

// Exports from invitations.ts
export type {
  InvitationRole,
  InvitationStatus,
  InvitationCreate,
  InvitationResponse,
  InvitationPublicInfo,
  InvitationActionResponse,
} from './invitations';

export {
  createInvitation,
  getDealInvitations,
  cancelInvitation,
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  resendInvitation,
  INVITATION_ROLE_LABELS,
  INVITATION_STATUS_LABELS,
} from './invitations';

// Exports from organizations.ts
export type {
  AgentInfo,
  AgentListResponse,
  Organization,
  EmployeeInvitation,
  EmployeeInvitationCreate,
  EmployeeInvitationsListResponse,
} from './organizations';

export {
  getOrganizations,
  getOrganization,
  getAgents,
  addAgentByPhone,
  removeAgent,
  getEmployeeInvitations,
  sendEmployeeInvitation,
  cancelEmployeeInvitation,
  resendEmployeeInvitation,
} from './organizations';

// Exports from profile.ts
export type {
  LegalType,
  OnboardingStatus,
  KYCStatus,
  PaymentProfile,
  PaymentProfileListResponse,
  OnboardingStartRequest,
  OnboardingStartResponse,
  OnboardingStatusResponse,
  INNValidationResponse,
  BankAutofillResponse,
  CompanyAutofillResponse,
  SettingsProfileResponse,
  AvatarUploadResponse,
} from './profile';

export {
  LEGAL_TYPE_LABELS,
  ONBOARDING_STATUS_LABELS,
  KYC_STATUS_LABELS,
  getPaymentProfiles,
  getPaymentProfile,
  startOnboarding,
  getOnboardingStatus,
  validateINN,
  autofillBankByBIK,
  autofillCompanyByINN,
  getSettingsProfile,
  updateSettingsProfile,
  uploadProfileAvatar,
  deleteProfileAvatar,
} from './profile';

// Exports from signing.ts
export type {
  SigningInfo,
  RequestOTPResponse,
} from './signing';

export {
  getSigningInfo,
  requestSigningOTP,
  verifyAndSign,
  formatDealType,
  formatPartyRole,
} from './signing';

// Exports from users.ts
export type {
  UserSearchResult,
} from './users';

export {
  searchUserByPhone,
} from './users';