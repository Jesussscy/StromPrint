"""
StormPrint :: generate_manga_model.py
Genera el modelo 3D de la peninsula de Manga, Cartagena de Indias.

Geometria representativa:
  - Peninsula de Manga: forma alargada N-S rodeada por Bahia de Cartagena
  - Bahia de Cartagena: plano azul semitransparente (nivel del mar)
  - Terreno: malla con leve elevacion representando topografia
  - Nodo "WaterLevel_Animated": plano de agua que Canvas3D.tsx anima

Ejecutar: python scripts/generate_manga_model.py
Genera: public/models/manga_model.glb
"""

import os
import sys
import numpy as np

try:
    import pygltflib
except ImportError:
    print("pygltflib no instalado. Ejecuta: pip install pygltflib")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Definicion de la geometria de Manga
# ---------------------------------------------------------------------------

def create_manga_peninsula():
    """
    Crea la geometria de la peninsula de Manga como una malla irregular.

    La peninsula de Manga se extiende de sur a norte, bordeada por:
    - Bahia de Cartagena al oeste
    - Canal del Dique al este
    - Forma alargada con约 1.2 km de largo
    """
    # Vertices approximados de Manga (escalados a unidades de escena)
    # Forma: peninsula alargada N-S con curvatura hacia el oeste
    vertices = np.array([
        # Costa este (Canal del Dique)
        [-0.3, 0.0, -2.0],   # 0: punta sur-este
        [-0.1, 0.0, -1.5],   # 1
        [0.0, 0.0, -1.0],    # 2
        [0.1, 0.0, -0.5],    # 3
        [0.15, 0.0, 0.0],    # 4
        [0.1, 0.0, 0.5],     # 5
        [0.0, 0.0, 1.0],     # 6
        [-0.1, 0.0, 1.5],    # 7
        [-0.3, 0.0, 2.0],    # 8: punta norte-este

        # Costa oeste (Bahia de Cartagena)
        [-1.2, 0.0, 2.0],    # 9: punta norte-oeste
        [-1.0, 0.0, 1.5],    # 10
        [-0.9, 0.0, 1.0],    # 11
        [-0.85, 0.0, 0.5],   # 12
        [-0.8, 0.0, 0.0],    # 13
        [-0.85, 0.0, -0.5],  # 14
        [-0.9, 0.0, -1.0],   # 15
        [-1.0, 0.0, -1.5],   # 16
        [-1.2, 0.0, -2.0],   # 17: punta sur-oeste

        # Interior (elevacion del terreno)
        [-0.2, 0.06, -1.5],  # 18
        [-0.1, 0.08, -1.0],  # 19
        [-0.05, 0.1, -0.5],  # 20
        [0.0, 0.12, 0.0],    # 21: punto mas alto
        [-0.05, 0.1, 0.5],   # 22
        [-0.1, 0.08, 1.0],   # 23
        [-0.2, 0.06, 1.5],   # 24

        # Puntos intermedios costa oeste con leve elevacion
        [-0.6, 0.03, -1.5],  # 25
        [-0.5, 0.04, -0.5],  # 26
        [-0.45, 0.05, 0.5],  # 27
        [-0.5, 0.04, 1.5],   # 28

        # Puntos intermedios costa este
        [-0.15, 0.03, -1.2], # 29
        [-0.05, 0.06, -0.3], # 30
        [-0.05, 0.06, 0.3],  # 31
        [-0.15, 0.03, 1.2],  # 32
    ], dtype=np.float32)

    # Triangulos (caras del terreno)
    triangles = np.array([
        # Superficie principal - zona sur
        [0, 1, 18], [0, 18, 25], [0, 25, 17], [17, 25, 16],
        [1, 2, 19], [1, 19, 18], [2, 3, 20], [2, 20, 19],
        [3, 4, 21], [3, 21, 20], [4, 5, 22], [4, 22, 21],
        [5, 6, 23], [5, 23, 22], [6, 7, 24], [6, 24, 23],
        [7, 8, 9], [7, 9, 24], [8, 17, 16], [8, 16, 9],

        # Zona central
        [25, 18, 19], [25, 19, 26], [26, 19, 20], [26, 20, 27],
        [27, 20, 21], [27, 21, 22], [27, 22, 28], [28, 22, 23],
        [28, 23, 24], [28, 24, 9],

        # Costa este detalle
        [29, 1, 2], [29, 2, 30], [30, 3, 4], [30, 4, 31],
        [31, 5, 6], [31, 6, 32], [32, 7, 8],

        # Zona norte
        [9, 10, 11], [9, 11, 24], [10, 11, 23], [10, 23, 28],
        [11, 12, 27], [11, 27, 23], [12, 13, 26], [12, 26, 27],
        [13, 14, 25], [13, 25, 26], [14, 15, 16], [14, 16, 25],

        # Zona sur costa oeste
        [16, 15, 29], [16, 29, 25], [15, 14, 29],
    ], dtype=np.uint32)

    return vertices, triangles


def create_water_plane():
    """
    Crea el plano de agua (WaterLevel_Animated).
    Plano rectangular que cubre toda la zona de Manga, representando
    el nivel del agua en la bahia y zonas inundadas.
    """
    # Plano grande que cubre toda la peninsula y la bahia
    s = 2.5  # escala
    vertices = np.array([
        [-s, 0.0, -s],    # 0
        [ s, 0.0, -s],    # 1
        [ s, 0.0,  s],    # 2
        [-s, 0.0,  s],    # 3
    ], dtype=np.float32)

    triangles = np.array([
        [0, 1, 2],
        [0, 2, 3],
    ], dtype=np.uint32)

    return vertices, triangles


def create_bay_water():
    """
    Crea el plano de la Bahia de Cartagena (agua permanente, no animada).
    """
    vertices = np.array([
        [-2.5, -0.02, -2.5],  # 0
        [-0.3, -0.02, -2.5],  # 1
        [-0.3, -0.02,  2.5],  # 2
        [-2.5, -0.02,  2.5],  # 3
    ], dtype=np.float32)

    triangles = np.array([
        [0, 1, 2],
        [0, 2, 3],
    ], dtype=np.uint32)

    return vertices, triangles


# ---------------------------------------------------------------------------
# Construccion del GLB
# ---------------------------------------------------------------------------

def build_glb(territory_verts, territory_tris,
              water_verts, water_tris,
              bay_verts, bay_tris,
              output_path: str):
    """
    Construye un archivo GLB con tres meshes:
      0: Territory_Manga (terreno)
      1: WaterLevel_Animated (agua animada)
      2: BayWater (bahia permanente)
    """
    # Preparar datos binarios
    t_tri_bytes = territory_tris.flatten().tobytes()
    t_ver_bytes = territory_verts.tobytes()
    w_tri_bytes = water_tris.flatten().tobytes()
    w_ver_bytes = water_verts.tobytes()
    b_tri_bytes = bay_tris.flatten().tobytes()
    b_ver_bytes = bay_verts.tobytes()

    # Offset calculations
    t_tri_len = len(t_tri_bytes)
    t_ver_len = len(t_ver_bytes)
    w_tri_len = len(w_tri_bytes)
    w_ver_len = len(w_ver_bytes)
    b_tri_len = len(b_tri_bytes)
    b_ver_len = len(b_ver_bytes)

    # Binary blob: territory_tri, territory_ver, water_tri, water_ver, bay_tri, bay_ver
    binary_blob = t_tri_bytes + t_ver_bytes + w_tri_bytes + w_ver_bytes + b_tri_bytes + b_ver_bytes

    # Buffer views (6 total: 3 index + 3 position)
    offset = 0
    bv_t_tri = offset; offset += t_tri_len
    bv_t_ver = offset; offset += t_ver_len
    bv_w_tri = offset; offset += w_tri_len
    bv_w_ver = offset; offset += w_ver_len
    bv_b_tri = offset; offset += b_tri_len
    bv_b_ver = offset; offset += b_ver_len

    # Accessors
    acc_t_tri = pygltflib.Accessor(
        bufferView=0, componentType=pygltflib.UNSIGNED_INT,
        count=int(territory_tris.size), type=pygltflib.SCALAR,
        max=[int(territory_tris.max())], min=[int(territory_tris.min())],
    )
    acc_t_ver = pygltflib.Accessor(
        bufferView=1, componentType=pygltflib.FLOAT,
        count=len(territory_verts), type=pygltflib.VEC3,
        max=territory_verts.max(axis=0).tolist(),
        min=territory_verts.min(axis=0).tolist(),
    )
    acc_w_tri = pygltflib.Accessor(
        bufferView=2, componentType=pygltflib.UNSIGNED_INT,
        count=int(water_tris.size), type=pygltflib.SCALAR,
        max=[int(water_tris.max())], min=[int(water_tris.min())],
    )
    acc_w_ver = pygltflib.Accessor(
        bufferView=3, componentType=pygltflib.FLOAT,
        count=len(water_verts), type=pygltflib.VEC3,
        max=water_verts.max(axis=0).tolist(),
        min=water_verts.min(axis=0).tolist(),
    )
    acc_b_tri = pygltflib.Accessor(
        bufferView=4, componentType=pygltflib.UNSIGNED_INT,
        count=int(bay_tris.size), type=pygltflib.SCALAR,
        max=[int(bay_tris.max())], min=[int(bay_tris.min())],
    )
    acc_b_ver = pygltflib.Accessor(
        bufferView=5, componentType=pygltflib.FLOAT,
        count=len(bay_verts), type=pygltflib.VEC3,
        max=bay_verts.max(axis=0).tolist(),
        min=bay_verts.min(axis=0).tolist(),
    )

    gltf = pygltflib.GLTF2(
        scene=0,
        scenes=[pygltflib.Scene(nodes=[0, 1, 2])],
        nodes=[
            pygltflib.Node(name="Territory_Manga", mesh=0),
            pygltflib.Node(name="WaterLevel_Animated", mesh=1),
            pygltflib.Node(name="BayWater", mesh=2),
        ],
        meshes=[
            pygltflib.Mesh(
                name="Terrain",
                primitives=[
                    pygltflib.Primitive(
                        attributes=pygltflib.Attributes(POSITION=1),
                        indices=0,
                    )
                ],
            ),
            pygltflib.Mesh(
                name="WaterPlane",
                primitives=[
                    pygltflib.Primitive(
                        attributes=pygltflib.Attributes(POSITION=3),
                        indices=2,
                    )
                ],
            ),
            pygltflib.Mesh(
                name="BayPlane",
                primitives=[
                    pygltflib.Primitive(
                        attributes=pygltflib.Attributes(POSITION=5),
                        indices=4,
                    )
                ],
            ),
        ],
        accessors=[acc_t_tri, acc_t_ver, acc_w_tri, acc_w_ver, acc_b_tri, acc_b_ver],
        bufferViews=[
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_t_tri, byteLength=t_tri_len,
                target=pygltflib.ELEMENT_ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_t_ver, byteLength=t_ver_len,
                target=pygltflib.ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_w_tri, byteLength=w_tri_len,
                target=pygltflib.ELEMENT_ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_w_ver, byteLength=w_ver_len,
                target=pygltflib.ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_b_tri, byteLength=b_tri_len,
                target=pygltflib.ELEMENT_ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0, byteOffset=bv_b_ver, byteLength=b_ver_len,
                target=pygltflib.ARRAY_BUFFER,
            ),
        ],
        buffers=[
            pygltflib.Buffer(byteLength=len(binary_blob))
        ],
    )

    gltf.set_binary_blob(binary_blob)
    gltf.save(output_path)
    print(f"Modelo 3D generado: {output_path}")
    print(f"  - Territory_Manga: {len(territory_verts)} vertices, {len(territory_tris)} caras")
    print(f"  - WaterLevel_Animated: {len(water_verts)} vertices, {len(water_tris)} caras")
    print(f"  - BayWater: {len(bay_verts)} vertices, {len(bay_tris)} caras")
    print(f"  - Tamano binario: {len(binary_blob)} bytes")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_path = os.path.join(project_root, "public", "models", "manga_model.glb")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print("Generando modelo 3D de Manga, Cartagena...")
    print()

    territory_verts, territory_tris = create_manga_peninsula()
    water_verts, water_tris = create_water_plane()
    bay_verts, bay_tris = create_bay_water()

    build_glb(territory_verts, territory_tris,
              water_verts, water_tris,
              bay_verts, bay_tris,
              output_path)


if __name__ == "__main__":
    main()
