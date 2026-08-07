import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { useAuth } from '../context/AuthContext.jsx';

/**
 * Socket.IO connection authenticated with the JWT.
 * - Connection is only opened while `enabled` is true, so no socket exists
 *   before the exam actually starts (state machine gate).
 * - Candidates join the `session:<id>` room when sessionId is provided;
 *   admins automatically join the global `admins` room on the server.
 */
export function useSocket(sessionId, enabled = true) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    const socket = io(import.meta.env.VITE_WS_URL || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    if (sessionId) {
      socket.emit('join_session', sessionId);
    }

    return () => {
      if (sessionId) socket.emit('leave_session', sessionId);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, sessionId, enabled]);

  return useMemo(() => ({ socket: socketRef.current, connected }), [connected]);
}
