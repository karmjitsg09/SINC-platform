/**
 * SINC Platform — Core TypeScript Type Definitions
 * Phase 3: Type Safety System
 */

// 1. Auth Types
export type AuthEventType = 'login' | 'session_restored' | null;

export interface AuthEvent {
  id: string;
  type: 'login' | 'session_restored';
  timestamp: number;
}

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    [key: string]: any;
  };
}

// 2. User & Profile Models
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  role?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  domains?: string[] | null;
  headline?: string | null;
  is_verified?: boolean;
  onboarding_completed?: boolean;
  profile_setup_completed_steps?: number[];
  isNewUser?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPrivateDetails {
  user_id: string;
  privacy_settings?: {
    profile_visibility?: 'public' | 'connections' | 'private';
    show_email?: boolean;
    show_location?: boolean;
    allow_dms?: boolean;
  };
  date_of_birth?: string | null;
  gender?: string | null;
  gender_custom?: string | null;
  location_address?: string | null;
  location_area?: string | null;
  location_landmark?: string | null;
  location_pincode?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  updated_at?: string;
}

// 3. Post & Interaction Models
export interface PostMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  aspect_ratio?: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string | null;
  author_role?: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
  media?: PostMediaItem[];
  tags?: string[];
  visibility?: 'public' | 'connections';
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_username: string;
  author_avatar?: string | null;
  content: string;
  created_at: string;
  likes_count?: number;
}

export interface PostInsights {
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  shares: number;
  saves: number;
}

// 4. Messaging & Realtime Models
export interface ConversationMember {
  user_id: string;
  last_read_at?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  members: string[];
  otherUser?: {
    id: string;
    name: string;
    username: string;
    role?: string;
    avatarUrl?: string | null;
  };
  lastMessage?: string;
  time?: string;
  unreadCount?: number;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  type: 'sent' | 'received';
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface DomainMessage {
  id: string;
  domain_id: string;
  channel_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string | null;
  text: string;
  created_at: string;
}

export interface TypingStatus {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface PresenceStatus {
  userId: string;
  status: 'online' | 'offline';
  timestamp: number;
}

// 5. Notifications
export interface AppNotification {
  id: string;
  user_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string | null;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'mention' | 'message';
  content: string;
  target_id?: string;
  target_type?: 'post' | 'comment' | 'profile' | 'message';
  read: boolean;
  created_at: string;
}

// 6. Section Items (Profile Portfolios)
export interface ProjectItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  role?: string;
  link?: string;
  skills?: string[];
  created_at?: string;
}

export interface ExperienceItem {
  id: string;
  user_id: string;
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
}

export interface EducationItem {
  id: string;
  user_id: string;
  institution: string;
  degree: string;
  field_of_study?: string;
  start_year: string;
  end_year?: string;
}

export interface CertificationItem {
  id: string;
  user_id: string;
  name: string;
  issuing_organization: string;
  issue_date: string;
  expiration_date?: string;
  credential_id?: string;
  credential_url?: string;
}

export interface AchievementItem {
  id: string;
  user_id: string;
  title: string;
  issuer: string;
  date: string;
  description?: string;
}

// 7. Domain Ecosystem Models
export interface DomainChannel {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  unread?: number;
}

export interface DomainItem {
  id: string;
  name: string;
  iconType?: string;
  feed?: {
    descriptionTop?: string;
    [key: string]: any;
  };
  channels?: DomainChannel[];
  [key: string]: any;
}

