"""Architectural presentation inside each frozen footprint; called by builder.

Casa Roman is a partial historical interpretation, not a measured replica.
All other profiles are explicitly approximate. No hydrology is modified.
"""
import bmesh

def build(context):
    g=context
    bpy=g['bpy']; math=g['math']; ROOT=g['ROOT']; json=g['json']
    profiles=json.loads((ROOT/'data/manga/architecture.json').read_text(encoding='utf8'))
    assert profiles['sourceSha256']==g['details']['sourceSha256']
    wood=g['material']('Madera_persiana',(.11,.19,.16),.8)
    clay=g['material']('Teja_arcilla',(.34,.125,.058),.89,kind='tile')
    zinc=g['material']('Zinc_costero',(.38,.43,.44),.56,.3,kind='metal')
    mats=[*g['facades'],*g['roofs'],g['glass'],g['frames'],g['dark'],g['concrete'],wood,clay,zinc]
    GLASS,TRIM,DARK,STONE,WOOD,CLAY,ZINC=10,11,12,13,14,15,16
    counts={'profiles':profiles['counts'],'recessedFronts':0,'roofFaces':0,'balconyRails':0,'shutters':0,'roofEquipment':0,'landmark':'Casa Román: interpretación parcial 2004'}
    for b in g['data']['buildings']:
        cfg=profiles['buildings'][b['id']]; style=cfg['profile'];seed=cfg['seed']
        if style=='canopy':continue
        facade=seed%6
        if style=='roman':facade=5
        for name in [b['id'],'Detalle_'+b['id']]:
            ob=bpy.data.objects.get(name)
            if ob:bpy.data.objects.remove(ob,do_unlink=True)
        vs=[];fs=[];mi=[]
        def face(points,material):
            k=len(vs);vs.extend(points);fs.append(tuple(range(k,k+len(points))));mi.append(material)
        def box(a,u,n,x0,x1,y0,y1,z0,z1,material):
            if x1<=x0 or y1<=y0 or z1<=z0:return
            def v(x,y,z):return(a[0]+u[0]*x+n[0]*y,a[1]+u[1]*x+n[1]*y,z)
            points=[v(x,y,z) for z in (z0,z1) for y in (y0,y1) for x in (x0,x1)]
            for ids in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]:face([points[i] for i in ids],material)
        def panel(a,u,n,x0,x1,dep,z0,z1,material):
            face([(a[0]+u[0]*x+n[0]*dep,a[1]+u[1]*x+n[1]*dep,z) for x,z in [(x0,z0),(x1,z0),(x1,z1),(x0,z1)]],material)
        def arch(a,u,n,center,radius,spring,dep,thickness,material):
            # Actual open voussoir band, not a rectangle with a dark arch painted on.
            for step in range(16):
                t0=math.pi*step/16;t1=math.pi*(step+1)/16
                def p(t,r,d):return(a[0]+u[0]*(center+math.cos(t)*r)+n[0]*d,a[1]+u[1]*(center+math.cos(t)*r)+n[1]*d,spring+math.sin(t)*r*.85)
                face([p(t0,radius,dep),p(t1,radius,dep),p(t1,radius+thickness,dep),p(t0,radius+thickness,dep)],material)
                face([p(t0,radius,dep+.24),p(t1,radius,dep+.24),p(t1,radius,dep),p(t0,radius,dep)],material)
        top=cfg['eave'];base=b['base'];h=top-base
        floors=1 if style=='roman' else max(1,round(h/3))
        floorH=h/floors
        roofmat=CLAY if style in ('roman','shutters','caribbean') else ZINC if style=='warehouse' else 6+(seed//13)%4
        for tri in cfg['roof']:face(tri,roofmat)
        counts['roofFaces']+=len(cfg['roof'])
        for ri,ring in enumerate(b['rings']):
            area=sum(a[0]*c[1]-c[0]*a[1] for a,c in zip(ring,ring[1:]))
            for edge,(a,c) in enumerate(zip(ring,ring[1:])):
                length=math.dist(a,c)
                if length<.02:continue
                u=((c[0]-a[0])/length,(c[1]-a[1])/length)
                n=(-u[1],u[0]) if area>0 else (u[1],-u[0])
                front=ri==0 and edge==cfg['front']
                recess=cfg['recess'] if front else 0
                # Every added piece stays inward; very short sides receive walls only.
                foundation=g['details']['foundations'][b['id']][ri]
                zground=min(base,foundation[edge][2],foundation[edge+1][2])
                # Long walls are assembled around real openings below, so window
                # panes and recessed shutters are not hidden behind a solid wall.
                if length<3:panel(a,u,n,0,length,recess,zground,top,facade)
                else:panel(a,u,n,0,length,recess,zground,base,facade)
                if recess:
                    counts['recessedFronts']+=1
                    for x in (0,length):
                        face([(a[0]+u[0]*x+n[0]*y,a[1]+u[1]*x+n[1]*y,z) for y,z in [(0,base),(recess,base),(recess,top),(0,top)]],facade)
                    box(a,u,n,.02,length-.02,.02,recess+.08,base,base+.18,STONE)
                if length<3:continue
                # Wall base and eaves. All details have volume and cast local shadows.
                box(a,u,n,.04,length-.04,max(.003,recess-.035),recess+.065,base+.05,base+.30,STONE)
                box(a,u,n,.06,length-.06,.015,.22,top-.19,top,TRIM)
                bays=max(1,min(20,int(length/(4.0 if style=='modern' else 3.25))))
                pitch=length/bays
                for floor in range(floors):
                    level=base+floor*floorH
                    if recess and floor>0:
                        box(a,u,n,.04,length-.04,.02,recess+.04,level-.12,level+.05,TRIM)
                        # Balcony sits inside the mapped envelope, clear of neighbours.
                        box(a,u,n,.15,length-.15,.12,.18,level+.9,level+.95,DARK)
                        for post in range(max(2,int(length/.48))):
                            x=.2+post*(length-.4)/max(1,int(length/.48)-1)
                            box(a,u,n,x-.017,x+.017,.13,.17,level+.08,level+.92,DARK)
                            counts['balconyRails']+=1
                    for bay in range(bays):
                        center=(bay+.5)*pitch
                        door=front and floor==0 and bay==bays//2
                        half=min(.82,pitch*.27);bottom=level+(.19 if door else .78)
                        upper=min(level+(2.48 if door else 2.24),top-.40)
                        if style=='roman':bottom=base+.45;upper=top-1.15;half=min(.86,pitch*.29)
                        if upper<=bottom:continue
                        x0,x1=center-half,center+half
                        for l,r,z0,z1 in [(bay*pitch,x0,level,level+floorH),(x1,(bay+1)*pitch,level,level+floorH),(x0,x1,level,bottom),(x0,x1,upper,level+floorH)]:
                            if z1>z0:panel(a,u,n,l,r,recess,z0,z1,facade)
                        dep=recess+.10
                        panel(a,u,n,x0,x1,dep,bottom,upper,DARK if door else GLASS)
                        # Jambs and lintel project from recessed wall, or sit inside envelope.
                        d0=max(.001,recess-.10);d1=max(.17,recess+.015)
                        for l,r,z0,z1 in [(x0-.08,x0,bottom-.07,upper+.09),(x1,x1+.08,bottom-.07,upper+.09),(x0,x1,upper,upper+.09),(x0-.1,x1+.1,bottom-.10,bottom)]:
                            if front:box(a,u,n,l,r,d0,d1,z0,z1,TRIM)
                            else:panel(a,u,n,l,r,.008,z0,z1,TRIM)
                        if not door:
                            panel(a,u,n,center-.024,center+.024,max(.001,recess-.04),bottom,upper,TRIM)
                            if style in ('shutters','caribbean'):
                                for l,r in [(x0,x0+half*.65),(x1-half*.65,x1)]:
                                    panel(a,u,n,l,r,recess+.06,bottom,upper,WOOD)
                                    for slat in range(7 if front else 0):
                                        z=bottom+(upper-bottom)*(slat+.2)/7
                                        face([(a[0]+u[0]*x+n[0]*y,a[1]+u[1]*x+n[1]*y,zz) for x,y,zz in [(l,recess+.01,z),(r,recess+.01,z),(r,recess+.085,z+.065),(l,recess+.085,z+.065)]],WOOD)
                                counts['shutters']+=1
                            elif front and floor==0 and style!='roman':
                                for bar in range(4):
                                    x=x0+(x1-x0)*(bar+1)/5
                                    box(a,u,n,x-.016,x+.016,.002,.04,bottom,upper,DARK)
                        elif style!='roman':
                            for seam in range(4):panel(a,u,n,x0+.07,x1-.07,max(.0005,recess-.022),bottom+.23+seam*.43,bottom+.25+seam*.43,WOOD)
                        if style=='roman':
                            arch(a,u,n,center,half,upper-.30,max(.001,recess-.10),.13,TRIM)
                if recess:
                    # Pilasters / columns supporting gallery, all on the actual frontage.
                    for col in range(bays+1):
                        x=max(.16,min(length-.16,col*pitch))
                        box(a,u,n,x-.10,x+.10,.12,.34,base+.20,top-.19,TRIM)
                        box(a,u,n,x-.17,x+.17,.05,.42,base+.20,base+.48,TRIM)
                        box(a,u,n,x-.18,x+.18,.04,.43,top-.60,top-.35,TRIM)
                    if style=='roman':
                        for bay in range(bays):
                            arch(a,u,n,(bay+.5)*pitch,pitch*.5-.15,top-1.55,.06,.14,TRIM)
                        # Small stepped merlons, inspired by the photographed crown.
                        for j in range(max(2,int(length/.65))):
                            x=.22+j*(length-.44)/max(1,int(length/.65)-1)
                            box(a,u,n,x-.12,x+.12,.04,.34,top,top+.18,TRIM)
                            box(a,u,n,x-.065,x+.065,.08,.29,top+.18,top+.27,TRIM)
                if front and style in ('modern','institution') and length>6:
                    # Recessed canopy and louvers, not an out-of-footprint cantilever.
                    box(a,u,n,length*.3,length*.7,.01,.7,base+2.48,base+2.60,ZINC)
        # Equipment is restricted to a central point guaranteed inside a roof triangle.
        if style in ('modern','institution') and b['roofTriangles']:
            tri=max(b['roofTriangles'],key=lambda t:abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0])))
            cx=sum(v[0] for v in tri)/3;cy=sum(v[1] for v in tri)/3
            # Test all corners and midpoints in source polygon; avoid narrow roofs.
            corners=[(cx+x,cy+y) for x in (-.65,0,.65) for y in (-.45,0,.45)]
            if all(g['inside'](x,y,b['rings'][0]) and not any(g['inside'](x,y,r) for r in b['rings'][1:]) for x,y in corners):
                box((cx,cy),(1,0),(0,1),-.65,.65,-.45,.45,top+.02,top+.65,ZINC)
                for j in range(5):box((cx,cy),(1,0),(0,1),-.56,.56,-.35+j*.14,-.30+j*.14,top+.65,top+.67,DARK)
                counts['roofEquipment']+=1
        # Keep polygons inside their building footprint, including acute corners.
        if cfg['boundaryClearance']<2:
            valid=[g['inside'](v[0],v[1],g['data']['boundary']) for v in vs]
            kept=[i for i,f in enumerate(fs) if all(valid[k] for k in f)]
            fs=[fs[i] for i in kept];mi=[mi[i] for i in kept]
        ob=g['mesh'](b['id'],vs,fs,'Edificios',mats,mi)
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
        ob['osm_id']=b['id'];ob['name_osm']=b['name'];ob['architecture_profile']=style
        ob['height_m']=b['height'];ob['height_method']=b['heightMethod'];ob['visual_height_m']=cfg['height']
        ob['facade_status']='Historical partial interpretation, dimensions inferred' if style=='roman' else 'Approximate architectural profile, not surveyed'
        if style=='roman':ob['reference']='Sergio Londoño, CasaRoman.jpg (2004), CC BY-SA 3.0; interpretation, not photo texture'
        if len(bpy.data.meshes)>6000:
            for orphan in list(bpy.data.meshes):
                if orphan.users==0:bpy.data.meshes.remove(orphan)
    g['detail_counts']['architecture']=counts
    (ROOT/'docs/manga/architecture-build.json').write_text(json.dumps(counts,indent=2,ensure_ascii=False),encoding='utf8')
