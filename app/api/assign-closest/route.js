// app/api/assign-closest/route.js
//
// Vercel Cron Job — runs every 30 seconds.
// Picks the closest interested rescuer for each pending incident
// after the 90-second collection window has closed.
//
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/assign-closest",
//     "schedule": "*/1 * * * *"
//   }]
// }
//
// Note: Vercel free tier cron minimum is 1 minute, not 30 seconds.
// For testing that's fine — 60 second window is acceptable.
// Upgrade to Pro for 30-second intervals if needed.
//
// Security: protected by CRON_SECRET header which Vercel sets automatically.

import { assignClosestRescuers } from '../whatsapp-bot/route.js'

export async function GET(request) {
  // Vercel sets this header automatically on cron invocations
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    await assignClosestRescuers()
    return new Response(
      JSON.stringify({ ok: true, ran_at: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[assign-closest] Cron error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}