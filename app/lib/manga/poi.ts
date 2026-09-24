/** Verified public points of interest in Manga. Coordinates are WGS84.
 *  Business locations were checked against the place result/address in Google Earth;
 *  coordinates are kept here as map anchors and are not claims about parcel boundaries.
 */
export type MangaPoi = {
  id: string;
  name: string;
  category: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  source: string;
  /** OSM building footprint matched to the verified point when confidence is high. */
  buildingId?: string;
};

export const MANGA_POIS: MangaPoi[] = [
  {
    id: 'carulla-villa-susana',
    name: 'Carulla Villa Susana',
    category: 'Supermercado',
    address: 'Villa Susana, Manga, Cartagena',
    description: 'Sede de Carulla ubicada en Villa Susana. La huella del supermercado está nombrada en la cartografía del modelo.',
    latitude: 10.41333,
    longitude: -75.5403,
    source: 'https://www.google.com/maps/search/?api=1&query=10.41333%2C-75.5403',
    buildingId: 'osm-way-64621438-0',
  },
  {
    id: 'sanato-manga',
    name: 'SANATo · Un sano antojo',
    category: 'Restaurante saludable',
    address: 'Calle 24A #20-20 a 20-96, Manga, Cartagena',
    description: 'Lugar identificado en Google Earth como SANATo – Un sano antojo. La dirección mostrada por Earth se conserva para distinguirlo de otros negocios llamados Sanato.',
    latitude: 10.4128275,
    longitude: -75.5401154,
    source: 'https://www.google.com/maps/search/?api=1&query=10.4128275%2C-75.5401154',
    buildingId: 'osm-way-109813096-0',
  },
  {
    id: 'atrium-manga',
    name: 'Atrium Food & Drinks · Manga',
    category: 'Restaurante',
    address: 'Calle Real #19-26, Manga, Cartagena',
    description: 'Sede Manga de Atrium Food & Drinks. El punto se georreferenció con el resultado de Google Earth para esta dirección.',
    latitude: 10.41331095,
    longitude: -75.5397522,
    source: 'https://www.google.com/maps/search/?api=1&query=10.41331095%2C-75.5397522',
    buildingId: 'osm-way-109811266-0',
  },
  {
    id: 'tortas-maran-manga',
    name: 'Tortas Marán',
    category: 'Pastelería',
    address: 'Carrera 21 #25-93, Manga, Cartagena',
    description: 'Punto de Tortas Marán identificado en Google Earth. Su marcador queda asociado a la huella más cercana del modelo.',
    latitude: 10.4135387,
    longitude: -75.5381669,
    source: 'https://www.google.com/maps/search/?api=1&query=10.4135387%2C-75.5381669',
    buildingId: 'osm-way-109811285-0',
  },
  {
    id: 'utb-casa-lemaitre',
    name: 'Universidad Tecnológica de Bolívar · Casa Lemaitre',
    category: 'Universidad',
    address: 'Calle del Bouquet, Carrera 21 #25-92, Manga, Cartagena',
    description: 'Campus Casa Lemaitre de la UTB en Manga. Es distinto del Campus Tecnológico ubicado en la vía a Turbaco.',
    latitude: 10.41315751288616,
    longitude: -75.5382160371619,
    source: 'https://www.google.com/maps/search/?api=1&query=10.4131575%2C-75.5382160',
  },
];
