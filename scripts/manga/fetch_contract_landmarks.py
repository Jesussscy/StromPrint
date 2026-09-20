"""Cache OSM historic/marina/pier geometries missing from the original road query."""
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/manga/raw/osm-contract-landmarks.json'
QUERY = '''[out:json][timeout:90];(
  nwr[historic](10.402,-75.547,10.423,-75.521);
  nwr[leisure=marina](10.402,-75.547,10.423,-75.521);
  way[man_made=pier](10.402,-75.547,10.423,-75.521);
);out body geom;'''
if OUT.exists():
    result = json.loads(OUT.read_text(encoding='utf8'))
else:
    request = Request('https://overpass-api.de/api/interpreter?' + urlencode({'data': QUERY}),
                      headers={'User-Agent': 'StormPrint-Manga-GIS/1.0'})
    with urlopen(request, timeout=120) as response:
        result = json.load(response)
    if result.get('remark') or not result.get('elements'):
        raise RuntimeError('Incomplete Overpass response')
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps([dict(type=e['type'], id=e['id'], tags=e.get('tags'),
                       points=len(e.get('geometry', []))) for e in result['elements']], ensure_ascii=False))
