// Socket.IO rooms live on the server and are lost whenever the connection is. After a
// reconnect (network drop, server restart, or the reconnect that follows a password change)
// the client is a brand-new socket that is in no room, so a page that stays mounted must ask
// to join its rooms again. This runs `join` now if the socket is already connected and again
// on every later 'connect', and returns the cleanup that removes the listener.
//
// Nothing here decides which rooms are allowed: `join` re-sends the same request the page made
// originally and the server authorizes every join again (permissions, society scope,
// conversation participation); a refused join simply gets no room. If the socket is not
// connected yet, no request is sent until it connects, so the first connection joins once.
// No imports: plain logic that can be tested without a browser.

export interface RejoinableSocket {
  connected: boolean;
  on(event: string, handler: () => void): unknown;
  off(event: string, handler: () => void): unknown;
}

export function rejoinOnConnect(socket: RejoinableSocket, join: () => void): () => void {
  if (socket.connected) join();
  socket.on('connect', join);
  return () => {
    socket.off('connect', join);
  };
}
