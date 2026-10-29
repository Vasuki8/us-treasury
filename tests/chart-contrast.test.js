import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const chartSource=await readFile(new URL('../src/charts.js',import.meta.url),'utf8');
const rule=(selector,required=true)=>{
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const body=css.match(new RegExp('(?:^|\\n)'+escaped+'\\s*\\{([^}]+)\\}'))?.[1];
 if(required)assert.ok(body,`CSS rule exists: ${selector}`);
 if(!body)return{};
 return Object.fromEntries(body.split(';').map(part=>part.split(':').map(value=>value.trim())).filter(parts=>parts.length===2));
};
const palettes={Graphite:rule('#app'),Light:rule('#app[data-theme="Light"]')};
const rgb=hex=>{const full=hex.length===4?'#'+[...hex.slice(1)].map(value=>value+value).join(''):hex;return[1,3,5].map(i=>parseInt(full.slice(i,i+2),16));};
const blend=(foreground,background,alpha)=>foreground.map((value,i)=>value*alpha+background[i]*(1-alpha));
const luminance=color=>color.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
const contrast=(first,second)=>(Math.max(luminance(first),luminance(second))+.05)/(Math.min(luminance(first),luminance(second))+.05);
const color=(value,palette)=>rgb(value.startsWith('var(')?palette[value.slice(4,-1)]:value);
const meets=(first,second,minimum,label)=>assert.ok(contrast(first,second)>=minimum,`${label}: ${contrast(first,second).toFixed(4)}:1 must be >= ${minimum}:1`);

test('normal state and explanatory text retains 4.5:1 across declared theme surfaces',()=>{
 for(const[name,palette]of Object.entries(palettes))for(const foreground of ['--text','--muted','--accent','--cyan','--link'])for(const background of ['--panel','--raised','--selected','--field','--bg'])meets(rgb(palette[foreground]),rgb(palette[background]),4.5,`${name} ${foreground} on ${background}`);
});

test('essential chart strokes and bar fills retain 3:1 against their panel',()=>{
 for(const[name,palette]of Object.entries(palettes))for(const selector of ['.chart .series-line','.chart .series-line.secondary','.chart .series-line.previous','.chart .bar']){
  const style=rule(selector),foreground=color(style.stroke??style.fill,palette);
  meets(foreground,rgb(palette['--panel']),3,`${name} ${selector}`);
 }
});

test('funding boundaries and median retain 3:1 after both translucent bands stack',()=>{
 const outer=rule('.funding-band.outer'),inner=rule('.funding-band.inner');
 for(const[name,palette]of Object.entries(palettes)){
  const panel=rgb(palette['--panel']),accent=rgb(palette['--accent']);
  const outerFill=blend(accent,panel,Number(outer['fill-opacity'])),innerFill=blend(accent,outerFill,Number(inner['fill-opacity']));
  meets(blend(color(outer.stroke,palette),outerFill,Number(outer['stroke-opacity'])),outerFill,3,`${name} outer boundary on outer fill`);
  meets(blend(color(inner.stroke,palette),innerFill,Number(inner['stroke-opacity'])),innerFill,3,`${name} inner boundary on stacked fill`);
  meets(color(rule('.chart .series-line').stroke,palette),innerFill,3,`${name} median on stacked fill`);
 }
});

test('essential reference lines retain 3:1 at their declared opacity',()=>{
 const style=rule('.chart .value-reference',false),original=Number(chartSource.match(/class:'value-reference'.*?'stroke-opacity':'([^']+)'/)[1]);
 for(const[name,palette]of Object.entries(palettes)){
  const panel=rgb(palette['--panel']),foreground=style.stroke?color(style.stroke,palette):rgb(palette['--text']);
  meets(blend(foreground,panel,Number(style['stroke-opacity']??original)),panel,3,`${name} reference line`);
 }
});

test('input and select identifying borders retain 3:1 against field and panel',()=>{
 for(const selector of ['input, select','.labor-radar input,.labor-radar select']){
  const style=rule(selector),token=/var\((--[\w-]+)\)/.exec(style.border??style['border-color'])[1];
  for(const[name,palette]of Object.entries(palettes))for(const background of ['--field','--panel'])meets(rgb(palette[token]),rgb(palette[background]),3,`${name} ${selector} border on ${background}`);
 }
});
