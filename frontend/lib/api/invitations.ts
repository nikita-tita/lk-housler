import { apiClient } from './client';

// Invitation types
export type InvitationRole = 'coagent' | 'agency';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface InvitationCreate {
  invited_phone: string;
  invited_email?: string;
  role: InvitationRole;
  split_percent: number;
}

export interface InvitationResponse {
  id: string;
  deal_id: string;
  invited_by_user_id: number;
  invited_phone: string;
  invited_email?: string;
  invited_user_id?: number;
  role: InvitationRole;
  split_percent: number;
  status: InvitationStatus;
  expires_at: string;
  responded_at?: string;
  created_at: string;
}

export interface InvitationPublicInfo {
  id: string;
  deal_id: string;
  property_address: string;
  inviter_name: string;
  role: InvitationRole;
  split_percent: number;
  status: InvitationStatus;
  expires_at: string;
  is_expired: boolean;
}

export interface InvitationActionResponse {
  invitation_id: string;
  status: string;
  message: string;
}

// API functions

export async function createInvitation(
  dealId: string,
  data: InvitationCreate
): Promise<InvitationResponse> {
  const { data: response } = await apiClient.post<InvitationResponse>(
    `/bank-split/${dealId}/invite`,
    data
  );
  return response;
}

export async function getDealInvitations(dealId: string): Promise<InvitationResponse[]> {
  const { data } = await apiClient.get<InvitationResponse[]>(
    `/bank-split/${dealId}/invitations`
  );
  return data;
}

export async function cancelInvitation(
  dealId: string,
  invitationId: string
): Promise<InvitationActionResponse> {
  const { data } = await apiClient.delete<InvitationActionResponse>(
    `/bank-split/${dealId}/invitations/${invitationId}`
  );
  return data;
}

// Public (token-based) endpoints

export async function getInvitationByToken(token: string): Promise<InvitationPublicInfo> {
  const { data } = await apiClient.get<InvitationPublicInfo>(`/invitations/${token}`);
  return data;
}

export async function acceptInvitation(token: string): Promise<InvitationActionResponse> {
  const { data } = await apiClient.post<InvitationActionResponse>(
    `/invitations/${token}/accept`
  );
  return data;
}

export async function declineInvitation(
  token: string,
  reason?: string
): Promise<InvitationActionResponse> {
  const { data } = await apiClient.post<InvitationActionResponse>(
    `/invitations/${token}/decline`,
    reason ? { reason } : undefined
  );
  return data;
}

export async function resendInvitation(
  invitationId: string,
  method: 'sms' | 'email' = 'sms'
): Promise<InvitationActionResponse> {
  const { data } = await apiClient.post<InvitationActionResponse>(
    `/invitations/${invitationId}/resend`,
    { method }
  );
  return data;
}

// Role labels for UI
export const INVITATION_ROLE_LABELS: Record<InvitationRole, string> = {
  coagent: 'Со-агент',
  agency: 'Агентство',
};

// Status labels for UI
export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Ожидает ответа',
  accepted: 'Принято',
  declined: 'Отклонено',
  expired: 'Истекло',
  cancelled: 'Отменено',
};
