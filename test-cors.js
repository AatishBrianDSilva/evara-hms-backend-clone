// Pre-deployment CORS test script
// Run this locally to test CORS configuration

const testCORS = {
  // Test 1: Check if current deployment has CORS issues
  async testCurrentDeployment() {
    console.log('🔍 Testing Current Deployment CORS...\n');
    
    const testUrl = 'https://nex0q2i42e.execute-api.ap-south-1.amazonaws.com/debug/cors';
    
    try {
      // Test OPTIONS preflight
      console.log('1️⃣ Testing OPTIONS preflight request:');
      const optionsResponse = await fetch(testUrl, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Origin': 'https://dashboard.dev.evarahealth.in'
        }
      });
      
      console.log('   Status:', optionsResponse.status);
      console.log('   Allow-Methods:', optionsResponse.headers.get('Access-Control-Allow-Methods'));
      console.log('   Allow-Origin:', optionsResponse.headers.get('Access-Control-Allow-Origin'));
      console.log('   Allow-Headers:', optionsResponse.headers.get('Access-Control-Allow-Headers'));
      
      const optionsBody = await optionsResponse.text();
      console.log('   Response:', optionsBody);
      
      // Test actual PATCH request
      console.log('\n2️⃣ Testing actual PATCH request:');
      const patchResponse = await fetch(testUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://dashboard.dev.evarahealth.in'
        },
        body: JSON.stringify({ test: 'data' })
      });
      
      console.log('   Status:', patchResponse.status);
      console.log('   CORS Headers:', {
        'Allow-Origin': patchResponse.headers.get('Access-Control-Allow-Origin'),
        'Allow-Methods': patchResponse.headers.get('Access-Control-Allow-Methods'),
      });
      
      const patchBody = await patchResponse.json();
      console.log('   Response:', patchBody);
      
      // Analysis
      console.log('\n📊 CORS Analysis:');
      const allowMethods = optionsResponse.headers.get('Access-Control-Allow-Methods');
      const hasPatch = allowMethods && allowMethods.includes('PATCH');
      
      console.log('   ✅ OPTIONS request works:', optionsResponse.status === 200);
      console.log('   ✅ PATCH method allowed:', hasPatch);
      console.log('   ✅ Origin allowed:', !!optionsResponse.headers.get('Access-Control-Allow-Origin'));
      
      if (!hasPatch) {
        console.log('   ❌ ISSUE: PATCH not in allowed methods:', allowMethods);
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  },

  // Test 2: Test the problematic endpoint
  async testPurchaseOrderEndpoint() {
    console.log('\n🔍 Testing Purchase Order Endpoint CORS...\n');
    
    const testUrl = 'https://nex0q2i42e.execute-api.ap-south-1.amazonaws.com/pharmacy-dashboard/purchase-order/test123/status';
    
    try {
      console.log('1️⃣ Testing OPTIONS on purchase order endpoint:');
      const optionsResponse = await fetch(testUrl, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Origin': 'https://dashboard.dev.evarahealth.in'
        }
      });
      
      console.log('   Status:', optionsResponse.status);
      console.log('   Allow-Methods:', optionsResponse.headers.get('Access-Control-Allow-Methods'));
      console.log('   Allow-Origin:', optionsResponse.headers.get('Access-Control-Allow-Origin'));
      
      console.log('\n2️⃣ Testing actual PATCH (without auth):');
      const patchResponse = await fetch(testUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://dashboard.dev.evarahealth.in'
        },
        body: JSON.stringify({ status: 'Test' })
      });
      
      console.log('   Status:', patchResponse.status);
      console.log('   CORS Headers in response:', {
        'Allow-Origin': patchResponse.headers.get('Access-Control-Allow-Origin'),
        'Allow-Methods': patchResponse.headers.get('Access-Control-Allow-Methods'),
        'X-CORS-Fixed': patchResponse.headers.get('X-CORS-Fixed'),
      });
      
      let responseBody;
      try {
        responseBody = await patchResponse.json();
      } catch {
        responseBody = await patchResponse.text();
      }
      console.log('   Response:', responseBody);
      
      const allowMethods = optionsResponse.headers.get('Access-Control-Allow-Methods');
      const hasPatch = allowMethods && allowMethods.includes('PATCH');
      const hasResponseCORS = !!patchResponse.headers.get('Access-Control-Allow-Origin');
      
      console.log('\n📊 Purchase Order Analysis:');
      console.log('   ✅ OPTIONS works:', optionsResponse.status === 200 || optionsResponse.status === 204);
      console.log('   ✅ PATCH allowed in preflight:', hasPatch);
      console.log('   ✅ PATCH response has CORS:', hasResponseCORS);
      console.log('   📝 PATCH response status:', patchResponse.status);
      
      if (!hasPatch) {
        console.log('   ❌ PROBLEM: PATCH not in preflight allowed methods:', allowMethods);
      }
      
      if (!hasResponseCORS) {
        console.log('   ❌ PROBLEM: PATCH response missing CORS headers');
        console.log('   🔧 This is why browser shows CORS error!');
      }
      
      if (patchResponse.status === 401 || patchResponse.status === 403) {
        console.log('   ⚠️  AUTH ISSUE: Need valid token for full test');
      }
      
    } catch (error) {
      console.error('❌ Purchase order test failed:', error.message);
    }
  }
};

// Run tests
(async () => {
  console.log('🚀 Starting CORS Diagnostic Tests\n');
  console.log('=' .repeat(50));
  
  await testCORS.testCurrentDeployment();
  await testCORS.testPurchaseOrderEndpoint();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Tests Complete!');
})();
