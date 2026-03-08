import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top left, #203b7c 0%, #0f172a 38%, #050816 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(34,197,94,0.10) 45%, rgba(244,114,182,0.12))',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(56,189,248,0.18)',
            filter: 'blur(8px)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: -140,
            left: -70,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: 'rgba(16,185,129,0.16)',
            filter: 'blur(8px)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 72px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 62,
                height: 62,
                borderRadius: 16,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              VL
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#93c5fd',
              }}
            >
              Research Use Only
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 880,
              gap: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 0.92,
                fontSize: 96,
                fontWeight: 900,
                letterSpacing: -4,
              }}
            >
              <span>VariantLens</span>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                lineHeight: 1.25,
                color: '#dbeafe',
                maxWidth: 900,
              }}
            >
              Structure-aware variant evidence briefing with UniProt, ClinVar,
              PubMed, PDB, and AlphaFold context in one place.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              {['HGVS input', 'ClinVar', 'PubMed', 'PDB', 'AlphaFold'].map(
                (label) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      padding: '10px 16px',
                      borderRadius: 9999,
                      background: 'rgba(15, 23, 42, 0.52)',
                      border: '1px solid rgba(148, 163, 184, 0.24)',
                      color: '#e2e8f0',
                      fontSize: 24,
                    }}
                  >
                    {label}
                  </div>
                )
              )}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                color: '#cbd5e1',
              }}
            >
              variant-lens.vercel.app
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
