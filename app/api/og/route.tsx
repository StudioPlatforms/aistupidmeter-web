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
          color: '#00FF41',
          padding: '60px'
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 25, color: '#FFB000' }}>
          ⚠️ DATA TEMPORARILY UNAVAILABLE
        </div>
        <div style={{ fontSize: 28, color: '#888', textAlign: 'center', maxWidth: '80%' }}>
          AI Intelligence monitoring data is currently being updated
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
      ? ''
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
      
      // Get bottom 3 models (worst performers)
      const bottomModels = modelScores.slice(-3).reverse();
      
      // Get recommendations if available
      const topRecommendations = recommendations?.slice(0, 2) || [];
      
      return new ImageResponse(
        (
          <div
            style={{
              background: '#000',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'monospace',
              color: '#00FF41',
              padding: '40px 50px'
            }}
          >
            {/* Top Section: Best Models */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 30 }}>
              <div style={{ fontSize: 32, marginBottom: 15, color: '#00FF41', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>✅</span>
                <span>RECOMMENDED MODELS</span>
              </div>
              {topModels.map((model: any, index: number) => (
                <div
                  key={model.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '8px 16px',
                    background: 'rgba(0, 255, 65, 0.08)',
                    border: '1px solid #00FF41',
                    borderRadius: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 28, color: index === 0 ? '#FFD700' : '#00FF41' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                    <div style={{ fontSize: 20, color: '#00FF41' }}>
                      {model.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: '#00FF41' }}>
                    {model.currentScore}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Section: Models to Avoid */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 32, marginBottom: 15, color: '#FF2D00', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>⚠️</span>
                <span>AVOID THESE MODELS</span>
              </div>
              {bottomModels.map((model: any, index: number) => (
                <div
                  key={model.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '8px 16px',
                    background: 'rgba(255, 45, 0, 0.08)',
                    border: '1px solid #FF2D00',
                    borderRadius: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24, color: '#FF2D00' }}>
                      ❌
                    </div>
                    <div style={{ fontSize: 20, color: '#FFB000' }}>
                      {model.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: '#FF2D00' }}>
                    {model.currentScore}
                  </div>
                </div>
              ))}
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
      
      // Get degradations and recommendations
      const topDegradations = degradations?.slice(0, 3) || [];
      const topRecommendations = recommendations?.slice(0, 2) || [];
      
      return new ImageResponse(
        (
          <div
            style={{
              background: '#000',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'monospace',
              color: '#00FF41',
              padding: '40px 50px'
            }}
          >
            {/* Global Score Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 35, paddingBottom: 20, borderBottom: '2px solid #333' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 28, color: '#888', marginBottom: 8 }}>
                  GLOBAL AI INDEX
                </div>
                <div style={{ fontSize: 72, fontWeight: 'bold', color }}>
                  {score}/100
                </div>
              </div>
              <div style={{ fontSize: 24, color, textAlign: 'right', maxWidth: '400px' }}>
                {status}
              </div>
            </div>

            {/* Degradations or Top Models */}
            {topDegradations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 28, marginBottom: 12, color: '#FFB000', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>📉</span>
                  <span>RECENT DEGRADATIONS</span>
                </div>
                {topDegradations.map((deg: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      padding: '8px 16px',
                      background: 'rgba(255, 176, 0, 0.08)',
                      border: '1px solid #FFB000',
                      borderRadius: 6
                    }}
                  >
                    <div style={{ fontSize: 18, color: '#FFB000' }}>
                      {deg.modelName}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#FF2D00' }}>
                      -{deg.change}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 28, marginBottom: 12, color: '#00FF41', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>🏆</span>
                  <span>TOP PERFORMERS</span>
                </div>
                {topModels.slice(0, 3).map((model: any, index: number) => (
                  <div
                    key={model.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      padding: '8px 16px',
                      background: 'rgba(0, 255, 65, 0.08)',
                      border: '1px solid #00FF41',
                      borderRadius: 6
                    }}
                  >
                    <div style={{ fontSize: 18, color: '#00FF41' }}>
                      {model.name}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 'bold', color: '#00FF41' }}>
                      {model.currentScore}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }
    
    // Default fallback - show simple data-focused view
    return new ImageResponse(
      (
        <div
          style={{
            background: '#000',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            color: '#00FF41',
            padding: '40px 50px'
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 30, color: '#00FF41' }}>
            📊 AI MODEL INTELLIGENCE REPORT
          </div>
          {topModels.map((model: any, index: number) => (
            <div
              key={model.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                padding: '10px 18px',
                background: 'rgba(0, 255, 65, 0.08)',
                border: '1px solid #00FF41',
                borderRadius: 6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                <div style={{ fontSize: 28, color: index === 0 ? '#FFD700' : '#00FF41' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
                <div style={{ fontSize: 22, color: '#00FF41' }}>
                  {model.name}
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#00FF41' }}>
                {model.currentScore}
              </div>
            </div>
          ))}
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
