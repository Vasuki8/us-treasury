import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};

export function createAppServer(root = projectRoot) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'");
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, {'Allow':'GET, HEAD'}); res.end('Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Invalid URL'); return; }
    const asset = pathname === '/' ? 'index.html' : pathname.slice(1);
    const allowed = ['index.html','styles.css','favicon.svg'].includes(asset)
      || /^src\/[a-zA-Z0-9_-]+\.js$/.test(asset)
      || /^assets\/[a-f0-9]{16}\/(?:styles\.css|favicon\.svg|src\/[a-zA-Z0-9_-]+\.js)$/.test(asset);
    if (!allowed) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const data = await readFile(path.join(root, asset));
      res.writeHead(200, {'Content-Type':types[path.extname(asset)] || 'application/octet-stream'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const portArg = args.indexOf('--port');
  const port = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 4173);
  const root = args.includes('--dist') ? path.join(projectRoot,'dist') : projectRoot;
  const server = createAppServer(root);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Meridian ready: http://127.0.0.1:${server.address().port}`));
}
