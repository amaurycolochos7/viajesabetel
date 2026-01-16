// Script para forzar reload del schema cache de Supabase
const SUPABASE_URL = 'https://ynqcixheqjfwclstxwek.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucWNpeGhlcWpmd2Nsc3R4d2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwODQ2NTYsImV4cCI6MjA4MzY2MDY1Nn0.swriLD-wVSAZJo3ZMtbhyaNVxPj-rwCZePOxea63qvE';

async function testRPCFunctions() {
    console.log('🔍 Testing RPC functions...\n');

    // Test 1: get_active_packages
    try {
        console.log('1️⃣ Testing get_active_packages()...');
        const response1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_packages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({})
        });

        if (response1.ok) {
            const data = await response1.json();
            console.log('✅ SUCCESS! Found packages:', data);
        } else {
            const error = await response1.text();
            console.log('❌ ERROR:', response1.status, error);
        }
    } catch (err) {
        console.log('❌ EXCEPTION:', err.message);
    }

    console.log('\n');

    // Test 2: get_package_reservations
    try {
        console.log('2️⃣ Testing get_package_reservations()...');
        const response2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_package_reservations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({})
        });

        if (response2.ok) {
            const data = await response2.json();
            console.log('✅ SUCCESS! Found reservations:', data);
        } else {
            const error = await response2.text();
            console.log('❌ ERROR:', response2.status, error);
        }
    } catch (err) {
        console.log('❌ EXCEPTION:', err.message);
    }
}

testRPCFunctions();
