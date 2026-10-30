namespace FinancialTransfers.Application.Interfaces;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
    bool IsNightPeriod(DateTime utcDateTime);
}
