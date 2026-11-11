import {BufferGeometry,CanvasTexture,CylinderGeometry,DoubleSide,ExtrudeGeometry,Float32BufferAttribute,Group,Mesh,MeshPhysicalMaterial,MeshStandardMaterial,Shape,SRGBColorSpace,SphereGeometry} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {OUTFITS,OUTFIT_EDITIONS,type OutfitId} from './outfits';

/** Offline tailoring only. Exported geometry is used by BOTH photo and inspector. */
export function uniformFabric(id:OutfitId){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#b9c0c3';ctx.fillRect(0,0,128,128);
 let seed=id.split('').reduce((n,c)=>n+c.charCodeAt(0),0);
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const v=155+Math.floor(random()*65);ctx.fillStyle=`rgb(${v},${v+2},${v+3})`;ctx.fillRect(x,y,1,2);}
 if(['crimson','golden','founder'].includes(id))for(let i=0;i<100;i++){ctx.fillStyle=i%2?'#626b7155':'#e8eaeb44';ctx.fillRect(Math.floor(random()*32)*4,Math.floor(random()*32)*4,4+Math.floor(random()*3)*4,4+Math.floor(random()*3)*4);}
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.name='RIVALS woven fabric / '+id;return texture;
}
export function buildOutfitArmor(parent:Group,id:OutfitId){
 const outfit=OUTFITS[id],edition=OUTFIT_EDITIONS[id],elite=id==='midnight',command=id==='commander',tech=id==='cyber',heavy=elite||command||tech;
 const group=new Group();group.name='RIVALS_TAILORED_'+edition.tier;parent.add(group);
 const armor=new MeshStandardMaterial({name:id+' / ballistic composite',color:command?'#64717b':outfit.gear,roughness:.64,metalness:command?.55:.22});
 const dark=new MeshStandardMaterial({name:'Graphite woven equipment',color:'#202a31',roughness:.87,metalness:.04});
 const edge=new MeshStandardMaterial({name:'Brushed titanium hardware',color:command?'#b9c4c7':'#6c7f8a',roughness:.36,metalness:.7});
 const accent=new MeshStandardMaterial({name:'Woven unit insignia',color:tech?'#416c75':id==='neon'?'#727d52':command?'#723c3a':'#52636c',roughness:.83,metalness:.05});
 const glass=new MeshPhysicalMaterial({name:'Curved optical glass',color:elite?'#456b82':'#293c48',roughness:.16,metalness:.47,clearcoat:1,side:DoubleSide});
 const part=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material=armor,radius=.012)=>{
  const mesh=new Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/3,h/3,d/3)),material);mesh.name=id+' / '+name;mesh.position.set(x,y,z);group.add(mesh);return mesh;
 };
 const tube=(name:string,r:number,length:number,x:number,y:number,z:number,material=edge)=>{const mesh=new Mesh(new CylinderGeometry(r,r,length,12),material);mesh.name=id+' / '+name;mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const plate=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material=armor)=>{
  const shape=new Shape();shape.moveTo(-w*.5,-h*.32);shape.lineTo(-w*.34,-h*.5);shape.lineTo(w*.34,-h*.5);shape.lineTo(w*.5,-h*.32);shape.lineTo(w*.5,h*.3);shape.lineTo(w*.25,h*.5);shape.lineTo(-w*.25,h*.5);shape.lineTo(-w*.5,h*.3);shape.closePath();
  const geometry=new ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.004,bevelThickness:.004,curveSegments:1});geometry.translate(0,0,-d/2);
  const mesh=new Mesh(geometry,material);mesh.name=id+' / '+name;mesh.position.set(x,y,z);group.add(mesh);return mesh;
 };
 const face=(name:string,width:number,height:number,y:number,material:MeshStandardMaterial)=>{
  const vertices:number[]=[],indices:number[]=[];
  for(let row=0;row<=4;row++)for(let col=0;col<=20;col++){const a=(col/20-.5)*1.9;vertices.push(Math.sin(a)*width*.62,y+(row/4-.5)*height,.035+Math.cos(a)*.14);if(row<4&&col<20){const i=row*21+col;indices.push(i,i+1,i+21,i+1,i+22,i+21);}}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new Mesh(geometry,material);mesh.name=id+' / '+name;group.add(mesh);
 };
 if(id==='urban'){parent.userData.rivalsEdition=edition;return;}
 // A real stitched patch and buckle, not luminous floating decoration.
 part('unit tab',.055,.025,.008,-.115,1.4,.163,accent,.002);
 if(id==='shadow'||id==='crimson'){
  face('curved assault visor',.245,.075,1.69,glass);face('ballistic lower face guard',.2,.1,1.59,dark);
  part('breacher upper plate',.275,.16,.055,0,1.34,.16);
  for(const side of [-1,1]){part('shoulder cap',.13,.055,.16,side*.235,1.44,.005);part('carrier webbing',.025,.28,.015,side*.13,1.26,.2,dark,.003);}
 }
 if(id==='neon'||elite){
  part('optics rail',.17,.025,.075,0,1.795,.09,dark,.005);
  for(const side of [-1,1])for(let row=0;row<(elite?2:1);row++){
   const scope=tube('night optic housing',.024,.105,side*.04,1.756-row*.045,.16,dark);scope.rotation.x=Math.PI/2;
   const lens=tube('coated objective lens',.019,.008,side*.04,1.756-row*.045,.214,glass);lens.rotation.x=Math.PI/2;
   part('optics mount',.025,.025,.045,side*.04,1.782-row*.045,.11,edge,.003);
  }
 }
 if(heavy){
  part('torso carrier backing',.34,.35,.085,0,1.285,.115,dark);
  for(const side of [-1,1]){
   const chest=plate('layered chest ceramic',.14,.195,.035,side*.083,1.345,.211);chest.rotation.z=side*-.045;
   for(let row=0;row<3;row++)plate('segmented abdominal plate',.135,.042,.025,side*.078,1.215-row*.044,.214,command?armor:dark);
   for(let row=0;row<3;row++)part('carrier attachment rail',.09,.004,.005,side*.08,1.38-row*.022,.238,edge,.001);
   for(const y of [1.41,1.28]){const bolt=tube('carrier fastener',.003,.004,side*.117,y,.236,edge);bolt.rotation.x=Math.PI/2;}
   const shoulder=new Mesh(new SphereGeometry(.1,20,10,0,Math.PI*2,0,Math.PI*.6),armor);shoulder.name=id+' / shoulder ballistic shell';shoulder.position.set(side*.237,1.414,0);shoulder.scale.set(.84,.55,.91);shoulder.rotation.z=side*-.2;group.add(shoulder);
   if(command)for(let row=0;row<2;row++){const segment=plate('layered command pauldron',.125,.043,.035,side*(.26+row*.008),1.414-row*.035,.062);segment.rotation.z=side*-.24;}
   part('upper arm insignia',.05,.035,.007,side*.29,1.32,.083,accent,.003);
   const forearm=plate('armored gauntlet',.083,.16,.026,side*.31,1.02,.094);forearm.rotation.z=side*.13;
   for(let i=0;i<3;i++)part('gauntlet band',.085,.007,.012,side*.31,1.075-i*.043,.114,dark,.003);
   const thigh=plate('thigh plate',.105,command?.21:.15,.022,side*.117,.76,.132);thigh.rotation.z=side*-.05;
   plate('kneepad ceramic',.112,.1,.035,side*.115,.46,.137);
   if(command){plate('segmented shin guard',.1,.2,.025,side*.12,.285,.127);plate('shin inset',.05,.13,.008,side*.12,.285,.144,dark);}
  }
  part('wrist instrument',.08,.065,.025,-.32,1.045,.111,dark);
  part('wrist screen',.057,.042,.007,-.32,1.045,.127,new MeshStandardMaterial({color:'#637f88',roughness:.25,metalness:.3}));
  const pack=part('radio backpack',.26,command?.4:.31,.13,0,1.27,-.172,dark);
  for(let side=-1;side<=1;side++)part('backpack vertical rib',.014,.25,.018,side*.075,1.28,-.245,edge,.004);
  part('radio transceiver',.065,.095,.065,.12,1.45,-.18,dark);
  tube('flexible radio antenna',.004,command?.36:.27,.12,1.62,-.18,dark);
  if(command)tube('secondary command antenna',.003,.28,-.11,1.59,-.18,dark);
  pack.userData.edition=edition.tier;
 }
 if(command){
  // Sculpted shell follows the head; the face remains a separate optical surface.
  const shell=new Mesh(new SphereGeometry(.131,24,16,0,Math.PI*2,0,Math.PI*.58),armor);shell.name=id+' / sealed command helmet';shell.position.set(0,1.702,-.006);shell.scale.set(1,1,1.1);group.add(shell);
  face('sealed panoramic visor',.25,.075,1.688,glass);face('ceramic respirator',.222,.109,1.591,armor);
  part('respirator graphite inset',.115,.046,.015,0,1.583,.181,dark,.006);
  for(const side of [-1,1]){
   const vent=tube('respirator filter',.025,.028,side*.092,1.577,.136,dark);vent.rotation.x=Math.PI/2;
   part('helmet side rail',.035,.04,.13,side*.121,1.716,.008,edge,.005);
   part('helmet brow',.095,.018,.025,side*.051,1.739,.13,armor,.004);
  }
  part('sternum command crest',.025,.043,.012,0,1.359,.241,accent,.004);
  // Split shoulder mantle is curved tailored cloth, not a giant rigid cube.
  const vertices:number[]=[],indices:number[]=[];
  for(const side of [-1,1]){
   const start=vertices.length/3;
   for(let row=0;row<=12;row++)for(let col=0;col<=8;col++){const v=row/12,u=col/8;vertices.push(side*(.02+u*(.185+.035*v)),1.43-v*.61,-.2-.065*Math.sin(u*Math.PI)+.018*Math.sin(v*5+u*5));if(row<12&&col<8){const i=start+row*9+col;indices.push(i,i+9,i+1,i+1,i+9,i+10);}}
  }
  const cloth=new BufferGeometry();cloth.setAttribute('position',new Float32BufferAttribute(vertices,3));cloth.setIndex(indices);cloth.computeVertexNormals();const mantle=new Mesh(cloth,new MeshStandardMaterial({name:'Charcoal command mantle',color:'#323b44',roughness:.95,side:DoubleSide}));mantle.name=id+' / split command mantle';group.add(mantle);
 }
 if(tech){face('technical face shield',.24,.09,1.67,glass);for(const side of [-1,1])part('cyan equipment marker',.035,.065,.009,side*.125,1.36,.223,accent,.002);}
 if(id==='golden'||id==='founder'){
  for(const side of [-1,1]){part('veteran shoulder reinforcement',.135,.06,.16,side*.23,1.44,0);part('utility chest module',.105,.13,.065,side*.1,1.27,.17,dark);}
  part('numbered metal insignia',.065,.025,.01,0,1.4,.173,edge,.002);
 }
 parent.userData.rivalsEdition={...edition,assemblies:group.children.map(child=>child.name)};
 // Shared materials keep generated exports compact; no runtime tailoring work.
}
