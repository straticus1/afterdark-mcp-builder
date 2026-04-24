/**
 * Twilio Module
 * Provides tools for SMS, Voice, and communication services
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('twilio');

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  defaultFromNumber?: string;
}

interface TwilioClient {
  accountSid: string;
  authToken: string;
  defaultFromNumber: string;
  configured: boolean;
  baseUrl: string;
}

export class TwilioModule {
  private client: TwilioClient;

  constructor(config: TwilioConfig = {}) {
    this.client = {
      accountSid: config.accountSid || process.env['TWILIO_ACCOUNT_SID'] || '',
      authToken: config.authToken || process.env['TWILIO_AUTH_TOKEN'] || '',
      defaultFromNumber: config.defaultFromNumber || process.env['TWILIO_PHONE_NUMBER'] || '',
      configured: !!(
        (config.accountSid || process.env['TWILIO_ACCOUNT_SID']) &&
        (config.authToken || process.env['TWILIO_AUTH_TOKEN'])
      ),
      baseUrl: 'https://api.twilio.com/2010-04-01',
    };

    if (this.client.configured) {
      logger.info('Twilio module initialized');
    } else {
      logger.warn('Twilio credentials not configured');
    }
  }

  getTools() {
    return [
      // SMS Tools
      {
        name: 'send_sms',
        description: 'Send an SMS message',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient phone number (E.164 format)' },
            body: { type: 'string', description: 'Message body' },
            from: { type: 'string', description: 'Sender phone number (optional, uses default)' },
          },
          required: ['to', 'body'],
        },
      },
      {
        name: 'list_messages',
        description: 'List SMS messages',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Filter by recipient' },
            from: { type: 'string', description: 'Filter by sender' },
            dateSent: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
            limit: { type: 'number', description: 'Maximum messages to return' },
          },
        },
      },
      {
        name: 'get_message',
        description: 'Get message details',
        inputSchema: {
          type: 'object',
          properties: {
            messageSid: { type: 'string', description: 'Message SID' },
          },
          required: ['messageSid'],
        },
      },
      // Voice/Call Tools
      {
        name: 'make_call',
        description: 'Initiate a voice call',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient phone number' },
            from: { type: 'string', description: 'Caller phone number' },
            url: { type: 'string', description: 'TwiML URL for call instructions' },
            twiml: { type: 'string', description: 'TwiML instructions (alternative to URL)' },
          },
          required: ['to'],
        },
      },
      {
        name: 'list_calls',
        description: 'List voice calls',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Filter by recipient' },
            from: { type: 'string', description: 'Filter by caller' },
            status: { type: 'string', description: 'Filter by status' },
            limit: { type: 'number', description: 'Maximum calls to return' },
          },
        },
      },
      {
        name: 'get_call',
        description: 'Get call details',
        inputSchema: {
          type: 'object',
          properties: {
            callSid: { type: 'string', description: 'Call SID' },
          },
          required: ['callSid'],
        },
      },
      // Phone Number Tools
      {
        name: 'list_phone_numbers',
        description: 'List phone numbers in the account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'lookup_phone',
        description: 'Look up information about a phone number',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumber: { type: 'string', description: 'Phone number to look up' },
            type: { type: 'array', items: { type: 'string' }, description: 'Lookup types: carrier, caller-name' },
          },
          required: ['phoneNumber'],
        },
      },
      // Account Tools
      {
        name: 'get_account_balance',
        description: 'Get account balance',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_usage',
        description: 'Get account usage records',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Usage category (sms, calls, etc.)' },
            startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          },
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling Twilio tool: ${name}`, args);

    if (!this.client.configured) {
      return {
        error: 'Twilio not configured',
        message: 'Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables',
      };
    }

    try {
      switch (name) {
        case 'send_sms':
          return await this.sendSMS(args);
        case 'list_messages':
          return await this.listMessages(args);
        case 'get_message':
          return await this.getMessage(args.messageSid);
        case 'make_call':
          return await this.makeCall(args);
        case 'list_calls':
          return await this.listCalls(args);
        case 'get_call':
          return await this.getCall(args.callSid);
        case 'list_phone_numbers':
          return await this.listPhoneNumbers();
        case 'lookup_phone':
          return await this.lookupPhone(args);
        case 'get_account_balance':
          return await this.getAccountBalance();
        case 'get_usage':
          return await this.getUsage(args);
        default:
          throw new Error(`Unknown Twilio tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in Twilio ${name}:`, error);
      throw error;
    }
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.client.accountSid}:${this.client.authToken}`).toString('base64');
  }

  private async twilioFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Twilio API error: ${response.status}`);
    }

    return await response.json();
  }

  private formEncode(data: Record<string, string>): string {
    return Object.entries(data)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private async sendSMS(args: any): Promise<any> {
    const endpoint = `/Accounts/${this.client.accountSid}/Messages.json`;
    const body = {
      To: args.to,
      Body: args.body,
      From: args.from || this.client.defaultFromNumber,
    };

    return await this.twilioFetch(endpoint, {
      method: 'POST',
      body: this.formEncode(body),
    });
  }

  private async listMessages(args: any): Promise<any> {
    let endpoint = `/Accounts/${this.client.accountSid}/Messages.json?`;
    if (args.to) endpoint += `To=${encodeURIComponent(args.to)}&`;
    if (args.from) endpoint += `From=${encodeURIComponent(args.from)}&`;
    if (args.dateSent) endpoint += `DateSent=${args.dateSent}&`;
    if (args.limit) endpoint += `PageSize=${args.limit}&`;
    return await this.twilioFetch(endpoint);
  }

  private async getMessage(messageSid: string): Promise<any> {
    return await this.twilioFetch(`/Accounts/${this.client.accountSid}/Messages/${messageSid}.json`);
  }

  private async makeCall(args: any): Promise<any> {
    const endpoint = `/Accounts/${this.client.accountSid}/Calls.json`;
    const body: Record<string, string> = {
      To: args.to,
      From: args.from || this.client.defaultFromNumber,
    };

    if (args.url) {
      body['Url'] = args.url;
    } else if (args.twiml) {
      body['Twiml'] = args.twiml;
    } else {
      body['Twiml'] = '<Response><Say>Hello from After Dark Systems MCP Server!</Say></Response>';
    }

    return await this.twilioFetch(endpoint, {
      method: 'POST',
      body: this.formEncode(body),
    });
  }

  private async listCalls(args: any): Promise<any> {
    let endpoint = `/Accounts/${this.client.accountSid}/Calls.json?`;
    if (args.to) endpoint += `To=${encodeURIComponent(args.to)}&`;
    if (args.from) endpoint += `From=${encodeURIComponent(args.from)}&`;
    if (args.status) endpoint += `Status=${args.status}&`;
    if (args.limit) endpoint += `PageSize=${args.limit}&`;
    return await this.twilioFetch(endpoint);
  }

  private async getCall(callSid: string): Promise<any> {
    return await this.twilioFetch(`/Accounts/${this.client.accountSid}/Calls/${callSid}.json`);
  }

  private async listPhoneNumbers(): Promise<any> {
    return await this.twilioFetch(`/Accounts/${this.client.accountSid}/IncomingPhoneNumbers.json`);
  }

  private async lookupPhone(args: any): Promise<any> {
    let endpoint = `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(args.phoneNumber)}`;
    if (args.type && args.type.length > 0) {
      endpoint += `?Type=${args.type.join('&Type=')}`;
    }

    const response = await fetch(endpoint, {
      headers: { 'Authorization': this.getAuthHeader() },
    });

    if (!response.ok) {
      throw new Error(`Lookup failed: ${response.status}`);
    }

    return await response.json();
  }

  private async getAccountBalance(): Promise<any> {
    return await this.twilioFetch(`/Accounts/${this.client.accountSid}/Balance.json`);
  }

  private async getUsage(args: any): Promise<any> {
    let endpoint = `/Accounts/${this.client.accountSid}/Usage/Records.json?`;
    if (args.category) endpoint += `Category=${args.category}&`;
    if (args.startDate) endpoint += `StartDate=${args.startDate}&`;
    if (args.endDate) endpoint += `EndDate=${args.endDate}&`;
    return await this.twilioFetch(endpoint);
  }
}
