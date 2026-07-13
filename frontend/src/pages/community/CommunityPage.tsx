import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { communityService } from '@/services/community';
import { Button, LoadingSpinner } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { getSocket, connectSocket } from '@/lib/socket';
import type { CommunityMessage } from '@/types/models';
import toast from 'react-hot-toast';

export default function CommunityPage() {
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { token, user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    communityService.getMessages().then((res) => {
      setMessages(res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    connectSocket(token);
    const socket = getSocket();
    socket.on('community:message', (msg: CommunityMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => { socket.off('community:message'); };
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await communityService.sendMessage(newMessage.trim());
      setMessages((prev) => [...prev, res.data.data]);
      setNewMessage('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-heading-1 font-bold text-ink mb-4">Community Hub</h1>
      <div className="flex-1 overflow-auto bg-surface rounded-lg border border-hairline p-4 space-y-3">
        {messages.length === 0 && <p className="text-body-sm text-ink-muted text-center py-8">No messages yet. Start the conversation!</p>}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.authorId === user?.id ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.authorId === user?.id ? 'bg-primary text-on-primary' : 'bg-canvas-soft text-ink'}`}>
              <div className="text-body-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }} />
            </div>
            <p className="text-caption text-ink-faint mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>Send</Button>
      </div>
    </div>
  );
}
