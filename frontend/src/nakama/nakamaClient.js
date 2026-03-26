import { Client } from '@heroiclabs/nakama-js';

const NAKAMA_SERVER = import.meta.env.VITE_NAKAMA_HOST || 'localhost';
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || 'defaultkey';
const NAKAMA_SSL = import.meta.env.VITE_NAKAMA_SSL === 'true';

class NakamaClient {
  constructor() {
    this.client = new Client(NAKAMA_KEY, NAKAMA_SERVER, NAKAMA_PORT, NAKAMA_SSL);
    this.session = null;
    this.socket = null;
  }

  async authenticate() {
    // Use device ID for zero-friction guest auth
    let deviceId = localStorage.getItem('nakama_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('nakama_device_id', deviceId);
    }

    this.session = await this.client.authenticateDevice(deviceId, true);
    console.log('Authenticated as:', this.session.user_id, this.session.username);
    return this.session;
  }

  async connect() {
    if (!this.session) {
      await this.authenticate();
    }

    this.socket = this.client.createSocket(NAKAMA_SSL, false);
    await this.socket.connect(this.session, true);
    console.log('Socket connected');
    return this.socket;
  }

  async createMatch(timedMode = false) {
    const response = await this.client.rpc(this.session, 'create_match', { timedMode });
    return response.payload;
  }

  async findMatch(timedMode = false) {
    const response = await this.client.rpc(this.session, 'find_match', { timedMode });
    return response.payload;
  }

  async joinMatch(matchId) {
    const match = await this.socket.joinMatch(matchId);
    console.log('Joined match:', match.match_id);
    return match;
  }

  sendMove(matchId, position) {
    const data = JSON.stringify({ position });
    this.socket.sendMatchState(matchId, 1, data); // OpCode.MOVE = 1
  }

  async getLeaderboard() {
    const response = await this.client.rpc(this.session, 'get_leaderboard', {});
    return response.payload;
  }

  async updateUsername(username) {
    await this.client.updateAccount(this.session, { username });
    // Re-authenticate to get a fresh session JWT with the new username,
    // then reconnect the socket so Nakama presences use the updated name.
    await this.authenticate();
    if (this.socket) {
      this.socket.disconnect(false);
      this.socket = null;
    }
    await this.connect();
    console.log('Username updated to:', username);
  }

  getSession() {
    return this.session;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect(false);
      this.socket = null;
    }
  }
}

// Singleton instance
const nakamaClient = new NakamaClient();
export default nakamaClient;
