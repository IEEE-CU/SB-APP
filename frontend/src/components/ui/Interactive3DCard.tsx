import React, { useRef, useState } from 'react';

interface Interactive3DCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxRotation?: number; // Maximum rotation in degrees
}

export default function Interactive3DCard({
  children,
  className = '',
  maxRotation = 15,
  style,
  ...props
}: Interactive3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
    background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 60%)',
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Relative mouse coordinates from center of card
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Normalize coordinates (-0.5 to 0.5)
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;

    // Calculate rotation: mouse X moves rotateY, mouse Y moves rotateX
    const rotateY = normalizedX * maxRotation;
    const rotateX = -normalizedY * maxRotation;

    setTransformStyle(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`
    );

    // Dynamic glare effect tracking cursor
    const glareX = ((e.clientX - rect.left) / rect.width) * 100;
    const glareY = ((e.clientY - rect.top) / rect.height) * 100;

    setGlareStyle({
      opacity: 0.6,
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 50%)`,
    });
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlareStyle({
      opacity: 0,
      background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 60%)',
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-all duration-200 ease-out shadow-md hover:shadow-elevated rounded-xl border border-hairline bg-surface ${className}`}
      style={{
        transform: transformStyle,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      {...props}
    >
      {/* Glare Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
        style={glareStyle}
      />
      {/* Container to enforce preserve-3d on children */}
      <div className="relative w-full h-full z-0" style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </div>
  );
}
