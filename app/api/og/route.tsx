import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const revalidate = 60; // Cache for 60 seconds

// Fallback image when API fails
function generateFallbackImage(type: string) {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          color: '#00FF41'
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 30 }}>
          🔬 AI STUPID LEVEL
        </div>
        <div style={{ fontSize: 32, color: '#888', textAlign: 'center', maxWidth: '80%' }}>
          Real-Time AI Intelligence Monitoring
        </div>
        <div style={{ fontSize: 28, marginTop: 40, color: '#888' }}>
          aistupidlevel.info
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'rankings';
    
    // Use the CACHED endpoint for instant data - no timeouts!
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://aistupidlevel.info' 
      : 'http://localhost:4000';
    
    let data: any = null;
    
    try {
      console.log(`[OG] Fetching from cached endpoint (instant response)`);
      
      // Use cached endpoint - this should return instantly since data is pre-computed
      const response = await fetch(`${apiUrl}/dashboard/cached?period=latest&sortBy=combined&analyticsPeriod=latest`, {
        headers: { 
          'User-Agent': 'OG-Generator',
          'Accept': 'application/json'
        },
        next: { revalidate: 60 }
      });
      
      if (response.ok) {
        data = await response.json();
        console.log(`[OG] Successfully fetched cached data`);
      } else {
        console.error(`[OG] Cached API returned status ${response.status}`);
      }
    } catch (fetchError: any) {
      console.error(`[OG] Error fetching cached data:`, fetchError.message);
    }
    
    // If no data, use fallback
    if (!data?.success || !data?.data) {
      console.error('No data available for OG image, using fallback');
      return generateFallbackImage(type);
    }
    
    const { modelScores, globalIndex, degradations, recommendations } = data.data;
    
    // Validate we have the data we need
    if (!modelScores || !Array.isArray(modelScores) || modelScores.length === 0) {
      console.error('No model scores available for OG image');
      return generateFallbackImage(type);
    }
    
    const topModels = modelScores.slice(0, 3);
    
    // Generate image based on type
    if (type === 'rankings') {
      // Show critical alerts if any, otherwise top 3
      const criticalModels = modelScores.filter((m: any) => m.currentScore < 50);
      const hasAlerts = criticalModels.length > 0;
      
      return new ImageResponse(
        (
          <div
            style={{
              background: '#000',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              color: '#00FF41',
              padding: '40px'
            }}
          >
            {hasAlerts ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 20, textAlign: 'center', color: '#FF2D00' }}>
                  🚨 CRITICAL ALERTS
                </div>
                <div style={{ fontSize: 28, marginBottom: 30, color: '#FFB000' }}>
                  {criticalModels.length} MODELS BELOW 50 POINTS
                </div>
                {criticalModels.slice(0, 3).map((model: any, index: number) => (
                  <div
                    key={model.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '80%',
                      marginBottom: 12,
                      padding: '12px 20px',
                      background: 'rgba(255, 45, 0, 0.1)',
                      border: '2px solid #FF2D00',
                      borderRadius: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <div style={{ fontSize: 32, color: '#FF2D00' }}>⚠️</div>
                      <div style={{ fontSize: 24, color: '#FFB000' }}>
                        {model.name.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FF2D00' }}>
                      {model.currentScore} pts
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 30, textAlign: 'center' }}>
                  🏆 TOP AI MODELS
                </div>
                <div style={{ fontSize: 32, marginBottom: 20, color: '#888' }}>
                  LIVE PERFORMANCE SCORES
                </div>
                {topModels.map((model: any, index: number) => (
                  <div
                    key={model.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '80%',
                      marginBottom: 15,
                      padding: '15px 20px',
                      background: 'rgba(0, 255, 65, 0.1)',
                      border: '2px solid #00FF41',
                      borderRadius: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ fontSize: 40, color: index === 0 ? '#FFD700' : '#00FF41' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </div>
                      <div style={{ fontSize: 28 }}>
                        {model.name.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 'bold', color: '#00FF41' }}>
                      {model.currentScore} pts
                    </div>
                  </div>
                ))}
              </>
            )}
            <div style={{ fontSize: 24, marginTop: 30, color: '#888' }}>
              aistupidlevel.info • Real-time AI monitoring
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }
    
    if (type === 'index') {
      const score = globalIndex?.current?.globalScore || 50;
      const status = score >= 70 ? 'PERFORMING WELL' : score >= 50 ? 'BELOW AVERAGE' : 'CONCERNING LEVELS';
      const color = score >= 70 ? '#00FF41' : score >= 50 ? '#FFB000' : '#FF2D00';
      
      return new ImageResponse(
        (
          <div
            style={{
              background: '#000',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              color: '#00FF41'
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 30 }}>
              🌡️ AI STUPIDITY INDEX
            </div>
            <div style={{ fontSize: 120, fontWeight: 'bold', color, marginBottom: 20 }}>
              {score}/100
            </div>
            <div style={{ fontSize: 36, color: '#888', marginBottom: 40 }}>
              {status}
            </div>
            <div style={{ fontSize: 28, color: '#888' }}>
              Track AI performance at aistupidlevel.info
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }
    
    // Default fallback
    return new ImageResponse(
      (
        <div
          style={{
            background: '#000',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            color: '#00FF41'
          }}
        >
          <div style={{ fontSize: 60, marginBottom: 30 }}>
            🔬 STUPID METER
          </div>
          <div style={{ fontSize: 32, color: '#888', textAlign: 'center', maxWidth: '80%' }}>
            Real-Time AI Intelligence Monitoring
          </div>
          <div style={{ fontSize: 28, marginTop: 40, color: '#888' }}>
            aistupidlevel.info
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
