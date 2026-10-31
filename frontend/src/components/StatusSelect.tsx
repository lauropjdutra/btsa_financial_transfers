import { useEffect, useRef, useState } from 'react';
import { AccountStatus } from '../types/financial';
import { translateAccountStatus } from '../utils/formatters';

interface StatusSelectProps {
  value: AccountStatus;
  onChange: (status: AccountStatus) => void;
}

const STATUS_OPTIONS: AccountStatus[] = ['Active', 'Blocked', 'Inactive'];

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="custom-status-select" ref={containerRef}>
      <button
        type="button"
        className={`custom-status-trigger ${open ? 'custom-select-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{translateAccountStatus(value)}</span>
        <svg
          className="custom-select-chevron"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="custom-status-menu" role="listbox">
          {STATUS_OPTIONS.map((status) => {
            const isSelected = status === value;
            return (
              <li
                key={status}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'custom-select-option-selected' : ''}`}
                onClick={() => {
                  onChange(status);
                  setOpen(false);
                }}
              >
                <span>{translateAccountStatus(status)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
