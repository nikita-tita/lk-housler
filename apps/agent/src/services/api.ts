import type {
  OfferListItem,
  OfferDetail,
  OfferFilters,
  PaginationParams,
  PaginatedResponse,
  FilterOptions,
  ApiResponse,
  User,
  FavoriteOffer,
  Selection,
  SelectionDetail,
  SelectionActivity,
  Booking,
  Complex,
  ComplexDetail,
  Client,
  ClientListItem,
  ClientDetail,
  ClientFilters,
  ClientStage,
  FunnelStats,
  CreateClientDto,
  UpdateClientDto,
  ClientActivity,
  Agency,
  FixationWithOffer,
  FixationDetail,
  FixationStats,
  FixationStatus,
  CreateFixationDto,
  DealWithOffer,
  DealDetail,
  DealStats,
  DealStatus,
  CreateDealDto,
  UpdateDealDto,
  FailureWithDetails,
  FailureStats,
  CancellationReason,
  CancellationStage,
  CreateFailureDto,
  AdminUser,
  AdminAgency,
  PlatformStats,
  SelectionGuestContext,
  GuestBookingData,
  SmartSearchRequest,
  SmartSearchResponse,
  ClusterLevel,
  ClusterPath,
  ClustersResponse,
  ExtendedProfile,
  NotificationSettings,
  UpdateProfileDto,
  UpdateNotificationSettingsDto,
  AgentLegalData,
  UpdateLegalDataDto,
  UpdatePassportDataDto,
  AgencySettings,
  UpdateAgencySettingsDto,
  AgencySecuritySettings,
  UpdateAgencySecurityDto,
  AuditLogEntry,
  TeamMember,
  TeamInvitation,
  InvitationPublicInfo,
  SendInvitationDto,
  AcceptInvitationDto,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Token storage helpers
const TOKEN_KEY = 'housler_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...options?.headers,
        },
      });

      const data = await response.json().catch(() => ({ success: false, error: 'Invalid JSON response' }));

      if (!response.ok) {
        // Возвращаем объект с ошибкой вместо throw
        return { success: false, error: data.error || `API Error: ${response.status}` } as T;
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Превышено время ожидания ответа от сервера' } as T;
      }
      return { success: false, error: 'Ошибка сети' } as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Build query string from filters and pagination
  private buildQuery(filters?: OfferFilters, pagination?: PaginationParams): string {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.rooms?.length) {
        filters.rooms.forEach(r => params.append('rooms', r.toString()));
      }
      if (filters.is_studio !== undefined) {
        params.set('is_studio', filters.is_studio.toString());
      }
      if (filters.price_min) params.set('price_min', filters.price_min.toString());
      if (filters.price_max) params.set('price_max', filters.price_max.toString());
      if (filters.area_min) params.set('area_min', filters.area_min.toString());
      if (filters.area_max) params.set('area_max', filters.area_max.toString());
      if (filters.floor_min) params.set('floor_min', filters.floor_min.toString());
      if (filters.floor_max) params.set('floor_max', filters.floor_max.toString());
      if (filters.districts?.length) {
        filters.districts.forEach(d => params.append('districts', d));
      }
      if (filters.metro_stations?.length) {
        filters.metro_stations.forEach(m => params.append('metro_stations', m));
      }
      if (filters.has_finishing !== undefined) {
        params.set('has_finishing', filters.has_finishing.toString());
      }
      if (filters.complexes?.length) {
        filters.complexes.forEach(c => params.append('complexes', c));
      }
      if (filters.complex_id) {
        params.set('complex_id', filters.complex_id.toString());
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.completion_years?.length) {
        filters.completion_years.forEach(y => params.append('completion_years', y.toString()));
      }
      if (filters.developers?.length) {
        filters.developers.forEach(d => params.append('developers', d));
      }
      if (filters.floor_min) params.set('floor_min', filters.floor_min.toString());
      if (filters.floor_max) params.set('floor_max', filters.floor_max.toString());
      if (filters.not_first_floor) params.set('not_first_floor', 'true');
      if (filters.not_last_floor) params.set('not_last_floor', 'true');
      if (filters.kitchen_area_min) params.set('kitchen_area_min', filters.kitchen_area_min.toString());
      if (filters.kitchen_area_max) params.set('kitchen_area_max', filters.kitchen_area_max.toString());
      if (filters.ceiling_height_min) params.set('ceiling_height_min', filters.ceiling_height_min.toString());
      if (filters.bounds) {
        params.set('lat_min', filters.bounds.lat_min.toString());
        params.set('lat_max', filters.bounds.lat_max.toString());
        params.set('lng_min', filters.bounds.lng_min.toString());
        params.set('lng_max', filters.bounds.lng_max.toString());
      }
    }

    if (pagination) {
      if (pagination.page) params.set('page', pagination.page.toString());
      if (pagination.limit) params.set('limit', pagination.limit.toString());
      if (pagination.sort_by) params.set('sort_by', pagination.sort_by);
      if (pagination.sort_order) params.set('sort_order', pagination.sort_order);
    }

    const query = params.toString();
    return query ? `?${query}` : '';
  }

  // Offers
  async getOffers(
    filters?: OfferFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<OfferListItem>>> {
    const query = this.buildQuery(filters, pagination);
    return this.fetch(`/api/offers${query}`);
  }

  async getOfferById(id: number): Promise<ApiResponse<OfferDetail>> {
    return this.fetch(`/api/offers/${id}`);
  }

  async getPriceHistory(offerId: number): Promise<ApiResponse<{ price: number; price_per_sqm: number | null; recorded_at: string }[]>> {
    return this.fetch(`/api/offers/${offerId}/price-history`);
  }

  async getMapMarkers(filters?: OfferFilters): Promise<ApiResponse<{ id: number; lat: number; lng: number; price: number; rooms: number; is_studio: boolean }[]>> {
    const query = this.buildQuery(filters);
    return this.fetch(`/api/offers/map/markers${query}`);
  }

  async getOffersByIds(ids: number[]): Promise<ApiResponse<OfferListItem[]>> {
    return this.fetch('/api/offers/batch', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  // Clusters (Кластерная витрина)
  async getClusters(
    level: ClusterLevel,
    path?: ClusterPath,
    filters?: OfferFilters
  ): Promise<ApiResponse<ClustersResponse>> {
    const params = new URLSearchParams();
    params.set('level', level);

    if (path?.complex_id) params.set('complex_id', path.complex_id.toString());
    if (path?.building_name) params.set('building_name', path.building_name);
    if (path?.rooms !== undefined) params.set('rooms', path.rooms.toString());
    if (path?.is_studio) params.set('is_studio', 'true');
    if (path?.floor_min) params.set('floor_min', path.floor_min.toString());
    if (path?.floor_max) params.set('floor_max', path.floor_max.toString());

    // Добавляем фильтры
    if (filters) {
      if (filters.rooms?.length) {
        filters.rooms.forEach(r => params.append('filter_rooms', r.toString()));
      }
      if (filters.price_min) params.set('price_min', filters.price_min.toString());
      if (filters.price_max) params.set('price_max', filters.price_max.toString());
      if (filters.area_min) params.set('area_min', filters.area_min.toString());
      if (filters.area_max) params.set('area_max', filters.area_max.toString());
      if (filters.districts?.length) {
        filters.districts.forEach(d => params.append('districts', d));
      }
      if (filters.metro_stations?.length) {
        filters.metro_stations.forEach(m => params.append('metro_stations', m));
      }
      if (filters.completion_years?.length) {
        filters.completion_years.forEach(y => params.append('completion_years', y.toString()));
      }
      if (filters.developers?.length) {
        filters.developers.forEach(d => params.append('developers', d));
      }
      if (filters.has_finishing !== undefined) {
        params.set('has_finishing', filters.has_finishing.toString());
      }
    }

    return this.fetch(`/api/offers/clusters?${params.toString()}`);
  }

  // Filters
  async getFilters(): Promise<ApiResponse<FilterOptions>> {
    return this.fetch('/api/filters');
  }

  // ============ AUTH ============
  async requestCode(email: string): Promise<ApiResponse<{
    message: string;
    existingCode?: boolean;
    canResendAt?: string;
  }>> {
    return this.fetch('/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resendCode(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyCode(email: string, code: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.fetch('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  async getMe(): Promise<ApiResponse<User>> {
    return this.fetch('/api/auth/me');
  }

  // ============ SMS AUTH ============
  async requestSmsCode(phone: string): Promise<ApiResponse<{ message: string; existingCode?: boolean; canResendAt?: string }>> {
    return this.fetch('/api/auth/request-sms', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async resendSmsCode(phone: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch('/api/auth/resend-sms', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifySmsCode(phone: string, code: string): Promise<ApiResponse<{ user?: User; token?: string; isNewUser: boolean; message: string }>> {
    return this.fetch('/api/auth/verify-sms', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  }

  // ============ REGISTRATION ============
  async registerRealtor(data: {
    phone: string;
    name: string;
    email: string;
    city?: string;
    isSelfEmployed?: boolean;
    personalInn?: string;
    consents: {
      personalData: boolean;
      terms: boolean;
      realtorOffer: boolean;
      marketing?: boolean;
    };
  }): Promise<ApiResponse<{ user: User; token: string; message: string }>> {
    return this.fetch('/api/auth/register-realtor', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkInn(inn: string): Promise<ApiResponse<{ exists: boolean; agencyName?: string }>> {
    return this.fetch('/api/auth/check-inn', {
      method: 'POST',
      body: JSON.stringify({ inn }),
    });
  }

  async registerAgency(data: {
    inn: string;
    name: string;
    legalAddress: string;
    phone?: string;
    companyEmail?: string;
    contactName: string;
    contactPosition?: string;
    contactPhone: string;
    contactEmail: string;
    password: string;
    consents: {
      personalData: boolean;
      terms: boolean;
      agencyOffer: boolean;
      marketing?: boolean;
    };
  }): Promise<ApiResponse<{ user: User; token: string; message: string }>> {
    return this.fetch('/api/auth/register-agency', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginAgency(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.fetch('/api/auth/login-agency', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // ============ FAVORITES ============
  async getFavorites(): Promise<ApiResponse<FavoriteOffer[]>> {
    return this.fetch('/api/favorites');
  }

  async getFavoriteIds(): Promise<ApiResponse<number[]>> {
    return this.fetch('/api/favorites/ids');
  }

  async addFavorite(offerId: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ offerId }),
    });
  }

  async removeFavorite(offerId: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/favorites/${offerId}`, {
      method: 'DELETE',
    });
  }

  // ============ SELECTIONS ============
  async getSelections(): Promise<ApiResponse<Selection[]>> {
    return this.fetch('/api/selections');
  }

  // Подборки для клиента (где он указан по email)
  async getMySelections(): Promise<ApiResponse<(Selection & { agent_name?: string })[]>> {
    return this.fetch('/api/selections/my');
  }

  async createSelection(data: {
    name: string;
    clientName?: string;
    clientEmail?: string;
    clientId?: number;
  }): Promise<ApiResponse<Selection>> {
    return this.fetch('/api/selections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSelection(id: number): Promise<ApiResponse<SelectionDetail>> {
    return this.fetch(`/api/selections/${id}`);
  }

  async getSharedSelection(code: string): Promise<ApiResponse<SelectionDetail>> {
    return this.fetch(`/api/selections/shared/${code}`);
  }

  // Клиент добавляет объект в подборку по share_code
  async addToSharedSelection(code: string, offerId: number, clientId: string, comment?: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/shared/${code}/items`, {
      method: 'POST',
      body: JSON.stringify({ offerId, clientId, comment }),
    });
  }

  // Клиент удаляет объект из подборки
  async removeFromSharedSelection(code: string, offerId: number, clientId: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/shared/${code}/items/${offerId}`, {
      method: 'DELETE',
      body: JSON.stringify({ clientId }),
    });
  }

  // Записать просмотр подборки
  async recordSelectionView(code: string, clientId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.fetch(`/api/selections/shared/${code}/view`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  }

  async addSelectionItem(selectionId: number, offerId: number, comment?: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/${selectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ offerId, comment }),
    });
  }

  async removeSelectionItem(selectionId: number, offerId: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/${selectionId}/items/${offerId}`, {
      method: 'DELETE',
    });
  }

  async updateSelectionItemStatus(selectionId: number, offerId: number, status: string): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/${selectionId}/items/${offerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateSelection(id: number, data: {
    name?: string;
    clientEmail?: string;
    clientName?: string;
    isPublic?: boolean;
  }): Promise<ApiResponse<Selection>> {
    return this.fetch(`/api/selections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSelection(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/selections/${id}`, {
      method: 'DELETE',
    });
  }

  async getSelectionActivity(id: number): Promise<ApiResponse<SelectionActivity[]>> {
    return this.fetch(`/api/selections/${id}/activity`);
  }

  // ============ BOOKINGS ============
  async createBooking(data: {
    offerId: number;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    comment?: string;
  }): Promise<ApiResponse<Booking>> {
    return this.fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyBookings(): Promise<ApiResponse<Booking[]>> {
    return this.fetch('/api/bookings');
  }

  // ============ CLIENTS CRM ============
  async getClients(filters?: ClientFilters): Promise<ApiResponse<ClientListItem[]>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.hasNextContact) params.set('hasNextContact', 'true');
    const query = params.toString();
    return this.fetch(`/api/clients${query ? `?${query}` : ''}`);
  }

  async createClient(data: CreateClientDto): Promise<ApiResponse<Client>> {
    return this.fetch('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getClient(id: number): Promise<ApiResponse<ClientDetail>> {
    return this.fetch(`/api/clients/${id}`);
  }

  async updateClient(id: number, data: UpdateClientDto): Promise<ApiResponse<Client>> {
    return this.fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  }

  async updateClientStage(id: number, stage: ClientStage): Promise<ApiResponse<Client>> {
    return this.fetch(`/api/clients/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
  }

  async getClientActivity(id: number): Promise<ApiResponse<ClientActivity[]>> {
    return this.fetch(`/api/clients/${id}/activity`);
  }

  async getClientsStats(): Promise<ApiResponse<FunnelStats>> {
    return this.fetch('/api/clients/stats');
  }

  async linkSelectionToClient(clientId: number, selectionId: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/clients/${clientId}/link-selection`, {
      method: 'POST',
      body: JSON.stringify({ selectionId }),
    });
  }

  async recordClientContact(clientId: number, comment?: string): Promise<ApiResponse<Client>> {
    return this.fetch(`/api/clients/${clientId}/contact`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  // ============ COMPLEXES ============
  async getComplexes(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<PaginatedResponse<Complex>>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return this.fetch(`/api/complexes${query ? `?${query}` : ''}`);
  }

  async getComplexById(id: number): Promise<ApiResponse<ComplexDetail>> {
    return this.fetch(`/api/complexes/${id}`);
  }

  // ============ AGENCIES ============
  async getAgencies(): Promise<ApiResponse<Agency[]>> {
    return this.fetch('/api/agencies');
  }

  async getAgencyBySlug(slug: string): Promise<ApiResponse<Agency>> {
    return this.fetch(`/api/agencies/${slug}`);
  }

  async getDefaultAgency(): Promise<ApiResponse<Agency>> {
    return this.fetch('/api/agencies/default');
  }

  async getMyAgencies(): Promise<ApiResponse<Agency[]>> {
    return this.fetch('/api/agencies/my');
  }

  async linkToAgency(slug: string, source: string = 'direct'): Promise<ApiResponse<{ id: number }>> {
    return this.fetch(`/api/agencies/${slug}/link`, {
      method: 'POST',
      body: JSON.stringify({ source }),
    });
  }

  // ============ FIXATIONS ============
  async getFixations(filters?: { status?: FixationStatus; clientId?: number }): Promise<ApiResponse<FixationWithOffer[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.clientId) params.set('clientId', filters.clientId.toString());
    const query = params.toString();
    return this.fetch(`/api/fixations${query ? `?${query}` : ''}`);
  }

  async getFixation(id: number): Promise<ApiResponse<FixationDetail>> {
    return this.fetch(`/api/fixations/${id}`);
  }

  async createFixation(data: CreateFixationDto): Promise<ApiResponse<FixationWithOffer>> {
    return this.fetch('/api/fixations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFixationStatus(id: number, status: FixationStatus, data?: { approvedDays?: number; comment?: string }): Promise<ApiResponse<FixationWithOffer>> {
    return this.fetch(`/api/fixations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...data }),
    });
  }

  async convertFixationToBooking(id: number): Promise<ApiResponse<{ booking_id: number }>> {
    return this.fetch(`/api/fixations/${id}/convert`, {
      method: 'POST',
    });
  }

  async deleteFixation(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/fixations/${id}`, {
      method: 'DELETE',
    });
  }

  async getFixationsStats(): Promise<ApiResponse<FixationStats>> {
    return this.fetch('/api/fixations/stats');
  }

  // ============ DEALS ============
  async getDeals(filters?: { status?: DealStatus; clientId?: number }): Promise<ApiResponse<DealWithOffer[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.clientId) params.set('clientId', filters.clientId.toString());
    const query = params.toString();
    return this.fetch(`/api/deals${query ? `?${query}` : ''}`);
  }

  async getDeal(id: number): Promise<ApiResponse<DealDetail>> {
    return this.fetch(`/api/deals/${id}`);
  }

  async createDeal(data: CreateDealDto): Promise<ApiResponse<DealWithOffer>> {
    return this.fetch('/api/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: number, data: UpdateDealDto): Promise<ApiResponse<DealWithOffer>> {
    return this.fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateDealStatus(id: number, status: DealStatus): Promise<ApiResponse<DealWithOffer>> {
    return this.fetch(`/api/deals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getDealsStats(): Promise<ApiResponse<DealStats>> {
    return this.fetch('/api/deals/stats');
  }

  // ============ FAILURES ============
  async getFailures(filters?: { stage?: CancellationStage; reason?: string }): Promise<ApiResponse<FailureWithDetails[]>> {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.reason) params.set('reason', filters.reason);
    const query = params.toString();
    return this.fetch(`/api/failures${query ? `?${query}` : ''}`);
  }

  async createFailure(data: CreateFailureDto): Promise<ApiResponse<FailureWithDetails>> {
    return this.fetch('/api/failures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCancellationReasons(stage?: CancellationStage): Promise<ApiResponse<CancellationReason[]>> {
    const query = stage ? `?stage=${stage}` : '';
    return this.fetch(`/api/failures/reasons${query}`);
  }

  async getFailuresStats(): Promise<ApiResponse<FailureStats>> {
    return this.fetch('/api/failures/stats');
  }

  // ============ ADMIN ============
  async adminGetUsers(params?: {
    search?: string;
    role?: string;
    is_active?: boolean;
    agency_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    data: AdminUser[];
    pagination: { total: number; limit: number; offset: number };
  }>> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString());
    if (params?.agency_id) searchParams.set('agency_id', params.agency_id.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.fetch(`/api/admin/users${query ? `?${query}` : ''}`);
  }

  async adminGetUser(id: number): Promise<ApiResponse<AdminUser>> {
    return this.fetch(`/api/admin/users/${id}`);
  }

  async adminCreateUser(data: {
    email: string;
    name?: string;
    phone?: string;
    role: string;
    agency_id?: number;
  }): Promise<ApiResponse<User>> {
    return this.fetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateUserRole(id: number, role: string): Promise<ApiResponse<User>> {
    return this.fetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async adminToggleUserActive(id: number, is_active: boolean): Promise<ApiResponse<User>> {
    return this.fetch(`/api/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  }

  async adminSetUserAgency(id: number, agency_id: number | null): Promise<ApiResponse<User>> {
    return this.fetch(`/api/admin/users/${id}/agency`, {
      method: 'PATCH',
      body: JSON.stringify({ agency_id }),
    });
  }

  async adminDeleteUser(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  async adminGetAgencies(params?: {
    search?: string;
    registration_status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    data: AdminAgency[];
    pagination: { total: number; limit: number; offset: number };
  }>> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.registration_status) searchParams.set('registration_status', params.registration_status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.fetch(`/api/admin/agencies${query ? `?${query}` : ''}`);
  }

  async adminGetAgency(id: number): Promise<ApiResponse<AdminAgency>> {
    return this.fetch(`/api/admin/agencies/${id}`);
  }

  async adminUpdateAgencyStatus(id: number, status: string): Promise<ApiResponse<AdminAgency>> {
    return this.fetch(`/api/admin/agencies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async adminGetStats(): Promise<ApiResponse<PlatformStats>> {
    return this.fetch('/api/admin/stats');
  }

  // ============ GUEST MODE ============

  /**
   * Получить контекст подборки для гостевого режима (агент, агентство)
   */
  async getSelectionGuestContext(shareCode: string): Promise<ApiResponse<SelectionGuestContext>> {
    return this.fetch(`/api/selections/shared/${shareCode}/context`);
  }

  /**
   * Создать гостевое бронирование (без авторизации)
   */
  async createGuestBooking(data: GuestBookingData): Promise<ApiResponse<Booking>> {
    return this.fetch('/api/bookings/guest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ SMART SEARCH (AI Broker) ============

  /**
   * Отправить сообщение или ответ в диалоговый поиск
   */
  async smartSearch(request: SmartSearchRequest): Promise<ApiResponse<SmartSearchResponse>> {
    return this.fetch('/api/smart-search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ============ AI BROKER V2 ============

  /**
   * Отправить сообщение в чат с ИИ-брокером (YandexGPT)
   */
  async aiBrokerChat(data: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    currentFilters: Partial<OfferFilters>;
    totalOffers: number;
    conversationId?: string;
  }): Promise<ApiResponse<{
    conversationId: string;
    message: string;
    extractedFilters: Partial<OfferFilters>;
    quickOptions: { label: string; value: string; filters?: Partial<OfferFilters> }[];
    done: boolean;
  }>> {
    return this.fetch('/api/ai-broker/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ SETTINGS ============

  /**
   * Получить расширенный профиль пользователя
   */
  async getSettingsProfile(): Promise<ApiResponse<ExtendedProfile>> {
    return this.fetch('/api/settings/profile');
  }

  /**
   * Обновить профиль пользователя
   */
  async updateSettingsProfile(data: UpdateProfileDto): Promise<ApiResponse<ExtendedProfile>> {
    return this.fetch('/api/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Загрузить аватар профиля
   */
  async uploadProfileAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);

    const token = getStoredToken();
    const response = await fetch(`${API_URL}/api/settings/profile/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    return response.json();
  }

  /**
   * Удалить аватар профиля
   */
  async deleteProfileAvatar(): Promise<ApiResponse<{ avatar_url: null }>> {
    return this.fetch('/api/settings/profile/avatar', {
      method: 'DELETE',
    });
  }

  /**
   * Получить настройки уведомлений
   */
  async getNotificationSettings(): Promise<ApiResponse<NotificationSettings>> {
    return this.fetch('/api/settings/notifications');
  }

  /**
   * Обновить настройки уведомлений
   */
  async updateNotificationSettings(data: UpdateNotificationSettingsDto): Promise<ApiResponse<NotificationSettings>> {
    return this.fetch('/api/settings/notifications', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== Legal Data (Юридические данные агента) ==========

  /**
   * Получить юридические данные (маскированные)
   */
  async getLegalData(): Promise<ApiResponse<AgentLegalData>> {
    return this.fetch('/api/settings/legal');
  }

  /**
   * Обновить юридические данные (ИНН, ОГРНИП, банк)
   */
  async updateLegalData(data: UpdateLegalDataDto): Promise<ApiResponse<AgentLegalData>> {
    return this.fetch('/api/settings/legal', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Обновить паспортные данные (только для СМЗ)
   */
  async updatePassportData(data: UpdatePassportDataDto): Promise<ApiResponse<AgentLegalData>> {
    return this.fetch('/api/settings/legal/passport', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== Agency Settings (Настройки агентства) ==========

  /**
   * Получить настройки агентства
   */
  async getAgencySettings(): Promise<ApiResponse<AgencySettings>> {
    return this.fetch('/api/agency/settings');
  }

  /**
   * Обновить настройки агентства
   */
  async updateAgencySettings(data: UpdateAgencySettingsDto): Promise<ApiResponse<AgencySettings>> {
    return this.fetch('/api/agency/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Загрузить логотип агентства
   */
  async uploadAgencyLogo(file: File): Promise<ApiResponse<{ logo_url: string }>> {
    const formData = new FormData();
    formData.append('logo', file);

    const token = getStoredToken();
    const response = await fetch(`${API_URL}/api/agency/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    return response.json();
  }

  /**
   * Удалить логотип агентства
   */
  async deleteAgencyLogo(): Promise<ApiResponse<{ logo_url: null }>> {
    return this.fetch('/api/agency/logo', {
      method: 'DELETE',
    });
  }

  /**
   * Получить настройки безопасности агентства
   */
  async getAgencySecuritySettings(): Promise<ApiResponse<AgencySecuritySettings>> {
    return this.fetch('/api/agency/security');
  }

  /**
   * Обновить настройки безопасности агентства
   */
  async updateAgencySecuritySettings(data: UpdateAgencySecurityDto): Promise<ApiResponse<AgencySecuritySettings>> {
    return this.fetch('/api/agency/security', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Получить аудит-лог агентства
   */
  async getAgencyAuditLog(params?: {
    action?: string;
    userId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ data: AuditLogEntry[]; total: number }>> {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.userId) searchParams.set('userId', params.userId.toString());
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.fetch(`/api/agency/audit${query ? `?${query}` : ''}`);
  }

  // ========== Team (Команда агентства) ==========

  /**
   * Получить список сотрудников
   */
  async getTeamMembers(): Promise<ApiResponse<TeamMember[]>> {
    return this.fetch('/api/agency/team');
  }

  /**
   * Получить активные приглашения
   */
  async getTeamInvitations(): Promise<ApiResponse<TeamInvitation[]>> {
    return this.fetch('/api/agency/team/invitations');
  }

  /**
   * Отправить приглашение
   */
  async sendTeamInvitation(data: SendInvitationDto): Promise<ApiResponse<TeamInvitation>> {
    return this.fetch('/api/agency/team/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Отменить приглашение
   */
  async cancelTeamInvitation(invitationId: number): Promise<ApiResponse<void>> {
    return this.fetch(`/api/agency/team/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Удалить сотрудника из команды
   */
  async removeTeamMember(userId: number): Promise<ApiResponse<void>> {
    return this.fetch(`/api/agency/team/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Изменить роль сотрудника
   */
  async updateTeamMemberRole(userId: number, role: 'agent' | 'operator'): Promise<ApiResponse<void>> {
    return this.fetch(`/api/agency/team/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Активировать/деактивировать сотрудника
   */
  async toggleTeamMemberActive(userId: number, isActive: boolean): Promise<ApiResponse<void>> {
    return this.fetch(`/api/agency/team/${userId}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // ========== Invitations (Публичные) ==========

  /**
   * Получить информацию о приглашении (публичный)
   */
  async getInvitationInfo(token: string): Promise<ApiResponse<InvitationPublicInfo>> {
    return this.fetch(`/api/invitations/${token}`);
  }

  /**
   * Принять приглашение (публичный)
   */
  async acceptInvitation(token: string, data: AcceptInvitationDto): Promise<ApiResponse<TeamMember>> {
    return this.fetch(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();

// Helper for formatting price
export function formatPrice(price: number): string {
  const rounded = Math.round(price);
  if (rounded >= 1_000_000) {
    const millions = rounded / 1_000_000;
    return `${millions.toFixed(millions % 1 === 0 ? 0 : 1)} млн ₽`;
  }
  return `${rounded.toLocaleString('ru-RU')} ₽`;
}

// Helper for formatting area
export function formatArea(area: number): string {
  return `${area.toFixed(1)} м²`;
}

// Helper for room count display
export function formatRooms(rooms: number | null, isStudio: boolean): string {
  if (isStudio) return 'Студия';
  if (!rooms) return '—';
  if (rooms === 1) return '1 комната';
  if (rooms >= 2 && rooms <= 4) return `${rooms} комнаты`;
  return `${rooms} комнат`;
}

// Helper for floor display
export function formatFloor(floor: number, floorsTotal: number): string {
  return `${floor}/${floorsTotal} этаж`;
}

// Helper for phone formatting: +7 (999) 123-45-67
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Оставляем только цифры
  const digits = phone.replace(/\D/g, '');

  // Если номер начинается с 8, заменяем на 7
  const normalized = digits.startsWith('8') && digits.length === 11
    ? '7' + digits.slice(1)
    : digits;

  // Форматируем 11-значный номер
  if (normalized.length === 11) {
    return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }

  // Для других форматов возвращаем как есть
  return phone;
}
