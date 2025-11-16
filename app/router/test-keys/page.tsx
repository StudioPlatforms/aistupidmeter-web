'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import ProviderLogo from '@/components/ProviderLogo';

interface TestResult {
  success: boolean;
  provider: string;
  model: string;
  error?: string;
  latency?: number;
  response?: {
    text: string;
    tokensIn: number;
    tokensOut: number;
  };
  testPassed?: boolean;
  performance?: {
    displayScore: number;
    stupidScore: number;
    axes: {
      correctness: number;
      spec: number;
      codeQuality: number;
      efficiency: number;
      stability: number;
      refusal: number;
      recovery: number;
    };
  };
  metrics?: {
    totalLatency: number;
    avgLatency: number;
    totalTokensIn: number;
    totalTokensOut: number;
    testsRun: number;
    refusalRate: string;
    recoveryRate: string;
    tasksCompleted: string;
  };
}

type Provider = 'openai' | 'anthropic' | 'xai' | 'google' | 'glm' | 'deepseek' | 'kimi';

export default function TestKeysPage() {
  const { data: session, status } = useSession();
  const [selectedProvider, setSelectedProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [testType, setTestType] = useState<'chat' | 'benchmark'>('chat');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const providers: { id: Provider; name: string; description: string }[] = [
    { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-5, o3 models' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude Sonnet, Opus, Haiku' },
    { id: 'xai', name: 'xAI', description: 'Grok models' },
    { id: 'google', name: 'Google', description: 'Gemini 2.5 Pro, Flash' },
    { id: 'glm', name: 'GLM', description: 'GLM-4.6 models' },
    { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek R1, V3 models' },
    { id: 'kimi', name: 'Kimi', description: 'Moonshot K2 models' },
  ];

  const discoverModels = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key first');
      return;
    }

    setDiscoveringModels(true);
    setAvailableModels([]);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/test-adapters/discovery?provider=${selectedProvider}`, {
        headers: {
          'x-user-api-key': apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const providerResult = data.results[selectedProvider];
      
      if (providerResult && providerResult.success) {
        setAvailableModels(providerResult.models);
        if (providerResult.models.length > 0) {
          setSelectedModel(providerResult.models[0]);
        }
      } else {
        throw new Error(providerResult?.error || 'Model discovery failed');
      }
    } catch (error) {
      console.error('Model discovery failed:', error);
      alert(`Model discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDiscoveringModels(false);
    }
  };

  const runTest = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }

    if (testType === 'benchmark') {
      setShowConsentModal(true);
      return;
    }

    // For chat tests, run directly
    await executeTest();
  };

  const executeTest = async () => {
    setTesting(true);
    setResult(null);
    setTestLogs([]);

    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      if (testType === 'chat') {
        // For chat tests, use the simple endpoint
        const response = await fetch(`${apiUrl}/test-adapters/chat-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-api-key': apiKey,
          },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || `Test failed: ${response.statusText}`);
        }

        const data = await response.json();
        setResult(data);
        setTesting(false);
      } else {
        // For benchmark tests, use streaming functionality like the original test page
        setTestLogs(['🚀 Starting streaming benchmark test...', `📊 Testing ${selectedModel.toUpperCase()} from ${selectedProvider.toUpperCase()}`]);

        // First, start the streaming benchmark
        const response = await fetch(`${apiUrl}/api/test-adapters/benchmark-test-stream`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-api-key': apiKey
          },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel
          })
        });

        const startResult = await response.json();
        
        if (!response.ok) {
          throw new Error(startResult.error || 'Failed to start benchmark');
        }

        const { sessionId } = startResult;
        setTestLogs(prev => [...prev, `📡 Connected to streaming session: ${sessionId.substring(0, 8)}...`]);

        // Connect to the streaming endpoint
        const eventSource = new EventSource(`${apiUrl}/api/test-adapters/benchmark-stream/${sessionId}`);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Add log message
            if (data.message) {
              setTestLogs(prev => [...prev, data.message]);
            }
            
            // Handle completion
            if (data.type === 'complete' && data.data) {
              setResult(data.data);
              setTestLogs(prev => [...prev, '🎉 Streaming benchmark completed successfully!']);
              eventSource.close();
              setTesting(false);
            } else if (data.type === 'error') {
              setResult({
                success: false,
                provider: selectedProvider,
                model: selectedModel || 'unknown',
                error: data.message || 'Streaming benchmark failed'
              });
              setTestLogs(prev => [...prev, `❌ Error: ${data.message}`]);
              eventSource.close();
              setTesting(false);
            }
          } catch (parseError) {
            console.error('Error parsing streaming data:', parseError);
            setTestLogs(prev => [...prev, `⚠️ Received malformed data: ${event.data.substring(0, 100)}...`]);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          setTestLogs(prev => [...prev, '❌ Connection error - switching to non-streaming mode']);
          eventSource.close();
          
          // Fallback to regular benchmark endpoint
          fallbackToRegularBenchmark();
        };

        eventSource.onopen = () => {
          setTestLogs(prev => [...prev, '✅ Real-time streaming connected']);
        };

        // Cleanup function to close EventSource if component unmounts
        const cleanup = () => {
          eventSource.close();
          setTesting(false);
        };

        // Set timeout for safety (5 minutes max)
        const timeout = setTimeout(() => {
          setTestLogs(prev => [...prev, '⏰ Benchmark taking longer than expected, continuing...']);
        }, 5 * 60 * 1000);

        // Store cleanup function for potential use
        (window as any).benchmarkCleanup = () => {
          clearTimeout(timeout);
          cleanup();
        };
      }
    } catch (error) {
      console.error('Test failed:', error);
      setResult({
        success: false,
        provider: selectedProvider,
        model: selectedModel || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (testType === 'benchmark') {
        setTestLogs(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      }
      setTesting(false);
    }
  };

  // Fallback function for when streaming fails
  const fallbackToRegularBenchmark = async () => {
    const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${apiUrl}/api/test-adapters/benchmark-test`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-api-key': apiKey
          },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          setResult(result);
          setTestLogs(prev => [...prev, '✅ Non-streaming benchmark completed']);
          setTesting(false);
          return;
        }

        // For 5xx, retry once
        if (response.status >= 500 && attempt < maxAttempts) {
          setTestLogs(prev => [...prev, `⚠️ Backend ${response.status} (${result.error || response.statusText}) - retrying (${attempt}/${maxAttempts})...`]);
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }

        setResult({
          success: false,
          provider: selectedProvider,
          model: selectedModel || 'unknown',
          error: result.error || 'Benchmark failed'
        });
        setTestLogs(prev => [...prev, `❌ Error: ${result.error || 'Benchmark failed'}`]);
        setTesting(false);
        return;
      } catch (error: any) {
        if (attempt < maxAttempts) {
          setTestLogs(prev => [...prev, `⚠️ Fallback error (${error.message || 'network'}) - retrying (${attempt}/${maxAttempts})...`]);
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        setResult({
          success: false,
          provider: selectedProvider,
          model: selectedModel || 'unknown',
          error: error.message || 'Network error'
        });
        setTestLogs(prev => [...prev, `❌ Fallback error: ${error.message || 'Network error'}`]);
        setTesting(false);
      }
    }
  };

  const getApiKeyPlaceholder = (provider: Provider) => {
    switch (provider) {
      case 'openai': return 'sk-proj-... or sk-...';
      case 'anthropic': return 'sk-ant-api03-...';
      case 'xai': return 'xai-...';
      case 'google': return 'AIza...';
      case 'glm': return 'glm-...';
      case 'deepseek': return 'sk-...';
      case 'kimi': return 'sk-...';
      default: return 'Enter API key';
    }
  };

  if (status === 'unauthenticated') {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="error-banner">
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1.2em', marginBottom: '12px' }}>
                ⚠️ AUTHENTICATION REQUIRED
              </div>
              <div className="terminal-text--dim">
                Please sign in to test your API keys
              </div>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <div className="vintage-container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">🔑 TEST YOUR API KEYS</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Validate your API keys and benchmark your models with our comprehensive testing suite
            </p>
          </div>
        </div>

        <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="section-header">
            <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
              🎛️ TEST CONFIGURATION
            </span>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {/* Provider Selection */}
            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                PROVIDER
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      setAvailableModels([]);
                      setSelectedModel('');
                      setResult(null);
                    }}
                    className={`vintage-btn ${selectedProvider === provider.id ? 'vintage-btn--active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      textAlign: 'left',
                      background: selectedProvider === provider.id ? 'var(--phosphor-green)' : 'transparent',
                      color: selectedProvider === provider.id ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                      flexDirection: 'column',
                      minHeight: '80px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <ProviderLogo provider={provider.id} size={24} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{provider.name}</div>
                        <div style={{ fontSize: '0.75em', opacity: 0.8 }}>{provider.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key Input */}
            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                YOUR API KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={getApiKeyPlaceholder(selectedProvider)}
                className="mobile-form-input"
                style={{ width: '100%' }}
              />
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                Your key is only used for this test - not stored
              </div>
            </div>

            {/* Model Discovery */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  MODEL SELECTION
                </label>
                <button
                  onClick={discoverModels}
                  disabled={!apiKey.trim() || discoveringModels}
                  className="vintage-btn vintage-btn--sm"
                  style={{ fontSize: '0.75em' }}
                >
                  {discoveringModels ? 'SCANNING...' : 'DISCOVER MODELS'}
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={availableModels.length === 0}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                {availableModels.length === 0 ? (
                  <option>Click "Discover Models" first</option>
                ) : (
                  availableModels.map(model => (
                    <option key={model} value={model}>{model.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>

            {/* Test Type Selection */}
            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                TEST TYPE
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setTestType('chat')}
                  className={`vintage-btn ${testType === 'chat' ? 'vintage-btn--active' : ''}`}
                  style={{ flex: 1 }}
                >
                  QUICK CHAT TEST
                </button>
                <button
                  onClick={() => setTestType('benchmark')}
                  className={`vintage-btn ${testType === 'benchmark' ? 'vintage-btn--active' : ''}`}
                  style={{ flex: 1 }}
                >
                  FULL BENCHMARK
                </button>
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                {testType === 'chat' ? 
                  'Quick validation test - checks if your API key works' :
                  'Comprehensive 7-axis performance evaluation - results saved to rankings'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Run Test Button */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <button
            onClick={runTest}
            disabled={testing || !apiKey.trim() || !selectedModel}
            className={`vintage-btn ${testing ? 'vintage-btn--warning' : 'vintage-btn--active'}`}
            style={{ padding: '16px 32px', fontSize: '1.1em' }}
          >
            {testing ? (
              <>TESTING<span className="vintage-loading"></span></>
            ) : (
              `RUN ${testType.toUpperCase()} TEST`
            )}
          </button>
        </div>

        {/* Consent Modal for Benchmark Tests */}
        {showConsentModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div className="section-card" style={{
              maxWidth: '500px',
              width: '100%',
              background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
              border: '2px solid var(--phosphor-green)'
            }}>
              <div className="terminal-text">
                <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
                  <span className="terminal-text--amber">⚠️ PRIVACY NOTICE</span>
                </div>
                
                <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                  <div className="terminal-text--green" style={{ marginBottom: '12px' }}>
                    🔐 Your Privacy is Protected:
                  </div>
                  <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Your API key is <span className="terminal-text--green">NEVER stored</span> - used only for this test session
                    </li>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Test results <span className="terminal-text--amber">will be saved</span> to our database
                    </li>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Your score becomes the <span className="terminal-text--amber">latest reference</span> for this model
                    </li>
                    <li className="terminal-text--dim">
                      ✓ Results <span className="terminal-text--amber">will appear</span> in live rankings
                    </li>
                  </ul>
                  
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                    By proceeding, you help improve our detection accuracy and contribute to the community's understanding of AI model performance.
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => {
                      setShowConsentModal(false);
                      executeTest();
                    }}
                    className="vintage-btn vintage-btn--active"
                    style={{ padding: '8px 24px' }}
                  >
                    ACCEPT & RUN TEST
                  </button>
                  <button 
                    onClick={() => setShowConsentModal(false)}
                    className="vintage-btn"
                    style={{ padding: '8px 24px' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Test Logs */}
        {testLogs.length > 0 && (
          <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="section-header">
              <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                📝 LIVE TEST LOGS
              </span>
            </div>
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85em',
              lineHeight: '1.5'
            }}>
              {testLogs.map((log, index) => (
                <div key={index} className="terminal-text--dim" style={{ marginBottom: '4px' }}>
                  <span className="terminal-text--green">[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              {testing && (
                <div className="terminal-text--amber">
                  <span className="blinking-cursor">█</span> Processing...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="section-card">
            <div className="section-header">
              <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                📊 TEST RESULTS
              </span>
            </div>

            {result.success ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.1)', borderRadius: '6px' }}>
                    <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold' }}>
                      {testType === 'chat' ? '✅' : result.performance?.displayScore || 'N/A'}
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      {testType === 'chat' ? 'CHAT TEST PASSED' : 'OVERALL SCORE'}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px' }}>
                    <div className="terminal-text" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                      {result.latency || result.metrics?.avgLatency || 'N/A'}ms
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      RESPONSE TIME
                    </div>
                  </div>

                  {testType === 'benchmark' && result.metrics && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px' }}>
                      <div className="terminal-text" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                        {result.metrics.tasksCompleted}
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        TASKS COMPLETED
                      </div>
                    </div>
                  )}
                </div>

                {/* 7-Axis Breakdown for Benchmark Tests */}
                {testType === 'benchmark' && result.performance?.axes && (
                  <div style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
                      🎯 7-AXIS PERFORMANCE BREAKDOWN
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-sm)' }}>
                      {Object.entries(result.performance.axes).map(([axis, value]) => {
                        const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        const axisLabels: Record<string, string> = {
                          correctness: 'CORRECTNESS',
                          spec: 'SPEC COMPLIANCE',
                          codeQuality: 'CODE QUALITY',
                          efficiency: 'EFFICIENCY',
                          stability: 'STABILITY',
                          refusal: 'REFUSAL RATE',
                          recovery: 'RECOVERY'
                        };
                        
                        return (
                          <div key={axis} style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                              <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                                {axisLabels[axis] || axis.toUpperCase()}
                              </span>
                              <span className={
                                numericValue >= 80 ? 'terminal-text--green' : 
                                numericValue >= 60 ? 'terminal-text--amber' : 'terminal-text--red'
                              } style={{ fontWeight: 'bold', fontSize: '0.9em' }}>
                                {numericValue.toFixed(0)}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${numericValue}%`, 
                                height: '100%', 
                                background: numericValue >= 80 ? 'var(--phosphor-green)' : 
                                           numericValue >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)', 
                                borderRadius: '4px', 
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chat Test Response */}
                {testType === 'chat' && result.response && (
                  <div style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
                      💬 MODEL RESPONSE
                    </div>
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85em',
                      lineHeight: '1.5',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {result.response.text}
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '8px' }}>
                      Tokens: {result.response.tokensIn} in, {result.response.tokensOut} out
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                <div className="terminal-text--red" style={{ fontSize: '2em', marginBottom: '16px' }}>
                  ❌ TEST FAILED
                </div>
                <div className="terminal-text--dim" style={{ marginBottom: '16px' }}>
                  {result.error}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                  Please check your API key and model selection, then try again.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </RouterLayout>
  );
}
