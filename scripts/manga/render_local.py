"""Reproducible, entirely local Blender 5.2.2 renders and MP4 encoding.

blender -b models/manga/MANGA_STORMPRINT_FINAL.blend --python scripts/manga/render_local.py -- --preview
blender -b models/manga/MANGA_STORMPRINT_FINAL.blend --python scripts/manga/render_local.py -- --stills
blender -b models/manga/MANGA_STORMPRINT_FINAL.blend --python scripts/manga/render_local.py -- --animation
blender -b --factory-startup --python scripts/manga/render_local.py -- --encode

Animation is checkpointed as numbered PNG frames. --start/--end restrict a
chunk; --resume skips existing nonempty images. --encode checks every required
frame before encoding. Scene changes are deliberately never saved to the blend.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from datetime import datetime, timezone

import bpy


ROOT = Path(__file__).resolve().parents[2]
CAMERAS = (
    'Aerea_General_Manga', 'Costa_Manga', 'Urbana_Manga',
    'Lluvia_Manga', 'Inundacion_Exploratoria',
)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--preview', action='store_true', help='640x360 Eevee, 16 samples')
    modes.add_argument('--stills', action='store_true', help='1600x900 Cycles OPTIX, 64 samples')
    modes.add_argument('--animation', action='store_true', help='1280x720 Eevee, PNG sequence, 24 fps')
    modes.add_argument('--encode', action='store_true', help='Encode an existing PNG sequence to H.264 MP4 locally')
    parser.add_argument('--camera', choices=(*CAMERAS, 'Recorrido_Manga', 'Casa_Roman_Referencia'))
    parser.add_argument('--frame', type=int, help='Render a single frame (including animation mode)')
    parser.add_argument('--start', type=int, default=1)
    parser.add_argument('--end', type=int, default=360)
    parser.add_argument('--samples', type=int, help='Explicit measured-quality override')
    parser.add_argument('--width', type=int, help='Explicit output width override')
    parser.add_argument('--height', type=int, help='Explicit output height override')
    parser.add_argument('--output', type=Path, default=ROOT / 'models/manga/renders')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--cpu', action='store_true', help='Explicit Cycles CPU fallback; never silently fallback')
    parser.add_argument('--threads', type=int, default=8, help='Keep interactive desktop capacity available')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)
    if not 1 <= args.start <= args.end or (args.frame is not None and args.frame < 1):
        parser.error('Frame range must be positive and ordered.')
    if args.threads < 1 or any(v is not None and v < 1 for v in (args.width, args.height, args.samples)):
        parser.error('Resolution, samples and threads must be positive.')
    return args


def action_curves(obj):
    action = obj.animation_data.action if obj.animation_data else None
    if action is None:
        return
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


class SceneScenarios:
    """Small reversible presentation changes; simulation geometry stays intact."""

    def __init__(self, scene):
        self.scene = scene
        self.materials = []
        self.suns = [(o.data, o.data.energy) for o in scene.objects if o.type == 'LIGHT' and o.data.type == 'SUN']
        for material in bpy.data.materials:
            if not material.use_nodes:
                continue
            bsdf = material.node_tree.nodes.get('Principled BSDF')
            if bsdf is None:
                continue
            name = material.name.lower()
            if any(term in name for term in ('asfalto', 'pavimento', 'acera', 'anden', 'andén', 'concreto', 'cubierta', 'fachada', 'suelo')):
                roughness = bsdf.inputs['Roughness']
                color = bsdf.inputs['Base Color']
                self.materials.append((roughness, roughness.default_value, color, tuple(color.default_value)))
        # Old hydrology demos keyframe visibility. Mute visibility channels so
        # scene.frame_set cannot override the chosen camera's explicit scenario.
        for obj in scene.objects:
            if obj.name.startswith(('Agua_DEMO', 'Lluvia_visual')):
                for curve in action_curves(obj):
                    if curve.data_path == 'hide_render':
                        curve.mute = True

    def apply(self, camera_name):
        raining = camera_name == 'Lluvia_Manga'
        flooding = camera_name == 'Inundacion_Exploratoria'
        for obj in self.scene.objects:
            if obj.name.startswith('Agua_DEMO'):
                obj.hide_render = not flooding
            elif obj.name.startswith('Lluvia_visual'):
                obj.hide_render = not raining
        for roughness, original_roughness, color, original_color in self.materials:
            if not roughness.is_linked:
                roughness.default_value = max(.16, original_roughness * .4) if raining else original_roughness
            if not color.is_linked:
                color.default_value = tuple(v * .76 for v in original_color[:3]) + (original_color[3],) if raining else original_color
        for sun, original_energy in self.suns:
            sun.energy = original_energy * .5 if raining else original_energy
        render = self.scene.render
        for prop in ('use_stamp_date', 'use_stamp_time', 'use_stamp_render_time', 'use_stamp_frame', 'use_stamp_frame_range', 'use_stamp_memory', 'use_stamp_hostname', 'use_stamp_camera', 'use_stamp_lens', 'use_stamp_scene', 'use_stamp_marker', 'use_stamp_filename', 'use_stamp_sequencer_strip'):
            if hasattr(render, prop):
                setattr(render, prop, False)
        render.use_stamp = flooding
        render.use_stamp_note = flooding
        render.use_stamp_labels = False
        render.stamp_note_text = 'EXPLORATORIO - NO ES PREDICCION CERTIFICADA | Manga, Cartagena'
        render.stamp_font_size = max(10, round(render.resolution_x / 100))
        render.stamp_foreground = (1., 1., 1., 1.)
        render.stamp_background = (.018, .025, .035, .86)
        return 'inundacion_exploratoria' if flooding else 'lluvia_visual' if raining else 'seco'


def configure(scene, args):
    scene.render.resolution_percentage = 100
    width, height = (640, 360) if args.preview else (1600, 900) if args.stills else (1280, 720)
    scene.render.resolution_x = args.width or width
    scene.render.resolution_y = args.height or height
    scene.render.image_settings.media_type = 'IMAGE'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20
    scene.render.fps = 24
    scene.render.fps_base = 1
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = args.threads
    scene.render.use_file_extension = True
    scene.render.use_persistent_data = False
    scene.render.use_simplify = True
    scene.render.simplify_subdivision_render = 1
    if hasattr(scene.cycles, 'texture_limit_render'):
        scene.cycles.texture_limit_render = '2048'
    if args.stills:
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = args.samples or 64
        scene.cycles.use_denoising = True
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = .035
        scene.cycles.max_bounces = 6
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 3
        scene.cycles.transmission_bounces = 4
        scene.cycles.volume_bounces = 0
        scene.cycles.caustics_reflective = False
        scene.cycles.caustics_refractive = False
        if args.cpu:
            scene.cycles.device = 'CPU'
            device = 'CPU (explicit --cpu)'
        else:
            preferences = bpy.context.preferences.addons['cycles'].preferences
            preferences.compute_device_type = 'OPTIX'
            preferences.refresh_devices()
            available = [d for d in preferences.devices if d.type == 'OPTIX']
            if not available:
                raise RuntimeError('No OPTIX device found. Retry with --cpu if explicitly desired.')
            for d in preferences.devices:
                d.use = d.type == 'OPTIX'
            scene.cycles.device = 'GPU'
            device = 'OPTIX: ' + ', '.join(d.name for d in available)
        samples = scene.cycles.samples
    else:
        # Blender 5.2 calls the engine BLENDER_EEVEE (not EEVEE_NEXT).
        scene.render.engine = 'BLENDER_EEVEE'
        scene.eevee.taa_render_samples = args.samples or (16 if args.preview else 24)
        samples = scene.eevee.taa_render_samples
        device = 'Eevee GPU (Blender graphics backend)'
    return {
        'engine': scene.render.engine,
        'device': device,
        'samples': samples,
        'resolution': [scene.render.resolution_x, scene.render.resolution_y],
        'fps': 24,
        'threads': args.threads,
        'memory_strategy': 'Instanced scene, no persistent data, subdivision 1; Cycles texture limit 2048. This is not a hard VRAM cap.',
    }


def write_report(path, report):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temp, path)


def png_size(path):
    """Validate the PNG envelope before resuming or encoding a prior frame."""
    if not path.exists() or path.stat().st_size < 1024:
        return None
    with path.open('rb') as stream:
        header = stream.read(24)
        stream.seek(-12, 2)
        end = stream.read()
    if header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR' or end[4:8] != b'IEND':
        return None
    return [int.from_bytes(header[16:20], 'big'), int.from_bytes(header[20:24], 'big')]


def encode_sequence(args, report):
    if not bpy.app.build_options.codec_ffmpeg:
        raise RuntimeError('This Blender build has no FFmpeg codec support.')
    sequence = args.output / 'animation'
    paths = [sequence / f'{frame:04d}.png' for frame in range(args.start, args.end + 1)]
    expected_size = [args.width or 1280, args.height or 720]
    missing = [p.name for p in paths if png_size(p) != expected_size]
    if missing:
        raise RuntimeError(f'Missing, incomplete or wrong-size PNGs ({len(missing)} frames): {missing[:20]}; expected {expected_size}')
    # Use an empty VSE scene. No city rendering occurs in this encoding step.
    scene = bpy.data.scenes.new('Codificacion_local_Manga')
    bpy.context.window.scene = scene
    scene.render.resolution_x = args.width or 1280
    scene.render.resolution_y = args.height or 720
    scene.render.resolution_percentage = 100
    scene.render.fps = 24
    scene.render.fps_base = 1
    scene.frame_start = 1
    scene.frame_end = len(paths)
    editor = scene.sequence_editor_create()
    strip = editor.strips.new_image('Recorrido_Manga', filepath=str(paths[0]), channel=1, frame_start=1)
    for path in paths[1:]:
        strip.elements.append(path.name)
    # PNGs already have their final view transform. Standard prevents AgX from
    # being applied a second time when the image sequence goes through the VSE.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.image_settings.media_type = 'VIDEO'
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.render.use_sequencer = True
    target = args.output / 'Manga_Recorrido_15s.mp4'
    if args.start != 1 or args.end != 360:
        target = args.output / f'Manga_Recorrido_{args.start:04d}_{args.end:04d}.mp4'
    scene.render.filepath = str(target)
    started = time.perf_counter()
    bpy.ops.render.render(animation=True)
    if not target.exists() or target.stat().st_size < 1024:
        raise RuntimeError(f'Encoder did not produce a valid nonempty MP4: {target}')
    result = {
        'path': str(target), 'status': 'complete', 'seconds': round(time.perf_counter() - started, 3),
        'bytes': target.stat().st_size, 'frames': len(paths), 'duration_seconds': len(paths) / 24,
        'engine': 'Blender VSE / bundled FFmpeg', 'codec': 'H.264 / MP4',
        'resolution': [scene.render.resolution_x, scene.render.resolution_y],
    }
    report['results'].append(result)
    print('MANGA_ENCODING_COMPLETE', json.dumps(result), flush=True)


def main():
    args = parse_args()
    if bpy.app.version[:3] != (5, 2, 2):
        raise RuntimeError(f'Requires Blender 5.2.2; running {bpy.app.version_string}')
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    mode = 'encode' if args.encode else 'preview' if args.preview else 'stills' if args.stills else 'animation'
    label = f'{mode}_{args.camera or "all"}_{args.frame or args.start:04d}_{args.frame or args.end:04d}'
    report_path = args.output / f'report_{label}.json'
    report = {
        'started_utc': datetime.now(timezone.utc).isoformat(),
        'blender_version': bpy.app.version_string,
        'blender_executable': bpy.app.binary_path,
        'blend_file': bpy.data.filepath,
        'local_only': True,
        'mode': mode,
        'status': 'running',
        'results': [],
        'notes': ['Architectural materials/details are generic unless documented as verified.', 'Hydrology is exploratory, not a certified prediction.'],
    }
    overall_started = time.perf_counter()
    write_report(report_path, report)
    try:
        if args.encode:
            encode_sequence(args, report)
        else:
            if not bpy.data.filepath:
                raise RuntimeError('Open the generated .blend before this render script.')
            scene = bpy.context.scene
            report['settings'] = configure(scene, args)
            report['blend_sha256'] = hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()
            if args.animation:
                manifest_path=args.output/'animation'/'manifest.json'
                manifest={'blendSha256':report['blend_sha256'],'settings':report['settings'],'rendererSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
                if manifest_path.exists() and json.loads(manifest_path.read_text(encoding='utf8'))!=manifest:
                    raise RuntimeError('Animation settings/model changed. Use a new --output directory to preserve the prior sequence.')
                manifest_path.parent.mkdir(parents=True,exist_ok=True)
                manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf8')
            scenarios = SceneScenarios(scene)
            camera_names = [args.camera] if args.camera else ['Recorrido_Manga'] if args.animation else list(CAMERAS)
            for name in camera_names:
                if name not in bpy.data.objects or bpy.data.objects[name].type != 'CAMERA':
                    raise RuntimeError(f'Missing required camera: {name}')
            for name in camera_names:
                scene.camera = bpy.data.objects[name]
                if args.frame:
                    frames = [args.frame]
                elif args.animation:
                    frames = range(args.start, args.end + 1)
                else:
                    frames = [180 if name == 'Inundacion_Exploratoria' else 22 if name == 'Lluvia_Manga' else 1]
                directory = args.output / mode
                directory.mkdir(parents=True, exist_ok=True)
                for frame in frames:
                    target = directory / (f'{frame:04d}.png' if args.animation else f'{name}.png')
                    if args.resume and png_size(target) == report['settings']['resolution']:
                        report['results'].append({'path': str(target), 'frame': frame, 'camera': name, 'status': 'skipped_existing', 'bytes': target.stat().st_size})
                        write_report(report_path, report)
                        continue
                    scene.frame_set(frame)
                    scenario = scenarios.apply(name)
                    scene.render.filepath = str(target)
                    bpy.context.view_layer.update()
                    started = time.perf_counter()
                    bpy.ops.render.render(write_still=True)
                    if png_size(target) != report['settings']['resolution']:
                        raise RuntimeError(f'Render did not produce a valid nonempty image: {target}')
                    result = {
                        'path': str(target), 'camera': name, 'frame': frame, 'scenario': scenario,
                        'status': 'complete', 'seconds': round(time.perf_counter() - started, 3),
                        'bytes': target.stat().st_size,
                        'engine': report['settings']['engine'], 'device': report['settings']['device'],
                        'blender_version': bpy.app.version_string,
                    }
                    report['results'].append(result)
                    write_report(report_path, report)
                    print('MANGA_FRAME_COMPLETE', json.dumps(result), flush=True)
        report['status'] = 'complete'
    except Exception as exc:
        report['status'] = 'failed'
        report['error'] = f'{type(exc).__name__}: {exc}'
        raise
    finally:
        report['elapsed_seconds'] = round(time.perf_counter() - overall_started, 3)
        report['finished_utc'] = datetime.now(timezone.utc).isoformat()
        write_report(report_path, report)
        print('MANGA_RENDER_REPORT', str(report_path), flush=True)


if __name__ == '__main__':
    main()
