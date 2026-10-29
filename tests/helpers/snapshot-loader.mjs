const canonical=new URL('../../src/official-snapshot.js',import.meta.url).href;
const fixture=new URL('./snapshot-fixture.js',import.meta.url).href;

export async function load(url,context,nextLoad){
  const target=new URL(url);
  target.search='';
  if(target.href===canonical){
    return {format:'module',source:`export {snapshot} from ${JSON.stringify(fixture)};`,shortCircuit:true};
  }
  return nextLoad(url,context);
}
