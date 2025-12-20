// CONFIGURATION
const SUPABASE_URL = 'https://frmyusjvjbqzenlnvfsf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybXl1c2p2amJxemVubG52ZnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNTg2MDEsImV4cCI6MjA4MTYzNDYwMX0.RtHPFhYDTnj8q-6QYVNgeOiA_ZhzKRiVPtvBkdtKUbE';

// Initialize Supabase Client globally
// Note: We use 'var' to ensure it attaches to the window object and is accessible everywhere.

if (typeof window.supabase === 'undefined') {
    console.error("Supabase JS Library not loaded.");
    alert("Critical Error: Database library failed to load.");
} else {
    // 0. Preserve The Factory
    window.SupabaseFactory = window.supabase;

    // 1. Create Client
    const _supabaseClient = window.SupabaseFactory.createClient(SUPABASE_URL, SUPABASE_KEY);

    // 2. Expose as global 'supabase' variable
    window.supabase = _supabaseClient;

    // Also assign to 'supabase' for good measure in this script scope
    var supabase = _supabaseClient;

    console.log("Supabase Client Initialized and Globally Available");
}
