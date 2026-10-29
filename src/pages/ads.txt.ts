import type { APIRoute } from 'astro';
import { ADS, ADSENSE_CONNECTED } from '../config';

/**
 * /ads.txt tells ad buyers which sellers may sell ads on this site. AdSense
 * warns ("Earnings at risk") until it exists. Empty until ADS.publisherId is set.
 */
export const GET: APIRoute = () => {
  const body = ADSENSE_CONNECTED
    ? `google.com, ${ADS.publisherId.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
    : '# No advertising partners yet.\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
