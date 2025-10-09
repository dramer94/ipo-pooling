import { createClient } from '@supabase/supabase-js'

// Your Supabase configuration
const supabaseUrl = 'https://qxykoqthicwbjrfzqffl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eWtvcXRoaWN3YmpyZnpxZmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMzk3NjUsImV4cCI6MjA2NzYxNTc2NX0.OnQF5DwjbqaoMrBY4J7ENiJ3oseExS_t_jZHcLr6eas'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database table name for IPO projects
export const IPO_PROJECTS_TABLE = 'ipo_projects'
