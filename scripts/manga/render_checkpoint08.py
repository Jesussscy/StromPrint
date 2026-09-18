"""Checkpoint08 cameras and light variants; preserves checkpoint07 renderer."""
import math
import runpy
from pathlib import Path
import bpy

module=runpy.run_path(str(Path(__file__).with_name('render_local.py')))
g=module['main'].__globals__
g['CAMERAS']=(*g['CAMERAS'],'Jardin_Manga','Atardecer_Manga','Noche_Manga')
Original=g['SceneScenarios']
class Scenarios(Original):
    def apply(self,camera_name):
        scenario=super().apply(camera_name)
        night=camera_name=='Noche_Manga';evening=camera_name=='Atardecer_Manga'
        for light,energy in self.suns:
            light.energy=.45 if night else 2.5 if evening else energy*(.5 if camera_name=='Lluvia_Manga' else 1)
            light.color=(.35,.5,1) if night else (1,.72,.43) if evening else (1,.94,.82)
        for n in self.scene.world.node_tree.nodes:
            if n.type=='BACKGROUND':n.inputs['Strength'].default_value=.09 if night else .10 if evening else .18
            if n.type=='TEX_SKY':n.sun_elevation=math.radians(0 if night else 12 if evening else 48)
        self.scene.view_settings.exposure=1.0 if night else .1
        # Keep a readable blue night, not a black frame or a sunset sky.
        if night:
            for n in self.scene.world.node_tree.nodes:
                if n.type=='BACKGROUND':
                    for link in list(n.inputs['Color'].links):self.scene.world.node_tree.links.remove(link)
                    n.inputs['Color'].default_value=(.12,.20,.36,1)
                    n.inputs['Strength'].default_value=.35
        return 'night' if night else 'sunset' if evening else scenario
g['SceneScenarios']=Scenarios
module['main']()
