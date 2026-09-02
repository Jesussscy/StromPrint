import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Archivos generados en runtime / credenciales que nunca deben servirse
// como staticos. El backend los gestiona desde /tmp (Vercel) o la raiz
// local; el middleware los responde con 404 para no exponer datos
// sensibles (correos de suscriptores, caches, logs, credenciales).
const SENSITIVE_NAMES = new Set([
  "notifications.json",
  "subscriptions.json",
  "stormprint.db",
  "stormprint.db-journal",
  "tide_cache.json",
  "weather_cache.json",
  "backend.log",
  "backend.err.log",
  "backend_run.log",
  "backend_run_err.log",
  "dev.log",
  "dev.err.log",
  "frontend_run.log",
  "frontend_run_err.log",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const last = pathname.split("/").filter(Boolean).pop() ?? "";

  if (SENSITIVE_NAMES.has(last)) {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname.endsWith(".env")) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|cesium/|favicon.ico).*)"],
};