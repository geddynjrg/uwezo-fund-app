import { NextResponse } from 'next/server';

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || '';
  // App login returns JWTs in JSON (credentials: omit). Reflect any Capacitor/WebView origin.
  const allow = !origin || origin === 'null' ? '*' : origin;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': allow === '*' ? 'false' : 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function withCors(request: Request, response: NextResponse) {
  const headers = corsHeaders(request);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}

export function optionsCors(request: Request) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}
