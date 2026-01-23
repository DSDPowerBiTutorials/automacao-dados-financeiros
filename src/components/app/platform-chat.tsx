"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    MessageCircle,
    Send,
    X,
    Loader2,
    Minimize2,
    Maximize2,
    Hash,
    Plus,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

type Channel = {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    channel_type: "public" | "private" | "direct";
    created_by: string | null;
    created_at: string;
};

type Message = {
    id: number;
    channel_id: number;
    user_id: string;
    content: string;
    message_type: string;
    created_at: string;
    user_profile?: UserProfile | null;
};

type UserProfile = {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    status: string;
};

function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24)
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getInitials(name: string): string {
    if (!name) return "?";
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function getAvatarColor(name: string): string {
    const colors = [
        "bg-blue-600",
        "bg-green-600",
        "bg-purple-600",
        "bg-pink-600",
        "bg-indigo-600",
        "bg-teal-600",
        "bg-orange-600",
        "bg-cyan-600",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function PlatformChat() {
    const { user, profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Channels
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [channelsExpanded, setChannelsExpanded] = useState(true);
    const [dmsExpanded, setDmsExpanded] = useState(true);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);

    // Users for DMs
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [dmChannels, setDmChannels] = useState<Channel[]>([]);

    // Unread
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadByChannel, setUnreadByChannel] = useState<Record<number, number>>({});

    // Create channel dialog
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [newChannelDescription, setNewChannelDescription] = useState("");
    const [creatingChannel, setCreatingChannel] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load channels
    const loadChannels = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("channels")
                .select("*")
                .in("channel_type", ["public", "private"])
                .order("name");

            if (error) {
                console.log("Channels table not found:", error.message);
                setChannels([]);
            } else {
                setChannels(data || []);
                // Select first channel if none selected
                if (!selectedChannel && data && data.length > 0) {
                    setSelectedChannel(data[0]);
                }
            }
        } catch (e) {
            console.log("Error loading channels:", e);
        }
    }, [selectedChannel]);

    // Load DM channels
    const loadDmChannels = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from("channels")
                .select("*")
                .eq("channel_type", "direct")
                .order("updated_at", { ascending: false });

            if (error) {
                console.log("Error loading DMs:", error.message);
            } else {
                setDmChannels(data || []);
            }
        } catch (e) {
            console.log("Error loading DMs:", e);
        }
    }, [user]);

    // Load users for DMs
    const loadUsers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("user_profiles")
                .select("*")
                .neq("id", user?.id || "")
                .order("full_name");

            if (error) {
                console.log("User profiles not found:", error.message);
            } else {
                setUsers(data || []);
            }
        } catch (e) {
            console.log("Error loading users:", e);
        }
    }, [user]);

    // Load messages for selected channel
    const loadMessages = useCallback(async () => {
        if (!selectedChannel) return;
        setLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from("messages")
                .select(`
          *,
          user_profile:user_profiles(id, username, full_name, avatar_url, status)
        `)
                .eq("channel_id", selectedChannel.id)
                .order("created_at", { ascending: true })
                .limit(100);

            if (error) {
                console.log("Messages error:", error.message);
                setMessages([]);
            } else {
                setMessages(data || []);
                // Clear unread for this channel
                setUnreadByChannel((prev) => ({ ...prev, [selectedChannel.id]: 0 }));
            }
        } catch (e) {
            console.log("Error loading messages:", e);
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, [selectedChannel]);

    // Initial load
    useEffect(() => {
        if (isOpen && user) {
            setLoading(true);
            Promise.all([loadChannels(), loadDmChannels(), loadUsers()]).finally(() =>
                setLoading(false)
            );
        }
    }, [isOpen, user, loadChannels, loadDmChannels, loadUsers]);

    // Load messages when channel changes
    useEffect(() => {
        if (selectedChannel) {
            loadMessages();
        }
    }, [selectedChannel, loadMessages]);

    // Subscribe to realtime messages
    useEffect(() => {
        if (!selectedChannel) return;

        const channel = supabase
            .channel(`messages_${selectedChannel.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `channel_id=eq.${selectedChannel.id}`,
                },
                async (payload) => {
                    // Fetch the user profile for the new message
                    const { data: userProfile } = await supabase
                        .from("user_profiles")
                        .select("*")
                        .eq("id", payload.new.user_id)
                        .single();

                    const newMsg = {
                        ...payload.new,
                        user_profile: userProfile,
                    } as Message;

                    setMessages((prev) => [...prev, newMsg]);

                    // Update unread if not our message
                    if (payload.new.user_id !== user?.id) {
                        setUnreadCount((prev) => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedChannel, user?.id]);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Reset unread when opening
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    // Send message
    async function sendMessage() {
        if (!newMessage.trim() || !user || !selectedChannel) return;

        setSending(true);
        try {
            const { error } = await supabase.from("messages").insert([
                {
                    channel_id: selectedChannel.id,
                    user_id: user.id,
                    content: newMessage.trim(),
                    message_type: "text",
                },
            ]);

            if (error) throw error;
            setNewMessage("");
        } catch (e: any) {
            console.error("Error sending message:", e);
        } finally {
            setSending(false);
        }
    }

    // Create channel
    async function createChannel() {
        if (!newChannelName.trim() || !user) return;

        setCreatingChannel(true);
        try {
            const slug = newChannelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            const { data, error } = await supabase
                .from("channels")
                .insert([
                    {
                        slug,
                        name: newChannelName.trim(),
                        description: newChannelDescription.trim() || null,
                        channel_type: "public",
                        created_by: user.id,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            setChannels((prev) => [...prev, data]);
            setSelectedChannel(data);
            setCreateChannelOpen(false);
            setNewChannelName("");
            setNewChannelDescription("");
        } catch (e: any) {
            console.error("Error creating channel:", e);
        } finally {
            setCreatingChannel(false);
        }
    }

    // Start DM
    async function startDm(targetUser: UserProfile) {
        if (!user) return;

        // Check if DM already exists
        const existingDm = dmChannels.find(
            (c) =>
                c.channel_type === "direct" &&
                (c.name.includes(user.id) && c.name.includes(targetUser.id))
        );

        if (existingDm) {
            setSelectedChannel(existingDm);
            return;
        }

        // Create new DM channel
        try {
            const slug = `dm-${user.id}-${targetUser.id}`;
            const { data, error } = await supabase
                .from("channels")
                .insert([
                    {
                        slug,
                        name: `${user.id}-${targetUser.id}`,
                        description: null,
                        channel_type: "direct",
                        created_by: user.id,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            // Add both users as members
            await supabase.from("channel_members").insert([
                { channel_id: data.id, user_id: user.id, role: "owner" },
                { channel_id: data.id, user_id: targetUser.id, role: "member" },
            ]);

            setDmChannels((prev) => [data, ...prev]);
            setSelectedChannel(data);
        } catch (e: any) {
            console.error("Error creating DM:", e);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    if (!user) return null;

    return (
        <>
            {/* Chat Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-105"
                >
                    <MessageCircle className="h-6 w-6" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold bg-red-500 text-white rounded-full">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className={cn(
                        "fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 flex transition-all duration-200",
                        isExpanded
                            ? "bottom-4 right-4 w-[700px] h-[600px]"
                            : "bottom-6 right-6 w-[450px] h-[500px]"
                    )}
                >
                    {/* Sidebar */}
                    <div className="w-48 bg-gray-900 text-white rounded-l-lg flex flex-col">
                        {/* Header */}
                        <div className="p-3 border-b border-gray-700">
                            <h3 className="font-semibold text-sm">DSD Finance Hub</h3>
                        </div>

                        {/* Channels */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Channels Section */}
                            <div className="p-2">
                                <button
                                    onClick={() => setChannelsExpanded(!channelsExpanded)}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white w-full"
                                >
                                    {channelsExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                    <span className="uppercase font-medium">Channels</span>
                                    <Plus
                                        className="h-3 w-3 ml-auto hover:text-blue-400"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCreateChannelOpen(true);
                                        }}
                                    />
                                </button>

                                {channelsExpanded && (
                                    <div className="mt-1 space-y-0.5">
                                        {loading ? (
                                            <div className="flex justify-center py-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                                            </div>
                                        ) : channels.length === 0 ? (
                                            <p className="text-xs text-gray-500 px-2">No channels</p>
                                        ) : (
                                            channels.map((channel) => (
                                                <button
                                                    key={channel.id}
                                                    onClick={() => setSelectedChannel(channel)}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-gray-800",
                                                        selectedChannel?.id === channel.id && "bg-blue-600"
                                                    )}
                                                >
                                                    <Hash className="h-3.5 w-3.5" />
                                                    <span className="truncate">{channel.name}</span>
                                                    {(unreadByChannel[channel.id] || 0) > 0 && (
                                                        <span className="ml-auto bg-red-500 text-xs px-1.5 rounded-full">
                                                            {unreadByChannel[channel.id]}
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Direct Messages */}
                            <div className="p-2 border-t border-gray-700">
                                <button
                                    onClick={() => setDmsExpanded(!dmsExpanded)}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white w-full"
                                >
                                    {dmsExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                    <span className="uppercase font-medium">Direct Messages</span>
                                </button>

                                {dmsExpanded && (
                                    <div className="mt-1 space-y-0.5">
                                        {users.slice(0, 5).map((u) => (
                                            <button
                                                key={u.id}
                                                onClick={() => startDm(u)}
                                                className="flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-gray-800"
                                            >
                                                <div
                                                    className={cn(
                                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
                                                        getAvatarColor(u.full_name || u.username || "")
                                                    )}
                                                >
                                                    {getInitials(u.full_name || u.username || "?")}
                                                </div>
                                                <span className="truncate">{u.full_name || u.username}</span>
                                                <span
                                                    className={cn(
                                                        "w-2 h-2 rounded-full ml-auto",
                                                        u.status === "online"
                                                            ? "bg-green-500"
                                                            : u.status === "away"
                                                                ? "bg-yellow-500"
                                                                : "bg-gray-500"
                                                    )}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* User info */}
                        <div className="p-2 border-t border-gray-700 flex items-center gap-2">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                                    getAvatarColor(profile?.name || user.email || "")
                                )}
                            >
                                {getInitials(profile?.name || user.email || "?")}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                    {profile?.name || user.email?.split("@")[0]}
                                </p>
                                <p className="text-[10px] text-gray-400">Online</p>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col bg-white rounded-r-lg">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b">
                            <div className="flex items-center gap-2">
                                {selectedChannel && (
                                    <>
                                        <Hash className="h-4 w-4 text-gray-500" />
                                        <span className="font-medium">{selectedChannel.name}</span>
                                        {selectedChannel.description && (
                                            <span className="text-xs text-gray-500 hidden sm:inline">
                                                — {selectedChannel.description}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    {isExpanded ? (
                                        <Minimize2 className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <Maximize2 className="h-4 w-4 text-gray-500" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="h-4 w-4 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                                    <p className="text-sm">No messages yet</p>
                                    <p className="text-xs">Be the first to send a message!</p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isOwnMessage = msg.user_id === user.id;
                                    const userName =
                                        msg.user_profile?.full_name ||
                                        msg.user_profile?.username ||
                                        "Unknown";
                                    return (
                                        <div key={msg.id} className="flex gap-2">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                {msg.user_profile?.avatar_url ? (
                                                    <img
                                                        src={msg.user_profile.avatar_url}
                                                        alt={userName}
                                                        className="w-8 h-8 rounded object-cover"
                                                    />
                                                ) : (
                                                    <div
                                                        className={cn(
                                                            "w-8 h-8 rounded flex items-center justify-center text-white text-xs font-medium",
                                                            getAvatarColor(userName)
                                                        )}
                                                    >
                                                        {getInitials(userName)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Message */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {isOwnMessage ? "You" : userName}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {formatMessageTime(msg.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 break-words">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t p-3 bg-white rounded-br-lg">
                            <div className="flex items-end gap-2">
                                <Textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        selectedChannel
                                            ? `Message #${selectedChannel.name}`
                                            : "Select a channel"
                                    }
                                    className="min-h-[40px] max-h-[100px] resize-none text-sm"
                                    rows={1}
                                    disabled={!selectedChannel}
                                />
                                <Button
                                    size="sm"
                                    onClick={sendMessage}
                                    disabled={!newMessage.trim() || sending || !selectedChannel}
                                    className="bg-blue-600 hover:bg-blue-700 h-10 px-3"
                                >
                                    {sending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Channel Dialog */}
            <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle>Create a Channel</DialogTitle>
                        <DialogDescription>
                            Channels are where your team communicates. Create a channel for a topic.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Channel Name</label>
                            <Input
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                                placeholder="e.g., marketing"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description (optional)</label>
                            <Input
                                value={newChannelDescription}
                                onChange={(e) => setNewChannelDescription(e.target.value)}
                                placeholder="What's this channel about?"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setCreateChannelOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={createChannel} disabled={!newChannelName.trim() || creatingChannel}>
                                {creatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
