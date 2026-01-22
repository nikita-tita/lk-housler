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
