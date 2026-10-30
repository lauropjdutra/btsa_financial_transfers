using FinancialTransfers.Domain.Entities;

namespace FinancialTransfers.Application.DTOs;

public record AccountResponseDto(
    Guid Id,
    string HolderName,
    string DocumentNumber,
    decimal Balance,
    decimal OverdraftLimit,
    decimal UsedOverdraft,
    decimal AvailableOverdraft,
    decimal TotalAvailableFunds,
    string Status,
    decimal DaytimeHourlyLimit,
    int DaytimeMaxAttemptsPerHour,
    decimal NighttimeHourlyLimit,
    int NighttimeMaxAttemptsPerHour,
    DateTime CreatedAtUtc)
{
    public static AccountResponseDto FromEntity(Account account) => new(
        account.Id,
        account.HolderName,
        account.DocumentNumber,
        account.Balance,
        account.OverdraftLimit,
        account.UsedOverdraft,
        account.AvailableOverdraft,
        account.TotalAvailableFunds,
        account.Status.ToString(),
        account.DaytimeHourlyLimit,
        account.DaytimeMaxAttemptsPerHour,
        account.NighttimeHourlyLimit,
        account.NighttimeMaxAttemptsPerHour,
        account.CreatedAtUtc);
}

public record CreateAccountRequestDto(
    string HolderName,
    string DocumentNumber,
    decimal InitialBalance,
    decimal OverdraftLimit);

public record UpdateAccountConfigRequestDto(
    decimal OverdraftLimit,
    string Status);
