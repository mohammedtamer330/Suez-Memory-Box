import json, sys
from PIL import Image, ImageDraw
mode = sys.argv[1]
data = json.load(open('/home/claude/work/compose.json'))
U = 5 if mode=='portrait' else 6   # px per unit
pad = 20
def paste_rot(canvas, im, cx, cy, rot):
    r = im.rotate(-rot, expand=True, resample=Image.BICUBIC)
    canvas.paste(r, (int(cx - r.width/2), int(cy - r.height/2)), r)
cols=[]
for entry in data:
    for sp in entry['spreads']:
        W=int(100*U); H=int(sp['height']*U)
        c = Image.new('RGBA',(W+2*pad,H+2*pad),(24,20,16,255))
        d = ImageDraw.Draw(c); d.rectangle([pad,pad,pad+W,pad+H],outline=(70,60,50,255))
        for it in sorted(sp['items'], key=lambda i:i['z']):
            gid = it['id']
            im = Image.open(f'public/seed/{gid}-t.webp').convert('RGBA')
            w=int(it['w']*U); h=int(it['h']*U)
            frame = Image.new('RGBA',(w,h),(233,222,196,255))
            ins = it['inset']
            l=int(ins['l']/100*w); t=int(ins['t']/100*h); r=int(ins['r']/100*w); b=int(ins['b']/100*h)
            ph = im.resize((max(1,w-l-r), max(1,h-t-b)))
            frame.paste(ph,(l,t))
            paste_rot(c, frame, pad+it['x']*U, pad+it['y']*U, it['rot'])
        cols.append(c)
        # label
tot_w=sum(c.width for c in cols); mh=max(c.height for c in cols)
sheet=Image.new('RGBA',(tot_w,mh),(0,0,0,255)); x=0
for c in cols: sheet.paste(c,(x,0)); x+=c.width
sheet.convert('RGB').save('/home/claude/work/compose_preview.jpg',quality=82)
print(sheet.size)
