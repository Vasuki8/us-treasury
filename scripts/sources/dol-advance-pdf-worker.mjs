import {parentPort,workerData} from 'node:worker_threads';
import {getDocumentProxy} from 'unpdf';

let pdf;
try {
 pdf=await getDocumentProxy(new Uint8Array(workerData),{isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,disableAutoFetch:true,disableRange:true,disableStream:true,stopAtErrors:true,maxImageSize:1_000_000});
 if(!Number.isInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>16)throw new Error('DOL advance PDF page limit exceeded');
 const texts=[];
 for(let number=1;number<=Math.min(pdf.numPages,5);number++){
  const page=await pdf.getPage(number);
  try {
   const content=await page.getTextContent();
   if(content.items.length>20000)throw new Error('DOL advance PDF text item limit exceeded');
   const text=content.items.map(item=>item.str??'').join(' ');
   if(text.length>100000)throw new Error('DOL advance PDF page text limit exceeded');
   texts.push(text);
  }finally{await page.cleanup();}
 }
 await pdf.loadingTask.destroy();pdf=null;
 parentPort.postMessage({firstPage:texts[0],tableText:texts.join('\n')});
}catch(error){parentPort.postMessage({error:String(error.message||error)});}
finally{if(pdf)await pdf.loadingTask.destroy();}
