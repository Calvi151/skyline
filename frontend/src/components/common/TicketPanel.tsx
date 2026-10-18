import React from 'react'

interface TicketPanelProps {
  children: React.ReactNode
  orientation?: 'horizontal' | 'vertical'
  className?: string
  notchPositionPercent?: number
}

export default function TicketPanel({
  children,
  orientation = 'horizontal',
  className = '',
  notchPositionPercent = 70,
}: TicketPanelProps) {
  return (
    <div
      className={`relative bg-panel border border-line rounded-ticket overflow-hidden shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {orientation === 'horizontal' ? (
        <>
          {/* Top Notch */}
          <div
            className="absolute -top-3 w-6 h-6 rounded-full bg-page border border-line z-10"
            style={{
              left: `${notchPositionPercent}%`,
              transform: 'translateX(-50%)',
            }}
          />

          {/* Perforated Dotted Line */}
          <div
            className="absolute top-3 bottom-3 border-r-2 border-dashed border-line/80 z-0 pointer-events-none"
            style={{ left: `${notchPositionPercent}%` }}
          />

          {/* Bottom Notch */}
          <div
            className="absolute -bottom-3 w-6 h-6 rounded-full bg-page border border-line z-10"
            style={{
              left: `${notchPositionPercent}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </>
      ) : (
        <>
          {/* Left Notch */}
          <div
            className="absolute -left-3 w-6 h-6 rounded-full bg-page border border-line z-10"
            style={{
              top: `${notchPositionPercent}%`,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Horizontal Perforated Line */}
          <div
            className="absolute left-3 right-3 border-b-2 border-dashed border-line/80 z-0 pointer-events-none"
            style={{ top: `${notchPositionPercent}%` }}
          />

          {/* Right Notch */}
          <div
            className="absolute -right-3 w-6 h-6 rounded-full bg-page border border-line z-10"
            style={{
              top: `${notchPositionPercent}%`,
              transform: 'translateY(-50%)',
            }}
          />
        </>
      )}

      {/* Content wrapper */}
      <div className="relative z-1">{children}</div>
    </div>
  )
}
