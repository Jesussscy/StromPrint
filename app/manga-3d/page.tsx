"use client";

import dynamic from 'next/dynamic';
import '@/app/components/MangaContract.css';

const Viewer = dynamic(() => import('@/app/components/MangaContract'), {
  ssr: false,
  loading: () => <main className="manga-route-loading" role="status"><span>STORMPRINT / MANGA</span><strong>Preparando el mapa 3D…</strong></main>,
});

export default function Manga3DPage() {
  return <Viewer />;
}
