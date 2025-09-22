const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const logger = require('../src/utils/logger');

class GoogleAuthService {
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/cloudshell'
    ];
  }

  generateAuthUrl(state = null) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
      state: state
    });
  }

  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      this.client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.client.refreshAccessToken();
      return credentials;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getUserInfo(accessToken) {
    try {
      this.client.setCredentials({ access_token: accessToken });
      const oauth2 = google.oauth2({
        auth: this.client,
        version: 'v2'
      });
      const { data } = await oauth2.userinfo.get();
      return data;
    } catch (error) {
      logger.error('Error fetching user info:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  async verifyIdToken(idToken) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      return ticket.getPayload();
    } catch (error) {
      logger.error('Error verifying ID token:', error);
      throw new Error('Invalid ID token');
    }
  }

  async getProjectInfo(accessToken) {
    try {
      this.client.setCredentials({ access_token: accessToken });
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v1',
        auth: this.client
      });

      const { data } = await cloudResourceManager.projects.list();
      return data.projects || [];
    } catch (error) {
      logger.error('Error fetching project info:', error);
      return [];
    }
  }
}

module.exports = new GoogleAuthService();