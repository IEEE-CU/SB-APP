export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  societyId?: string;
  roleId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeBearer {
  name: string;
  position: string;
  email?: string;
  phone?: string;
}

export interface Society {
  id: string;
  name: string;
  shortName?: string; // e.g. "CS", "WIE" — used in society logo cards
  logoSlug?: string; // lowercase slug matching /public/logos/{slug}_logo.{ext}
  description?: string;
  chairId?: string;
  budget?: number;
  balance?: number;
  officeBearers?: OfficeBearer[];
  memberIds: string[];
  createdAt: string;
  slug?: string;
  category?: string;
  websiteUrl?: string;
}

export interface Event {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  societyId?: string;
  societyName?: string;
  date?: string;
  time?: string;
  location?: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdAt: string;
  capacity?: number;
  rsvpCount?: number;
  speakers?: { name: string; role: string; organization?: string }[];
  budget?: number;
  category?: string;
}

export interface Project {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  societyId?: string;
  societyName?: string;
  status: "planning" | "active" | "completed" | "on_hold";
  memberIds: string[];
  createdAt: string;
  techStack?: string[];
  githubUrl?: string;
  demoUrl?: string;
  progress?: number;
  milestones?: { title: string; completed: boolean }[];
}

export interface Report {
  id: string;
  title: string;
  slug?: string;
  content?: string;
  societyId?: string;
  societyName?: string;
  authorId?: string;
  authorName?: string;
  type?: "financial" | "activity" | "general";
  createdAt: string;
  status?: "draft" | "under_review" | "approved" | "archived";
  downloadUrl?: string;
  summary?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  societyId?: string;
  authorId?: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
}

export interface CommunityMessage {
  id: string;
  content: string;
  authorId: string;
  societyId?: string;
  createdAt: string;
}

export interface Permission {
  module: string;
  action: string;
  accessLevel: AccessLevel;
}

export type AccessLevel = "none" | "read" | "write" | "admin" | "superadmin";

// Channels and Messaging types
export interface Reaction {
  emoji: string;
  users: string[]; // User IDs who reacted
}

export interface Message {
  id: string;
  channelId?: string;
  conversationId?: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string;
  attachments?: string[];
  parentId?: string; // For replies / thread support
  replies?: Message[];
  reactions: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  societyId?: string; // Optional links to societies
  /** Discriminates chat channels from kanban board channels. Backend defaults to "chat". */
  type?: "chat" | "board";
  icon?: string;
  categoryName?: string;
  isPrivate: boolean;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
    avatarUrl?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message;
}

// Unified Calendar types
export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO string format
  time?: string;
  venue?: string;
  source?: "CalendarEvent" | "Event" | "Message" | "BoardCard";
  sourceType?: string;
  status?: string;
  priority?: string;
  society?: { id: string; name: string; shortName?: string };
  metadata?: Record<string, any>;
}
