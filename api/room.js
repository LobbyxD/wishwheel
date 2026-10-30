// Transitional same-origin endpoint while the Cloudflare Worker is provisioned.
// Never accept or persist room data here; the configured UI calls the Worker.
export default function handler(_req,res) {
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Retry-After','60');
 return res.status(503).json({error:{code:'NOT_CONFIGURED',message:'Backend setup is in progress. Please try again shortly.'}});
}
