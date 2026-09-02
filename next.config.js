/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  swcMinify: true,

  // Cesium carga sus workers/assets desde /cesium (copia en public/cesium)
  env: {
    CESIUM_BASE_URL: "/cesium",
  },

  async rewrites() {
    const IS_VERCEL = process.env.VERCEL === "1";
    if (IS_VERCEL) {
      // En Vercel el enrutado de /api/v1/* lo hace vercel.json (rewrite hacia
      // la funcion `/api`). Si Next lo reescribe tambien, intercepta y responde
      // 404 antes de que la funcion Python pueda atender el request.
      return [];
    }
    // Desarrollo local: reenviar al backend FastAPI (ejecutar con uvicorn)
    return [{ source: "/api/v1/:path*", destination: "http://127.0.0.1:8000/api/v1/:path*" }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://*.cartocdn.com https://basemaps.cartocdn.com; connect-src 'self' https://api.open-meteo.com https://server.arcgisonline.com https://elevation3d.arcgis.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.cartocdn.com https://basemaps.cartocdn.com; font-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    // Cesium: permitir recursos estaticos sin tratarlos como modulos JS
    config.module.rules.push({
      test: /\.(png|gif|jpg|jpeg|svg)$/,
      type: "asset/resource",
    });

    return config;
  },
};

module.exports = nextConfig;
