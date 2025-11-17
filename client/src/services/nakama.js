import { Client } from '@heroiclabs/nakama-js';

class NakamaService {
  constructor() {
    this.client = new Client(
      import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey',
      import.meta.env.VITE_NAKAMA_HOST || 'localhost',
      import.meta.env.VITE_NAKAMA_PORT || '7349',
      import.meta.env.VITE_NAKAMA_USE_SSL === 'true'
    );
    this.session = null;
    this.socket = null;
  }

  async authenticate() {
    const deviceId = this.getDeviceId();
    this.session = await this.client.authenticateDevice(deviceId, true);
    return this.session;
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = this.generateUUID();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async createSocket() {
    this.socket = this.client.createSocket(
      import.meta.env.VITE_NAKAMA_USE_SSL === 'true',
      false
    );
    await this.socket.connect(this.session);
    return this.socket;
  }

  async findMatch(mode = 'classic') {
    if (!this.socket) {
      await this.createSocket();
    }

    const query = '+properties.mode:' + mode;
    const minCount = 2;
    const maxCount = 2;
    const stringProperties = { mode };

    const ticket = await this.socket.addMatchmaker(query, minCount, maxCount, stringProperties);
    return ticket;
  }

  async joinMatch(matchId) {
    if (!this.socket) {
      await this.createSocket();
    }
    const match = await this.socket.joinMatch(matchId);
    return match;
  }

  async leaveMatch(matchId) {
    if (this.socket) {
      await this.socket.leaveMatch(matchId);
    }
  }

  async sendMatchState(matchId, opCode, data) {
    if (this.socket) {
      await this.socket.sendMatchState(matchId, opCode, JSON.stringify(data));
    }
  }

  async rpcCall(id, payload = {}) {
    return await this.client.rpc(this.session, id, JSON.stringify(payload));
  }

  async getLeaderboard() {
    const response = await this.rpcCall('get_leaderboard');
    return JSON.parse(response.payload);
  }

  async getPlayerStats() {
    const response = await this.rpcCall('get_player_stats');
    return JSON.parse(response.payload);
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const nakamaService = new NakamaService();
