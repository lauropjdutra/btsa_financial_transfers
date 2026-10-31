import { useCallback, useEffect, useState } from 'react';
import { AccountsOverview } from './components/AccountsOverview';
import { CreateAccountModal } from './components/CreateAccountModal';
import { TransferOperationForm } from './components/TransferOperationForm';
import { TransfersHistoryTable } from './components/TransfersHistoryTable';
import { ApiRequestError, financialApi } from './services/financialApi';
import { Account, CreateAccountRequest, Transfer, UpdateAccountConfigRequest } from './types/financial';
import { formatCurrency } from './utils/formatters';

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const NOTES_STORAGE_KEY = 'btsa_transfer_notes';

function loadStoredNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function sanitizeMessagePtBr(message: string): string {
  return message
    .replace(/A conta de (origem|destino)\s*\([^)]+\)/gi, 'A conta de $1')
    .replace(/\bBlocked\b/gi, 'bloqueada')
    .replace(/\bInactive\b/gi, 'inativa')
    .replace(/\bActive\b/gi, 'ativa');
}

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [transferNotes, setTransferNotes] = useState<Record<string, string>>(loadStoredNotes);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now();
    setToast({
      id,
      type,
      title,
      message: sanitizeMessagePtBr(message)
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 7000);

    return () => clearTimeout(timer);
  }, [toast]);

  function saveTransferNote(transferId: string, note?: string) {
    if (!note?.trim()) return;
    setTransferNotes((prev) => {
      const updated = { ...prev, [transferId]: note.trim() };
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  const loadData = useCallback(async (silent = false, initialLoad = false) => {
    if (initialLoad) {
      setIsInitialLoading(true);
    }

    try {
      const [accountsList, transfersList] = await Promise.all([
        financialApi.getAccounts(),
        financialApi.getTransfers(),
        ...(initialLoad ? [new Promise((resolve) => setTimeout(resolve, 600))] : [])
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
        showToast('error', 'Erro de conexão', message);
      }
    } finally {
      if (initialLoad) {
        setIsInitialLoading(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    void loadData(false, true);

    // Atualização periódica para refletir o processamento automático do Background Worker de agendamentos
    const interval = setInterval(() => {
      void loadData(true, false);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  async function handleImmediateTransfer(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    description?: string
  ) {
    const idempotencyKey = `idem-${crypto.randomUUID()}`;
    try {
      const result = await financialApi.createImmediateTransfer(
        { sourceAccountId, destinationAccountId, amount },
        idempotencyKey
      );

      saveTransferNote(result.id, description);

      showToast(
        'success',
        'Transferência concluída',
        `Transferência imediata de ${formatCurrency(result.amount)} realizada com sucesso.`
      );
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.transferResult?.id) {
          saveTransferNote(error.transferResult.id, description);
        }
        showToast('error', 'Transferência não realizada', error.message);
      } else {
        showToast('error', 'Erro na operação', 'Erro inesperado ao processar a transferência.');
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
    description?: string
  ) {
    const idempotencyKey = `idem-${crypto.randomUUID()}`;
    try {
      const result = await financialApi.scheduleTransfer(
        { sourceAccountId, destinationAccountId, amount, scheduledForUtc },
        idempotencyKey
      );

      saveTransferNote(result.id, description);

      showToast(
        'info',
        'Agendamento confirmado',
        `Transferência de ${formatCurrency(result.amount)} agendada com sucesso.`
      );
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao agendar transferência.';
      showToast('error', 'Agendamento não realizado', msg);
    }
  }

  async function handleCancelScheduled(transferId: string) {
    try {
      await financialApi.cancelScheduledTransfer(transferId);
      showToast('info', 'Agendamento cancelado', 'O agendamento foi cancelado com sucesso.');
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cancelar agendamento.';
      showToast('error', 'Erro ao cancelar', msg);
    }
  }

  async function handleLookupTransferById(transferId: string): Promise<Transfer | null> {
    try {
      return await financialApi.getTransferById(transferId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Transferência não encontrada.';
      showToast('error', 'Consulta de transferência', msg);
      return null;
    }
  }

  async function handleUpdateAccountConfig(
    accountId: string,
    payload: UpdateAccountConfigRequest
  ) {
    try {
      await financialApi.updateAccountConfig(accountId, payload);
      showToast('success', 'Conta atualizada', 'Configuração da conta bancária salva com sucesso.');
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar conta.';
      showToast('error', 'Erro na configuração', msg);
    }
  }

  async function handleCreateAccount(payload: CreateAccountRequest) {
    try {
      const created = await financialApi.createAccount(payload);
      showToast('success', 'Conta criada', `Conta de '${created.holderName}' cadastrada com sucesso.`);
      await loadData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar conta.';
      showToast('error', 'Erro no cadastro', msg);
    }
  }

  return (
    <div className="app-layout">
      {toast && (
        <div key={toast.id} className={`swal-toast swal-toast-${toast.type}`} role="alert">
          <div className="swal-toast-body">
            <div className={`swal-toast-icon swal-toast-icon-${toast.type}`}>
              {toast.type === 'success' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              )}
            </div>
            <div className="swal-toast-content">
              <strong className="swal-toast-title">{toast.title}</strong>
              <p className="swal-toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="swal-toast-close"
              onClick={() => setToast(null)}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
          <div className="swal-toast-progress-track">
            <div className={`swal-toast-progress-bar swal-toast-progress-${toast.type}`} />
          </div>
        </div>
      )}

      <header className="top-navbar">
        <div className="container navbar-content">
          <div className="brand-header">
            <span className="brand-accent-bar" />
            <h1 className="brand-title">Sistema de Transferências Financeiras</h1>
          </div>
          <div className="navbar-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-with-icon"
              onClick={() => setShowHistoryModal(true)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
              <span>Histórico</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm btn-with-icon"
              onClick={() => setShowCreateAccountModal(true)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <span>Nova Conta</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container main-content">
        <div className="workspace-grid">
          <div className="workspace-col">
            <AccountsOverview
              accounts={accounts}
              selectedSourceId={selectedSourceId}
              isLoading={isInitialLoading}
              onUpdateConfig={handleUpdateAccountConfig}
            />
          </div>

          <div className="workspace-col">
            <TransferOperationForm
              accounts={accounts}
              selectedSourceId={selectedSourceId}
              isLoading={isInitialLoading}
              onSourceChange={setSelectedSourceId}
              onSubmitImmediate={handleImmediateTransfer}
              onSubmitScheduled={handleScheduledTransfer}
            />
          </div>
        </div>
      </main>

      {showHistoryModal && (
        <TransfersHistoryTable
          transfers={transfers}
          transferNotes={transferNotes}
          onCancelScheduled={handleCancelScheduled}
          onLookupById={handleLookupTransferById}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showCreateAccountModal && (
        <CreateAccountModal
          onClose={() => setShowCreateAccountModal(false)}
          onCreate={handleCreateAccount}
        />
      )}
    </div>
  );
}
