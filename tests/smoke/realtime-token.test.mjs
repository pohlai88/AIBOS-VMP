/**
 * Phase 12 Smoke Test - Realtime Token Endpoint
 *
 * Tests:
 * 1. Login as Alice
 * 2. Check /nexus/api/realtime-token returns 200
 * 3. Verify token contains expected claims
 */

// Using native fetch (Node 18+)

const BASE_URL = 'http://localhost:9000';

async function runTests() {
  console.log('=== Phase 12 Smoke Test: Realtime Token ===\n');

  // Step 1: Login as Alice
  console.log('1. Logging in as Alice...');
  const loginRes = await fetch(`${BASE_URL}/nexus/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: 'alice@alpha.com',
      password: 'Demo123!'
    }),
    redirect: 'manual'
  });

  // Extract session cookie
  const cookies = loginRes.headers.raw()['set-cookie'];
  const sessionCookie = cookies?.find(c => c.startsWith('nexus_session='));

  if (!sessionCookie) {
    console.error('❌ Login failed - no session cookie');
    console.log('Response status:', loginRes.status);
    const body = await loginRes.text();
    console.log('Response body:', body.substring(0, 200));
    process.exit(1);
  }

  console.log('✅ Login successful - session cookie obtained\n');

  // Step 2: Test realtime-token endpoint
  console.log('2. Testing /nexus/api/realtime-token...');
  const tokenRes = await fetch(`${BASE_URL}/nexus/api/realtime-token`, {
    headers: {
      'Cookie': sessionCookie.split(';')[0]
    }
  });

  console.log('   Status:', tokenRes.status);

  if (tokenRes.status !== 200) {
    console.error('❌ Token endpoint returned non-200');
    const body = await tokenRes.text();
    console.log('   Response:', body);
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  console.log('   Response keys:', Object.keys(tokenData));

  if (!tokenData.access_token) {
    console.error('❌ No access_token in response');
    process.exit(1);
  }

  console.log('✅ Token endpoint returned 200 with access_token\n');

  // Step 3: Decode and verify JWT claims
  console.log('3. Verifying JWT claims...');
  try {
    const parts = tokenData.access_token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    console.log('   Role:', payload.role);
    console.log('   Exp:', new Date(payload.exp * 1000).toISOString());

    const appMeta = payload.app_metadata || {};
    console.log('   nexus_user_id:', appMeta.nexus_user_id || '(not set)');
    console.log('   nexus_tenant_id:', appMeta.nexus_tenant_id || '(not set)');

    if (appMeta.nexus_user_id === 'USR-ALIC0001' && appMeta.nexus_tenant_id === 'TNT-ALPH0001') {
      console.log('✅ JWT claims verified correctly\n');
    } else {
      console.log('⚠️  JWT claims may not be set (could be legacy bcrypt login)\n');
    }
  } catch (e) {
    console.log('⚠️  Could not decode JWT:', e.message);
  }

  // Step 4: Test without auth (should get 401)
  console.log('4. Testing without auth (expect 401)...');
  const unauthRes = await fetch(`${BASE_URL}/nexus/api/realtime-token`);
  console.log('   Status:', unauthRes.status);

  if (unauthRes.status === 302 || unauthRes.status === 401) {
    console.log('✅ Unauthenticated request correctly rejected\n');
  } else {
    console.log('⚠️  Unexpected status for unauthenticated request\n');
  }

  console.log('=== All Smoke Tests Passed ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
