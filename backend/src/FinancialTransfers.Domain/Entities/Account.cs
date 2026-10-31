using FinancialTransfers.Domain.Common;
using FinancialTransfers.Domain.Enums;

namespace FinancialTransfers.Domain.Entities;

public class Account : Entity
{
    public string HolderName { get; private set; } = string.Empty;
    public string DocumentNumber { get; private set; } = string.Empty;
    public decimal Balance { get; private set; }
    public decimal OverdraftLimit { get; private set; }
    public AccountStatus Status { get; private set; }

    public decimal DaytimeHourlyLimit { get; private set; } = 5000m;
    public int DaytimeMaxAttemptsPerHour { get; private set; } = 5;
    public decimal NighttimeHourlyLimit { get; private set; } = 1000m;
    public int NighttimeMaxAttemptsPerHour { get; private set; } = 3;

    public DateTime CreatedAtUtc { get; private set; }
    public Guid ConcurrencyToken { get; private set; } = Guid.NewGuid();

    public decimal UsedOverdraft => Balance < 0 ? Math.Abs(Balance) : 0m;
    public decimal AvailableOverdraft => Math.Max(0m, OverdraftLimit - UsedOverdraft);
    public decimal TotalAvailableFunds => Balance + OverdraftLimit;

    protected Account()
    {
    }

    public Account(
        string holderName,
        string documentNumber,
        decimal initialBalance,
        decimal overdraftLimit,
        AccountStatus status = AccountStatus.Active,
        decimal daytimeHourlyLimit = 5000m,
        int daytimeMaxAttemptsPerHour = 5,
        decimal nighttimeHourlyLimit = 1000m,
        int nighttimeMaxAttemptsPerHour = 3,
        Guid? id = null)
    {
        if (string.IsNullOrWhiteSpace(holderName))
            throw new DomainException("O nome do titular da conta é obrigatório.");

        if (string.IsNullOrWhiteSpace(documentNumber))
            throw new DomainException("O documento (CPF/CNPJ) do titular é obrigatório.");

        if (overdraftLimit < 0)
            throw new DomainException("O limite de cheque especial não pode ser negativo.");

        if (initialBalance < -overdraftLimit)
            throw new DomainException("O saldo inicial não pode ser inferior ao limite de cheque especial.");

        if (id.HasValue && id.Value != Guid.Empty)
            Id = id.Value;

        HolderName = holderName.Trim();
        DocumentNumber = documentNumber.Trim();
        Balance = initialBalance;
        OverdraftLimit = overdraftLimit;
        Status = status;
        DaytimeHourlyLimit = daytimeHourlyLimit;
        DaytimeMaxAttemptsPerHour = daytimeMaxAttemptsPerHour;
        NighttimeHourlyLimit = nighttimeHourlyLimit;
        NighttimeMaxAttemptsPerHour = nighttimeMaxAttemptsPerHour;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public bool IsActive => Status == AccountStatus.Active;

    public string GetStatusDescriptionPtBr() => Status switch
    {
        AccountStatus.Active => "ativa",
        AccountStatus.Blocked => "bloqueada",
        AccountStatus.Inactive => "inativa",
        _ => Status.ToString().ToLowerInvariant()
    };

    public void EnsureCanSendTransfer()
    {
        if (!IsActive)
            throw new DomainException($"A conta de origem ({HolderName}) está {GetStatusDescriptionPtBr()} e não pode realizar transferências.");
    }

    public void EnsureCanReceiveTransfer()
    {
        if (!IsActive)
            throw new DomainException($"A conta de destino ({HolderName}) está {GetStatusDescriptionPtBr()} e não pode receber transferências.");
    }

    public bool HasSufficientFunds(decimal amount) => TotalAvailableFunds >= amount;

    public decimal GetHourlyAmountLimit(bool isNightPeriod) =>
        isNightPeriod ? NighttimeHourlyLimit : DaytimeHourlyLimit;

    public int GetHourlyAttemptsLimit(bool isNightPeriod) =>
        isNightPeriod ? NighttimeMaxAttemptsPerHour : DaytimeMaxAttemptsPerHour;

    public void Debit(decimal amount)
    {
        EnsureCanSendTransfer();

        if (amount <= 0)
            throw new DomainException("O valor de débito deve ser maior que zero.");

        if (!HasSufficientFunds(amount))
            throw new DomainException("Saldo e limite de cheque especial insuficientes para realizar a transferência.");

        Balance -= amount;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void Credit(decimal amount)
    {
        EnsureCanReceiveTransfer();

        if (amount <= 0)
            throw new DomainException("O valor de crédito deve ser maior que zero.");

        // Se o saldo estiver negativo (cheque especial em uso), a soma aritmética cobre primeiro
        // o cheque especial utilizado e o excedente passa a compor o saldo positivo disponível.
        Balance += amount;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void UpdateOverdraftLimit(decimal newLimit)
    {
        if (newLimit < 0)
            throw new DomainException("O limite de cheque especial não pode ser negativo.");

        if (Balance < -newLimit)
            throw new DomainException("O novo limite de cheque especial é menor que o valor já utilizado atualmente.");

        OverdraftLimit = newLimit;
        ConcurrencyToken = Guid.NewGuid();
    }

    public void ChangeStatus(AccountStatus newStatus)
    {
        Status = newStatus;
        ConcurrencyToken = Guid.NewGuid();
    }
}
