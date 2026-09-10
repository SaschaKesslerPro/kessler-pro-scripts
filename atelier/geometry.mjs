// Client preview guard. Contour points follow the original engine's rounded path.
export function pointInPolygon(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
export function segmentDistance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function boundaryDistance(p,poly){return Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length])));}
function footprint(c){
  if(c.t==='p')return (c.pts||[]).map(p=>[c.cx+p[0],c.cy+p[1]]);
  const w=c.t==='k'?(c.dir==='quer'?c.w/10:c.len):c.w;
  const h=c.t==='k'?(c.dir==='quer'?c.len:c.w/10):c.h;
  return [[c.cx-w/2,c.cy-h/2],[c.cx+w/2,c.cy-h/2],[c.cx+w/2,c.cy+h/2],[c.cx-w/2,c.cy+h/2]];
}
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersect(a,b,c,d){const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return p*q<0&&r*s<0;}
function polysCross(a,b){return a.some((p,i)=>b.some((q,j)=>intersect(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));}
function overlap(a,b){
  if(a.t==='c'&&b.t==='c')return Math.hypot(a.cx-b.cx,a.cy-b.cy)<(a.d+b.d)/2+0.01;
  if(b.t==='c')return overlap(b,a);
  if(a.t==='c'){const p=footprint(b);return pointInPolygon([a.cx,a.cy],p)||boundaryDistance([a.cx,a.cy],p)<=a.d/2+0.01;}
  const p=footprint(a),q=footprint(b);return polysCross(p,q)||p.some(v=>pointInPolygon(v,q))||q.some(v=>pointInPolygon(v,p));
}
export function validateCuts(cuts,poly,minEdge=5){
  const errors=[];
  cuts.forEach((c,i)=>{
    let valid=true;
    if(c.t==='c')valid=Number.isFinite(c.d)&&c.d>0&&Number.isFinite(c.cx)&&Number.isFinite(c.cy);
    else if(c.t==='p')valid=Number.isFinite(c.cx)&&Number.isFinite(c.cy)&&Array.isArray(c.pts)&&c.pts.length>=3&&c.pts.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
    else valid=[c.cx,c.cy,c.t==='k'?c.len:c.w,c.t==='k'?c.w:c.h].every(Number.isFinite)&&(c.t==='k'?c.len>0&&c.w>0:c.w>0&&c.h>0);
    if(!valid){errors.push({index:i,message:'Bitte gib gültige Maße für diese Bearbeitung ein.'});return;}
    if(c.t==='c'){
      const p=[c.cx,c.cy],dist=boundaryDistance(p,poly);
      if(!pointInPolygon(p,poly)||dist<c.d/2-0.01)errors.push({index:i,message:'Die Bohrung liegt außerhalb der Platte. Verschiebe sie vollständig auf die Materialfläche.'});
      else if(dist-c.d/2<minEdge-0.02)errors.push({index:i,message:`Halte mindestens ${minEdge*10} mm Abstand zwischen Bohrungsrand und Plattenkante.`});
    }else{
      const p=footprint(c);
      if(p.some(v=>!pointInPolygon(v,poly))||polysCross(p,poly))errors.push({index:i,message:'Der Ausschnitt liegt außerhalb der Platte. Verschiebe ihn vollständig auf die Materialfläche.'});
      else if(c.t!=='k'&&p.some(v=>boundaryDistance(v,poly)<minEdge-0.02))errors.push({index:i,message:`Halte mindestens ${minEdge*10} mm Abstand zur Plattenkante.`});
    }
    for(let j=0;j<i;j++) if(overlap(c,cuts[j])){errors.push({index:i,message:`Diese Bearbeitung überschneidet sich mit Bearbeitung ${j+1}. Bitte verschiebe oder entferne sie.`});break;}
  });return errors;
}
