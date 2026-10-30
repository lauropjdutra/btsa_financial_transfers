export type AccountStatus = 'Active' | 'Blocked' | 'Inactive';

export type TransferStatus =
  | 'Scheduled'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface Account {
  id: string;
  holderName: string;
  documentNumber: string;
  balance: number;
  overdraftLimit: number;
  usedOverdraft: number;
  availableOverdraft: number;
  totalAvailableFunds: number;
  status: AccountStatus;
  daytimeHourlyLimit: number;
  daytimeMaxAttemptsPerHour: number;
  nighttimeHourlyLimit: number;
  nighttimeMaxAttemptsPerHour: number;
  createdAtUtc: string;
}

export interface Transfer {
  id: string;
  sourceAccountId: string;
  sourceAccountHolder: string | null;
  destinationAccountId: string;
  destinationAccountHolder: string | null;
  amount: number;
  status: TransferStatus;
  isScheduled: boolean;
  scheduledForUtc: string | null;
  createdAtUtc: string;
  executedAtUtc: string | null;
  cancelledAtUtc: string | null;
  failureReason: string | null;
  idempotencyKey: string | null;
}

export interface CreateImmediateTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
}

export interface CreateScheduledTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  scheduledForUtc: string;
}

export interface CreateAccountRequest {
  holderName: string;
  documentNumber: string;
  initialBalance: number;
  overdraftLimit: number;
}

export interface UpdateAccountConfigRequest {
  overdraftLimit: number;
  status: AccountStatus;
}

export interface ApiErrorPayload {
  status?: number;
  title?: string;
  detail?: string;
  failureReason?: string;
}
