"use client";

import dynamic from 'next/dynamic';

const Viewer = dynamic(() => import('@/app/components/MangaContract'), {
  ssr: false,
  loading: () => <p role="status">Cargando visor de Manga…</p>,
});

export default function Manga3DPage() {
  return <Viewer />;
}
