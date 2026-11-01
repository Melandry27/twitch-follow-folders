"""Génère les icônes de l'extension (dossier violet Twitch). Usage : python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
PURPLE, LIGHT, DOT = (145, 71, 255), (191, 148, 255), (235, 4, 0)

def icon(size: int) -> Image.Image:
    s = 8  # suréchantillonnage pour un rendu lisse
    S = size * s
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = S * 0.09
    # onglet du dossier
    d.rounded_rectangle([S*0.06, S*0.16, S*0.48, S*0.36], radius=r, fill=LIGHT)
    # dos du dossier
    d.rounded_rectangle([S*0.06, S*0.24, S*0.94, S*0.86], radius=r, fill=LIGHT)
    # face avant
    d.rounded_rectangle([S*0.06, S*0.34, S*0.94, S*0.86], radius=r, fill=PURPLE)
    # point « live »
    c, rad = (S*0.76, S*0.66), S*0.11
    d.ellipse([c[0]-rad, c[1]-rad, c[0]+rad, c[1]+rad], fill=DOT)
    return img.resize((size, size), Image.LANCZOS)

for size in (16, 32, 48, 128):
    icon(size).save(os.path.join(OUT, f'icon{size}.png'))
print('ok')
