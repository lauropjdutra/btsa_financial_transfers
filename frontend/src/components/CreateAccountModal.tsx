import { FormEvent, useState } from 'react';
import { CreateAccountRequest } from '../types/financial';
import {
  formatCurrencyInput,
  formatDocumentPtBr,
  isValidDocumentPtBr
} from '../utils/formatters';

interface CreateAccountModalProps {
  onClose: () => void;
  onCreate: (payload: CreateAccountRequest) => Promise<void>;
}

export function CreateAccountModal({ onClose, onCreate }: CreateAccountModalProps) {
  const [holderName, setHolderName] = useState('');
  const [documentDisplay, setDocumentDisplay] = useState('');
  const [initialBalanceDisplay, setInitialBalanceDisplay] = useState('1.000,00');
  const [initialBalanceNumeric, setInitialBalanceNumeric] = useState(1000);
  const [overdraftDisplay, setOverdraftDisplay] = useState('500,00');
  const [overdraftNumeric, setOverdraftNumeric] = useState(500);
  const [docError, setDocError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleDocumentChange(raw: string) {
    setDocError('');
    setDocumentDisplay(formatDocumentPtBr(raw));
  }

  function handleInitialBalanceChange(raw: string) {
    const { display, numeric } = formatCurrencyInput(raw);
    setInitialBalanceDisplay(display);
    setInitialBalanceNumeric(numeric);
  }

  function handleOverdraftChange(raw: string) {
    const { display, numeric } = formatCurrencyInput(raw.replace('-', ''));
    setOverdraftDisplay(display);
    setOverdraftNumeric(numeric);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!isValidDocumentPtBr(documentDisplay)) {
      setDocError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        holderName: holderName.trim(),
        documentNumber: documentDisplay.replace(/\D/g, ''),
        initialBalance: initialBalanceNumeric,
        overdraftLimit: overdraftNumeric
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3 className="panel-title">Cadastrar Nova Conta Bancária</h3>
          <button
            type="button"
            className="modal-close-icon-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="transfer-form">
          <div className="form-group">
            <label htmlFor="holderName">Nome do Titular / Razão Social</label>
            <input
              id="holderName"
              type="text"
              required
              placeholder="Ex: João Oliveira"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="documentNumber">CPF ou CNPJ</label>
            <input
              id="documentNumber"
              type="text"
              inputMode="numeric"
              required
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={documentDisplay}
              onChange={(e) => handleDocumentChange(e.target.value)}
            />
            {docError && <small className="text-danger">{docError}</small>}
          </div>

          <div className="form-row-two-cols">
            <div className="form-group">
              <label htmlFor="initialBalance">Saldo Inicial (R$)</label>
              <input
                id="initialBalance"
                type="text"
                inputMode="numeric"
                required
                placeholder="0,00"
                value={initialBalanceDisplay}
                onChange={(e) => handleInitialBalanceChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="overdraftLimit">Limite Cheque Especial (R$)</label>
              <input
                id="overdraftLimit"
                type="text"
                inputMode="numeric"
                required
                placeholder="0,00"
                value={overdraftDisplay}
                onChange={(e) => handleOverdraftChange(e.target.value)}
              />
            </div>
          </div>

          <div className="account-card-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar Conta'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
