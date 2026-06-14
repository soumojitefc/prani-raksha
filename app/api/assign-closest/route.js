// app/api/assign-closest/route.js
// Closest rescuer assignment — runs via pg_cron inside Supabase
// This file is kept as a stub so the build doesn't break
// The actual logic runs in the database via pg_cron

export async function GET(request) {
  return new Response(JSON.stringify({ message: 'Assignment handled by pg_cron' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}