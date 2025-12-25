-- ============================================================================
-- Cleanup Test Notifications
-- Run this to remove test data after smoke tests
-- ============================================================================

-- Delete by known test IDs
DELETE FROM nexus_notifications
WHERE notification_id IN (
  'NTF-BROADCAST-TEST',
  'NTF-ALICE-ONLY-TEST'
);

-- Delete by test title patterns (safety net)
DELETE FROM nexus_notifications
WHERE title LIKE '%TEST%'
   OR title LIKE '%test%'
   OR title LIKE '📢 System Announcement'
   OR title LIKE '🎯 For Alice Only';

-- Verify cleanup
SELECT COUNT(*) as remaining_test_notifications
FROM nexus_notifications
WHERE notification_id LIKE 'NTF-%-TEST'
   OR title LIKE '%TEST%';
