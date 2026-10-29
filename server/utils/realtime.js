// ============================================================
// Real-time Event Broadcaster (Server-Sent Events)
// Delivers live transaction events strictly scoped to authenticated user UID
// ============================================================

const clientsByUser = new Map();

/**
 * Register an SSE client connection for a specific user UID
 */
function registerClient(uid, res) {
  if (!uid || !res) return;

  if (!clientsByUser.has(uid)) {
    clientsByUser.set(uid, new Set());
  }

  const userClients = clientsByUser.get(uid);
  userClients.add(res);

  // Send initial connection acknowledgement
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`);

  // Remove client on connection close
  res.on("close", () => {
    userClients.delete(res);
    if (userClients.size === 0) {
      clientsByUser.delete(uid);
    }
  });
}

/**
 * Broadcast an event strictly to connected sessions of the specified user
 * Never broadcasts to other users.
 */
function broadcastToUser(uid, eventData) {
  if (!uid || !clientsByUser.has(uid)) return;

  const userClients = clientsByUser.get(uid);
  const payload = `data: ${JSON.stringify({ ...eventData, timestamp: Date.now() })}\n\n`;

  for (const client of userClients) {
    try {
      client.write(payload);
    } catch (err) {
      // Stale connection cleanup
      userClients.delete(client);
    }
  }

  if (userClients.size === 0) {
    clientsByUser.delete(uid);
  }
}

/**
 * Get active connection counts (diagnostic)
 */
function getActiveConnectionsCount() {
  let count = 0;
  for (const set of clientsByUser.values()) {
    count += set.size;
  }
  return { users: clientsByUser.size, connections: count };
}

module.exports = {
  registerClient,
  broadcastToUser,
  getActiveConnectionsCount,
};
