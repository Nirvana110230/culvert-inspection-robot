// Keep sub-step drag movement in `raw` so slow drags accumulate smoothly.
export function advanceSliderDrag(raw,deltaPixels,trackPixels,min,max,factor,step){
  const next=Math.min(max,Math.max(min,raw+deltaPixels*(max-min)/Math.max(1,trackPixels)*factor));
  const snapped=Math.round((next-min)/step)*step+min;
  return {raw:next,value:Number(Math.min(max,Math.max(min,snapped)).toFixed(8))};
}
