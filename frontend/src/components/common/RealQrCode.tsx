import React, { useMemo } from 'react'
import { qrcodegen } from '../../lib/qrcodegen'

interface RealQrCodeProps {
  value: string
  size?: number | string
  border?: number
  className?: string
  darkColor?: string
  lightColor?: string
  alt?: string
}

export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = '100%',
  border = 2,
  className = '',
  darkColor = '#0F172A',
  lightColor = '#FFFFFF',
  alt = 'Boarding Pass QR Code',
}) => {
  const qrData = useMemo(() => {
    if (!value || !value.trim()) return null
    try {
      const qr = qrcodegen.QrCode.encodeText(value.trim(), qrcodegen.Ecc.MEDIUM)
      const pathData = qr.getSvgPath(border)
      const totalSize = qr.size + border * 2
      return { pathData, totalSize }
    } catch (err) {
      console.error('RealQrCode generation error:', err)
      return null
    }
  }, [value, border])

  if (!qrData) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-4 border border-dashed border-slate-200 rounded ${className}`}
        style={{ width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }}
      >
        <span className="material-symbols-outlined text-2xl text-slate-400">qr_code_2</span>
        <span className="text-[11px] font-medium text-slate-500 mt-1">QR Tidak Tersedia</span>
      </div>
    )
  }

  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox={`0 0 ${qrData.totalSize} ${qrData.totalSize}`}
      shapeRendering="crispEdges"
      className={`block select-none ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }}
    >
      <rect width="100%" height="100%" fill={lightColor} rx="1" />
      <path d={qrData.pathData} fill={darkColor} />
    </svg>
  )
}

export default RealQrCode
