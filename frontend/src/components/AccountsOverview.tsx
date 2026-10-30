import { useState } from 'react';
import { Account, AccountStatus, UpdateAccountConfigRequest } from '../types/financial';
import { formatCurrency, translateAccountStatus } from '../utils/formatters';

interface AccountsOverviewProps {
  accounts: Account[];
  selectedSourceId: string;
  onSelectSource: (accountId: string) => void;
  onUpdateConfig: (accountId: string, payload: UpdateAccountConfigRequest) => Promise<void>;
  onInspectAccountById: (accountId: string) => Promise<Account | null>;
}

export function AccountsOverview({
  accounts,
  selectedSourceId,
  onSelectSource,
  onUpdateConfig,
  onInspectAccountById
}: AccountsOverviewProps) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [overdraftInput, setOverdraftInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<AccountStatus>('Active');
  const [saving, setSaving] = useState(false);
  const [lookupAccountId, setLookupAccountId] = useState('');
  const [inspectedAccount, setInspectedAccount] = useState<Account | null>(null);

  async function handleAccountSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupAccountId.trim()) return;
    const found = await onInspectAccountById(lookupAccountId.trim());
    if (found) {
      setInspectedAccount(found);
    }
  }

  function startEditing(account: Account) {
    setEditingAccountId(account.id);
    setOverdraftInput(account.overdraftLimit.toString());
    setStatusInput(account.status);
  }

  async function handleSaveConfig(accountId: string) {
    const parsedLimit = Number(overdraftInput);
    if (Number.isNaN(parsedLimit) || parsedLimit < 0) return;

    setSaving(true);
    try {
      await onUpdateConfig(accountId, {
        overdraftLimit: parsedLimit,
        status: statusInput
      });
      setEditingAccountId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Contas Bancárias Cadastradas</h2>
          <p className="panel-subtitle">
            Selecione uma conta como origem, consulte por ID (GET /api/accounts/&#123;id&#125;) ou configure cheque especial e status.
          </p>
        </div>
        <form onSubmit={handleAccountSearch} className="lookup-bar">
          <input
            type="text"
            placeholder="Consultar conta por ID..."
            value={lookupAccountId}
            onChange={(e) => setLookupAccountId(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Consultar
          </button>
        </form>
      </div>

      {inspectedAccount && (
        <div className="inspector-box">
          <div className="inspector-header">
            <strong>
              Conta Consultada (GET /api/accounts/&#123;id&#125;): <code>{inspectedAccount.id}</code>
            </strong>
            <button
              type="button"
              className="btn-link"
              onClick={() => setInspectedAccount(null)}
            >
              Fechar
            </button>
          </div>
          <div className="inspector-grid">
            <div>
              <span>Titular:</span> <strong>{inspectedAccount.holderName}</strong>
            </div>
            <div>
              <span>Documento:</span> <strong>{inspectedAccount.documentNumber}</strong>
            </div>
            <div>
              <span>Status:</span>{' '}
              <strong>{translateAccountStatus(inspectedAccount.status)}</strong>
            </div>
            <div>
              <span>Saldo Atual:</span>{' '}
              <strong>{formatCurrency(inspectedAccount.balance)}</strong>
            </div>
            <div>
              <span>Limite Cheque Especial:</span>{' '}
              <strong>{formatCurrency(inspectedAccount.overdraftLimit)}</strong>
            </div>
            <div>
              <span>Poder Total Disponível:</span>{' '}
              <strong>{formatCurrency(inspectedAccount.totalAvailableFunds)}</strong>
            </div>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state">
          Nenhuma conta encontrada. Verifique se a API está em execução e se o banco de dados PostgreSQL foi inicializado.
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => {
            const isSelected = account.id === selectedSourceId;
            const isNegative = account.balance < 0;
            const isEditing = editingAccountId === account.id;

            return (
              <div
                key={account.id}
                className={`account-card ${isSelected ? 'account-card-selected' : ''}`}
              >
                <div className="account-card-top">
                  <div>
                    <div className="account-holder">{account.holderName}</div>
                    <div className="account-doc">
                      Doc: {account.documentNumber} • ID: <code>{account.id.slice(0, 8)}...</code>
                    </div>
                  </div>
                  <span className={`status-pill status-account-${account.status.toLowerCase()}`}>
                    {translateAccountStatus(account.status)}
                  </span>
                </div>

                <div className="account-metrics">
                  <div className="metric-row">
                    <span className="metric-label">Saldo em Conta:</span>
                    <strong className={isNegative ? 'text-danger' : 'text-positive'}>
                      {formatCurrency(account.balance)}
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Limite Cheque Especial:</span>
                    <span>{formatCurrency(account.overdraftLimit)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Cheque Especial Utilizado:</span>
                    <span className={account.usedOverdraft > 0 ? 'text-warning' : ''}>
                      {formatCurrency(account.usedOverdraft)}
                    </span>
                  </div>
                  <div className="metric-row metric-row-total">
                    <span className="metric-label">Disponível para Transferir:</span>
                    <strong>{formatCurrency(account.totalAvailableFunds)}</strong>
                  </div>
                </div>

                <div className="account-limits-footer">
                  <span>
                    Dia: máx. {formatCurrency(account.daytimeHourlyLimit)}/h ({account.daytimeMaxAttemptsPerHour} tent.)
                  </span>
                  <span>
                    Noite: máx. {formatCurrency(account.nighttimeHourlyLimit)}/h ({account.nighttimeMaxAttemptsPerHour} tent.)
                  </span>
                </div>

                {isEditing ? (
                  <div className="account-edit-box">
                    <div className="form-row-inline">
                      <label>
                        Cheque Especial (R$)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={overdraftInput}
                          onChange={(e) => setOverdraftInput(e.target.value)}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={statusInput}
                          onChange={(e) => setStatusInput(e.target.value as AccountStatus)}
                        >
                          <option value="Active">Ativa (Active)</option>
                          <option value="Blocked">Bloqueada (Blocked)</option>
                          <option value="Inactive">Inativa (Inactive)</option>
                        </select>
                      </label>
                    </div>
                    <div className="account-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                        onClick={() => handleSaveConfig(account.id)}
                      >
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingAccountId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-card-actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => onSelectSource(account.id)}
                    >
                      {isSelected ? 'Conta de Origem Selecionada' : 'Usar como Origem'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEditing(account)}
                    >
                      Configurar Conta
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
