import {
  Account,
  CreateAccountRequest,
  CreateImmediateTransferRequest,
  CreateScheduledTransferRequest,
  Transfer,
  UpdateAccountConfigRequest
} from '../types/financial';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5251/api';

export class ApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly transferResult?: Transfer;

  constructor(message: string, statusCode: number, transferResult?: Transfer) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.transferResult = transferResult;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // Quando uma transferência imediata é rejeitada pelas regras de negócio (HTTP 422),
    // a API retorna o próprio objeto Transfer com status 'Failed' e o 'failureReason' persistido.
    if (data && typeof data === 'object' && 'failureReason' in data && data.failureReason) {
      throw new ApiRequestError(
        data.failureReason as string,
        response.status,
        data as Transfer
      );
    }

    const detailMessage =
      data?.detail ||
      data?.title ||
      `Erro na comunicação com a API (HTTP ${response.status}).`;

    throw new ApiRequestError(detailMessage, response.status);
  }

  return data as T;
}

export const financialApi = {
  async getAccounts(): Promise<Account[]> {
    const response = await fetch(`${API_BASE_URL}/accounts`);
    return parseResponse<Account[]>(response);
  },

  async getAccountById(id: string): Promise<Account> {
    const response = await fetch(`${API_BASE_URL}/accounts/${id}`);
    return parseResponse<Account>(response);
  },

  async createAccount(payload: CreateAccountRequest): Promise<Account> {
    const response = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseResponse<Account>(response);
  },

  async updateAccountConfig(id: string, payload: UpdateAccountConfigRequest): Promise<Account> {
    const response = await fetch(`${API_BASE_URL}/accounts/${id}/configuration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseResponse<Account>(response);
  },

  async getTransfers(accountId?: string): Promise<Transfer[]> {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const response = await fetch(`${API_BASE_URL}/transfers${query}`);
    return parseResponse<Transfer[]>(response);
  },

  async getTransferById(id: string): Promise<Transfer> {
    const response = await fetch(`${API_BASE_URL}/transfers/${id}`);
    return parseResponse<Transfer>(response);
  },

  async createImmediateTransfer(
    payload: CreateImmediateTransferRequest,
    idempotencyKey?: string
  ): Promise<Transfer> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (idempotencyKey?.trim()) {
      headers['Idempotency-Key'] = idempotencyKey.trim();
    }

    const response = await fetch(`${API_BASE_URL}/transfers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    return parseResponse<Transfer>(response);
  },

  async scheduleTransfer(
    payload: CreateScheduledTransferRequest,
    idempotencyKey?: string
  ): Promise<Transfer> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (idempotencyKey?.trim()) {
      headers['Idempotency-Key'] = idempotencyKey.trim();
    }

    const response = await fetch(`${API_BASE_URL}/transfers/scheduled`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    return parseResponse<Transfer>(response);
  },

  async cancelScheduledTransfer(transferId: string): Promise<Transfer> {
    const response = await fetch(`${API_BASE_URL}/transfers/${transferId}/cancel`, {
      method: 'POST'
    });
    return parseResponse<Transfer>(response);
  }
};
