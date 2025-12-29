# Supabase Queues: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Queues - reliable message queuing using pgmq  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Basic Operations](#basic-operations)
4. [Advanced Features](#advanced-features)
5. [Use Cases](#use-cases)
6. [Best Practices](#best-practices)
7. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is pgmq?

**pgmq** is a Postgres extension that provides **reliable message queuing** with ACID guarantees, built on top of PostgreSQL.

### Key Features

- ✅ **ACID Guarantees** - Transactional message delivery
- ✅ **At-Least-Once Delivery** - No message loss
- ✅ **Visibility Timeout** - Hide messages during processing
- ✅ **Dead Letter Queue** - Handle failed messages
- ✅ **Priority Queues** - Prioritize messages
- ✅ **Batch Operations** - Process multiple messages

---

## 🚀 Getting Started

### Enable Extension

```sql
-- Enable pgmq extension
CREATE EXTENSION IF NOT EXISTS pgmq;
```

### Create Queue

```sql
-- Create queue
SELECT pgmq.create('task_queue');
```

### List Queues

```sql
-- List all queues
SELECT * FROM pgmq.list_queues();
```

---

## 📤 Basic Operations

### Send Message

```sql
-- Send message
SELECT pgmq.send('task_queue', '{"task": "process_invoice", "id": 123}');
```

### Read Message

```sql
-- Read message (with visibility timeout)
SELECT * FROM pgmq.read('task_queue', 1, 30);
-- 1 message, 30 second visibility timeout
```

### Delete Message

```sql
-- Delete message after processing
SELECT pgmq.delete('task_queue', msg_id);
```

### Archive Message

```sql
-- Archive message (mark as processed)
SELECT pgmq.archive('task_queue', msg_id);
```

---

## 🔄 Advanced Features

### Priority Messages

```sql
-- Send high priority message
SELECT pgmq.send('task_queue', '{"task": "urgent"}', delay := 0, priority := 10);

-- Send low priority message
SELECT pgmq.send('task_queue', '{"task": "normal"}', delay := 0, priority := 1);
```

### Delayed Messages

```sql
-- Send message with delay (5 minutes)
SELECT pgmq.send(
  'task_queue',
  '{"task": "scheduled"}',
  delay := 300  -- 300 seconds = 5 minutes
);
```

### Batch Operations

```sql
-- Send multiple messages
SELECT pgmq.send_batch(
  'task_queue',
  ARRAY[
    '{"task": "task1"}',
    '{"task": "task2"}',
    '{"task": "task3"}'
  ]
);

-- Read multiple messages
SELECT * FROM pgmq.read('task_queue', 10, 30);  -- Read up to 10 messages
```

### Message Metadata

```sql
-- Send message with metadata
SELECT pgmq.send(
  'task_queue',
  '{"task": "process"}',
  delay := 0,
  priority := 5,
  metadata := '{"source": "api", "user_id": "123"}'::jsonb
);
```

---

## 🎯 Use Cases

### Use Case 1: Background Job Processing

```sql
-- Send job to queue
SELECT pgmq.send('job_queue', jsonb_build_object(
  'job_type', 'process_document',
  'document_id', 'doc_123',
  'priority', 5
)::text);

-- Worker reads and processes
DO $$
DECLARE
  msg pgmq.message;
BEGIN
  -- Read message
  SELECT * INTO msg FROM pgmq.read('job_queue', 1, 60);
  
  IF msg IS NOT NULL THEN
    -- Process job
    PERFORM process_document((msg.message::jsonb->>'document_id')::uuid);
    
    -- Archive message
    PERFORM pgmq.archive('job_queue', msg.msg_id);
  END IF;
END $$;
```

### Use Case 2: Email Queue

```sql
-- Send email to queue
SELECT pgmq.send('email_queue', jsonb_build_object(
  'to', 'user@example.com',
  'subject', 'Case Update',
  'body', 'Your case has been updated'
)::text);

-- Email worker
DO $$
DECLARE
  msg pgmq.message;
BEGIN
  SELECT * INTO msg FROM pgmq.read('email_queue', 1, 30);
  
  IF msg IS NOT NULL THEN
    -- Send email
    PERFORM send_email(
      msg.message::jsonb->>'to',
      msg.message::jsonb->>'subject',
      msg.message::jsonb->>'body'
    );
    
    PERFORM pgmq.archive('email_queue', msg.msg_id);
  END IF;
END $$;
```

### Use Case 3: Event Processing

```sql
-- Send event to queue
SELECT pgmq.send('event_queue', jsonb_build_object(
  'event_type', 'case.created',
  'case_id', 'case_123',
  'timestamp', now()::text
)::text);

-- Event processor
DO $$
DECLARE
  msg pgmq.message;
  event_data jsonb;
BEGIN
  SELECT * INTO msg FROM pgmq.read('event_queue', 1, 60);
  
  IF msg IS NOT NULL THEN
    event_data := msg.message::jsonb;
    
    -- Process event
    CASE event_data->>'event_type'
      WHEN 'case.created' THEN
        PERFORM handle_case_created(event_data);
      WHEN 'case.updated' THEN
        PERFORM handle_case_updated(event_data);
      ELSE
        -- Unknown event type
        PERFORM pgmq.archive('event_queue', msg.msg_id);
    END CASE;
    
    PERFORM pgmq.archive('event_queue', msg.msg_id);
  END IF;
END $$;
```

---

## 🔧 Advanced Patterns

### Pattern 1: Dead Letter Queue

```sql
-- Process with retry and DLQ
DO $$
DECLARE
  msg pgmq.message;
  retry_count int := 0;
  max_retries int := 3;
BEGIN
  SELECT * INTO msg FROM pgmq.read('task_queue', 1, 30);
  
  IF msg IS NOT NULL THEN
    BEGIN
      -- Try to process
      PERFORM process_task(msg.message::jsonb);
      PERFORM pgmq.archive('task_queue', msg.msg_id);
    EXCEPTION WHEN OTHERS THEN
      -- Check retry count
      retry_count := COALESCE((msg.metadata->>'retry_count')::int, 0);
      
      IF retry_count < max_retries THEN
        -- Retry
        PERFORM pgmq.send(
          'task_queue',
          msg.message,
          delay := 60,  -- Wait 1 minute before retry
          metadata := jsonb_build_object('retry_count', retry_count + 1)
        );
        PERFORM pgmq.delete('task_queue', msg.msg_id);
      ELSE
        -- Move to DLQ
        PERFORM pgmq.send('dlq', msg.message);
        PERFORM pgmq.delete('task_queue', msg.msg_id);
      END IF;
    END;
  END IF;
END $$;
```

### Pattern 2: Priority Processing

```sql
-- Process high priority messages first
DO $$
DECLARE
  msg pgmq.message;
BEGIN
  -- Try high priority first
  SELECT * INTO msg FROM pgmq.read('task_queue', 1, 30)
  WHERE priority >= 5
  ORDER BY priority DESC, enqueued_at ASC;
  
  -- If no high priority, get any message
  IF msg IS NULL THEN
    SELECT * INTO msg FROM pgmq.read('task_queue', 1, 30)
    ORDER BY priority DESC, enqueued_at ASC;
  END IF;
  
  IF msg IS NOT NULL THEN
    PERFORM process_task(msg.message::jsonb);
    PERFORM pgmq.archive('task_queue', msg.msg_id);
  END IF;
END $$;
```

### Pattern 3: Scheduled Tasks

```sql
-- Send scheduled task
SELECT pgmq.send(
  'scheduled_tasks',
  '{"task": "generate_report", "date": "2025-01-23"}',
  delay := EXTRACT(EPOCH FROM ('2025-01-23 06:00:00'::timestamp - now()))::int
);

-- Process scheduled tasks
DO $$
DECLARE
  msg pgmq.message;
BEGIN
  SELECT * INTO msg FROM pgmq.read('scheduled_tasks', 1, 30);
  
  IF msg IS NOT NULL THEN
    PERFORM execute_scheduled_task(msg.message::jsonb);
    PERFORM pgmq.archive('scheduled_tasks', msg.msg_id);
  END IF;
END $$;
```

---

## 📊 Best Practices

### 1. Visibility Timeout

- ✅ Set appropriate timeout (processing time + buffer)
- ✅ Too short: Messages become visible too soon
- ✅ Too long: Messages stuck if worker crashes

### 2. Error Handling

```sql
-- Always handle errors
DO $$
BEGIN
  -- Process message
EXCEPTION WHEN OTHERS THEN
  -- Log error
  -- Retry or move to DLQ
END $$;
```

### 3. Batch Processing

```sql
-- Process multiple messages at once
SELECT * FROM pgmq.read('task_queue', 10, 60);  -- Read 10 messages
```

### 4. Monitoring

```sql
-- Monitor queue health
SELECT 
  queue_name,
  COUNT(*) as pending_messages,
  MAX(enqueued_at) as oldest_message
FROM pgmq.metrics
GROUP BY queue_name;
```

### 5. Cleanup

```sql
-- Archive old processed messages
DELETE FROM pgmq.archive
WHERE archived_at < NOW() - INTERVAL '30 days';
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [Cron Jobs Guide](./CRON_JOBS_GUIDE.md) - Scheduled jobs
- [pgmq Docs](https://github.com/tembo-io/pgmq) - pgmq documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

