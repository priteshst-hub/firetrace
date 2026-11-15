import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: 'FireTrace · Global Fire Observatory',
 description: 'Explore verified NASA FIRMS hotspot observations and compare MODIS and VIIRS sampling during Australia’s Black Summer.',
 icons: {icon:'/favicon.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}</body></html>;
}
