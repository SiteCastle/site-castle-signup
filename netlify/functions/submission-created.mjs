// Runs by itself every time Netlify accepts a form entry on start.sitecastle.net (Netlify's "submission-created" event).
// It wakes the right Claude scheduled task right away, so an intake form is handled in minutes,
// any day, instead of waiting for the task's next scheduled run (Kyle, 2026-11-18).
//
//   intake-a  -> Gatekeeper (Form A receipt; Gatekeeper then wakes Mason to build the preview)
//   intake-b  -> Gatekeeper (Form B receipt)
//
// Each task has its own fire URL and bearer token, made in the task's API trigger settings at
// claude.ai/code/routines and stored ONLY as Netlify environment variables:
//   GATEKEEPER_FIRE_URL, GATEKEEPER_FIRE_TOKEN
// If a pair is missing this does nothing, and the task's scheduled run picks the entry up as before.
//
// Only the form name and the entry id are passed to the task, never what the visitor typed:
// the task reads the entry itself from Netlify, where it treats it as data, not instructions.

const ROUTES = {
  'intake-a': { task: 'Gatekeeper', prefix: 'GATEKEEPER' },
  'intake-b': { task: 'Gatekeeper', prefix: 'GATEKEEPER' }
};

const env = name => {
  const v = globalThis.Netlify?.env?.get?.(name) ?? process.env[name];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const fire = async (url, token, text) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    if (res.ok) return { ok: true, status: res.status };
    // Retry once only when the service itself failed; anything else (bad token, hourly limit) won't fix itself.
    if (attempt === 1 && (res.status === 500 || res.status === 503)) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    return { ok: false, status: res.status, body: (await res.text()).slice(0, 300) };
  }
};

export default async req => {
  let payload;
  try {
    ({ payload } = await req.json());
  } catch {
    return new Response('ignored: no payload', { status: 200 });
  }
  const form = payload?.form_name;
  const route = ROUTES[form];
  if (!route) return new Response(`ignored: form ${form}`, { status: 200 });

  const url = env(`${route.prefix}_FIRE_URL`);
  const token = env(`${route.prefix}_FIRE_TOKEN`);
  if (!url || !token) {
    console.log(`${route.task} not woken: ${route.prefix}_FIRE_URL or _FIRE_TOKEN not set`);
    return new Response('not set up', { status: 200 });
  }

  const text =
    `EVENT RUN from the start.sitecastle.net intake site, not your schedule: a new "${form}" form entry arrived. ` +
    `Netlify site id ${payload.site_id}, submission id ${payload.id}, received ${payload.created_at}. ` +
    `Follow the EVENT RUN section of your instructions for this one entry.`;

  try {
    const r = await fire(url, token, text);
    console.log(`${route.task} ${r.ok ? 'woken' : 'NOT woken'} for ${form} ${payload.id}: HTTP ${r.status} ${r.body || ''}`);
  } catch (e) {
    console.log(`${route.task} NOT woken for ${form} ${payload.id}: ${e.message}`);
  }
  // Always 200: the form entry is already saved, and the scheduled run is the safety net.
  return new Response('ok', { status: 200 });
};
