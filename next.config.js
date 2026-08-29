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
      return [{ source: "/api/v1/:path*", destination: "/api/index.py" }];
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
        ],
      },
    ];
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/models",
          outputPath: "static/models",
        },
      },
    });

    // Cesium: permitir recursos estaticos sin tratarlos como modulos JS
    config.module.rules.push({
      test: /\.(png|gif|jpg|jpeg|svg)$/,
      type: "asset/resource",
    });

    return config;
  },
};

module.exports = nextConfig;
