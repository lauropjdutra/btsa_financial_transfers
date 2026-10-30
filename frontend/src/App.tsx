import { useCallback, useEffect, useState } from 'react';
import { AccountsOverview } from './components/AccountsOverview';
import { CreateAccountModal } from './components/CreateAccountModal';
import { TransferOperationForm } from './components/TransferOperationForm';
import { TransfersHistoryTable } from './components/TransfersHistoryTable';
import { ApiRequestError, financialApi } from './services/financialApi';
import { Account, CreateAccountRequest, Transfer, UpdateAccountConfigRequest } from './types/financial';
import { formatCurrency } from './utils/formatters';

interface FeedbackBanner {
  type: 'success' | 'error' | 'info';
  message: string;
}

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState<boolean>(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [accountsList, transfersList] = await Promise.all([
        financialApi.getAccounts(),
        financialApi.getTransfers()
      ]);

      setAccounts(accountsList);
      setTransfers(transfersList);

      setSelectedSourceId((currentId) => {
        if (currentId && accountsList.some((a) => a.id === currentId)) {
          return currentId;
        }
        return accountsList[0]?.id ?? '';
      });
    } catch (error) {
      if (!silent) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível conectar à API (.NET 8) em http://localhost:5251.';
        setFeedback({ type: 'error', message });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);

    // Atualização periódica para refletir o processamento automático do Background Worker de agendamentos
    const interval = setInterval(() => {
      void loadData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  async function handleImmediateTransfer(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    idempotencyKey?: string
  ) {
    setFeedback(null);
    try {
      const result = await financialApi.createImmediateTransfer(
        { sourceAccountId, destinationAccountId, amount },
        idempotencyKey
      );

      setFeedback({
        type: 'success',
        message: `Transferência imediata de ${formatCurrency(result.amount)} concluída com sucesso (ID: ${result.id.slice(0, 8)}...).`
      });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFeedback({
          type: 'error',
          message: `Transferência não realizada: ${error.message}`
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Erro inesperado ao processar a transferência.'
        });
      }
    } finally {
      await loadData(true);
    }
  }

  async function handleScheduledTransfer(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    scheduledForUtc: string,
    idempotencyKey?: string
  ) {
    setFeedback(null);
    try {
      const result = await financialApi.scheduleTransfer(
        { sourceAccountId, destinationAccountId, amount, scheduledForUtc },
        idempotencyKey
      );

      setFeedback({
        type: 'info',
        message: `Transferência de ${formatCurrency(result.amount)} agendada com status '${result.status}' (ID: ${result.id.slice(0, 8)}...).`
      });
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao agendar transferência.';
      setFeedback({ type: 'error', message: msg });
    }
  }

  async function handleCancelScheduled(transferId: string) {
    setFeedback(null);
    try {
      await financialApi.cancelScheduledTransfer(transferId);
      setFeedback({
        type: 'info',
        message: `Agendamento ${transferId.slice(0, 8)}... cancelado com sucesso.`
      });
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cancelar agendamento.';
      setFeedback({ type: 'error', message: msg });
    }
  }

  async function handleLookupTransferById(transferId: string): Promise<Transfer | null> {
    setFeedback(null);
    try {
      return await financialApi.getTransferById(transferId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Transferência não encontrada.';
      setFeedback({ type: 'error', message: msg });
      return null;
    }
  }

  async function handleLookupAccountById(accountId: string): Promise<Account | null> {
    setFeedback(null);
    try {
      return await financialApi.getAccountById(accountId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Conta não encontrada.';
      setFeedback({ type: 'error', message: msg });
      return null;
    }
  }

  async function handleUpdateAccountConfig(
    accountId: string,
    payload: UpdateAccountConfigRequest
  ) {
    setFeedback(null);
    try {
      await financialApi.updateAccountConfig(accountId, payload);
      setFeedback({
        type: 'success',
        message: 'Configuração da conta bancária atualizada com sucesso.'
      });
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar conta.';
      setFeedback({ type: 'error', message: msg });
    }
  }

  async function handleCreateAccount(payload: CreateAccountRequest) {
    setFeedback(null);
    try {
      const created = await financialApi.createAccount(payload);
      setFeedback({
        type: 'success',
        message: `Conta de '${created.holderName}' criada com sucesso.`
      });
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar conta.';
      setFeedback({ type: 'error', message: msg });
    }
  }

  return (
    <div className="app-layout">
      <header className="top-navbar">
        <div className="container navbar-content">
          <div>
            <span className="brand-tag">BRASIL TERRENOS HOLDING</span>
            <h1 className="brand-title">Sistema de Transferências Financeiras</h1>
          </div>
          <div className="navbar-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadData(false)}
              disabled={loading}
            >
              {loading ? 'Sincronizando...' : 'Atualizar Dados'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateAccountModal(true)}
            >
              + Nova Conta
            </button>
          </div>
        </div>
      </header>

      <main className="container main-content">
        {feedback && (
          <div className={`alert-banner alert-${feedback.type}`} role="alert">
            <span>{feedback.message}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        )}

        <div className="workspace-grid">
          <div className="workspace-left">
            <AccountsOverview
              accounts={accounts}
              selectedSourceId={selectedSourceId}
              onSelectSource={setSelectedSourceId}
              onUpdateConfig={handleUpdateAccountConfig}
              onInspectAccountById={handleLookupAccountById}
            />
          </div>

          <div className="workspace-right">
            <TransferOperationForm
              accounts={accounts}
              selectedSourceId={selectedSourceId}
              onSourceChange={setSelectedSourceId}
              onSubmitImmediate={handleImmediateTransfer}
              onSubmitScheduled={handleScheduledTransfer}
            />
          </div>
        </div>

        <TransfersHistoryTable
          transfers={transfers}
          onCancelScheduled={handleCancelScheduled}
          onLookupById={handleLookupTransferById}
        />
      </main>

      {showCreateAccountModal && (
        <CreateAccountModal
          onClose={() => setShowCreateAccountModal(false)}
          onCreate={handleCreateAccount}
        />
      )}
    </div>
  );
}
