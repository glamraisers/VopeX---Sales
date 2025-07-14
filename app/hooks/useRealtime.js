app/hooks/useRealtime.js

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const useRealtime = (config = {}) => {
  const {
    table,
    filter,
    event = '*',
    schema = 'public',
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onError,
    retryAttempts = 3,
    retryDelay = 1000,
    heartbeatInterval = 30000,
  } = config;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);

  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isNetworkConnectedRef = useRef(true);

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      isNetworkConnectedRef.current = state.isConnected;
      if (!state.isConnected && isConnected) {
        setConnectionStatus('network_disconnected');
        setIsConnected(false);
      } else if (state.isConnected && !isConnected && enabled) {
        connect();
      }
    });

    return unsubscribe;
  }, [isConnected, enabled]);

  // App state monitoring
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        if (enabled && isNetworkConnectedRef.current) {
          connect();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        disconnect();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [enabled]);

  // Heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (channelRef.current && channelRef.current.state === 'joined') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
        setLastHeartbeat(new Date());
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Connection management
  const connect = useCallback(async () => {
    if (!enabled || !table || !isNetworkConnectedRef.current) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      setError(null);

      // Clean up existing connection
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      // Create new channel
      const channelName = `realtime:${schema}:${table}${filter ? `:${JSON.stringify(filter)}` : ''}`;
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: `user_${Date.now()}`,
          },
          broadcast: {
            self: true,
          },
        },
      });

      // Set up event handlers
      if (event === '*' || event === 'INSERT' || event.includes('INSERT')) {
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema,
          table,
          filter: filter ? `${Object.keys(filter)[0]}=eq.${Object.values(filter)[0]}` : undefined,
        }, (payload) => {
          try {
            onInsert?.(payload.new, payload);
          } catch (err) {
            console.error('Error handling INSERT event:', err);
            onError?.(err);
          }
        });
      }

      if (event === '*' || event === 'UPDATE' || event.includes('UPDATE')) {
        channel.on('postgres_changes', {
          event: 'UPDATE',
          schema,
          table,
          filter: filter ? `${Object.keys(filter)[0]}=eq.${Object.values(filter)[0]}` : undefined,
        }, (payload) => {
          try {
            onUpdate?.(payload.new, payload.old, payload);
          } catch (err) {
            console.error('Error handling UPDATE event:', err);
            onError?.(err);
          }
        });
      }

      if (event === '*' || event === 'DELETE' || event.includes('DELETE')) {
        channel.on('postgres_changes', {
          event: 'DELETE',
          schema,
          table,
          filter: filter ? `${Object.keys(filter)[0]}=eq.${Object.values(filter)[0]}` : undefined,
        }, (payload) => {
          try {
            onDelete?.(payload.old, payload);
          } catch (err) {
            console.error('Error handling DELETE event:', err);
            onError?.(err);
          }
        });
      }

      // Handle channel state changes
      channel.on('system', {}, (payload) => {
        if (payload.status === 'ok') {
          setIsConnected(true);
          setConnectionStatus('connected');
          setRetryCount(0);
          startHeartbeat();
        } else if (payload.status === 'error') {
          setIsConnected(false);
          setConnectionStatus('error');
          setError(new Error(payload.message || 'Connection error'));
          stopHeartbeat();
          scheduleRetry();
        }
      });

      // Handle broadcast events (for heartbeat)
      channel.on('broadcast', { event: 'heartbeat' }, (payload) => {
        // Echo heartbeat received
      });

      // Subscribe to the channel
      const subscriptionResult = await channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');
          setRetryCount(0);
          startHeartbeat();
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionStatus('error');
          setError(err || new Error('Channel subscription error'));
          stopHeartbeat();
          scheduleRetry();
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setConnectionStatus('timeout');
          setError(new Error('Connection timeout'));
          stopHeartbeat();
          scheduleRetry();
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
          stopHeartbeat();
        }
      });

      channelRef.current = channel;

    } catch (err) {
      console.error('Connection error:', err);
      setError(err);
      setConnectionStatus('error');
      setIsConnected(false);
      stopHeartbeat();
      scheduleRetry();
    }
  }, [enabled, table, filter, event, schema, onInsert, onUpdate, onDelete, onError, startHeartbeat, stopHeartbeat]);

  const disconnect = useCallback(async () => {
    try {
      setConnectionStatus('disconnecting');
      stopHeartbeat();
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('Disconnect error:', err);
      setError(err);
    }
  }, [stopHeartbeat]);

  const scheduleRetry = useCallback(() => {
    if (retryCount >= retryAttempts) {
      setConnectionStatus('max_retries_exceeded');
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
    setConnectionStatus('retrying');
    
    retryTimeoutRef.current = setTimeout(() => {
      setRetryCount(prev => prev + 1);
      connect();
    }, delay);
  }, [retryCount, retryAttempts, retryDelay, connect]);

  const reconnect = useCallback(() => {
    setRetryCount(0);
    disconnect().then(() => {
      if (enabled && isNetworkConnectedRef.current) {
        connect();
      }
    });
  }, [enabled, disconnect, connect]);

  // Initial connection
  useEffect(() => {
    if (enabled && isNetworkConnectedRef.current) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, table, filter, event, schema]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // Public API
  const send = useCallback((eventName, payload) => {
    if (!channelRef.current || !isConnected) {
      throw new Error('Not connected to realtime channel');
    }

    return channelRef.current.send({
      type: 'broadcast',
      event: eventName,
      payload,
    });
  }, [isConnected]);

  const getPresence = useCallback(() => {
    if (!channelRef.current) {
      return {};
    }
    return channelRef.current.presenceState();
  }, []);

  const trackPresence = useCallback((presence) => {
    if (!channelRef.current || !isConnected) {
      throw new Error('Not connected to realtime channel');
    }

    return channelRef.current.track(presence);
  }, [isConnected]);

  const untrackPresence = useCallback(() => {
    if (!channelRef.current) {
      return;
    }
    return channelRef.current.untrack();
  }, []);

  return {
    isConnected,
    connectionStatus,
    error,
    retryCount,
    lastHeartbeat,
    connect,
    disconnect,
    reconnect,
    send,
    getPresence,
    trackPresence,
    untrackPresence,
  };
};

export default useRealtime;
```