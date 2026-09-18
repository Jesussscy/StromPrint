"""Cache public source responses; reruns reuse bytes, --refresh downloads again."""
import json, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/manga/raw'
RAW.mkdir(parents=True, exist_ok=True)

def fetch(name, url, params=None):
    p = RAW / name
    if p.exists() and '--refresh' not in sys.argv:
        return json.loads(p.read_text(encoding='utf8'))
    r = requests.get(url, params=params, timeout=150, headers={'User-Agent':'StormPrint-Manga-research/1.0'})
    r.raise_for_status()
    data = r.json()
    if 'error' in data: raise RuntimeError(data['error'])
    p.write_text(json.dumps(data, ensure_ascii=False), encoding='utf8')
    print(name, len(r.content), flush=True)
    return data

if __name__ == '__main__':
    fetch('arcgis-boundary.geojson', 'https://services7.arcgis.com/t784NacZjQPpWVsA/arcgis/rest/services/Barrios_de_Cartagena/FeatureServer/0/query', {'f':'geojson','where':"NOMBRE = 'MANGA'",'outFields':'*','outSR':4326})
    data = fetch('osm-boundary.json','https://www.openstreetmap.org/api/0.6/way/1385212852/full.json')
    nodes = [e for e in data['elements'] if e['type']=='node']
    south,north=min(n['lat'] for n in nodes),max(n['lat'] for n in nodes)
    west,east=min(n['lon'] for n in nodes),max(n['lon'] for n in nodes)
    print('OSM bounds',west,south,east,north, flush=True)
    bbox=f'{south-.0005},{west-.0005},{north+.0005},{east+.0005}'
    query=f'[out:json][timeout:100];(way[building]({bbox});way[highway]({bbox});way[natural=coastline]({bbox});way[leisure=park]({bbox});way[landuse=grass]({bbox}););out body geom;'
    fetch('osm-features.json','https://overpass-api.de/api/interpreter',{'data':query})
