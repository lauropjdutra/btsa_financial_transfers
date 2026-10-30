using FinancialTransfers.Application.Common;
using FinancialTransfers.Application.DTOs;
using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Domain.Common;
using FinancialTransfers.Domain.Entities;
using FinancialTransfers.Domain.Enums;

namespace FinancialTransfers.Application.Services;

public interface IAccountService
{
    Task<AccountResponseDto> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<AccountResponseDto> CreateAsync(CreateAccountRequestDto request, CancellationToken cancellationToken = default);
    Task<AccountResponseDto> UpdateConfigurationAsync(Guid id, UpdateAccountConfigRequestDto request, CancellationToken cancellationToken = default);
}

public class AccountService : IAccountService
{
    private readonly IAccountRepository _accountRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AccountService(IAccountRepository accountRepository, IUnitOfWork unitOfWork)
    {
        _accountRepository = accountRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<AccountResponseDto> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var account = await _accountRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Conta com ID '{id}' não encontrada.");

        return AccountResponseDto.FromEntity(account);
    }

    public async Task<IReadOnlyList<AccountResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var accounts = await _accountRepository.GetAllAsync(cancellationToken);
        return accounts.Select(AccountResponseDto.FromEntity).ToList();
    }

    public async Task<AccountResponseDto> CreateAsync(CreateAccountRequestDto request, CancellationToken cancellationToken = default)
    {
        var account = new Account(
            request.HolderName,
            request.DocumentNumber,
            request.InitialBalance,
            request.OverdraftLimit);

        await _accountRepository.AddAsync(account, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return AccountResponseDto.FromEntity(account);
    }

    public async Task<AccountResponseDto> UpdateConfigurationAsync(Guid id, UpdateAccountConfigRequestDto request, CancellationToken cancellationToken = default)
    {
        var account = await _accountRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException($"Conta com ID '{id}' não encontrada.");

        if (!Enum.TryParse<AccountStatus>(request.Status, ignoreCase: true, out var parsedStatus))
            throw new DomainException($"Status de conta inválido: '{request.Status}'. Valores aceitos: Active, Blocked, Inactive.");

        account.UpdateOverdraftLimit(request.OverdraftLimit);
        account.ChangeStatus(parsedStatus);

        _accountRepository.Update(account);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return AccountResponseDto.FromEntity(account);
    }
}
