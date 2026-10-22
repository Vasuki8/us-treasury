import {requestText} from './http.mjs';
import {decodeHtmlText} from './calendar-utils.mjs';
import {publicationExplanationScope,requestedExplanationIds,explanationMetadataFor,assertPublicationExplanations} from '../publication-explanation-policy.mjs';

const maxBytes=2*1024*1024;
const fail=message=>{throw new Error('Invalid publication explanation source: '+message);};
function visibleHtml(input){
 if(typeof input!=='string'||Buffer.byteLength(input)>maxBytes)fail('HTML byte limit');
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input))fail('HTML control character');
 // Evidence inside comments or inactive source elements is never release text.
 const content=input.replace(/<!--[^]*?-->/g,' ');
 if(/<!--|-->/i.test(content))fail('malformed comment');
 const visible=content.replace(/<(script|style|template|noscript)\b[^>]*>[^]*?<\/\1\s*>/gi,' ');
 if(/<\/?(?:script|style|template|noscript)\b/i.test(visible))fail('malformed inactive element');
 if(/<!\[CDATA\[/i.test(visible))fail('unreviewed visible CDATA');
 return visible;
}
function reviewPage(html,scopes){
 const articles=[...html.matchAll(/<article\b([^>]*)>([^]*?)<\/article\s*>/gi)];
 if(articles.length!==1||(html.match(/<article\b/gi)||[]).length!==1)fail('release article scope');
 const [,attributes,article]=articles[0],first=scopes[0];
 const about=/\babout\s*=\s*(["'])([^"']+)\1/i.exec(attributes)?.[2];
 if(about!==new URL(first.sourceUrl).pathname)fail('release article source path');
 const titles=[...article.matchAll(/<h1\b[^>]*>([^]*?)<\/h1\s*>/gi)].map(match=>decodeHtmlText(match[1]));
 if(titles.filter(title=>title===first.sourceTitle).length!==1)fail('release title');
 const dates=[...article.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bfield--name-field-release-date\b[^"']*["'])[^>]*>([^]*?)<\/div\s*>/gi)];
 if(dates.length!==1||decodeHtmlText(dates[0][1])!==first.releaseDateText)fail('release date');
 const allText=decodeHtmlText(article);
 const headings=[...article.matchAll(/<h([23])\b[^>]*>([^]*?)<\/h\1\s*>/gi)];
 for(const scope of scopes){
  if(scope.sourceTitle!==first.sourceTitle||scope.releaseDateText!==first.releaseDateText)fail('reviewed page identity');
  for(const passage of scope.sourcePassages)if(!allText.includes(passage))fail('missing reviewed release passage');
  const selected=headings.filter(match=>decodeHtmlText(match[2])===scope.sectionHeading);
  if(selected.length!==1)fail('reviewed source section heading');
  const heading=selected[0],start=heading.index+heading[0].length;
  const next=headings.find(match=>match.index>=start&&Number(match[1])<=Number(heading[1]));
  const section=decodeHtmlText(article.slice(start,next?.index??article.length));
  for(const passage of scope.sectionPassages)if(!section.includes(passage))fail('missing reviewed section passage');
 }
}
/** Review every admitted explanation on the page before selecting a subset. */
export function parsePublicationExplanationPage(input,{provenance,ids}={}){
 const scopes=publicationExplanationScope.filter(scope=>scope.sourceUrl===provenance?.url);
 if(!scopes.length)fail('unreviewed source URL scope');
 const requested=requestedExplanationIds(ids??scopes.map(scope=>scope.publicationId));
 if(requested.some(id=>!scopes.some(scope=>scope.publicationId===id)))fail('requested explanation source scope');
 reviewPage(visibleHtml(input),scopes);
 const byId=new Map(scopes.map(scope=>[scope.publicationId,scope]));
 const archive={version:1,explanations:requested.map(id=>({...explanationMetadataFor(byId.get(id)),provenance:[provenance]}))};
 assertPublicationExplanations(archive,{ids:requested});return archive;
}
export async function collectPublicationExplanations({ids,fetchImpl=globalThis.fetch}={}){
 const requested=requestedExplanationIds(ids),byId=new Map(publicationExplanationScope.map(scope=>[scope.publicationId,scope]));
 const urls=[...new Set(requested.map(id=>byId.get(id).sourceUrl))];
 const batches=await Promise.all(urls.map(async url=>{
  const response=await requestText(url,{maxBytes,headers:{Accept:'text/html'},fetchImpl:async(source,options)=>{
   const result=await fetchImpl(source,options);if(result.redirected||result.url&&result.url!==source)fail('unreviewed source redirect');return result;
  }});
  const {text,...provenance}=response;
  return parsePublicationExplanationPage(text,{provenance,ids:requested.filter(id=>byId.get(id).sourceUrl===url)});
 }));
 const records=new Map(batches.flatMap(batch=>batch.explanations).map(record=>[record.publicationId,record]));
 const archive={version:1,explanations:requested.map(id=>records.get(id))};assertPublicationExplanations(archive,{ids:requested});return archive;
}
