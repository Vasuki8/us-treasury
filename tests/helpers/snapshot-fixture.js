import {readFileSync} from 'node:fs';
import {cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeStoredSnapshot,writeStoredSnapshot} from '../../scripts/snapshot-storage.mjs';

export const snapshot=decodeStoredSnapshot(readFileSync(new URL('../fixtures/ui-snapshot/snapshot.json.gz',import.meta.url)));
const root=fileURLToPath(new URL('../../',import.meta.url));
const defaults=['src','scripts','fonts','index.html','styles.css','favicon.svg','package.json','server.mjs'];
function scratchDirectory(destination){
  const target=path.resolve(destination),relative=path.relative(root,target),parent=path.relative(target,root);
  if(!parent||!parent.startsWith('..')&&!path.isAbsolute(parent))throw new Error('A fixture cannot replace the repository or its parents');
  if(!relative.startsWith('..')&&!path.isAbsolute(relative)&&!['test-results','output','tmp'].includes(relative.split(path.sep)[0])){
    throw new Error('Repository fixture copies belong in test-results, output or tmp');
  }
  return target;
}

/** Write real indexed gzip/capture files in a sandbox; no production snapshot or history is copied. */
export async function installSnapshotFixture(destination){
  const directory=scratchDirectory(destination);
  await mkdir(path.join(directory,'src'),{recursive:true});
  return writeStoredSnapshot(snapshot,{destination:path.join(directory,'src','official-snapshot.json.gz')});
}

export async function copyFixtureProject(destination,names=defaults){
  const directory=scratchDirectory(destination),history=path.join(root,'src','history');
  const canonical=path.join(root,'src','official-snapshot.json.gz');
  await mkdir(directory,{recursive:true});
  for(const name of names){
    const source=path.resolve(root,name),relative=path.relative(root,source);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Fixture input must belong to the project');
    await cp(source,path.join(directory,name),{recursive:true,filter:input=>input!==canonical&&input!==history});
  }
  await installSnapshotFixture(directory);
  return directory;
}
