/** Resize an explicitly selected photo for an image API. Metadata is stripped by canvas
 * re-encoding. Do not persist the returned data URL; clear it when the modal closes.
 * HEIC availability depends on device decoding. Blob URLs and image bitmaps are disposed.
 */
export async function prepareImage(file, { maxSide=1800, maxInputBytes=20*1024*1024, maxBytes=3*1024*1024 }={}) {
  if(!file || !file.type.startsWith('image/') || file.size>maxInputBytes)throw new Error('IMAGE_INVALID');
  let bitmap, image, url;
  try {
    if(globalThis.createImageBitmap) {try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}}
    if(!bitmap){url=URL.createObjectURL(file);image=new Image();image.src=url;await image.decode();}
    const source=bitmap||image;const width=source.width||source.naturalWidth,height=source.height||source.naturalHeight;
    if(!width||!height||width*height>80000000)throw Error();
    const scale=Math.min(1,maxSide/Math.max(width,height));const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.85);if(data.length*3/4>maxBytes)throw Error();return data;
  }catch{throw new Error('IMAGE_INVALID');}
  finally{bitmap?.close();if(url)URL.revokeObjectURL(url);}
}
