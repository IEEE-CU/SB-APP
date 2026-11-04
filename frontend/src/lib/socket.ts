import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// The credential is read from the same storage the HTTP client uses, on EVERY connection attempt
// (including Socket.IO's own automatic reconnects) - never captured once when the socket is
// created. So a reconnect after a password change uses the replacement token, and after logout
// there is no token to reconnect with.
const currentToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

export function getSocket(): Socket {
  if (!socket) {
    socket = io(
      import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') ||
        'http://localhost:5000',
      {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        auth: (callback) => callback({ token: currentToken() }),
      },
    );
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

// After a password change the server closes this user's sockets and the old token no longer
// authenticates. Reconnect now (a socket the server closed does not reconnect by itself); the
// new connection reads the replacement token from storage. Mounted pages re-send their room
// joins on the resulting 'connect' (see socketRejoin.ts). Does nothing when no socket exists yet.
export function reconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
