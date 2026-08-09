import { create } from 'zustand';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface PresenceState {
  userStatuses: Record<string, UserStatus>;
  typingUsers: Record<string, Set<string>>; // channelId -> Set of user names/IDs
  setStatus: (userId: string, status: UserStatus) => void;
  setTyping: (channelId: string, username: string, isTyping: boolean) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  userStatuses: {},
  typingUsers: {},
  setStatus: (userId, status) =>
    set((state) => ({
      userStatuses: { ...state.userStatuses, [userId]: status },
    })),
  setTyping: (channelId, username, isTyping) =>
    set((state) => {
      const channelSet = new Set(state.typingUsers[channelId] || []);
      if (isTyping) {
        channelSet.add(username);
      } else {
        channelSet.delete(username);
      }
      return {
        typingUsers: { ...state.typingUsers, [channelId]: channelSet },
      };
    }),
}));
