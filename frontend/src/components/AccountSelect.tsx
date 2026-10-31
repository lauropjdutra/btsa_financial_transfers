import { useEffect, useRef, useState } from 'react';
import { Account } from '../types/financial';
import { translateAccountStatus } from '../utils/formatters';

interface AccountSelectProps {
  id: string;
  accounts: Account[];
  selectedId: string;
  onChange: (accountId: string) => void;
}

export function AccountSelect({
  id,
  accounts,
  selectedId,
  onChange
}: AccountSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="custom-select" ref={containerRef}>
      <button
        id={id}
        type="button"
        className={`custom-select-trigger ${open ? 'custom-select-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedAccount ? (
          <div className="custom-select-value">
            <span className="custom-select-name">{selectedAccount.holderName}</span>
            <span className={`status-pill status-account-${selectedAccount.status.toLowerCase()}`}>
              {translateAccountStatus(selectedAccount.status)}
            </span>
          </div>
        ) : (
          <span className="custom-select-placeholder">Selecione uma conta</span>
        )}
        <svg
          className="custom-select-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="custom-select-menu" role="listbox">
          {accounts.map((account) => {
            const isSelected = account.id === selectedAccount?.id;
            return (
              <li
                key={account.id}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'custom-select-option-selected' : ''}`}
                onClick={() => {
                  onChange(account.id);
                  setOpen(false);
                }}
              >
                <span className="custom-select-option-name">{account.holderName}</span>
                <span className={`status-pill status-account-${account.status.toLowerCase()}`}>
                  {translateAccountStatus(account.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
