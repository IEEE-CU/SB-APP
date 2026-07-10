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

export interface Society {
  id: string;
  name: string;
  shortName?: string;   // e.g. "CS", "WIE" — used in society logo cards
  logoSlug?: string;    // lowercase slug matching /public/logos/{slug}_logo.{ext}
  description?: string;
  chairId?: string;
  memberIds: string[];
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  societyId?: string;
  date?: string;
  location?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  societyId?: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  memberIds: string[];
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  content?: string;
  societyId?: string;
  authorId?: string;
  type?: 'financial' | 'activity' | 'general';
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  societyId?: string;
  authorId?: string;
  priority: 'low' | 'medium' | 'high';
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

export type AccessLevel = 'none' | 'read' | 'write' | 'admin' | 'superadmin';
