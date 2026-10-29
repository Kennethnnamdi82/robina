#!/usr/bin/env python3
"""Create original production-oriented Rivals 2D source asset package.
Original procedural/vector sprite art; real transparent PNGs and WAVs; no stock copyrighted art.
This is a high-coverage development kit, not guaranteed AAA final artwork or finished game.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
from pathlib import Path
import os, json, math, random, wave, struct, zipfile, shutil, re, hashlib
import numpy as np
random.seed(36)
ROOT=Path('/mnt/data/RIVALS_ULTIMATE_2D_KIT')
A=ROOT/'public'/'assets'
for d in ['characters','enemies','bosses','tiles','tilesets','props','vfx','ui','nft','audio/sfx','audio/music','maps','data','docs/prompts','references','demo/src','demo/public/assets','tests','src']: (ROOT/d).mkdir(parents=True,exist_ok=True)
for d in ['characters','enemies','bosses','tiles','tilesets','props','vfx','ui','nft','audio/sfx','audio/music','maps','data']: (A/d).mkdir(parents=True,exist_ok=True)
C={'bg':(9,14,30),'deep':(14,22,39),'metal':(33,47,72),'mid':(47,62,90),'line':(89,117,151),'cyan':(39,211,249),'pink':(201,89,251),'red':(255,77,106),'amber':(255,185,67),'green':(53,234,183),'white':(235,245,255),'blue':(70,130,246)}
S=3
font='/usr/share/fonts/truetype/lato/Lato-Black.ttf'; font2='/usr/share/fonts/truetype/lato/Lato-Bold.ttf'; fontreg='/usr/share/fonts/truetype/lato/Lato-Regular.ttf'
def ft(size,bold=True): return ImageFont.truetype(font if bold else fontreg,size)
def rgba(color,a=255): return (*C.get(color,color)[:3],a) if isinstance(color,str) else (*color[:3],a)
def canvas(w=96,h=96,bg=(0,0,0,0)): return Image.new('RGBA',(w*S,h*S),bg)
def xy(t): return [round(q*S) for q in t]
def box(d,coords,fill,outline=None,r=0,width=1):
 kwargs={'fill':fill};
 if outline is not None: kwargs.update(outline=outline,width=int(width*S))
 if r:d.rounded_rectangle(xy(coords),radius=int(r*S),**kwargs)
 else:d.rectangle(xy(coords),**kwargs)
def circ(d,coords,fill,outline=None,width=1):d.ellipse(xy(coords),fill=fill,outline=outline,width=int(width*S))
def line(d,p,fill,width=1):d.line([(int(x*S),int(y*S)) for x,y in p],fill=fill,width=int(width*S),joint='curve')
def poly(d,p,fill,outline=None):d.polygon([(int(x*S),int(y*S)) for x,y in p],fill=fill)
def save(im,relative,down=True):
 path=A/relative;path.parent.mkdir(parents=True,exist_ok=True)
 if down:im=im.resize((im.width//S,im.height//S),Image.Resampling.LANCZOS)
 im.save(path);return str(path.relative_to(ROOT))
manifest=[]
def register(category,name,path,**meta):
 data={'category':category,'name':name,'path':path,**meta};manifest.append(data)

# --- A cohesive, polished neon-industrial 64x64 tile family, exported as PNG + Tiled atlas ---
T=64; zones=['neon','phantom','reactor']
P={'neon':((27,46,74),(15,28,53),'cyan'), 'phantom':((47,34,78),(22,19,51),'pink'), 'reactor':((48,62,55),(21,32,39),'green')}
tile_names=['floor_a','floor_b','floor_c','floor_grate','floor_caution','wall_solid','wall_panel','wall_reinforced','floor_circuit','floor_slats','floor_grid','floor_holo','floor_reactor','wall_glow','wall_corner','floor_crack']
def tile(zone,kind):
 base,alt,glow=P[zone];im=canvas(T,T);d=ImageDraw.Draw(im)
 bg=base if kind.startswith('floor') else alt
 box(d,(0,0,T,T),rgba(bg))
 if kind.startswith('floor'):
  for y in (0,32):
   for x in (0,32):
    fill=tuple(max(0,min(255,v+(-3 if x==y else 4))) for v in bg)
    box(d,(x+1,y+1,x+31,y+31),rgba(fill),outline=rgba('line',50),r=1)
    circ(d,(x+4,y+4,x+6,y+6),rgba('white',70))
    circ(d,(x+26,y+25,x+28,y+27),rgba('white',50))
  if kind=='floor_b':
   for x,y in [(12,9),(46,48)]:line(d,[(x,y),(x+8,y)],rgba(glow,115),2)
  if kind=='floor_c':
   for x in [15,48]:box(d,(x,0,x+2,64),rgba('deep',140))
  if kind=='floor_grate':
   box(d,(9,9,55,55),rgba('deep',220),outline=rgba('line',150),width=2)
   for x in range(14,52,6):line(d,[(x,11),(x,53)],rgba('line',155),1)
   for y in range(14,52,6):line(d,[(11,y),(53,y)],rgba('line',100),1)
  if kind=='floor_caution':
   for x in range(-55,100,14):line(d,[(x,63),(x+35,28)],rgba('amber',135),3)
  if kind=='floor_circuit':
   line(d,[(6,34),(22,34),(22,12),(45,12),(45,48),(60,48)],rgba(glow,210),2)
   for x,y in [(22,34),(45,48)]:circ(d,(x-3,y-3,x+3,y+3),rgba(glow,220))
  if kind=='floor_slats':
   for y in range(7,60,8):box(d,(6,y,58,y+3),rgba('deep',150))
  if kind=='floor_grid':
   for x in range(0,65,8):line(d,[(x,0),(x,64)],rgba(glow,40),1)
   for y in range(0,65,8):line(d,[(0,y),(64,y)],rgba(glow,40),1)
  if kind=='floor_holo':
   circ(d,(10,10,54,54),(0,0,0,0),outline=rgba(glow,160),width=2)
   circ(d,(22,22,42,42),(0,0,0,0),outline=rgba(glow,180),width=2)
  if kind=='floor_reactor':
   box(d,(8,8,56,56),rgba('deep',200),outline=rgba('line',180),width=2)
   circ(d,(17,17,47,47),rgba(glow,75),outline=rgba(glow,230),width=2)
  if kind=='floor_crack':
   line(d,[(5,18),(23,28),(18,36),(40,48),(55,41)],rgba('deep',240),3)
 else:
  box(d,(3,3,61,61),rgba('metal'),outline=rgba('line',175),r=3,width=2)
  box(d,(8,8,56,56),rgba('deep'),outline=rgba(glow,130),r=2,width=1)
  if kind=='wall_panel':
   box(d,(14,16,50,43),rgba('mid'),outline=rgba(glow,200),r=3,width=2)
   line(d,[(19,49),(45,49)],rgba(glow,200),2)
  elif kind=='wall_reinforced':
   for x in [10,51]:box(d,(x,7,x+4,57),rgba('metal'))
   for y in [12,50]:box(d,(8,y,56,y+4),rgba('line',160))
  elif kind=='wall_glow':
   line(d,[(9,54),(54,9)],rgba(glow,230),4)
   circ(d,(25,25,39,39),rgba(glow,155))
  elif kind=='wall_corner':
   box(d,(8,8,48,18),rgba('line',140))
   box(d,(8,8,18,49),rgba('line',140))
  else:
   for a in [12,52]:circ(d,(a-2,a-2,a+2,a+2),rgba(glow,175))
 return im
for zone in zones:
 atlas=Image.new('RGBA',(T*4,T*4))
 for idx,kind in enumerate(tile_names):
  im=tile(zone,kind);path=save(im,f'tiles/{zone}/{kind}.png')
  atlas.alpha_composite(Image.open(A/f'tiles/{zone}/{kind}.png'),((idx%4)*T,(idx//4)*T))
  register('tile',zone+'/'+kind,path,w=T,h=T,collision=kind.startswith('wall'))
 path=A/f'tilesets/{zone}_atlas_4x4.png';atlas.save(path)
 register('tileset',zone+'_atlas',str(path.relative_to(ROOT)),tileWidth=64,tileHeight=64,columns=4,rows=4)

# --- character sprite sheets: 3 units x 3 color appearances x 6 animation states x 4 directions ---
CHARS={'vex':'cyan','nyx':'pink','rook':'amber'}
ANIMS={'idle':4,'walk':6,'dash':4,'attack':6,'hurt':3,'down':6}
def fighter_frame(hero,color,dir_,phase,anim,n=96):
 im=canvas(n,n);d=ImageDraw.Draw(im);cx=48;cy=52
 main=rgba(color);secondary=rgba('pink' if color=='cyan' else ('cyan' if color=='pink' else 'green'))
 if anim=='dash':cx+=phase*2-4
 if anim=='hurt':cx+=(-2 if phase%2 else 2)
 if anim=='down':cy+=min(phase,4)*3
 bob= 2*math.sin(phase*math.pi/3) if anim in ('walk','idle') else 0
 cy+=bob
 circ(d,(cx-23,cy+25,cx+23,cy+32),rgba('bg',95))
 # trailing energy / movement
 if anim=='dash':
  for j in range(3):line(d,[(cx-12-j*8,cy-4+j*4),(cx-28-j*9,cy-4+j*4)],rgba(color,140-j*30),3)
 if anim=='attack':
  angle=-math.pi/4 + (phase/5)*math.pi*1.2
  xx=cx+30*math.cos(angle);yy=cy+4+25*math.sin(angle)
  line(d,[(cx+9,cy+2),(xx,yy)],rgba('white',235),6)
  line(d,[(cx+9,cy+2),(xx,yy)],main,3)
  circ(d,(xx-4,yy-4,xx+4,yy+4),rgba('white',215))
 # legs and boots
 shift=4*math.sin(phase*math.pi/3) if anim=='walk' else 0
 for sx,walk in [(-12,shift),(8,-shift)]:
  box(d,(cx+sx,cy+12+walk,cx+sx+9,cy+30+walk),rgba('deep'),outline=main,r=3,width=2)
  box(d,(cx+sx-2,cy+25+walk,cx+sx+11,cy+31+walk),rgba('metal'),outline=rgba('white',140),r=2,width=1)
 # torso + shoulders
 box(d,(cx-18,cy-12,cx+18,cy+18),rgba('metal'),outline=main,r=9,width=3)
 poly(d,[(cx-17,cy-11),(cx+17,cy-11),(cx+9,cy+12),(cx-9,cy+12)],rgba('deep',255))
 line(d,[(cx-10,cy-2),(cx+10,cy-2)],main,3)
 circ(d,(cx-5,cy+3,cx+5,cy+13),rgba('white',185),outline=main,width=2)
 armshift=3*math.sin(phase*math.pi/3) if anim=='walk' else 0
 for sx,sv in [(-27,armshift),(18,-armshift)]:
  box(d,(cx+sx,cy-8+sv,cx+sx+10,cy+15+sv),rgba('deep'),outline=main,r=5,width=2)
  box(d,(cx+sx+2,cy-6+sv,cx+sx+8,cy+5+sv),rgba('mid'))
 # helmet and visor
 circ(d,(cx-20,cy-36,cx+20,cy-5),rgba('deep'),outline=main,width=3)
 poly(d,[(cx-19,cy-23),(cx-11,cy-39),(cx-3,cy-33),(cx+12,cy-38),(cx+21,cy-21),(cx+12,cy-27)],rgba('metal'))
 if hero=='nyx':
  poly(d,[(cx-16,cy-34),(cx-10,cy-49),(cx-1,cy-32)],rgba('pink',240))
 elif hero=='rook':
  poly(d,[(cx+4,cy-36),(cx+12,cy-46),(cx+17,cy-32)],rgba('amber',240))
 if dir_==0:bx=(cx-13,cy-26,cx+13,cy-17)
 elif dir_==1: bx=(cx-18,cy-27,cx+2,cy-17)
 elif dir_==2: bx=(cx-2,cy-27,cx+18,cy-17)
 else: bx=(cx-11,cy-27,cx+11,cy-22)
 box(d,bx,rgba('bg'),outline=main,r=3,width=2)
 if dir_!=3:
  line(d,[(bx[0]+4,bx[1]+5),(bx[2]-4,bx[1]+5)],rgba('white',210),2)
 if anim=='hurt':line(d,[(cx-26,cy-39),(cx+24,cy+27)],rgba('red',185),3)
 if anim=='down':
  im=im.rotate(min(phase,4)*13,Image.Resampling.BICUBIC,center=(48*S,52*S))
 return im.resize((n,n),Image.Resampling.LANCZOS)
for hero,default in CHARS.items():
 for variant,col in [('base',default),('shadow','pink'),('solar','amber')]:
  for anim,frames in ANIMS.items():
   sheet=Image.new('RGBA',(96*frames,96*4))
   for direction in range(4):
    for f in range(frames):sheet.alpha_composite(fighter_frame(hero,col,direction,f,anim),(96*f,96*direction))
   name=f'{hero}_{variant}_{anim}_{frames}x4.png';p=A/'characters'/name;sheet.save(p)
   register('character_animation',f'{hero}/{variant}/{anim}',str(p.relative_to(ROOT)),frameWidth=96,frameHeight=96,columns=frames,rows=4,directions=['down','left','right','up'],fps=8 if anim=='walk' else 5,loop=anim not in ['down','hurt'])
  fighter_frame(hero,col,0,0,'idle').save(A/'characters'/f'{hero}_{variant}_portrait.png')
  register('portrait',f'{hero}/{variant}',f'public/assets/characters/{hero}_{variant}_portrait.png',w=96,h=96)

# --- enemies + bosses --
def robot_frame(kind,col,phase,action='idle',n=96):
 im=canvas(n,n);d=ImageDraw.Draw(im);c=rgba(col); y=math.sin(phase/4*2*math.pi)*2
 circ(d,(16,77,80,87),rgba('bg',110))
 if kind=='drone':
  for sx in [12,68]:
   box(d,(sx,35+y,sx+16,54+y),rgba('metal'),outline=c,r=6,width=2)
   circ(d,(sx+4,39+y,sx+12,47+y),rgba('bg'),outline=rgba('white',160),width=1)
  box(d,(22,27+y,74,64+y),rgba('metal'),outline=c,r=15,width=3)
 elif kind=='turret':
  box(d,(30,38,65,75),rgba('metal'),outline=c,r=6,width=3)
  box(d,(23,19+y,72,57+y),rgba('deep'),outline=c,r=12,width=3)
  box(d,(42,4+y,54,31+y),rgba('mid'),outline=c,r=3,width=2)
 elif kind=='spider':
  for k in range(4):
   yy=30+k*10
   line(d,[(29,yy),(5,yy-10 if k<2 else yy+8)],c,4)
   line(d,[(67,yy),(91,yy-10 if k<2 else yy+8)],c,4)
  circ(d,(26,22+y,70,67+y),rgba('metal'),outline=c,width=3)
 else: # sentinel
  box(d,(29,23+y,67,69+y),rgba('metal'),outline=c,r=12,width=3)
  box(d,(20,37+y,30,63+y),rgba('mid'),outline=c,r=3)
  box(d,(66,37+y,76,63+y),rgba('mid'),outline=c,r=3)
  for sx in [35,55]:box(d,(sx,65+y,sx+8,80+y),rgba('deep'),outline=c,r=2)
 circ(d,(37,34+y,59,49+y),rgba('bg'),outline=c,width=2)
 circ(d,(43,38+y,53,46+y),rgba('white',205))
 if action=='alert':
  circ(d,(13,4,29,20),rgba('red',180));box(d,(20,8,22,15),rgba('white'))
 if action=='attack':
  for a in [-1,1]:line(d,[(48,39),(48+a*32,16+(phase%2)*9)],c,3)
 return im.resize((n,n),Image.Resampling.LANCZOS)
for k,col in [('drone','red'),('sentinel','amber'),('spider','pink'),('turret','cyan')]:
 for anim in ['idle','alert','attack','destroy']:
  frames=4 if anim!='destroy' else 6
  sh=Image.new('RGBA',(96*frames,96))
  for j in range(frames):
   fr=robot_frame(k,col,j,anim)
   if anim=='destroy':fr.putalpha(fr.getchannel('A').point(lambda a:int(a*(1-j/frames))))
   sh.alpha_composite(fr,(96*j,0))
  f=f'{k}_{anim}_{frames}x1.png';sh.save(A/'enemies'/f)
  register('enemy_animation',k+'/'+anim,f'public/assets/enemies/{f}',frameWidth=96,frameHeight=96,frames=frames)

def boss_frame(kind,phase,attack=False):
 im=canvas(192,192);d=ImageDraw.Draw(im);cx,cy=96,99;col={'guardian':'red','wraith':'pink','reactor_behemoth':'green'}[kind]
 circ(d,(24,155,171,176),rgba('bg',100))
 for sx in [-62,44]:box(d,(cx+sx,cy-4,cx+sx+19,cy+67),rgba('metal'),outline=rgba(col),r=9,width=3)
 for sx in [-95,64]:
  box(d,(cx+sx,cy-53,cx+sx+31,cy+22),rgba('deep'),outline=rgba(col,210),r=12,width=3)
  circ(d,(cx+sx+8,cy-25,cx+sx+24,cy-9),rgba(col,190))
 box(d,(cx-52,cy-65,cx+52,cy+37),rgba('metal'),outline=rgba(col,250),r=23,width=5)
 poly(d,[(cx-50,cy-38),(cx-22,cy-75),(cx+22,cy-75),(cx+50,cy-38),(cx+30,cy-3),(cx-30,cy-3)],rgba('deep'))
 circ(d,(cx-34,cy-54,cx+34,cy-14),rgba('bg'),outline=rgba(col,245),width=3)
 circ(d,(cx-18,cy-44,cx+18,cy-23),rgba(col,220),outline=rgba('white',215),width=2)
 if attack:
  for k in range(8):
   theta=k*math.pi/4+phase*.27;r=62
   x=cx+r*math.cos(theta);y=cy+r*math.sin(theta)
   circ(d,(x-5,y-5,x+5,y+5),rgba(col,180))
 return im.resize((192,192),Image.Resampling.LANCZOS)
for kind in ['guardian','wraith','reactor_behemoth']:
 for state in ['idle','attack','defeat']:
  frames=6;sh=Image.new('RGBA',(192*frames,192))
  for i in range(frames):
   fr=boss_frame(kind,i,state=='attack')
   if state=='defeat':fr.putalpha(fr.getchannel('A').point(lambda a:int(a*(1-i/frames))))
   sh.alpha_composite(fr,(i*192,0))
  nm=f'{kind}_{state}_6x1.png';sh.save(A/'bosses'/nm)
  register('boss_animation',kind+'/'+state,'public/assets/bosses/'+nm,frameWidth=192,frameHeight=192,frames=6)

# --- props: 28 distinct usable objects, transparent and collision/interaction semantics documented ---
props=['entrance_door','vault_door','vault_core','terminal_off','terminal_on','laser_emitter','laser_receiver','turret_pedestal','crate','storage_box','cover_block','barrier','heal_station','checkpoint','extraction_portal','floor_switch','security_camera','data_console','keycard_blue','keycard_red','energy_cell','loot_chest','warning_beacon','hologram','floor_trap','pressure_plate','power_generator','light_column','teleporter','sensor','decor_banner','crew_flag','forge_table','nft_relic','laser_gate','ammo_pickup']
for name in props:
 im=canvas(96,96);d=ImageDraw.Draw(im)
 circ(d,(16,75,80,88),rgba('bg',80))
 if name in ('entrance_door','vault_door','laser_gate'):
  box(d,(18,9,78,86),rgba('metal'),outline=rgba('amber' if name=='vault_door' else 'cyan'),r=8,width=3)
  box(d,(25,16,71,80),rgba('deep'),outline=rgba('line'),r=5,width=3)
  for y in range(24,78,14):line(d,[(29,y),(68,y)],rgba('line'),2)
  if name=='vault_door':
   circ(d,(36,35,60,59),rgba('deep'),outline=rgba('amber'),width=3)
   circ(d,(44,43,52,51),rgba('amber',240))
  if name=='laser_gate':
   for y in range(27,78,12):line(d,[(26,y),(70,y)],rgba('red',210),3)
 elif name in ('terminal_off','terminal_on','data_console','sensor'):
  box(d,(22,22,75,81),rgba('metal'),outline=rgba('line'),r=7,width=2)
  color='green' if name=='terminal_on' else 'red' if name=='terminal_off' else 'cyan'
  box(d,(29,29,68,60),rgba('deep'),outline=rgba(color),r=3,width=3)
  for j in range(3):line(d,[(34,39+j*6),(57,39+j*6)],rgba(color,190),2)
 elif name in ('laser_emitter','laser_receiver','pressure_plate','floor_switch','floor_trap'):
  box(d,(17,18,79,79),rgba('metal'),outline=rgba('line'),r=8,width=3)
  circ(d,(27,28,69,69),rgba('deep'),outline=rgba('red' if name.startswith('laser') or name=='floor_trap' else 'amber'),width=3)
  circ(d,(39,40,57,58),rgba('red' if name.startswith('laser') or name=='floor_trap' else 'green'))
 elif name in ('crate','storage_box','cover_block','loot_chest','ammo_pickup'):
  box(d,(14,22,82,82),rgba('metal'),outline=rgba('amber'),r=6,width=3)
  box(d,(23,30,73,74),rgba('deep'),outline=rgba('line'),r=3,width=2)
  line(d,[(22,32),(74,71)],rgba('amber',200),3)
  if name=='loot_chest':circ(d,(40,44,56,60),rgba('amber'))
 elif name in ('vault_core','energy_cell','nft_relic','keycard_blue','keycard_red'):
  if name.startswith('keycard'):
   box(d,(22,25,75,72),rgba('metal'),outline=rgba('blue' if name.endswith('blue') else 'red'),r=6,width=3)
   box(d,(31,37,51,50),rgba('amber'))
  else:
   circ(d,(15,14,81,80),rgba('cyan',65),outline=rgba('cyan'),width=3)
   poly(d,[(48,14),(71,46),(48,81),(25,46)],rgba('blue'),outline=rgba('white'))
   poly(d,[(48,28),(61,46),(48,65),(35,46)],rgba('cyan',190))
 elif name in ('checkpoint','extraction_portal','teleporter'):
  circ(d,(11,13,85,84),rgba('cyan',35),outline=rgba('green'),width=5)
  circ(d,(25,27,71,70),rgba('green',50),outline=rgba('cyan',240),width=3)
  for x in [17,78]:circ(d,(x-4,45,x+4,53),rgba('white',200))
 elif name in ('security_camera','warning_beacon','light_column','hologram'):
  box(d,(28,20,68,74),rgba('metal'),outline=rgba('pink'),r=8,width=3)
  circ(d,(36,30,60,54),rgba('deep'),outline=rgba('red'),width=2)
  circ(d,(42,36,54,48),rgba('red',215))
 elif name in ('heal_station','power_generator','forge_table','turret_pedestal'):
  box(d,(13,27,83,81),rgba('metal'),outline=rgba('cyan'),r=8,width=3)
  box(d,(27,11,69,56),rgba('deep'),outline=rgba('green'),r=7,width=2)
  for j in [36,48,60]:line(d,[(j,38),(j,46)],rgba('green'),2)
 else:
  box(d,(20,22,76,78),rgba('metal'),outline=rgba('pink'),r=8,width=3)
  poly(d,[(48,26),(65,53),(48,71),(31,53)],rgba('pink',180))
 path=save(im,'props/'+name+'.png')
 register('prop',name,path,w=96,h=96,interaction=name in ['vault_core','terminal_off','terminal_on','checkpoint','extraction_portal','loot_chest','heal_station'],solid=name in ['crate','cover_block','barrier','storage_box','power_generator'])

# --- VFX --
fx_types=['slash','muzzle','explosion','spark','dash_trail','shield_hit','laser_beam','terminal_hack','teleport','heal','collect','boss_charge','alert','smoke','level_up','vault_unlock']
for name in fx_types:
 sheet=Image.new('RGBA',(96*8,96))
 for i in range(8):
  im=canvas(96,96);d=ImageDraw.Draw(im);cx=48;cy=48;r=8+i*4
  if name in ['explosion','spark','muzzle','level_up','vault_unlock']:
   color='amber' if name in ['explosion','muzzle','spark'] else 'cyan'
   for j in range(12):
    ang=2*math.pi*j/12+i*.1
    line(d,[(cx+4*math.cos(ang),cy+4*math.sin(ang)),(cx+(r+8)*math.cos(ang),cy+(r+8)*math.sin(ang))],rgba(color,max(20,225-i*26)),max(1,4-i//3))
   circ(d,(cx-8,cy-8,cx+8,cy+8),rgba('white',max(25,210-i*25)))
  elif name=='laser_beam':
   box(d,(0,42,96,54),rgba('red',90));box(d,(0,46,96,50),rgba('red',240-i*13))
  elif name in ['shield_hit','heal','collect','teleport','terminal_hack','boss_charge','alert']:
   color='green' if name=='heal' else 'red' if name in ['alert','boss_charge'] else 'cyan'
   circ(d,(cx-r,cy-r,cx+r,cy+r),(0,0,0,0),outline=rgba(color,max(40,255-i*23)),width=3)
   if name=='heal':line(d,[(48,34),(48,62)],rgba('white'),3);line(d,[(34,48),(62,48)],rgba('white'),3)
  else:
   for j in range(3):line(d,[(cx-20-i*4,28+j*16),(cx+10-i*3,28+j*16)],rgba('pink' if name=='slash' else 'cyan',max(30,210-i*17)),3)
  sheet.alpha_composite(im.resize((96,96),Image.Resampling.LANCZOS),(96*i,0))
 file=f'{name}_8x1.png';sheet.save(A/'vfx'/file)
 register('vfx_animation',name,'public/assets/vfx/'+file,frameWidth=96,frameHeight=96,frames=8,fps=16)

# --- HUD icon library, simple clear vector icons exported at 64x64 and 128x128 ---
icons=['play','raid','defend','duel','boss','mine','nft','forge','crew','events','season','map','leaderboard','profile','settings','back','pause','resume','sound','mute','heart','shield','timer','energy','xp','shard','key','vault','terminal','dash','attack','interact','inventory','wallet','market','check','lock','warning','close','star','trophy','crosshair','quest','gift','share','ghost','edit','test','publish','camera','info']
for i,name in enumerate(icons):
 im=canvas(64,64);d=ImageDraw.Draw(im);color=['cyan','pink','amber','green'][i%4]
 circ(d,(7,7,57,57),rgba('deep',245),outline=rgba(color,190),width=2)
 if name in ['play','resume']:poly(d,[(26,18),(47,32),(26,46)],rgba(color))
 elif name=='pause':box(d,(22,19,28,46),rgba(color));box(d,(35,19,41,46),rgba(color))
 elif name in ['heart','heal']:poly(d,[(32,46),(17,34),(15,26),(24,20),(32,27),(40,20),(49,26),(47,34)],rgba('red'))
 elif name in ['attack','raid','duel','crosshair']:
  line(d,[(20,44),(43,20)],rgba(color),5);poly(d,[(44,14),(49,17),(45,23),(41,20)],rgba('white'))
 elif name in ['mine','shard','nft','xp','star','energy']:
  poly(d,[(32,15),(46,33),(32,50),(18,33)],rgba(color));circ(d,(27,26,36,36),rgba('white',180))
 elif name in ['shield','defend','vault','lock']:
  poly(d,[(32,15),(47,23),(45,41),(32,50),(19,41),(17,23)],rgba(color));box(d,(27,28,37,39),rgba('deep'),r=2)
 elif name in ['dash','ghost','share']:
  for yy in [25,33,41]:line(d,[(19,yy),(46,yy-5)],rgba(color),3)
 elif name in ['check','publish']:line(d,[(18,34),(29,44),(47,20)],rgba('green'),5)
 elif name in ['close','warning']:line(d,[(22,22),(42,42)],rgba('red'),4);line(d,[(42,22),(22,42)],rgba('red'),4)
 elif name in ['trophy','leaderboard']:box(d,(24,18,40,36),rgba('amber'),r=4);box(d,(29,36,35,44),rgba('amber'));box(d,(22,43,42,47),rgba('amber'))
 elif name in ['timer']:circ(d,(21,21,43,43),rgba('deep'),outline=rgba('white'));line(d,[(32,32),(32,24)],rgba(color),2);line(d,[(32,32),(39,35)],rgba(color),2)
 else:
  box(d,(21,21,43,43),rgba('deep'),outline=rgba(color),r=4,width=3)
  circ(d,(28,28,36,36),rgba(color))
 path=save(im,'ui/icons/'+name+'.png');register('ui_icon',name,path,w=64,h=64)
# UX panels, tiles and minimap markers
for theme,col in [('default','cyan'),('premium','amber'),('danger','red'),('guild','pink')]:
 for kind,wh in [('button',(320,72)),('panel',(480,240)),('badge',(144,144)),('notification',(580,100))]:
  w,h=wh;im=canvas(w,h);d=ImageDraw.Draw(im)
  box(d,(2,2,w-2,h-2),rgba('deep',240),outline=rgba(col,190),r=14,width=2)
  box(d,(10,10,w-10,h-10),rgba('metal',95),outline=rgba('line',75),r=10,width=1)
  line(d,[(18,14),(min(w-18,135),14)],rgba(col,190),3)
  line(d,[(w-135,h-14),(w-18,h-14)],rgba(col,180),3)
  path=save(im,f'ui/chrome/{theme}_{kind}.png');register('ui_chrome',theme+'/'+kind,path,w=w,h=h)
# mobile HUD actual base shapes, transparent
for name in ['joystick_base','joystick_knob','action_button','minimap_frame','health_bar_bg','health_bar_fill','xp_bar','objective_panel']:
 w,h=(160,160) if 'joystick' in name else (100,100) if 'button' in name else (280,50) if 'bar' in name else (340,140)
 im=canvas(w,h);d=ImageDraw.Draw(im)
 if 'joystick' in name or name=='action_button':
  circ(d,(5,5,w-5,h-5),rgba('deep',130),outline=rgba('cyan',220),width=3)
  circ(d,(25,25,w-25,h-25),rgba('cyan',45),outline=rgba('white',140),width=2)
 else:
  box(d,(2,2,w-2,h-2),rgba('deep',215),outline=rgba('cyan',155),r=8,width=2)
  if name=='health_bar_fill':box(d,(7,8,w-8,h-8),rgba('red'),r=5)
  if name=='xp_bar':box(d,(7,8,w-8,h-8),rgba('cyan'),r=5)
 path=save(im,f'ui/hud/{name}.png');register('ui_hud',name,path,w=w,h=h)

# --- NFT card artworks as actual transparent? cards are raster collectible artwork, separate from gameplay sprites ---
rarities=['COMMON','RARE','EPIC'];collectibles=[('SHADOW VEX','vex','pink'),('NEON NYX','nyx','cyan'),('SOLAR ROOK','rook','amber'),('PHANTOM VAULT','vault','pink'),('GUARDIAN CORE','core','red'),('GENESIS BADGE','badge','amber'),('CRIMSON SENTRY','sentinel','red'),('ECHO RELIC','relic','green'),('VOID EMBLEM','emblem','cyan')]
for idx,(name,typ,col) in enumerate(collectibles):
 w,h=350,490;im=canvas(w,h);d=ImageDraw.Draw(im);box(d,(0,0,w,h),rgba('bg'));box(d,(9,9,w-9,h-9),rgba('deep'),outline=rgba(col),r=17,width=3)
 for y in range(62,370,35):line(d,[(24,y),(w-24,y)],rgba(col,30),1)
 circ(d,(43,110,307,353),rgba(col,30),outline=rgba(col,130),width=3)
 for r in range(48,113,22):circ(d,(175-r,228-r,175+r,228+r),(0,0,0,0),outline=rgba(col,40),width=2)
 if typ in CHARS:
  hero=Image.open(A/f'characters/{typ}_base_portrait.png').resize((225*S,225*S),Image.Resampling.NEAREST)
  im.alpha_composite(hero,(62*S,100*S))
 elif typ=='sentinel':
  p=Image.open(A/'enemies/sentinel_idle_4x1.png').crop((0,0,96,96)).resize((230*S,230*S),Image.Resampling.NEAREST)
  im.alpha_composite(p,(60*S,110*S))
 else:
  prop={'vault':'vault_door','core':'vault_core','badge':'nft_relic','relic':'energy_cell','emblem':'crew_flag'}[typ]
  im.alpha_composite(Image.open(A/f'props/{prop}.png').resize((215*S,215*S),Image.Resampling.NEAREST),(68*S,120*S))
 d=ImageDraw.Draw(im)
 def write(txt,x,y,f,color):d.text((x*S,y*S),txt,font=ImageFont.truetype(font,int(f*S)),fill=color)
 write('RIVALS // GENESIS',25,29,15,rgba('white'));write(rarities[idx%3],24,374,16,rgba(col));write(name,24,411,25,rgba('white'))
 write('COLLECTIBLE  •  BASE',25,457,12,rgba('line'))
 path=save(im,'nft/cards/'+re.sub('[^a-z0-9]+','_',name.lower()).strip('_')+'.png');register('nft_art',name,path,w=w,h=h,rarity=rarities[idx%3],utility='cosmetic or commemorative; no investment return')

# --- audio synthesis from scratch: short real WAV effects, ambient loops ---
SR=22050
sfx_names=['ui_hover','ui_click','ui_confirm','ui_back','ui_error','player_step','player_dash','player_swing','player_hit','player_death','drone_alert','drone_fire','turret_fire','laser_on','laser_hit','terminal_start','terminal_success','terminal_fail','core_pickup','shard_pickup','keycard_pickup','vault_open','portal_open','extract_success','mission_fail','victory','boss_roar','boss_attack','boss_defeat','rank_up','craft_complete','nft_mint','coin_purchase','vault_publish','warning','countdown','shield','heal']
def wav(file,arr,sr=SR):
 arr=np.asarray(arr,dtype=float);arr=np.clip(arr,-1,1)
 if len(arr):
  attack=min(200,len(arr)//4);fade=min(1800,len(arr)//3)
  env=np.ones(len(arr));env[:attack]=np.linspace(0,1,attack);env[-fade:]=np.linspace(1,0,fade);arr*=env
 out=A/'audio'/file;out.parent.mkdir(parents=True,exist_ok=True)
 with wave.open(str(out),'wb') as wf:
  wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(sr);wf.writeframes((arr*24000).astype('<i2').tobytes())
 return str(out.relative_to(ROOT))
for i,name in enumerate(sfx_names):
 dur=.16+((i%5)*.07);tt=np.arange(int(SR*dur))/SR
 f1=220+(i%11)*55;f2=f1*1.75
 wave1=np.sin(2*math.pi*(f1*tt + (f1*.65)*(tt*tt)))
 wave2=.35*np.sin(2*math.pi*f2*tt)
 rng=np.random.default_rng(44+i);noise=rng.normal(0,.10,len(tt))
 pulse=np.exp(-tt*12)
 arr=(wave1+wave2+noise)*pulse*.65
 if any(x in name for x in ['fail','death','roar','boss','warning']):arr*=np.sin(2*math.pi*8*tt)*.4+.6
 path=wav('sfx/'+name+'.wav',arr);register('audio_sfx',name,path,duration=round(dur,2))
for name,seed,chord in [('neon_ambient',11,[110,165,220]),('phantom_ambient',12,[92.5,138.59,185]),('reactor_ambient',13,[103.8,155.5,207.65])]:
 duration=6.;t=np.arange(int(SR*duration))/SR;rng=np.random.default_rng(seed)
 arr=np.zeros(len(t))
 for f in chord:arr+=.10*np.sin(2*math.pi*f*t+0.2*np.sin(2*math.pi*t/duration))
 arr+=.03*np.sin(2*math.pi*1.5*t)*np.sin(2*math.pi*55*t)
 arr+=rng.normal(0,.012,len(t))
 # seamless fade endpoints
 arr*=np.minimum(1,np.minimum(t/.16,(duration-t)/.16))
 path=wav('music/'+name+'.wav',arr)
 register('audio_music',name,path,duration=duration,loop=True)

# --- maps: Tiled-compatible orthogonal 32x20, collision = wall tiles (GID 6..8,14..15) ---
W,H=32,20
LEVELS=[('training_vault','neon',1),('neon_district','neon',2),('phantom_fortress','phantom',3),('reactor_siege','reactor',4)]
level_spec=[]
for level_name,zone,difficulty in LEVELS:
 maptiles=[];solid=[];hazards=[];objects=[]
 for y in range(H):
  row=[];solidrow=[];hazardrow=[]
  for x in range(W):
   boundary=x==0 or y==0 or x==W-1 or y==H-1
   iswall=boundary or (difficulty>1 and (x in (12,22) and 3<=y<=16 and y not in (5,10,15))) or (difficulty>=3 and y==10 and x in range(4,12) and x not in (6,9))
   gid=6 if iswall else 1+((x+y+difficulty)%3)
   hazard=not iswall and difficulty>1 and ((x,y) in [(8,6),(15,12),(25,7),(20,16)])
   if hazard:gid=5
   row.append(gid);solidrow.append(1 if iswall else 0);hazardrow.append(1 if hazard else 0)
  maptiles+=row;solid+=solidrow;hazards+=hazardrow
 def obj(name,type_,x,y,**props):
  objects.append({'id':len(objects)+1,'name':name,'type':type_,'x':x*T,'y':y*T,'width':T,'height':T,'rotation':0,'visible':True,'properties':[{'name':k,'type':'bool' if isinstance(v,bool) else 'int' if isinstance(v,int) else 'string','value':v} for k,v in props.items()]})
 obj('player_spawn','spawn',3,3)
 obj('terminal_A','terminal',9,4,required=True)
 obj('terminal_B','terminal',25,15,required=True)
 obj('vault_core','core',26,4)
 obj('exit','extraction',3,16)
 for index,(x,y) in enumerate([(7,14),(17,8),(24,12)][:min(3,difficulty)]):obj('drone_'+str(index),'enemy',x,y,enemyType='drone')
 if difficulty>=3:obj('boss_guardian','boss',24,4,bossType='guardian' if zone=='phantom' else 'reactor_behemoth')
 obj('laser_A','laser',14,6,orientation='horizontal');obj('crate_1','crate',5,10)
 tmap={'compressionlevel':-1,'height':H,'width':W,'tilewidth':T,'tileheight':T,'infinite':False,'orientation':'orthogonal','renderorder':'right-down','type':'map','version':'1.10','tiledversion':'1.10.2','nextlayerid':5,'nextobjectid':len(objects)+1,
 'tilesets':[{'firstgid':1,'name':zone+'_atlas','tilewidth':T,'tileheight':T,'tilecount':16,'columns':4,'image':'../tilesets/'+zone+'_atlas_4x4.png','imagewidth':T*4,'imageheight':T*4,'margin':0,'spacing':0}],
 'layers':[{'id':1,'name':'Ground','type':'tilelayer','width':W,'height':H,'x':0,'y':0,'opacity':1,'visible':True,'data':maptiles},
           {'id':2,'name':'Solid','type':'tilelayer','width':W,'height':H,'x':0,'y':0,'opacity':0,'visible':False,'data':solid},
           {'id':3,'name':'Hazard','type':'tilelayer','width':W,'height':H,'x':0,'y':0,'opacity':0,'visible':False,'data':hazards},
           {'id':4,'name':'Objects','type':'objectgroup','x':0,'y':0,'opacity':1,'visible':True,'draworder':'topdown','objects':objects}]}
 loc=A/'maps'/f'{level_name}.json';loc.write_text(json.dumps(tmap,indent=2))
 register('tiled_map',level_name,str(loc.relative_to(ROOT)),width=W,height=H,tileWidth=T,zone=zone,difficulty=difficulty)
 level_spec.append({'id':level_name,'zone':zone,'difficulty':difficulty,'name':level_name.replace('_',' ').title(),'mission':{'disableTerminals':2,'captureCore':True,'reachExtraction':True},'recommendedDurationSeconds':180+30*(difficulty-1),'bossRequired':difficulty>=3,'map':str(loc.relative_to(ROOT))})
(A/'data'/'levels.json').write_text(json.dumps(level_spec,indent=2))

# balanced JSON catalogs, recipes, store and upgrade roles
catalog={
'player':{'startingHP':100,'moveSpeedPxPerSecond':205,'dashSpeedMultiplier':2.8,'dashDurationMs':210,'dashCooldownMs':1900,'invulnerabilityAfterHitMs':900,'attackDamage':25,'attackCooldownMs':450},
'enemies':{'drone':{'hp':60,'damage':12,'speed':110,'detectionRange':280},'sentinel':{'hp':90,'damage':17,'speed':85,'detectionRange':300},'spider':{'hp':45,'damage':9,'speed':145,'detectionRange':260},'turret':{'hp':75,'damage':15,'speed':0,'detectionRange':330}},
'bosses':{'guardian':{'hp':600,'damage':22},'wraith':{'hp':525,'damage':21},'reactor_behemoth':{'hp':700,'damage':24}},
'scoring':{'completion':1000,'perSecondRemaining':15,'terminalBonus':250,'coreBonus':450,'damagePenaltyPerHP':3,'retryPenalty':0,'verifiedResultRequired':True},
'rewards':{'xpBase':100,'shardBase':12,'firstClearBonusXP':75,'currency':'NON_TRANSFERABLE_CRAFTING_SHARDS','cashEquivalent':False},
'vaultEditor':{'width':32,'height':20,'maxEnemies':8,'maxTraps':12,'maxInteractiveTerminals':3,'maxObjects':90,'mustHaveReachableExit':True,'mustPassCreatorRun':True,'serverValidationRequired':True},
'competitive':{'mode':'asynchronous','serverVerifiesScore':True,'playerCreatedVaultRatingEligibleAfterReview':True,'premiumCosmeticsGiveGameplayAdvantage':False},
'mining':{'status':'LEGACY_UNCHANGED','doNotModify':['mining timer','BD Points rate','claims','balances','mining history','auto-claim','mining reward formulas']}}
(A/'data'/'game_balance.json').write_text(json.dumps(catalog,indent=2))
(A/'data'/'crafting_recipes.json').write_text(json.dumps({'recipes':[{'id':'shard_trail','inputs':[{'id':'crafting_shard','quantity':40}],'output':'cyan_dash_trail','random':False,'premium':False},{'id':'relic_theme','inputs':[{'id':'crafting_shard','quantity':120}],'output':'vault_relic_decoration','random':False,'premium':False}],'noPaidRandomRewards':True},indent=2))
(A/'data'/'shop_catalog.json').write_text(json.dumps({'notice':'Design hypotheses; prices need testing, compliance and product approval','currency':'USDC','chain':'Base','products':[{'id':'pass_s01','name':'Rivals Season Pass','type':'season_entitlement','priceUSDC':'4.99','competitiveBoost':False},{'id':'skin_shadow_vex','name':'Shadow VEX','type':'fixed_content_cosmetic_nft','priceUSDC':'4.99','competitiveBoost':False},{'id':'theme_neon_vault','name':'Neon Vault Theme','type':'fixed_content_vault_cosmetic','priceUSDC':'2.99','competitiveBoost':False}]},indent=2))

# write machine ready manifest with hints
(ROOT/'docs'/'ASSET_MANIFEST.json').write_text(json.dumps({'name':'RIVALS Ultimate 2D Asset Kit','version':'1.0','files':manifest},indent=2))

# --- Level preview and professional asset gallery layout generated from actual sprites ---
def back_scene(level,scale=1):
 data=json.loads((A/'maps'/f'{level}.json').read_text())
 zone=next(t['name'].split('_')[0] for t in data['tilesets'])
 atlas=Image.open(A/f'tilesets/{zone}_atlas_4x4.png')
 w,h=data['width'],data['height'];layer=data['layers'][0]['data'];out=Image.new('RGBA',(w*T,h*T))
 for i,g in enumerate(layer):
  tx,ty=((g-1)%4)*T,((g-1)//4)*T
  out.alpha_composite(atlas.crop((tx,ty,tx+T,ty+T)),((i%w)*T,(i//w)*T))
 for ob in data['layers'][3]['objects']:
  kind=ob['type'];name={'spawn':'checkpoint','terminal':'terminal_off','core':'vault_core','extraction':'extraction_portal','enemy':'crate','boss':'power_generator','laser':'laser_emitter','crate':'crate'}.get(kind)
  if kind=='enemy':p=Image.open(A/'enemies/drone_idle_4x1.png').crop((0,0,96,96))
  elif kind=='boss':p=Image.open(A/'bosses/guardian_idle_6x1.png').crop((0,0,192,192))
  else:p=Image.open(A/f'props/{name}.png')
  size=128 if kind=='boss' else 64;p=p.resize((size,size),Image.Resampling.LANCZOS)
  out.alpha_composite(p,(int(ob['x'])-(size-64)//2,int(ob['y'])-(size-64)//2))
 if scale!=1:out=out.resize((round(out.width*scale),round(out.height*scale)),Image.Resampling.LANCZOS)
 return out
for lv,*_ in LEVELS:
 im=back_scene(lv,.55);f=A/'maps'/f'{lv}_preview.png';im.save(f)
 register('map_preview',lv+'_preview',str(f.relative_to(ROOT)),w=im.width,h=im.height)

# preview 2200x1450 with editorial UI and asset samples
CW,CH=2240,1500
preview=Image.new('RGBA',(CW,CH),rgba('bg'));d=ImageDraw.Draw(preview)
for y in range(CH):
 t=y/CH;col=(round(9+12*t),round(14+12*t),round(30+22*t),255)
 d.line([(0,y),(CW,y)],fill=col)
def text2(txt,x,y,size=36,color='white',heavy=True):d.text((x,y),txt,font=ft(size,heavy),fill=rgba(color))
def rect2(p,co='cyan',rad=20):d.rounded_rectangle(p,radius=rad,fill=rgba('deep',235),outline=rgba(co,145),width=3)
text2('RIVALS  /  THE ULTIMATE 2D GAME ASSET KIT',76,47,55)
text2('ORIGINAL EDITABLE GAME ART  •  PHASER/TILED READY  •  BUILT FOR CODEX',80,122,25,'cyan')
rect2((70,185,1455,910));text2('01   NEON DISTRICT — LEVEL PREVIEW',100,209,27,'cyan')
mapimg=Image.open(A/'maps/neon_district_preview.png')
mapimg.thumbnail((1322,640),Image.Resampling.LANCZOS);preview.alpha_composite(mapimg,(105,257))
rect2((1490,185,2160,910),'pink');text2('02   OPERATIVES',1520,208,30,'pink')
for j,hero in enumerate(CHARS):
 p=Image.open(A/f'characters/{hero}_base_portrait.png').resize((170,170),Image.Resampling.NEAREST)
 x=1520+(j%3)*205; y=305
 preview.alpha_composite(p,(x,y));text2(hero.upper(),x+27,490,24)
text2('ENEMIES & BOSSES',1520,563,30,'red')
for j,kind in enumerate(['drone','spider','sentinel','turret']):
 fr=Image.open(A/f'enemies/{kind}_idle_4x1.png').crop((0,0,96,96)).resize((125,125),Image.Resampling.LANCZOS)
 x=1520+j*150;preview.alpha_composite(fr,(x,641));text2(kind.upper(),x+5,781,18,'white')
rect2((70,948,1455,1425),'amber');text2('03   COLLECTIBLES • ENVIRONMENTS • INTERACTIVE PROPS',100,978,28,'amber')
for j,c in enumerate(collectibles[:6]):
 f=re.sub('[^a-z0-9]+','_',c[0].lower()).strip('_')+'.png'
 card=Image.open(A/'nft/cards'/f).resize((180,255),Image.Resampling.LANCZOS)
 preview.alpha_composite(card,(104+j*218,1041))
rect2((1490,948,2160,1425),'green');text2('04   INTEGRATION',1520,984,30,'green')
for j,msg in enumerate(['GAME-READY PNG / WAV','6 ANIMATION STATES','4-DIRECTION MOVEMENT','4 TILED JSON MAPS','STRUCTURED ASSET MANIFEST','MISSION & BALANCE DATA','CODEX IMPLEMENTATION BRIEFS','PLAYABLE DEMO SCAFFOLD']):text2('• '+msg,1527,1046+j*41,24,'white' if j%2 else 'cyan')
preview=preview.convert('RGB');preview.save(ROOT/'PREVIEW.png',quality=93)

# Copy concept images as visual direction reference only, not sprites
for src,dst in [('/mnt/data/a_widescreen_high_detail_ui_marketing_concept_col.png','RIVALS_CONCEPT_DASHBOARD_REFERENCE.png'),('/mnt/data/a_wide_composite_game_ui_concept_image_clean_neon.png','RIVALS_CONCEPT_GAMEPLAY_REFERENCE.png')]:
 if Path(src).exists():shutil.copyfile(src,ROOT/'references'/dst)

# build content docs next (generated from files below)
print('Created',len(manifest),'manifest entries','in',ROOT)
