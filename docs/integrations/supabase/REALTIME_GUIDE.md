# Supabase Realtime: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Realtime capabilities - real-time subscriptions, presence, and broadcasting  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Subscriptions](#database-subscriptions)
3. [Presence](#presence)
4. [Broadcasting](#broadcasting)
5. [Channels](#channels)
6. [Advanced Patterns](#advanced-patterns)
7. [Performance Optimization](#performance-optimization)
8. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is Supabase Realtime?

Supabase Realtime provides **real-time subscriptions** to your database changes, user presence tracking, and message broadcasting - all via WebSocket connections.

### Key Features

- ✅ **Database Changes** - Subscribe to INSERT, UPDATE, DELETE events
- ✅ **Presence** - Track who's online and what they're doing
- ✅ **Broadcasting** - Send messages to channels
- ✅ **Filters** - Subscribe to specific changes
- ✅ **Postgres Changes** - Listen to database triggers
- ✅ **Binary Protocol** - Efficient WebSocket communication

---

## 📊 Database Subscriptions

### Basic Subscription

Subscribe to all changes in a table:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Subscribe to all changes
const channel = supabase
  .channel('cases-changes')
  .on('postgres_changes', {
    event: '*',  // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'nexus_cases'
  }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe()
```

### Filtered Subscriptions

Subscribe to specific changes:

```javascript
// Only INSERT events
const channel = supabase
  .channel('new-cases')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'nexus_cases'
  }, (payload) => {
    console.log('New case created!', payload.new)
  })
  .subscribe()

// Filter by column value
const channel = supabase
  .channel('urgent-cases')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'nexus_cases',
    filter: 'priority=eq.urgent'
  }, (payload) => {
    console.log('Urgent case changed!', payload)
  })
  .subscribe()
```

### Advanced Filters

```javascript
// Multiple filters
const channel = supabase
  .channel('vendor-cases')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'nexus_cases',
    filter: 'vendor_id=eq.vendor_123,status=eq.open'
  }, (payload) => {
    console.log('Vendor case changed!', payload)
  })
  .subscribe()
```

---

## 👥 Presence

### Track User Presence

Track who's online and what they're doing:

```javascript
const channel = supabase.channel('case-room:case_123')

// Track presence
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    console.log('Users online:', state)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', leftPresences)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Track current user's presence
      await channel.track({
        online_at: new Date().toISOString(),
        user: user.id,
        viewing: 'case_123'
      })
    }
  })
```

### Presence State

Get current presence state:

```javascript
const state = channel.presenceState()
// Returns: { 'user_123': [{ online_at: '...', user: '...', viewing: '...' }] }
```

---

## 📢 Broadcasting

### Send Messages

Broadcast messages to all channel subscribers:

```javascript
const channel = supabase.channel('case-room:case_123')

channel
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Message received:', payload)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Send message
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          from: user.id,
          message: 'Hello!',
          timestamp: new Date().toISOString()
        }
      })
    }
  })
```

### Typing Indicators

```javascript
// Send typing indicator
await channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: {
    user: user.id,
    isTyping: true
  }
})

// Listen for typing
channel.on('broadcast', { event: 'typing' }, (payload) => {
  console.log('User typing:', payload)
})
```

---

## 📡 Channels

### Channel Management

```javascript
// Create channel
const channel = supabase.channel('my-channel')

// Subscribe
channel.subscribe((status) => {
  console.log('Channel status:', status)
})

// Unsubscribe
channel.unsubscribe()

// Remove channel
supabase.removeChannel(channel)
```

### Multiple Channels

```javascript
// Subscribe to multiple channels
const casesChannel = supabase.channel('cases')
const messagesChannel = supabase.channel('messages')
const notificationsChannel = supabase.channel('notifications')

casesChannel.subscribe()
messagesChannel.subscribe()
notificationsChannel.subscribe()
```

---

## 🚀 Advanced Patterns

### Pattern 1: Collaborative Editing

```javascript
const channel = supabase.channel('document:doc_123')

// Track cursor position
channel
  .on('presence', { event: 'sync' }, () => {
    const cursors = channel.presenceState()
    // Update UI with other users' cursors
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        cursor: { line: 10, column: 5 },
        user: user.id
      })
    }
  })

// Broadcast changes
channel.on('broadcast', { event: 'change' }, (payload) => {
  // Apply remote changes
  applyChange(payload.change)
})
```

### Pattern 2: Live Dashboard

```javascript
// Subscribe to multiple metrics
const metricsChannel = supabase.channel('metrics')

metricsChannel
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'nexus_cases',
    filter: 'status=eq.open'
  }, (payload) => {
    updateOpenCasesCount()
  })
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'nexus_payments',
    filter: 'status=eq.completed'
  }, (payload) => {
    updatePaymentsTotal()
  })
  .subscribe()
```

### Pattern 3: Chat Application

```javascript
const chatChannel = supabase.channel('chat:room_123')

chatChannel
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: 'room_id=eq.room_123'
  }, (payload) => {
    // New message received
    displayMessage(payload.new)
  })
  .on('presence', { event: 'sync' }, () => {
    // Update online users list
    updateOnlineUsers(channel.presenceState())
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await chatChannel.track({
        user: user.id,
        username: user.username
      })
    }
  })
```

### Pattern 4: Real-Time Notifications

```javascript
const notificationsChannel = supabase.channel(`user:${user.id}`)

notificationsChannel
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id},read=eq.false`
  }, (payload) => {
    // Show notification
    showNotification(payload.new)
    // Update badge count
    updateNotificationCount()
  })
  .subscribe()
```

---

## ⚡ Performance Optimization

### 1. Selective Subscriptions

Only subscribe to what you need:

```javascript
// ❌ Bad: Subscribe to everything
channel.on('postgres_changes', { event: '*', table: 'nexus_cases' })

// ✅ Good: Subscribe to specific events
channel.on('postgres_changes', {
  event: 'INSERT',
  table: 'nexus_cases',
  filter: 'status=eq.open'
})
```

### 2. Channel Cleanup

Always unsubscribe when done:

```javascript
useEffect(() => {
  const channel = supabase.channel('my-channel')
  channel.subscribe()

  return () => {
    channel.unsubscribe()
    supabase.removeChannel(channel)
  }
}, [])
```

### 3. Debounce Updates

Debounce frequent updates:

```javascript
let updateTimeout
channel.on('postgres_changes', (payload) => {
  clearTimeout(updateTimeout)
  updateTimeout = setTimeout(() => {
    updateUI(payload)
  }, 100)
})
```

### 4. Batch Updates

Batch multiple updates:

```javascript
let pendingUpdates = []
channel.on('postgres_changes', (payload) => {
  pendingUpdates.push(payload)
  
  if (pendingUpdates.length >= 10) {
    processBatch(pendingUpdates)
    pendingUpdates = []
  }
})
```

---

## 🔒 Security

### RLS Integration

Realtime respects Row Level Security:

```sql
-- RLS policy ensures users only see their cases
CREATE POLICY "Users see own cases"
ON nexus_cases FOR SELECT
USING (auth.uid() = user_id);
```

Realtime subscriptions automatically respect these policies.

### Channel Access Control

Control who can subscribe to channels:

```javascript
// Use authenticated channels
const channel = supabase.channel('private-room', {
  config: {
    presence: {
      key: user.id  // Only authenticated users
    }
  }
})
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md) - MCP tools reference
- [Realtime Official Docs](https://supabase.com/docs/guides/realtime) - Official documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

