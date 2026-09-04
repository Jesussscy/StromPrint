"""
StormPrint :: storage.py
Utilidades de persistencia a archivo robustas (atomicas) para caches y
registros efimeros. Evitan corromper el JSON si dos invocaciones serverless
escriben casi simultaneamente (escritura a temp + rename atomico).
"""

import json
import os
import tempfile
from typing import Any


def atomic_write_json(path: str, data: Any) -> None:
    """Escribe `data` como JSON de forma atomica (temp + os.replace).

    Lanza la excepcion subyacente si falla; el llamador decide si tragar.
    """
    directory = os.path.dirname(path) or "."
    fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False)
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
