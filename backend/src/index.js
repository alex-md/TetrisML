export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            if (!env.KV) {
                return new Response(JSON.stringify({ error: 'KV binding not found' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (url.pathname === '/api/state') {
                if (request.method === 'GET') {
                    const state = await env.KV.get('population');
                    return new Response(state || '[]', {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                if (request.method === 'POST') {
                    const state = await request.text();

                    // Payload protection: allow larger saves, still keep a hard cap
                    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
                    if (state.length > MAX_BYTES) {
                        return new Response(JSON.stringify({ error: `Payload too large (max ${MAX_BYTES} bytes)` }), {
                            status: 413,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    // Basic validation to ensure it's JSON
                    try {
                        JSON.parse(state);
                    } catch (e) {
                        return new Response(JSON.stringify({ error: 'Invalid JSON state' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    await env.KV.put('population', state);
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            if (url.pathname === '/api/reset' && request.method === 'POST') {
                await env.KV.delete('population');
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response('Not Found', { status: 404, headers: corsHeaders });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    },
};
