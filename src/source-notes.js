/** Source qualifiers stay text until the rendering boundary escapes them. */
export function normalizeSourceNotes(notes){
 return [...new Set((Array.isArray(notes)?notes:[]).map(note=>{
  if(typeof note==='string')return note.trim();
  if(!note||typeof note!=='object'||Array.isArray(note))return '';
  const text=typeof note.text==='string'?note.text.trim():'',code=typeof note.code==='string'?note.code.trim():'';
  return text||(code?`Source footnote code ${code}`:'');
 }).filter(Boolean))];
}
