import type {WebGLRenderer} from 'three';

/** Canvas resizing clears its drawing buffer. Commit a changed size only at
 * the start of a presentation, then draw the world AND weapon before yielding.
 * Resize observers and quality controls must only request another frame. */
export class FrameSurface {
 private width=0;private height=0;private dpr=0;
 constructor(
  private renderer:Pick<WebGLRenderer,'setDrawingBufferSize'>,
  private layout:(width:number,height:number,dpr:number)=>void,
 ){}
 present(width:number,height:number,dpr:number,draw:()=>void):boolean{
  if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(dpr)||width<1||height<1||dpr<=0)return false;
  width=Math.floor(width);height=Math.floor(height);
  if(width!==this.width||height!==this.height||dpr!==this.dpr){
   this.renderer.setDrawingBufferSize(width,height,dpr);
   this.layout(width,height,dpr);
   this.width=width;this.height=height;this.dpr=dpr;
  }
  draw();return true;
 }
}
