export type UserRole = 'analyst' | 'collaborator'

export type TicketStatus = 'open' | 'in_progress' | 'pending_response' | 'scheduled' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketType = 'incident' | 'request'
export type TicketArea = 'systems' | 'infrastructure'

export type AssetStatus = 'in_use' | 'stock' | 'returned' | 'maintenance' | 'disposed'
export type AssetType = 'laptop' | 'desktop' | 'monitor' | 'phone' | 'printer' | 'tablet' | 'other'

export type WarrantyStatus = 'none' | 'active' | 'expiring' | 'expired'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  department?: string
  job_title?: string | null
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
  requester_id: string
  assignee_id?: string
  created_at: string
  updated_at: string
  resolved_at?: string
  requester?: Profile
  assignee?: Profile
  assets?: Asset[]
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
