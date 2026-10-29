import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.mjs';

function attributes(tag){
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([,name,value])=>[name.toLowerCase(),value]));
}

function directives(policy){
  return Object.fromEntries(policy.split(';').map(part=>part.trim().split(/\s+/)).filter(([name])=>name)
    .map(([name,...values])=>[name,values]));
}

test('static HTML applies the server CSP before loading resources with only meta-supported directives',async()=>{
  const server=createAppServer();
  const headers=new Map();
  let status;
  const html=await new Promise(resolve=>server.emit('request',{method:'GET',url:'/'},{
    setHeader:(name,value)=>headers.set(name.toLowerCase(),value),
    writeHead:code=>{status=code;},end:data=>resolve(String(data)),
  }));
  assert.equal(status,200);
  const policies=[...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match=>({index:match.index,...attributes(match[0])}))
    .filter(meta=>meta['http-equiv']?.toLowerCase()==='content-security-policy');
  assert.equal(policies.length,1,'Static hosting must receive one CSP meta policy.');
  const meta=policies[0],policy=directives(meta.content);
  assert.ok(meta.index>html.indexOf('<head>')&&meta.index<html.indexOf('</head>'));
  const resources=[...html.matchAll(/<(?:script|link|base|img|iframe|object|embed)\b/gi)];
  assert.ok(resources.every(resource=>resource.index>meta.index),'The policy must precede every resource.');
  for(const unsupported of ['frame-ancestors','sandbox','report-uri']){
    assert.equal(Object.hasOwn(policy,unsupported),false,`${unsupported} cannot be enforced through meta CSP.`);
  }
  const header=directives(headers.get('content-security-policy'));
  for(const unsupported of ['frame-ancestors','sandbox','report-uri'])delete header[unsupported];
  assert.deepEqual(policy,header);
  assert.deepEqual(policy,{
    'default-src':["'self'"],'script-src':["'self'"],'style-src':["'self'"],
    'img-src':["'self'",'data:'],'connect-src':["'self'"],'object-src':["'none'"],'base-uri':["'self'"],
  });
});
