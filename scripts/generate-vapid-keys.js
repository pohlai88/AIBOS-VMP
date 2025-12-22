/**
 * Generate VAPID Keys for Web Push Notifications
 * Run: node scripts/generate-vapid-keys.js
 */

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n========================================');
console.log('VAPID Keys Generated');
console.log('========================================\n');
console.log('Public Key (VAPID_PUBLIC_KEY):');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key (VAPID_PRIVATE_KEY):');
console.log(vapidKeys.privateKey);
console.log('\n========================================\n');
console.log('Add these to your .env file:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@nexuscanon.com`);
console.log('\n========================================\n');

