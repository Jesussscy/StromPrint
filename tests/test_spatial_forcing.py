from datetime import datetime, timezone
from api.spatial_forcing import make_spatial_forcing

def test_original_rain_and_timezone():
    rows=[{'time':'2026-09-17T10:00','precipitation':2.4}, {'time':'2026-09-17T11:00','precipitation':0}]
    result=make_spatial_forcing(rows,2,datetime(2026,9,17,15,25,tzinfo=timezone.utc))
    assert result.start_time=='2026-09-17T10:00:00-05:00'
    assert [h.rain_mm_h for h in result.hours]==[2.4,0]

def test_missing_is_not_dry():
    rows=[{'time':'2026-09-17T10:00','precipitation':0,'precipitation_missing':True}]
    result=make_spatial_forcing(rows,2,datetime(2026,9,17,10))
    assert [h.rain_mm_h for h in result.hours]==[None,None]
