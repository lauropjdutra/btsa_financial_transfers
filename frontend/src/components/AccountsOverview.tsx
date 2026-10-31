import { useEffect, useMemo, useState } from 'react';
import { Account, AccountStatus, UpdateAccountConfigRequest } from '../types/financial';
import {
  formatCurrency,
  formatCurrencyInput,
  formatDocumentPtBr,
  formatNumberPtBr,
  translateAccountStatus
} from '../utils/formatters';
import { StatusSelect } from './StatusSelect';

interface AccountsOverviewProps {
  accounts: Account[];
  selectedSourceId: string;
  isLoading?: boolean;
  onUpdateConfig: (accountId: string, payload: UpdateAccountConfigRequest) => Promise<void>;
}

const CARDS_PER_PAGE = 4;

export function AccountsOverview({
  accounts,
  selectedSourceId,
  isLoading = false,
  onUpdateConfig
}: AccountsOverviewProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [overdraftDisplay, setOverdraftDisplay] = useState<string>('');
  const [overdraftNumeric, setOverdraftNumeric] = useState<number>(0);
  const [statusInput, setStatusInput] = useState<AccountStatus>('Active');
  const [saving, setSaving] = useState(false);

  const filteredAccounts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return accounts;

    const digitsTerm = term.replace(/\D/g, '');

    return accounts.filter(
      (account) =>
        account.holderName.toLowerCase().includes(term) ||
        account.documentNumber.toLowerCase().includes(term) ||
        (digitsTerm.length > 0 && account.documentNumber.replace(/\D/g, '').includes(digitsTerm)) ||
        account.id.toLowerCase().includes(term)
    );
  }, [accounts, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / CARDS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredAccounts.length, currentPage, totalPages]);

  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + CARDS_PER_PAGE);

  function startEditing(account: Account) {
    setEditingAccountId(account.id);
    setOverdraftDisplay(formatNumberPtBr(account.overdraftLimit));
    setOverdraftNumeric(account.overdraftLimit);
    setStatusInput(account.status);
  }

  function handleOverdraftChange(raw: string) {
    const { display, numeric } = formatCurrencyInput(raw.replace('-', ''));
    setOverdraftDisplay(display);
    setOverdraftNumeric(numeric);
  }

  async function handleSaveConfig(accountId: string) {
    if (overdraftNumeric < 0) return;

    setSaving(true);
    try {
      await onUpdateConfig(accountId, {
        overdraftLimit: overdraftNumeric,
        status: statusInput
      });
      setEditingAccountId(null);
    } finally {
      setSaving(false);
    }
  }

  const isFiltering = searchQuery.trim().length > 0;
  const badgeLabel = isFiltering
    ? `${filteredAccounts.length} ${filteredAccounts.length === 1 ? 'encontrada' : 'encontradas'}`
    : `${accounts.length} ${accounts.length === 1 ? 'cadastrada' : 'cadastradas'}`;

  return (
    <section className="panel panel-accounts">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Contas Bancárias</h2>
          {!isLoading && <span className="badge badge-neutral">{badgeLabel}</span>}
        </div>

        <div className="search-input-wrapper">
          <svg
            className="search-input-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Filtrar por nome, documento ou ID"
            value={searchQuery}
            disabled={isLoading}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar filtro"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="panel-loading-state">
          <span className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">Carregando</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="empty-state">
          Nenhuma conta encontrada para o filtro informado.
        </div>
      ) : (
        <>
          <div className="accounts-grid-fixed">
            {paginatedAccounts.map((account) => {
              const isSelected = account.id === selectedSourceId;
              const isNegative = account.balance < 0;
              const isEditing = editingAccountId === account.id;

              const previewOverdraft = isEditing ? overdraftNumeric : account.overdraftLimit;
              const previewTotalAvailable = account.balance + previewOverdraft;

              return (
                <div
                  key={account.id}
                  className={`account-card ${isSelected ? 'account-card-selected' : ''} ${
                    isEditing ? 'account-card-editing' : ''
                  }`}
                >
                  <div className="account-card-top">
                    <div className="account-identity">
                      <div className="account-holder" title={account.holderName}>
                        {account.holderName}
                      </div>
                      <div className="account-doc">
                        Doc: {formatDocumentPtBr(account.documentNumber)} • ID: <code>{account.id.slice(0, 8)}</code>
                      </div>
                    </div>

                    {isEditing ? (
                      <StatusSelect
                        value={statusInput}
                        onChange={setStatusInput}
                      />
                    ) : (
                      <span className={`status-pill status-account-${account.status.toLowerCase()}`}>
                        {translateAccountStatus(account.status)}
                      </span>
                    )}
                  </div>

                  <div className="account-metrics">
                    <div className="metric-row">
                      <span className="metric-label">Saldo em Conta</span>
                      <strong className={isNegative ? 'text-danger' : 'text-positive'}>
                        {formatCurrency(account.balance)}
                      </strong>
                    </div>

                    <div className="metric-row">
                      <span className="metric-label">Limite Cheque Especial</span>
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          className="inline-metric-input"
                          placeholder="0,00"
                          value={overdraftDisplay}
                          onChange={(e) => handleOverdraftChange(e.target.value)}
                          aria-label="Limite de cheque especial"
                        />
                      ) : (
                        <span>{formatCurrency(account.overdraftLimit)}</span>
                      )}
                    </div>

                    <div className="metric-row">
                      <span className="metric-label">Cheque Especial Usado</span>
                      <span className={account.usedOverdraft > 0 ? 'text-warning' : ''}>
                        {formatCurrency(account.usedOverdraft)}
                      </span>
                    </div>

                    <div className="metric-row metric-row-total">
                      <span className="metric-label">Total Disponível</span>
                      <strong>{formatCurrency(previewTotalAvailable)}</strong>
                    </div>
                  </div>

                  <div className="account-limits-footer">
                    <div>
                      <strong>Limite Diurno:</strong> {formatCurrency(account.daytimeHourlyLimit)}/h ({account.daytimeMaxAttemptsPerHour} tent.)
                    </div>
                    <div>
                      <strong>Limite Noturno:</strong> {formatCurrency(account.nighttimeHourlyLimit)}/h ({account.nighttimeMaxAttemptsPerHour} tent.)
                    </div>
                  </div>

                  <div className="account-card-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-with-icon"
                          disabled={saving}
                          onClick={() => handleSaveConfig(account.id)}
                          title="Salvar alterações"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          <span>{saving ? 'Salvando...' : 'Confirmar'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-with-icon"
                          onClick={() => setEditingAccountId(null)}
                          title="Cancelar edição"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                          <span>Cancelar</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-with-icon"
                        onClick={() => startEditing(account)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Configurar Conta</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <span className="pagination-info">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
