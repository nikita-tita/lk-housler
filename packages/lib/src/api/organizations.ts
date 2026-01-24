import { apiClient } from './client';

// Agent info in organization
export interface AgentInfo {
  id: number;
  user_id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
}

// List response
export interface AgentListResponse {
  items: AgentInfo[];
  total: number;
}

// Organization info
export interface Organization {
  id: string;
  type: string;
  legal_name: string;
  inn: string;
  status: string;
  created_at: string;
}

/**
 * Get list of user's organizations
 */
export async function getOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<Organization[]>('/organizations');
  return data;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization> {
  const { data } = await apiClient.get<Organization>(`/organizations/${orgId}`);
  return data;
}

/**
 * List agents in organization
 */
export async function getAgents(orgId: string): Promise<AgentListResponse> {
  const { data } = await apiClient.get<AgentListResponse>(`/organizations/${orgId}/agents`);
  return data;
}

/**
 * Add agent to organization by phone
 */
export async function addAgentByPhone(
  orgId: string,
  phone: string,
  role: string = 'agent'
): Promise<AgentInfo> {
  const { data } = await apiClient.post<AgentInfo>(`/organizations/${orgId}/agents`, {
    phone,
    role,
  });
  return data;
}

/**
 * Remove agent from organization
 */
export async function removeAgent(orgId: string, userId: number): Promise<void> {
  await apiClient.delete(`/organizations/${orgId}/agents/${userId}`);
}

// ==========================================
// Employee Invitations
// ==========================================

export interface EmployeeInvitation {
  id: string;
  phone: string;
  name?: string;
  position?: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  inviteToken: string;
  expiresAt: string;
  createdAt: string;
}

export interface EmployeeInvitationCreate {
  phone: string;
  name?: string;
  position?: string;
}

export interface EmployeeInvitationsListResponse {
  items: EmployeeInvitation[];
  total: number;
}

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

/**
 * Get list of pending employee invitations
 */
export async function getEmployeeInvitations(orgId: string): Promise<EmployeeInvitationsListResponse> {
  if (IS_MOCK) {
    console.log('[MOCK] getEmployeeInvitations', orgId);
    return {
      items: [
        {
          id: '1',
          phone: '79999000005',
          name: 'Петров Петр',
          position: 'Риелтор',
          status: 'pending',
          inviteToken: 'mock-token-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    };
  }

  const { data } = await apiClient.get<EmployeeInvitationsListResponse>(
    `/organizations/${orgId}/employee-invitations`
  );
  return data;
}

/**
 * Send employee invitation (creates pending invite + sends SMS)
 */
export async function sendEmployeeInvitation(
  orgId: string,
  data: EmployeeInvitationCreate
): Promise<EmployeeInvitation> {
  if (IS_MOCK) {
    console.log('[MOCK] sendEmployeeInvitation', orgId, data);
    return {
      id: 'mock-' + Date.now(),
      phone: data.phone,
      name: data.name,
      position: data.position,
      status: 'pending',
      inviteToken: 'mock-token-' + Date.now(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  const { data: response } = await apiClient.post<EmployeeInvitation>(
    `/organizations/${orgId}/employee-invitations`,
    data
  );
  return response;
}

/**
 * Cancel employee invitation
 */
export async function cancelEmployeeInvitation(orgId: string, invitationId: string): Promise<void> {
  if (IS_MOCK) {
    console.log('[MOCK] cancelEmployeeInvitation', orgId, invitationId);
    return;
  }

  await apiClient.delete(`/organizations/${orgId}/employee-invitations/${invitationId}`);
}

/**
 * Resend employee invitation SMS
 */
export async function resendEmployeeInvitation(orgId: string, invitationId: string): Promise<void> {
  if (IS_MOCK) {
    console.log('[MOCK] resendEmployeeInvitation', orgId, invitationId);
    return;
  }

  await apiClient.post(`/organizations/${orgId}/employee-invitations/${invitationId}/resend`);
}
