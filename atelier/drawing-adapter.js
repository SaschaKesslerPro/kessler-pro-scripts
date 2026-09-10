/* Injected inside the original core so annotations use its exact shape geometry. */
function atelierCornerDetails(){
  if(!cornerFormOk()||!cornerCount())return [];
  const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null;
  return cornerIdx().map((id,index)=>{
    const at=g?g.ord.indexOf(id):-1, requested=cornerR(id);
    const radius=at>=0?g.rad[at]*10:requested;
    return {id,number:index+1,name:cornerName(id),radius:Math.round(radius*10)/10,minimum:radius>requested};
  });
}
function atelierCornerMarkers(x,y,sc,pw,ph){
  const corners=atelierCornerDetails();if(!corners.length)return '';
  const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null;
  const pts=g?g.pts.map(([px,py])=>[x+px*sc,y+py*sc]):[[x,y],[x+pw,y],[x+pw,y+ph],[x,y+ph]];
  const rad=g?g.rad.map(r=>r*sc):cornerRadii(sc,pw/2,ph/2);
  return '<g class="atelier_corner_markers" pointer-events="none">'+corners.map(c=>{
    const at=g?g.ord.indexOf(c.id):c.id, e=eckRundung(pts,rad,at);
    const mx=e.mitte[0],my=e.mitte[1];
    let tx=mx-e.aus[0]*29,ty=my-e.aus[1]*29;
    // Keep the two recess markers above the existing angle annotations.
    if(S.form==='bauch'&&(c.id===3||c.id===4))ty=Math.min(ty,y+(g.BR-g.t)*sc-69);
    tx=Math.max(x+16,Math.min(x+pw-16,tx));ty=Math.max(y+17,Math.min(y+ph-17,ty));
    return `<g><title>Ecke ${c.number}: ${c.name}, ${c.radius?'Radius '+c.radius+' mm':'eckig'}</title><path d="M${mx} ${my}L${tx} ${ty}" fill="none" stroke="#4e4e4e" stroke-width="1.1" stroke-opacity=".6"/><circle cx="${tx}" cy="${ty}" r="12" fill="#fff" stroke="#666" stroke-width="1"/><text x="${tx}" y="${ty+5.5}" text-anchor="middle" font-family="Onest,sans-serif" font-size="17" font-weight="600" fill="#242424">${c.number}</text></g>`;
  }).join('')+'</g>';
}
function atelierLabel(cx,cy,text,kind=''){
  const width=Math.max(42,text.length*9+18);
  return `<g class="atelier_dimension ${kind}" pointer-events="none"><rect x="${cx-width/2}" y="${cy-13}" width="${width}" height="26" rx="5" fill="#fff" fill-opacity=".96" stroke="#d6d6d6" stroke-width=".8"/><text x="${cx}" y="${cy+5.5}" text-anchor="middle" fill="#171717" font-family="Onest,sans-serif" font-size="17" font-weight="500">${text}</text></g>`;
}
function atelierMeasureH(a,b,y,text){
  return `<g class="atelier_dimension" pointer-events="none" stroke="#565656" stroke-width="1.3"><path d="M${a} ${y}H${b} M${a} ${y-5}v10 M${b} ${y-5}v10" fill="none"/></g>`+atelierLabel((a+b)/2,y,text);
}
function atelierNotchDimensions(x,y,sc,pw,ph,g){
  const left=g.pos==='vl'||g.pos==='hl',front=g.pos==='vl'||g.pos==='vr';
  const x0=left?x:x+pw-g.aw*sc,x1=left?x+g.aw*sc:x+pw;
  const y0=front?y+ph-g.ah*sc:y,y1=front?y+ph:y+g.ah*sc;
  const cy=(y0+y1)/2, cx=(x0+x1)/2;
  const fmt=v=>String(Math.round(v*10)/10).replace('.',',');
  // Separate the two measurements, anchored to the actual empty notch.
  let out=atelierMeasureH(x0+5,x1-5,cy-18,`${fmt(g.aw)} cm`);
  const vx=left?x0+18:x1-18;
  out+=`<path class="atelier_dimension" d="M${vx} ${y0+5}V${y1-5} M${vx-5} ${y0+5}h10 M${vx-5} ${y1-5}h10" fill="none" stroke="#565656" stroke-width="1.3" pointer-events="none"/>`;
  out+=atelierLabel(cx,cy+22,`Tiefe ${fmt(g.ah)} cm`);
  return out;
}
function atelierBauchDimensions(x,y,sc,pw,ph,g){
  const f=v=>String(Math.round(v*10)/10).replace('.',',');
  const yf=y+ph, yi=y+(g.BR-g.t)*sc;
  const xa=x+g.a*sc, xb=x+(g.L-g.b)*sc;
  const c0=x+(g.welle?g.a:g.a+g.r1)*sc,c1=x+(g.L-g.b-(g.welle?0:g.r2))*sc;
  const mid=(c0+c1)/2;
  // One aligned dimension row outside the material; no floating label badges.
  const ink='#303030', baseline=yf+31;
  const text=(tx,ty,label)=>`<text x="${tx}" y="${ty}" text-anchor="middle" fill="${ink}" stroke="#f7f7f7" stroke-width="4" stroke-opacity=".92" paint-order="stroke" stroke-linejoin="round" font-family="Onest,sans-serif" font-size="22" font-weight="500">${label}</text>`;
  const line=(d,dashed=false)=>`<path d="${d}" fill="none" stroke="${ink}" stroke-opacity="${dashed?'.38':'.72'}" stroke-width="1.25"${dashed?' stroke-dasharray="4 4"':''}/>`;
  const measure=(a,b,startY,label)=>line(`M${a} ${startY+5}V${baseline+5} M${b} ${startY+5}V${baseline+5}`,true)
    +line(`M${a} ${baseline}H${b} M${a-3} ${baseline+4}l6 -8 M${b-3} ${baseline+4}l6 -8`)
    +text((a+b)/2,baseline-9,label);
  let out=measure(x,xa,yf,`A ${f(g.a)}`)+measure(xb,x+pw,yf,`B ${f(g.b)}`);
  out+=measure(c0,c1,g.welle?yf:yi,g.welle?`Mulde ${f(g.oeffnung)}`:`C ${f(g.c)}`);
  // The depth measures the actual recess, from its floor to the front edge.
  // Its label stays in the material, as requested, with a short leader.
  out+=line(`M${xa} ${yf}H${xb}`,true);
  out+=line(`M${mid} ${yi}V${yf} M${mid-5} ${yi}h10 M${mid-5} ${yf}h10`);
  const depthY=Math.max(y+27,yi-33);
  out+=text(mid,depthY,`Tiefe ${f(g.t)} cm`);
  out+=line(`M${mid} ${depthY+8}V${yi-5}`,true);
  if(!g.welle){
    for(const [px,value,side,run] of [[xa,g.w1,-1,g.r1],[xb,g.w2,1,g.r2]]){
      const radius=Math.min(29,Math.max(15,(side<0?g.a:g.b)*sc*.3));
      const endAngle=Math.atan2(-g.t*sc,-side*run*sc);
      const ex=px+Math.cos(endAngle)*radius, ey=yf+Math.sin(endAngle)*radius;
      out+=line(`M${px+side*radius} ${yf}A${radius} ${radius} 0 0 ${side<0?1:0} ${ex} ${ey}`);
      const tx=Math.max(x+31,Math.min(x+pw-31,px+side*24));
      out+=text(tx,yf-radius-15,`${f(value)}°`);
    }
  }
  return `<g class="atelier_dimension atelier_bauch_dimensions" pointer-events="none">${out}</g>`;
}
