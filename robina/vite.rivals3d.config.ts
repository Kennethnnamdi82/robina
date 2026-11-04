import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import {createReadStream,existsSync,statSync} from 'node:fs';

/** Isolated serve-only sandbox. Production uses the untouched main Vite configuration. */
export default defineConfig(({ command }) => {
  const enabled = process.env.VITE_RIVALS_3D_SANDBOX === 'true';
  if (command !== 'serve') throw new Error('The RIVALS 3D sandbox is development-only and cannot be built for deployment.');
  return {
    plugins: [react(),{
      name: 'rivals-3d-development-gate',
      configureServer(server) {
        server.middlewares.use((req,res,next) => {
          const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
          // Standard HTTP transport compression for prepared binary assets.
          // Rebuild .gz after editing a source; stale sidecars are ignored.
          if(enabled&&['GET','HEAD'].includes(req.method??'')&&/^\/assets\/(rivals|rugfire)\/[a-zA-Z0-9_./-]+\.glb$/.test(pathname)&&/\bgzip\b/.test(req.headers['accept-encoding']??'')){
            const publicRoot=path.resolve(__dirname,'public'),source=path.resolve(publicRoot,'.'+pathname),gzip=source+'.gz';
            if(source.startsWith(publicRoot+path.sep)&&existsSync(source)&&existsSync(gzip)&&statSync(gzip).mtimeMs>=statSync(source).mtimeMs){
              const original=statSync(source),packed=statSync(gzip),etag=`W/"${original.size}-${Math.floor(original.mtimeMs)}"`;
              res.setHeader('Content-Type','model/gltf-binary');res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.setHeader('ETag',etag);
              if(req.headers['if-none-match']===etag){res.statusCode=304;res.end();return;}res.setHeader('Content-Length',packed.size);if(req.method==='HEAD'){res.end();return;}createReadStream(gzip).on('error',()=>res.destroy()).pipe(res);return;
            }
          }
          const localEntry = ['/', '/index.html', '/gaming', '/gaming/', '/login', '/login/'].includes(pathname);
          if (!enabled && (localEntry || /rivals3d|rivals\/three/.test(pathname))) { res.statusCode = 404; res.end('3D sandbox disabled. Run npm run dev:rivals3d to enable local testing.'); return; }
          // Only this dedicated serve-only config routes website entry URLs to
          // the isolated sandbox, before the authenticated app can be imported.
          if (localEntry) {
            res.statusCode = 302;
            res.setHeader('Location', '/tests/rivals3d/index.html');
            res.setHeader('Cache-Control', 'no-store');
            res.end();
            return;
          }
          next();
        });
      },
    }],
    define: { 'import.meta.env.VITE_RIVALS_3D_SANDBOX': JSON.stringify(enabled ? 'true' : 'false') },
    cacheDir: 'node_modules/.vite-rivals3d',
    resolve: { alias: { '@': path.resolve(__dirname,'./src') } },
    server: { host: '0.0.0.0',port: 8084,strictPort: true,watch:{ignored:['**/public/assets/rivals/city/premium/*-source.glb']} },
    optimizeDeps: { entries: ['tests/rivals3d/index.html','tests/rivals/index.html'],include: ['react','react-dom/client','react-router-dom','three','lucide-react','phaser'] },
  };
});
