import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function makeApiDevPlugin(route, file) {
  return {
    name: `api-${route}-dev-middleware`,
    configureServer(server) {
      server.middlewares.use(`/api/${route}`, async (req, res) => {
        try {
          if (!req.body && req.method && !['GET', 'HEAD'].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString('utf8');
            const contentType = req.headers['content-type'] || '';
            req.body = contentType.includes('application/json') && rawBody ? JSON.parse(rawBody) : rawBody;
          }

          const mod = await server.ssrLoadModule(`/api/${file}`);
          const handler = mod?.default;
          if (typeof handler !== 'function') throw new Error(`api/${file} does not export a default handler`);
          const headers = {};
          const bridgeRes = {
            setHeader(name, value) { headers[name] = value; res.setHeader(name, value); },
            status(code) { res.statusCode = code; return this; },
            end(body) { res.end(body); return this; },
            json(payload) {
              if (!headers['Content-Type']) res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(payload));
              return this;
            },
          };
          await handler(req, bridgeRes);
        } catch (error) {
          server.ssrFixStacktrace(error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error?.message || `Failed to load /api/${file}` }));
        }
      });
    },
  };
}

function apiNewsDevPlugin() {
  return {
    name: 'api-news-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res, next) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        try {
          const mod = await server.ssrLoadModule('/api/news.js');
          const handler = mod?.default;

          if (typeof handler !== 'function') {
            throw new Error('api/news.js does not export a default handler');
          }

          const headers = {};
          const bridgeRes = {
            setHeader(name, value) {
              headers[name] = value;
              res.setHeader(name, value);
            },
            status(code) {
              res.statusCode = code;
              return this;
            },
            json(payload) {
              if (!headers['Content-Type']) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
              }
              res.end(JSON.stringify(payload));
              return this;
            },
          };

          await handler(req, bridgeRes);
        } catch (error) {
          server.ssrFixStacktrace(error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: error?.message || 'Failed to load /api/news in dev server',
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
  plugins: [
    react(),
    apiNewsDevPlugin(),
    makeApiDevPlugin('weather-data', 'weather-data.js'),
    makeApiDevPlugin('weather-history', 'weather-history.js'),
    makeApiDevPlugin('radar', 'radar.js'),
    makeApiDevPlugin('enso', 'enso.js'),
    makeApiDevPlugin('tmd-wind', 'tmd-wind.js'),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,webmanifest}'],
        globIgnores: [
          '**/MapPage-*.js',
          '**/NewsPage-*.js',
          '**/apple-touch-icon.png',
          '**/icon-*.png',
          '**/maskable-icon-*.png',
          'ai-preview.html',
          'manifest.json',
        ],
      },
      manifest: {
        name: 'อากาศไทย — รู้ก่อน วางแผนได้',
        short_name: 'อากาศไทย',
        description:
          'ตรวจสอบคุณภาพอากาศ ฝุ่น PM2.5 สภาพอากาศ และเตือนภัยล่วงหน้าของประเทศไทยแบบเรียลไทม์',
        lang: 'th',
        theme_color: '#0788a7',
        background_color: '#f4f8fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/?source=pwa',
        categories: ['weather', 'environment', 'utilities'],
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'ภาพรวม',
            short_name: 'ภาพรวม',
            description: 'ดูข้อมูลสภาพอากาศและ AQI ภาพรวม',
            url: '/?shortcut=dashboard',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'แผนที่คุณภาพอากาศ',
            short_name: 'แผนที่',
            description: 'ดูแผนที่คุณภาพอากาศแบบ Interactive',
            url: '/map?shortcut=map',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'เตือนภัย',
            short_name: 'เตือนภัย',
            description: 'ดูการแจ้งเตือนสภาพอากาศและภัยธรรมชาติ',
            url: '/news?shortcut=alerts',
            icons: [{ src: 'icon-192x192.png', sizes: '192x192' }],
          },
        ],
        screenshots: [
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'AirQuality Thai Dashboard',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api-air': {
        target: 'http://air4thai.pcd.go.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-air/, ''),
      },
    },
  },
};
});
