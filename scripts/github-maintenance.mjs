export const repository='Vasuki8/us-treasury',base=`/repos/${repository}`;

export function githubApi(token,fetchImpl=fetch){
 if(!token)throw new Error('Repository notification token is unavailable.');
 return async(method,apiPath,body)=>{
  if(!apiPath.startsWith(`${base}/`))throw new Error('Unsupported repository notification path.');
  let response;
  try{response=await fetchImpl(`https://api.github.com${apiPath}`,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
  catch{throw new Error('GitHub maintenance request could not complete.');}
  if(!response.ok)throw new Error(`GitHub maintenance request failed (HTTP ${response.status}).`);
  return response.json();
 };
}

export async function listGithub(api,apiPath,key){
 const items=[];
 for(let page=1;;page++){
  const response=await api('GET',`${apiPath}${apiPath.includes('?')?'&':'?'}per_page=100&page=${page}`);
  const batch=key?response[key]:response;
  if(!Array.isArray(batch))throw new Error('GitHub maintenance returned an invalid collection.');
  items.push(...batch);if(batch.length<100)return items;
 }
}

export async function createNotice(api,title,body){
 const issue=await api('POST',`${base}/issues`,{title,body,assignees:['Vasuki8']});
 if(!issue.assignees?.some(assignee=>(typeof assignee==='string'?assignee:assignee.login)==='Vasuki8'))throw new Error('GitHub did not assign the maintenance notification recipient.');
 return issue;
}

/** Managed bot comments preserve delivered transitions when an issue update is interrupted. */
export async function syncHealthIssue({api,issues,key,health,title,message,link,footer='',observedAt=null}){
 if(!/^[a-z0-9:-]+$/.test(key)||!['ok','failed','unverified'].includes(health))throw new Error('Invalid maintenance incident state.');
 const marker=`<!-- ${key}:health -->`,prefix=`<!-- ${key}:health:`;
 const issue=issues.find(issue=>!issue.pull_request&&issue.user?.login==='github-actions[bot]'&&Number.isSafeInteger(issue.number)&&issue.body?.startsWith(marker));
 if(!issue&&health==='ok')return {created:0,updated:0};
 const bodyHealth=issue?.body?.match(/<!-- health:(ok|failed|unverified) -->/)?.[1];
 const comments=issue?await listGithub(api,`${base}/issues/${issue.number}/comments`):[];
 const transition=comments.filter(comment=>comment.user?.login==='github-actions[bot]'&&comment.body?.startsWith(prefix)).at(-1);
 const previousHealth=transition?.body?.slice(prefix.length).match(/^(ok|failed|unverified) -->/)?.[1]??bodyHealth;
 const evidence=text=>text?.match(/<!-- evidence-at:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) -->/)?.[1]??null;
 const previousAt=[evidence(issue?.body),evidence(transition?.body)].filter(Boolean).sort().at(-1);
 if(observedAt&&(!Number.isFinite(Date.parse(observedAt))||new Date(observedAt).toISOString()!==observedAt))throw new Error('Invalid maintenance evidence timestamp.');
 if(observedAt&&previousAt&&observedAt<previousAt)return {created:0,updated:0};
 const metadata=observedAt?`\n<!-- evidence-at:${observedAt} -->`:'';
 const body=`${marker}\n<!-- health:${health} -->${metadata}\n\n@Vasuki8 ${message}\n\n${link}\n\n${footer}\n`;
 if(issue&&previousHealth===health&&bodyHealth===health){
  if(observedAt&&(!previousAt||observedAt>previousAt)){await api('PATCH',`${base}/issues/${issue.number}`,{body});return {created:0,updated:1};}
  return {created:0,updated:0};
 }
 if(!issue){await createNotice(api,title,body);return {created:1,updated:0};}
 if(previousHealth!==health)await api('POST',`${base}/issues/${issue.number}/comments`,{body:`${prefix}${health} -->${metadata}\n\n@Vasuki8 ${message}\n\n${link}`});
 await api('PATCH',`${base}/issues/${issue.number}`,{title,body,state:health==='ok'?'closed':'open',...(health==='ok'?{state_reason:'completed'}:{})});
 return {created:0,updated:1};
}
