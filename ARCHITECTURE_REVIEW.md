# Chat App Foundation Review (Production Readiness)

## Current strengths
- Clear separation of concerns via domain-specific Zustand stores (`useSocketStore`, `useSearchStore`, `useRandomChatStore`, `useFriendChatStore`, etc.).
- Good defensive checks around invalid IDs and duplicate events.
- Practical UX protections: dedupe windows, typing throttling, unread suppression while inside active chat.

## Current reliability risks
1. **Socket lifecycle and listener ownership are mixed with UI flow**
   - Stores and screens both attach socket listeners.
   - This can create race conditions, duplicate handlers, and hard-to-debug state drift during reconnects.

2. **Message delivery semantics are mostly optimistic**
   - Random chat sends by `socket.emit` without explicit server ack / resend strategy.
   - Friend chat uses HTTP send + socket receive (good), but exact delivery guarantees are still best-effort.

3. **Event naming/shape is weakly typed**
   - Many `any` payloads reduce safety and can hide incompatible changes between client/server.

4. **Environment coupling**
   - `BASE_URL` is hard-coded to a LAN IP, which breaks across environments and release channels.

5. **Connection orchestration spread across multiple screens**
   - Connection retries happen in store, but connect calls are triggered from page-level effects.
   - This raises complexity when app background/foreground transitions happen.

## Recommendation on Zustand
Use Zustand for **UI/session state**, but avoid using it as the primary transport/reliability layer.

Recommended split:
- `SocketService` (singleton module/class): owns socket connect/reconnect/auth, event registration, backoff, and connection health.
- Zustand stores: subscribe to service outputs and hold render state only.
- Feature hooks (`useChatSession`, `useFriendChatSession`): compose service + store for screen-level behavior.

## Recommended architecture for 100s of users

### 1) Add explicit message state machine
Per message status:
- `queued` -> `sent_to_server` -> `delivered` -> `seen` -> `failed`

Use client-generated IDs (UUID) for idempotency and reconciliation.

### 2) Require ack + retry + idempotency
- Emit with ack callback and timeout.
- Retry with exponential backoff and jitter for transient failures.
- Server should treat duplicate client IDs as idempotent writes.

### 3) Durable history is source of truth
- Continue persisting friend messages via API/database.
- On reconnect, sync from server cursor (`lastMessageAt`/`lastMessageId`) instead of trusting in-memory continuity.

### 4) Typed socket contract
- Define shared event types (e.g., `SocketEventMap`).
- Validate server payloads at runtime (zod/io-ts) before mutating state.

### 5) Presence/typing should be ephemeral and lossy
- Keep these events non-durable.
- Debounce typing events more aggressively and auto-expire presence indicators.

### 6) Observability for production confidence
- Add structured logs around connect/disconnect/reconnect attempts, ack latency, retry counts.
- Track metrics: connection success rate, median send ack latency, duplicate drop count, message failure rate.

### 7) Horizontal scaling checklist
- Socket.IO adapter with Redis for multi-instance fanout.
- Sticky sessions at ingress (or connection affinity).
- Auth token validation on socket handshake.

## Suggested phased roadmap
1. **Phase 1 (quick wins)**
   - Move `BASE_URL` to environment config.
   - Centralize socket lifecycle into a service.
   - Add typed event payloads for critical events.

2. **Phase 2 (delivery reliability)**
   - Add client message IDs + ack timeout + retry queue.
   - Add reconnect sync endpoint and cursor-based history catch-up.

3. **Phase 3 (operational hardening)**
   - Add telemetry/metrics dashboards and alert thresholds.
   - Load-test with realistic churn (connect/disconnect bursts, packet delay, duplicate events).

## Bottom line
- **Yes, keep Zustand** for local app state.
- **No, don’t rely on Zustand patterns alone for socket reliability**.
- For production readiness, invest in a dedicated socket service + typed contracts + ack/retry/idempotency + reconnect sync.
