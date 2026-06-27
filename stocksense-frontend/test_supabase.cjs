const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://obprdtqmomiwvfpxggif.supabase.co';
const supabaseAnonKey = 'sb_publishable_-JdW7DBlQF5QcDwBjOBDpw_IATQwcKw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log('Testing connection to Supabase...');
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error fetching session:', error.message);
            process.exit(1);
        } else {
            console.log('SUCCESS: Successfully connected to Supabase cloud Auth endpoint!');
            console.log('Auth Session Status:', data ? 'Connected (Idle)' : 'No Session');
            process.exit(0);
        }
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

testConnection();
