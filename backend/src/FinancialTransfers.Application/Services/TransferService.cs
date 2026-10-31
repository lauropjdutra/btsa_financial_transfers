using FinancialTransfers.Application.Common;
using FinancialTransfers.Application.DTOs;
using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Domain.Common;
using FinancialTransfers.Domain.Entities;

namespace FinancialTransfers.Application.Services;

public interface ITransferService
{
    Task<TransferResponseDto> CreateImmediateTransferAsync(
        CreateImmediateTransferRequestDto request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    Task<TransferResponseDto> ScheduleTransferAsync(
        CreateScheduledTransferRequestDto request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default);

    Task<TransferResponseDto> CancelScheduledTransferAsync(
        Guid transferId,
        CancellationToken cancellationToken = default);

    Task<TransferResponseDto> ProcessScheduledTransferAsync(
        Guid transferId,
        CancellationToken cancellationToken = default);

    Task<TransferResponseDto> GetByIdAsync(
        Guid transferId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TransferResponseDto>> GetAllAsync(
        Guid? accountId = null,
        CancellationToken cancellationToken = default);
}

public class TransferService : ITransferService
{
    private readonly IAccountRepository _accountRepository;
    private readonly ITransferRepository _transferRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDateTimeProvider _dateTimeProvider;

    public TransferService(
        IAccountRepository accountRepository,
        ITransferRepository transferRepository,
        IUnitOfWork unitOfWork,
        IDateTimeProvider dateTimeProvider)
    {
        _accountRepository = accountRepository;
        _transferRepository = transferRepository;
        _unitOfWork = unitOfWork;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TransferResponseDto> CreateImmediateTransferAsync(
        CreateImmediateTransferRequestDto request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existing = await _transferRepository.GetByIdempotencyKeyAsync(idempotencyKey.Trim(), cancellationToken);
            if (existing is not null)
                return TransferResponseDto.FromEntity(existing);
        }

        var nowUtc = _dateTimeProvider.UtcNow;

        var transfer = Transfer.CreateImmediate(
            request.SourceAccountId,
            request.DestinationAccountId,
            request.Amount,
            nowUtc,
            idempotencyKey);

        Account? sourceAccount = null;
        Account? destinationAccount = null;

        await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            sourceAccount = await _accountRepository.GetByIdAsync(request.SourceAccountId, ct)
                ?? throw new NotFoundException($"Conta de origem '{request.SourceAccountId}' não encontrada.");

            destinationAccount = await _accountRepository.GetByIdAsync(request.DestinationAccountId, ct)
                ?? throw new NotFoundException($"Conta de destino '{request.DestinationAccountId}' não encontrada.");

            var validationError = await ValidateTransferRulesAsync(sourceAccount, destinationAccount, request.Amount, nowUtc, ct);

            if (validationError is not null)
            {
                // Persiste com status 'Failed' antes de concluir a transação.
                // Portanto, transferências rejeitadas contam como tentativa.
                transfer.MarkAsFailed(validationError, nowUtc);
                await _transferRepository.AddAsync(transfer, ct);
                await _unitOfWork.SaveChangesAsync(ct);
                return;
            }

            sourceAccount.Debit(request.Amount);
            destinationAccount.Credit(request.Amount);
            transfer.MarkAsCompleted(nowUtc);

            _accountRepository.Update(sourceAccount);
            _accountRepository.Update(destinationAccount);
            await _transferRepository.AddAsync(transfer, ct);

            await _unitOfWork.SaveChangesAsync(ct);
        }, cancellationToken);

        return new TransferResponseDto(
            transfer.Id,
            transfer.SourceAccountId,
            sourceAccount?.HolderName,
            transfer.DestinationAccountId,
            destinationAccount?.HolderName,
            transfer.Amount,
            transfer.Status.ToString(),
            transfer.IsScheduled,
            transfer.ScheduledForUtc,
            transfer.CreatedAtUtc,
            transfer.ExecutedAtUtc,
            transfer.CancelledAtUtc,
            transfer.FailureReason,
            transfer.IdempotencyKey);
    }

    public async Task<TransferResponseDto> ScheduleTransferAsync(
        CreateScheduledTransferRequestDto request,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existing = await _transferRepository.GetByIdempotencyKeyAsync(idempotencyKey.Trim(), cancellationToken);
            if (existing is not null)
                return TransferResponseDto.FromEntity(existing);
        }

        var sourceAccount = await _accountRepository.GetByIdAsync(request.SourceAccountId, cancellationToken)
            ?? throw new NotFoundException($"Conta de origem '{request.SourceAccountId}' não encontrada.");

        var destinationAccount = await _accountRepository.GetByIdAsync(request.DestinationAccountId, cancellationToken)
            ?? throw new NotFoundException($"Conta de destino '{request.DestinationAccountId}' não encontrada.");

        var nowUtc = _dateTimeProvider.UtcNow;
        var scheduledUtc = request.ScheduledForUtc.Kind == DateTimeKind.Utc
            ? request.ScheduledForUtc
            : request.ScheduledForUtc.ToUniversalTime();

        var transfer = Transfer.CreateScheduled(
            request.SourceAccountId,
            request.DestinationAccountId,
            request.Amount,
            scheduledUtc,
            nowUtc,
            idempotencyKey);

        var validationError = await ValidateTransferRulesAsync(
            sourceAccount,
            destinationAccount,
            request.Amount,
            nowUtc,
            cancellationToken);

        if (validationError is not null)
            throw new DomainException(validationError);

        await _transferRepository.AddAsync(transfer, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new TransferResponseDto(
            transfer.Id,
            transfer.SourceAccountId,
            sourceAccount.HolderName,
            transfer.DestinationAccountId,
            destinationAccount.HolderName,
            transfer.Amount,
            transfer.Status.ToString(),
            transfer.IsScheduled,
            transfer.ScheduledForUtc,
            transfer.CreatedAtUtc,
            transfer.ExecutedAtUtc,
            transfer.CancelledAtUtc,
            transfer.FailureReason,
            transfer.IdempotencyKey);
    }

    public async Task<TransferResponseDto> CancelScheduledTransferAsync(
        Guid transferId,
        CancellationToken cancellationToken = default)
    {
        var transfer = await _transferRepository.GetByIdAsync(transferId, cancellationToken)
            ?? throw new NotFoundException($"Transferência '{transferId}' não encontrada.");

        transfer.Cancel(_dateTimeProvider.UtcNow);

        _transferRepository.Update(transfer);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return TransferResponseDto.FromEntity(transfer);
    }

    public async Task<TransferResponseDto> ProcessScheduledTransferAsync(
        Guid transferId,
        CancellationToken cancellationToken = default)
    {
        Transfer? transfer = null;

        await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            transfer = await _transferRepository.GetByIdAsync(transferId, ct)
                ?? throw new NotFoundException($"Transferência agendada '{transferId}' não encontrada.");

            if (transfer.Status != Domain.Enums.TransferStatus.Scheduled)
                return;

            var nowUtc = _dateTimeProvider.UtcNow;
            transfer.StartProcessing();

            var sourceAccount = await _accountRepository.GetByIdAsync(transfer.SourceAccountId, ct);
            var destinationAccount = await _accountRepository.GetByIdAsync(transfer.DestinationAccountId, ct);

            if (sourceAccount is null || destinationAccount is null)
            {
                transfer.MarkAsFailed("Conta de origem ou destino não encontrada no momento da execução.", nowUtc);
                _transferRepository.Update(transfer);
                await _unitOfWork.SaveChangesAsync(ct);
                return;
            }

            // No momento da execução, saldo e limite do cheque especial são verificados novamente.
            var validationError = await ValidateTransferRulesAsync(sourceAccount, destinationAccount, transfer.Amount, nowUtc, ct);

            if (validationError is not null)
            {
                transfer.MarkAsFailed(validationError, nowUtc);
                _transferRepository.Update(transfer);
                await _unitOfWork.SaveChangesAsync(ct);
                return;
            }

            sourceAccount.Debit(transfer.Amount);
            destinationAccount.Credit(transfer.Amount);
            transfer.MarkAsCompleted(nowUtc);

            _accountRepository.Update(sourceAccount);
            _accountRepository.Update(destinationAccount);
            _transferRepository.Update(transfer);

            await _unitOfWork.SaveChangesAsync(ct);
        }, cancellationToken);

        return TransferResponseDto.FromEntity(transfer!);
    }

    public async Task<TransferResponseDto> GetByIdAsync(Guid transferId, CancellationToken cancellationToken = default)
    {
        var transfer = await _transferRepository.GetByIdAsync(transferId, cancellationToken)
            ?? throw new NotFoundException($"Transferência '{transferId}' não encontrada.");

        return TransferResponseDto.FromEntity(transfer);
    }

    public async Task<IReadOnlyList<TransferResponseDto>> GetAllAsync(Guid? accountId = null, CancellationToken cancellationToken = default)
    {
        var transfers = await _transferRepository.GetAllAsync(accountId, cancellationToken);
        return transfers.Select(TransferResponseDto.FromEntity).ToList();
    }

    private async Task<string?> ValidateTransferRulesAsync(
        Account sourceAccount,
        Account destinationAccount,
        decimal amount,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        if (!sourceAccount.IsActive)
        {
            return $"A conta de origem está {sourceAccount.GetStatusDescriptionPtBr()} e não pode realizar transferências.";
        }

        if (!destinationAccount.IsActive)
        {
            return $"A conta de destino está {destinationAccount.GetStatusDescriptionPtBr()} e não pode receber transferências.";
        }

        var oneHourAgoUtc = nowUtc.AddHours(-1);
        var isNightPeriod = _dateTimeProvider.IsNightPeriod(nowUtc);
        var periodLabel = isNightPeriod ? "noturno" : "diurno";

        var attemptsInLastHour = await _transferRepository.GetAttemptsInLastHourAsync(
            sourceAccount.Id,
            oneHourAgoUtc,
            cancellationToken);

        var maxAttempts = sourceAccount.GetHourlyAttemptsLimit(isNightPeriod);
        if (attemptsInLastHour >= maxAttempts)
        {
            return $"Limite de tentativas por hora excedido na conta de origem para o período {periodLabel} (máximo: {maxAttempts} tentativas/hora).";
        }

        if (!sourceAccount.HasSufficientFunds(amount))
        {
            return $"Saldo insuficiente na conta de origem. Saldo disponível + cheque especial: R$ {sourceAccount.TotalAvailableFunds:N2} | Valor solicitado: R$ {amount:N2}.";
        }

        var completedAmountInLastHour = await _transferRepository.GetCompletedAmountInLastHourAsync(
            sourceAccount.Id,
            oneHourAgoUtc,
            cancellationToken);

        var maxHourlyAmount = sourceAccount.GetHourlyAmountLimit(isNightPeriod);
        if (completedAmountInLastHour + amount > maxHourlyAmount)
        {
            return $"Limite de valor por hora excedido na conta de origem para o período {periodLabel}. Limite: R$ {maxHourlyAmount:N2} | Já transferido por esta conta na última hora: R$ {completedAmountInLastHour:N2}.";
        }

        return null;
    }
}
