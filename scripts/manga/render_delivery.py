"""Render the complete local delivery, keeping resumable animation frames.

python scripts/manga/render_delivery.py
Uses native subprocess arguments; no shell execution-policy changes needed.
"""
import subprocess
import argparse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
BLENDER=Path('C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
common=[str(BLENDER),'--background']
script=['--python-exit-code','1','--python','scripts/manga/render_local.py','--']
parser=argparse.ArgumentParser()
parser.add_argument('--skip-stills',action='store_true',help='Resume animation without repeating completed still images.')
parser.add_argument('--output',default='models/manga/checkpoint07')
args=parser.parse_args()
modes=[('models/manga/MANGA_STORMPRINT_FINAL.blend','--stills'),
             ('models/manga/MANGA_STORMPRINT_FINAL.blend','--stills','--camera','Casa_Roman_Referencia'),
             ('models/manga/MANGA_STORMPRINT_FINAL.blend','--animation','--resume'),
             ('--factory-startup','--encode')]
for mode in modes[2:] if args.skip_stills else modes:
    subprocess.run([*common,mode[0],*script,*mode[1:],'--output',args.output],cwd=ROOT,check=True)
print('MANGA_RENDER_DELIVERY_COMPLETE',flush=True)
