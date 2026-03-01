export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: { message: string }) => void;
  reconnect: (attempt: number) => void;
  reconnect_failed: () => void;
  error: (payload: { message: string }) => void;
  receive_message: (payload: {
    message: string;
    fromUserId: string;
    timestamp: number;
    messageId?: string;
  }) => void;
  message_seen: (payload: { fromUserId: string; timestamp: number; messageId?: string }) => void;
  partner_typing: (payload: { fromUserId: string }) => void;
  partner_stop_typing: (payload: { fromUserId: string }) => void;
  partner_disconnected: (payload: { disconnectedUserId: string }) => void;
  friend_request_received: (payload: { fromUserId: string; fromUsername: string }) => void;
  friend_request_status: (payload: {
    fromUserId: string;
    toUserId: string;
    fromUsername: string;
    status: string;
  }) => void;
  friend_request_accepted: (payload?: { fromUserId?: string; toUserId?: string }) => void;
  friend_request_rejected: (payload: { fromUserId: string; toUserId: string }) => void;
  friend_added: (payload: { friendId: string; friendUsername: string }) => void;
  friend_removed: (payload: { removedUserId: string }) => void;
  friend_chat_started: () => void;
  chat_ready: () => void;
  match_found: (payload: { partnerId: string; partnerName: string }) => void;
  user_deleted: (payload: { userId: string }) => void;
}


export interface ClientToServerEvents {
  set_username: (payload: { userId: string; username: string }) => void;
  start_search: (payload: { userId: string; username: string }) => void;
  stop_search: (payload: { userId: string }) => void;
  start_friend_chat: (payload: { userId: string; friendId: string; username: string }) => void;
  leave_friend_chat: (payload: { userId: string; friendId: string }) => void;
  leave_chat: (payload: { toUserId: string }) => void;
  send_message: (payload: { toUserId: string; message: string; fromUserId: string; timestamp: number }) => void;
  typing: (payload: { toUserId: string; fromUserId: string }) => void;
  stop_typing: (payload: { toUserId: string; fromUserId: string }) => void;
  message_seen: (payload: { toUserId: string; fromUserId: string; timestamp: number; messageId?: string }) => void;
  friend_request_sent: (payload: { toUserId: string; fromUserId: string; fromUsername: string }) => void;
  friend_request_rejected: (payload: { fromUserId: string; toUserId: string }) => void;
  friend_removed: (payload: { userId: string; removedUserId: string }) => void;
}


export interface AppSocket {
  id?: string;
  connected: boolean;
  on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): this;
  off<E extends keyof ServerToClientEvents>(event: E, listener?: ServerToClientEvents[E]): this;
  emit<E extends keyof ClientToServerEvents>(event: E, payload: Parameters<ClientToServerEvents[E]>[0]): this;
  disconnect(): this;
  offAnyOutgoing?(): this;
}
