'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';

interface BenchmarkLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  sessionId?: string;
  data?: any;
}

export default function BenchmarkMonitorPage() {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<BenchmarkLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Connect to live benchmark monitoring
  useEffect(() => {
    if (status !== 'loading' && session?.user) {
      connectToLiveBenchmarks();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [session, status]);

  const connectToLiveBenchmarks = () => {
    const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
    
    // Connect to the global benchmark monitoring stream
    const eventSource = new EventSource(`${apiUrl}/api/admin/benchmark-monitor-stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      addLog('info', '🔗 Connected to live benchmark monitoring');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'heartbeat') return; // Skip heartbeat messages
        
        // Track active sessions
        if (data.sessionId) {
          setActiveSessions(prev => new Set(prev).add(data.sessionId));
        }
        
        addLog(data.type || 'info', data.message, data.sessionId, data.data);
      } catch (error) {
        console.error('Error parsing benchmark event:', error);
      }
    };

