using FinancialTransfers.Application.Interfaces;

namespace FinancialTransfers.Infrastructure.Services;

public class SystemDateTimeProvider : IDateTimeProvider
{
    private static readonly TimeZoneInfo BrazilTimeZone = GetBrazilTimeZone();

    public DateTime UtcNow => DateTime.UtcNow;

    public bool IsNightPeriod(DateTime utcDateTime)
    {
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc),
            BrazilTimeZone);

        // Período diurno: 06:00 às 19:59
        // Período noturno: 20:00 às 05:59
        return localTime.Hour >= 20 || localTime.Hour < 6;
    }

    private static TimeZoneInfo GetBrazilTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");
        }
        catch
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
    }
}
