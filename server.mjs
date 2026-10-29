import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import {loadSnapshotHistory,browserSnapshotAssets} from './scripts/snapshot-storage.mjs';
import {assertCommercialData} from './scripts/data-policy.mjs';
import {importMapCspHash, isBuiltAsset} from './scripts/asset-references.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.gz':'application/gzip'};

export function createAppServer(root = projectRoot) {
  let cachedProjection=null,projectionKey='';
  const projection=async()=>{
    const sourcePath=path.join(root,'src','official-snapshot.js');
    const info=await stat(path.join(root,'src','official-snapshot.json.gz'));
    const key=`${info.mtimeMs}:${info.ctimeMs}:${info.size}:${info.ino}`;
    if(!cachedProjection||projectionKey!==key){
      projectionKey=key;
      cachedProjection=(async()=>{const {snapshot}=await import(pathToFileURL(sourcePath).href+`?projection=${encodeURIComponent(key)}`);const full={...snapshot,vintages:await loadSnapshotHistory(snapshot,{directory:path.join(root,'src')})};assertCommercialData(full);return browserSnapshotAssets(full);})();
      cachedProjection.catch(()=>{if(projectionKey===key)cachedProjection=null;});
    }
    return cachedProjection;
  };
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
      || /^src\/(?:history-[a-f0-9]{64}\.json(?:\.gz)?|source-[a-f0-9]{64}\.js)$/.test(asset)
      || isBuiltAsset(asset);
    if (!allowed) { res.writeHead(404); res.end('Not found'); return; }
    try {
      let data;
      if(asset==='src/official-snapshot.js')data=Buffer.from((await projection()).module);
      else if (/^src\/(?:history-[a-f0-9]{64}\.json(?:\.gz)?|source-[a-f0-9]{64}\.js)$/.test(asset)) {
        data=(await projection()).files.get(asset.slice(4));
        if(!data){res.writeHead(404);res.end('Not found');return;}
      }else data=await readFile(path.join(root, asset));
      if (asset === 'index.html') {
        const mapHash = importMapCspHash(data.toString('utf8'));
        if (mapHash) {
          const policy = res.getHeader('Content-Security-Policy');
          res.setHeader('Content-Security-Policy', policy.replace("script-src 'self'", `script-src 'self' '${mapHash}'`));
        }
      }
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
