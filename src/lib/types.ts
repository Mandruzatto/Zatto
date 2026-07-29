export type UserRole = 'analyst' | 'collaborator'

export type TicketStatus = 'open' | 'awaiting_approval' | 'in_progress' | 'pending' | 'scheduled' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketType = 'incident' | 'request'
export type TicketArea = 'systems' | 'infrastructure'

export type AssetStatus = 'in_use' | 'stock' | 'returned' | 'maintenance' | 'disposed'
export type AssetType = 'laptop' | 'desktop' | 'monitor' | 'phone' | 'printer' | 'tablet' | 'other'

export type WarrantyStatus = 'none' | 'active' | 'expiring' | 'expired'
export type ApprovalStatus = 'not_required' | 'pending_assignment' | 'pending' | 'approved' | 'rejected' | 'cancelled'
export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type KnowledgeStatus = 'draft' | 'published' | 'archived'

export interface CatalogField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  options?: string[]
}

export interface ServiceCatalogItem {
  id: string
  slug: string
  title: string
  description: string
  instructions?: string | null
  keywords: string[]
  area?: TicketArea | null
  category: string
  default_priority: TicketPriority
  default_type: TicketType
  requires_approval: boolean
  form_schema: CatalogField[]
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeCategory {
  id: string
  name: string
  slug: string
  description?: string | null
}

export interface KnowledgeArticle {
  id: string
  category_id?: string | null
  author_id?: string | null
  title: string
  slug: string
  summary: string
  content: string
  keywords: string[]
  status: KnowledgeStatus
  published_at?: string | null
  view_count: number
  helpful_count: number
  not_helpful_count: number
  category?: KnowledgeCategory | null
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  department?: string
  job_title?: string | null
  manager_id?: string | null
  can_approve?: boolean
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  ticket_number: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  area?: TicketArea | null
  resolution?: string | null
  pending_reason?: string | null
  scheduled_for?: string | null
  catalog_item_id?: string | null
  form_responses?: Record<string, string>
  approval_status?: ApprovalStatus
  sla_policy_id?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  first_responded_at?: string | null
  requester_id: string
  assignee_id?: string
  created_at: string
  updated_at: string
  resolved_at?: string
  requester?: Profile
  assignee?: Profile
  assets?: Asset[]
}

export interface TicketApproval {
  id: string
  ticket_id: string
  approver_id?: string | null
  assigned_by?: string | null
  decision: ApprovalDecision
  comment?: string | null
  requested_at: string
  decided_at?: string | null
  approver?: Profile | null
  ticket?: Ticket
}

export interface Asset {
  id: string
  asset_tag: string
  name: string
  type: AssetType
  brand?: string
  model?: string
  serial_number?: string
  phone_line?: string | null
  status: AssetStatus
  purchase_date?: string
  warranty_end_date?: string
  notes?: string
  created_at: string
  updated_at: string
  current_holder?: Profile
}

export interface AssetAssignment {
  id: string
  asset_id: string
  user_id: string
  assigned_at: string
  returned_at?: string
  notes?: string
  asset?: Asset
  user?: Profile
}

export interface TicketAsset {
  ticket_id: string
  asset_id: string
  asset?: Asset
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  content: string
  is_internal: boolean
  created_at: string
  author?: Profile
}
