import { ReactNode } from 'react';
import { Navigation } from './Navigation';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div 
      className="md:ml-56 transition-all duration-200"
      style={{
        backgroundColor: '#0a0a0f',
        color: '#e8e8f0',
        minHeight: '100vh'
      }}
    >
      {/* Grid sutil */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(124,106,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,106,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Orb roxo top-left */}
      <div style={{
        position: 'fixed',
        width: '600px', height: '600px',
        background: 'rgba(124,106,255,0.08)',
        borderRadius: '50%',
        filter: 'blur(120px)',
        top: '-200px', left: '-100px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Orb verde bottom-right */}
      <div style={{
        position: 'fixed',
        width: '400px', height: '400px',
        background: 'rgba(0,212,170,0.06)',
        borderRadius: '50%',
        filter: 'blur(120px)',
        bottom: '0', right: '-100px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <Navigation />
      
      <div style={{ 
        position: 'relative', 
        zIndex: 1,
        transition: 'opacity 0.2s ease',
        opacity: 1 
      }}>
        {children}
      </div>
    </div>
  );
};