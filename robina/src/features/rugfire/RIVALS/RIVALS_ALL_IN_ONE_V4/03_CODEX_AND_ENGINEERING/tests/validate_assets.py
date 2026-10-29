#!/usr/bin/env python3
"""Validate asset bundle consistency using only stdlib + Pillow."""
from pathlib import Path
from PIL import Image
import json,wave,collections,sys
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'docs/ASSET_MANIFEST.json').read_text())
errors=[];count=0
for item in m['files']:
 p=ROOT/item['path'];count+=1
 if not p.is_file():errors.append(f"MISSING {p}");continue
 if p.suffix=='.png':
  try:
   with Image.open(p) as im:
    im.verify()
   with Image.open(p) as im:
    if 'frameWidth' in item:
     if im.width%item['frameWidth'] or im.height%item['frameHeight']:errors.append(f"FRAME MISALIGNMENT {p}")
    elif 'w' in item and (im.width!=item['w'] or im.height!=item['h']): errors.append(f"WRONG DIMENSIONS {p}")
  except Exception as e:errors.append(f"BAD PNG {p}: {e}")
 if p.suffix=='.wav':
  try:
   with wave.open(str(p)) as f:
    if f.getnframes()<500:errors.append(f"TOO SHORT {p}")
  except Exception as e: errors.append(f"BAD WAV {p}: {e}")
 if p.suffix=='.json':
  try:json.loads(p.read_text())
  except Exception as e:errors.append(f"BAD JSON {p}: {e}")
# Level reachability from spawn to both terminals, core and extraction, ignoring hostile mobs and moving hazards.
from collections import deque
for mp in sorted((ROOT/'public/assets/maps').glob('*.json')):
 d=json.loads(mp.read_text());solid=d['layers'][1]['data'];W,H=d['width'],d['height'];objects=d['layers'][3]['objects'];start=next((int(x['x']/64),int(x['y']/64)) for x in objects if x['type']=='spawn')
 visited={start};q=deque([start]);
 while q:
  x,y=q.popleft()
  for nx,ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
   if 0<=nx<W and 0<=ny<H and (nx,ny) not in visited and solid[ny*W+nx]==0:visited.add((nx,ny));q.append((nx,ny))
 for obj in objects:
  if obj['type'] in ['terminal','core','extraction'] and (int(obj['x']/64),int(obj['y']/64)) not in visited:errors.append(f"UNREACHABLE {mp.name}: {obj['name']}")
print(f"Validated {count} asset manifest entries, {len(list((ROOT/'public/assets/maps').glob('*.json')))} maps. Errors: {len(errors)}")
for e in errors:print('ERROR',e)
sys.exit(1 if errors else 0)
