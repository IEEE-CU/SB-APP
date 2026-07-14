import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { channelsService } from '@/services/channels';
import { conversationsService } from '@/services/conversations';
import { userService } from '@/services/users';
import { Button, LoadingSpinner } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { getSocket, connectSocket } from '@/lib/socket';
import type { Channel, Conversation, Message, User } from '@/types/models';
import toast from 'react-hot-toast';
import { Hash, Lock, MessageSquare, Send, Plus, Reply } from 'lucide-react';

export default function CommunityPage() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // List data
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Selection states
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Message & Typing states
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> name
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isTypingRef = useRef(false);
  const lastTypingTimeRef = useRef<number>(0);

  // Modal / Create states
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [newChannelCategory, setNewChannelCategory] = useState('');

  const [showCreateDm, setShowCreateDm] = useState(false);

  // Poll creation states
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial lists
  useEffect(() => {
    const initData = async () => {
      try {
        const [chanRes, convRes, userRes] = await Promise.all([
          channelsService.getChannels(),
          conversationsService.getConversations(),
          userService.getUsers(1, 100),
        ]);
        setChannels(chanRes.data.data || []);
        setConversations(convRes.data.data || []);
        setAllUsers((userRes.data as any).data || []);
        
        // Auto-select first channel if exists
        const firstChan = chanRes.data.data?.[0];
        if (firstChan) {
          setSelectedChannel(firstChan);
        }
      } catch (err) {
        toast.error('Failed to load community data');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Socket setup for real-time events
  useEffect(() => {
    if (!token) return;
    connectSocket(token);
    const socket = getSocket();

    // Joint channel / DM rooms
    if (selectedChannel) {
      socket.emit('channel:join', selectedChannel.id);
    }
    if (selectedConversation) {
      socket.emit('conversation:join', selectedConversation.id);
    }

    // Handlers
    const handleNewMessage = (msg: Message) => {
      if (selectedChannel && msg.channelId === selectedChannel.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else if (selectedConversation && msg.conversationId === selectedConversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleReactionUpdate = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
      );
    };

    const handleTypingStart = ({ userId, userName, channelId, conversationId }: any) => {
      if (userId === user?.id) return;
      if (
        (selectedChannel && channelId === selectedChannel.id) ||
        (selectedConversation && conversationId === selectedConversation.id)
      ) {
        setTypingUsers((prev) => ({ ...prev, [userId]: userName }));

        // Clear existing timeout if any
        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }

        // Set automatic stop after 3 seconds
        typingTimeoutRef.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }, 3000);
      }
    };

    const handleTypingStop = ({ userId }: any) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handlePollUpdate = (updatedMsg: Message) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:reply', handleNewMessage);
    socket.on('message:reactions', handleReactionUpdate);
    socket.on('message:poll:update', handlePollUpdate);
    socket.on('typing-start', handleTypingStart);
    socket.on('typing-stop', handleTypingStop);

    return () => {
      if (selectedChannel) {
        socket.emit('channel:leave', selectedChannel.id);
      }
      if (selectedConversation) {
        socket.emit('conversation:leave', selectedConversation.id);
      }
      socket.off('message:new', handleNewMessage);
      socket.off('message:reply', handleNewMessage);
      socket.off('message:reactions', handleReactionUpdate);
      socket.off('message:poll:update', handlePollUpdate);
      socket.off('typing-start', handleTypingStart);
      socket.off('typing-stop', handleTypingStop);
    };
  }, [token, selectedChannel, selectedConversation, user?.id]);

  // Load message history when active item changes
  useEffect(() => {
    const loadMessages = async () => {
      setMessages([]);
      setReplyTo(null);
      setTypingUsers({});
      if (selectedChannel) {
        try {
          const res = await channelsService.getChannelMessages(selectedChannel.id);
          setMessages(res.data.data || []);
        } catch {
          toast.error('Failed to load messages');
        }
      } else if (selectedConversation) {
        try {
          const res = await conversationsService.getConversationMessages(selectedConversation.id);
          setMessages(res.data.data || []);
        } catch {
          toast.error('Failed to load messages');
        }
      }
    };
    loadMessages();
  }, [selectedChannel, selectedConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Typing notification trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!token) return;
    const socket = getSocket();

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing-start', {
        channelId: selectedChannel?.id,
        conversationId: selectedConversation?.id,
      });
      lastTypingTimeRef.current = Date.now();
    } else {
      lastTypingTimeRef.current = Date.now();
    }

    // Debounced stop typing
    setTimeout(() => {
      const timeDiff = Date.now() - lastTypingTimeRef.current;
      if (timeDiff >= 2000 && isTypingRef.current) {
        socket.emit('typing-stop', {
          channelId: selectedChannel?.id,
          conversationId: selectedConversation?.id,
        });
        isTypingRef.current = false;
      }
    }, 2000);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    
    // Stop typing notification immediately on send
    if (isTypingRef.current) {
      getSocket().emit('typing-stop', {
        channelId: selectedChannel?.id,
        conversationId: selectedConversation?.id,
      });
      isTypingRef.current = false;
    }

    try {
      let res;
      if (selectedChannel) {
        res = await channelsService.sendChannelMessage(
          selectedChannel.id,
          newMessage.trim(),
          replyTo?.id || undefined
        );
      } else if (selectedConversation) {
        res = await conversationsService.sendConversationMessage(
          selectedConversation.id,
          newMessage.trim(),
          replyTo?.id || undefined
        );
      }

      if (res?.data.data) {
        setMessages((prev) => [...prev, res.data.data]);
      }
      setNewMessage('');
      setReplyTo(null);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await channelsService.addReaction(messageId, emoji);
    } catch {
      toast.error('Failed to add reaction');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const res = await channelsService.createChannel({
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: newChannelDesc.trim(),
        isPrivate: newChannelPrivate,
        societyId: user?.societyId || undefined,
        categoryName: newChannelCategory.trim() || undefined,
      } as any);
      setChannels((prev) => [...prev, res.data.data]);
      setSelectedChannel(res.data.data);
      setSelectedConversation(null);
      setShowCreateChannel(false);
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelCategory('');
      setNewChannelPrivate(false);
      toast.success('Channel created!');
    } catch {
      toast.error('Failed to create channel');
    }
  };

  const handleCastVote = async (messageId: string, optionIndex: number) => {
    try {
      const res = await channelsService.castVote(messageId, optionIndex);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? res.data.data : msg))
      );
    } catch {
      toast.error('Failed to cast vote');
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
      toast.error('Question and at least 2 options are required');
      return;
    }
    setSending(true);
    try {
      const pollData = {
        question: pollQuestion.trim(),
        options: pollOptions.filter((o) => o.trim()).map((text) => ({ text, votes: [] })),
      };

      let res;
      if (selectedChannel) {
        res = await channelsService.sendChannelMessage(
          selectedChannel.id,
          `📊 Poll: ${pollQuestion}`,
          undefined,
          undefined,
          pollData
        );
      }

      if (res?.data.data) {
        setMessages((prev) => [...prev, res.data.data]);
      }
      setShowCreatePoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      toast.success('Poll created!');
    } catch {
      toast.error('Failed to create poll');
    } finally {
      setSending(false);
    }
  };

  const handleStartDm = async (targetUser: User) => {
    try {
      const res = await conversationsService.createConversation([targetUser.id]);
      setConversations((prev) => {
        if (prev.some((c) => c.id === res.data.data.id)) return prev;
        return [...prev, res.data.data];
      });
      setSelectedConversation(res.data.data);
      setSelectedChannel(null);
      setShowCreateDm(false);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-surface border border-hairline rounded-2xl overflow-hidden shadow-soft-3">
      {/* SIDEBAR */}
      <div className="w-80 border-r border-hairline/60 bg-canvas-soft/40 flex flex-col h-full">
        {/* Toggle tabs */}
        <div className="flex p-3 border-b border-hairline/60 gap-1 bg-surface">
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-body-sm font-semibold transition-all duration-200 ${
              activeTab === 'channels' ? 'bg-primary text-on-primary' : 'text-ink-secondary hover:bg-canvas-soft'
            }`}
          >
            Channels
          </button>
          <button
            onClick={() => setActiveTab('dms')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-body-sm font-semibold transition-all duration-200 ${
              activeTab === 'dms' ? 'bg-primary text-on-primary' : 'text-ink-secondary hover:bg-canvas-soft'
            }`}
          >
            Direct Messages
          </button>
        </div>

        {/* List area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {activeTab === 'channels' ? (
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-ink-muted">
                <span className="text-eyebrow font-bold uppercase tracking-wider">Channels</span>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="p-1 hover:bg-canvas-soft rounded text-ink-secondary hover:text-ink transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-4">
                {Object.entries(
                  channels.reduce((acc, chan) => {
                    const cat = (chan as any).categoryName || 'text channels';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(chan);
                    return acc;
                  }, {} as Record<string, Channel[]>)
                ).map(([category, chans]) => (
                  <div key={category} className="space-y-1">
                    <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-2 mb-1">
                      {category}
                    </p>
                    <div className="space-y-0.5">
                      {chans.map((chan) => (
                        <button
                          key={chan.id}
                          onClick={() => {
                            setSelectedChannel(chan);
                            setSelectedConversation(null);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-body-sm transition-all duration-150 ${
                            selectedChannel?.id === chan.id
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-ink-secondary hover:bg-canvas-soft hover:text-ink'
                          }`}
                        >
                          {chan.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                          <span className="truncate">{chan.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-ink-muted">
                <span className="text-eyebrow font-bold uppercase tracking-wider">Messages</span>
                <button
                  onClick={() => setShowCreateDm(true)}
                  className="p-1 hover:bg-canvas-soft rounded text-ink-secondary hover:text-ink transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-0.5">
                {conversations.map((conv) => {
                  const partner = conv.participants.find((p) => p.id !== user?.id) || conv.participants[0];
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        setSelectedChannel(null);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm transition-all duration-200 ${
                        selectedConversation?.id === conv.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-ink-secondary hover:bg-canvas-soft hover:text-ink'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-caption uppercase flex-shrink-0">
                        {partner?.name?.[0] || 'U'}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="truncate font-medium">{partner?.name || 'User'}</p>
                        {conv.lastMessage && (
                          <p className="text-caption text-ink-muted truncate">{conv.lastMessage.content}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div className="flex-1 flex flex-col h-full bg-surface">
        {selectedChannel || selectedConversation ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-hairline/60 flex items-center justify-between bg-surface/80 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-2">
                  {selectedChannel ? (
                    <>
                      {selectedChannel.isPrivate ? <Lock size={18} className="text-ink-secondary" /> : <Hash size={18} className="text-ink-secondary" />}
                      <h2 className="text-body-lg font-bold text-ink">{selectedChannel.name}</h2>
                    </>
                  ) : (
                    <>
                      <MessageSquare size={18} className="text-ink-secondary" />
                      <h2 className="text-body-lg font-bold text-ink">
                        {selectedConversation?.participants.find((p) => p.id !== user?.id)?.name || 'Direct Message'}
                      </h2>
                    </>
                  )}
                </div>
                {selectedChannel?.description && (
                  <p className="text-caption text-ink-muted mt-0.5">{selectedChannel.description}</p>
                )}
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-2xl bg-canvas-soft flex items-center justify-center text-ink-secondary mb-3">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-body-sm font-medium text-ink">No messages here yet</p>
                  <p className="text-caption text-ink-muted mt-1">Start the conversation by sending a message below!</p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.sender.id === user?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-caption font-semibold text-ink-secondary">{msg.sender.name}</span>
                      <span className="text-[10px] text-ink-faint">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {msg.parentId && (
                      <div className="text-[11px] text-ink-muted italic mb-1 flex items-center gap-1 bg-canvas-soft px-2 py-0.5 rounded">
                        <Reply size={10} /> Replying to a message
                      </div>
                    )}

                    <div className="relative max-w-[70%]">
                      <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-body-sm ${
                        isMe ? 'bg-primary text-on-primary rounded-tr-none' : 'bg-canvas-soft text-ink rounded-tl-none'
                      }`}>
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }} />
                        
                        {/* Interactive Poll Display */}
                        {(msg as any).poll && (msg as any).poll.question && (
                          <div className="mt-3 p-3 bg-surface text-ink rounded-xl border border-hairline/60 space-y-2">
                            <p className="font-semibold text-body-sm">📊 {(msg as any).poll.question}</p>
                            <div className="space-y-1.5">
                              {(msg as any).poll.options.map((opt: any, optIdx: number) => {
                                const totalVotes = (msg as any).poll.options.reduce((sum: number, o: any) => sum + o.votes.length, 0);
                                const percent = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                                const hasVoted = opt.votes.includes(user?.id || '');
                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => handleCastVote(msg.id, optIdx)}
                                    className={`w-full relative overflow-hidden text-left p-2 rounded-lg border transition-all text-caption flex items-center justify-between ${
                                      hasVoted ? 'border-primary/50 text-primary font-semibold' : 'border-hairline hover:bg-canvas-soft text-ink-secondary'
                                    }`}
                                  >
                                    <div
                                      className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                                        hasVoted ? 'bg-primary/15' : 'bg-canvas-soft'
                                      }`}
                                      style={{ width: `${percent}%`, zIndex: 0 }}
                                    />
                                    <span className="relative z-10">{opt.text}</span>
                                    <span className="relative z-10 text-[11px]">{percent}% ({opt.votes.length})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hover action toolbar */}
                      <div className={`absolute top-0 right-0 -translate-y-1/2 flex items-center bg-surface border border-hairline rounded-lg shadow-soft-2 px-1 py-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 gap-1`}>
                        <button
                          onClick={() => handleAddReaction(msg.id, '👍')}
                          className="hover:bg-canvas-soft p-1 rounded text-caption"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleAddReaction(msg.id, '❤️')}
                          className="hover:bg-canvas-soft p-1 rounded text-caption"
                        >
                          ❤️
                        </button>
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="hover:bg-canvas-soft p-1 rounded text-ink-secondary hover:text-ink"
                          title="Reply"
                        >
                          <Reply size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.reactions.map((react, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAddReaction(msg.id, react.emoji)}
                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                              react.users.includes(user?.id || '')
                                ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                                : 'bg-surface border-hairline text-ink-secondary hover:border-ink-muted'
                            }`}
                          >
                            <span>{react.emoji}</span>
                            <span>{react.users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing status bar */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="px-6 py-1 text-caption text-ink-muted italic flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
                <span>
                  {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            {/* Reply indicator */}
            {replyTo && (
              <div className="mx-6 px-4 py-2 bg-canvas-soft border-l-4 border-primary rounded-r flex items-center justify-between text-caption text-ink-secondary">
                <span className="truncate">Replying to <strong>{replyTo.sender.name}</strong>: {replyTo.content}</span>
                <button onClick={() => setReplyTo(null)} className="text-ink-muted hover:text-ink font-semibold">✕</button>
              </div>
            )}

            {/* Input Footer */}
            <div className="p-4 border-t border-hairline/60 bg-surface">
              <div className="flex gap-2 items-center">
                {selectedChannel && (
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="p-3 bg-canvas-soft hover:bg-canvas rounded-xl text-ink-secondary hover:text-primary transition-all text-body-lg"
                    title="Create Poll"
                  >
                    📊
                  </button>
                )}
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-canvas-soft/50 border border-hairline rounded-xl text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()} className="rounded-xl flex items-center justify-center p-3">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-heading-3 font-bold text-ink">Welcome to the Community Hub</h3>
            <p className="text-body-sm text-ink-muted max-w-sm mt-2">
              Select a channel from the left sidebar or start a direct message to begin communicating with members.
            </p>
          </div>
        )}
      </div>

      {/* CREATE CHANNEL MODAL */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-hairline shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-body-lg font-bold text-ink">Create a Channel</h3>
            <div className="space-y-3">
              <div>
                <label className="text-caption font-semibold text-ink-secondary block mb-1">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. general"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-caption font-semibold text-ink-secondary block mb-1">Category (e.g. text channels, projects)</label>
                <input
                  type="text"
                  value={newChannelCategory}
                  onChange={(e) => setNewChannelCategory(e.target.value)}
                  placeholder="e.g. text channels"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-caption font-semibold text-ink-secondary block mb-1">Description</label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  rows={3}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-chk"
                  checked={newChannelPrivate}
                  onChange={(e) => setNewChannelPrivate(e.target.checked)}
                  className="rounded border-hairline text-primary focus:ring-primary/25"
                />
                <label htmlFor="private-chk" className="text-body-sm text-ink-secondary font-medium">Make Private Channel</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCreateChannel(false)}>Cancel</Button>
              <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {showCreatePoll && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-hairline shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-body-lg font-bold text-ink">Create a Poll</h3>
            <div className="space-y-3">
              <div>
                <label className="text-caption font-semibold text-ink-secondary block mb-1">Poll Question</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="What is your question?"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-caption font-semibold text-ink-secondary block">Poll Options</label>
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const nextOpts = [...pollOptions];
                      nextOpts[idx] = e.target.value;
                      setPollOptions(nextOpts);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-caption text-primary font-semibold hover:underline"
                >
                  + Add Option
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCreatePoll(false)}>Cancel</Button>
              <Button onClick={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}>Create Poll</Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DM MODAL */}
      {showCreateDm && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-hairline shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-body-lg font-bold text-ink">New Direct Message</h3>
            <p className="text-caption text-ink-muted">Select a member to start chatting with:</p>
            <div className="max-h-60 overflow-y-auto border border-hairline rounded-lg divide-y divide-hairline">
              {allUsers
                .filter((u) => u.id !== user?.id)
                .map((target) => (
                  <button
                    key={target.id}
                    onClick={() => handleStartDm(target)}
                    className="w-full text-left px-4 py-2.5 hover:bg-canvas-soft transition-colors flex items-center gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-caption uppercase flex-shrink-0">
                      {target.name[0]}
                    </div>
                    <span className="text-body-sm font-semibold text-ink">{target.name}</span>
                  </button>
                ))}
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowCreateDm(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
