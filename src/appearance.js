export const defaultAppearance={fontFamily:'Microsoft YaHei',fontSize:10,fontSizeUnit:'pt',fontStyle:'Regular',zoom:100,lineNumbers:false,theme:'light',aiWidth:360,inputHeight:120,wrap:true,statusBar:true};
export const fontSizes=[8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72];
export const normalizeFontSize=value=>fontSizes.reduce((best,size)=>Math.abs(size-value)<Math.abs(best-value)?size:best,fontSizes[0]);

export function restoreAppearance(saved={}){
 const appearance={...defaultAppearance,...saved,fontSizeUnit:'pt'};
 // Older versions stored CSS pixels; migrate to the nearest Notepad preset.
 const size=Number(saved.fontSize);
 appearance.fontSize=Number.isFinite(size)&&size>0?normalizeFontSize(size*(saved.fontSizeUnit==='pt'?1:.75)):10;
 appearance.fontStyle=['Regular','Italic','Bold','Bold Italic'].includes(saved.fontStyle)?saved.fontStyle:'Regular';
 appearance.zoom=Math.max(50,Math.min(300,Math.round((Number(saved.zoom)||100)/10)*10));
 return appearance;
}

export const fontPixels=appearance=>Math.round(appearance.fontSize*4/3*1000)/1000;
