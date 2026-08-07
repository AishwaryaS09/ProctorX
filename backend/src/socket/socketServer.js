const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { env } = require('../config/env');
const User = require('../models/User');
const ExamSession = require('../models/ExamSession');
const { ROLES } = require('../config/constants');

let io = null;

/**
 * Attach Socket.IO to an HTTP server.
 * - Candidates are validated with a JWT from the handshake.
 * - Candidates can join `session:<id>` rooms for their own sessions.
 * - Admins join the global `admins` room.
 */
function attachSocket(server) {
  io = new Server(server, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.id);
      if (!user) {
        return next(new Error('Unknown user'));
      }
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.user.role === ROLES.ADMIN) {
      socket.join('admins');
    }

    socket.on('join_session', async (sessionId) => {
      try {
        const session = await ExamSession.findById(sessionId);
        if (!session) return;
        const isOwner = String(session.candidate) === String(socket.user._id);
        const isAdmin = socket.user.role === ROLES.ADMIN;
        if (isOwner || isAdmin) {
          socket.join(`session:${sessionId}`);
        }
      } catch (err) {
        // ignore malformed session ids
      }
    });

    socket.on('leave_session', (sessionId) => {
      socket.leave(`session:${sessionId}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

/** Emit to everyone watching a specific session room. */
function emitSession(sessionId, event, payload) {
  if (io) io.to(`session:${sessionId}`).emit(event, payload);
}

/** Emit to all connected admins. */
function emitAdmin(event, payload) {
  if (io) io.to('admins').emit(event, payload);
}

module.exports = { attachSocket, getIO, emitSession, emitAdmin };
