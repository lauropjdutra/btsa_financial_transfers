using FinancialTransfers.Domain.Entities;
using FinancialTransfers.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FinancialTransfers.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static readonly Guid AccountLauroId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid AccountBrasilTerrenosId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid AccountMariaOverdraftId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid AccountBlockedId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    public static async Task SeedAsync(AppDbContext dbContext, ILogger logger)
    {
        if (await dbContext.Accounts.AnyAsync())
            return;

        var accounts = new List<Account>
        {
            new(
                holderName: "Lauro Dutra",
                documentNumber: "12345678901",
                initialBalance: 500m,
                overdraftLimit: 1000m,
                status: AccountStatus.Active,
                id: AccountLauroId),

            new(
                holderName: "Brasil Terrenos Holding S.A.",
                documentNumber: "98765432000199",
                initialBalance: 10000m,
                overdraftLimit: 5000m,
                status: AccountStatus.Active,
                id: AccountBrasilTerrenosId),

            new(
                holderName: "Maria Silva",
                documentNumber: "45678912300",
                initialBalance: -800m,
                overdraftLimit: 1000m,
                status: AccountStatus.Active,
                id: AccountMariaOverdraftId),

            new(
                holderName: "Carlos Souza",
                documentNumber: "78912345600",
                initialBalance: 1500m,
                overdraftLimit: 500m,
                status: AccountStatus.Blocked,
                id: AccountBlockedId)
        };

        await dbContext.Accounts.AddRangeAsync(accounts);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Seed inicial de 4 contas bancárias concluído com sucesso.");
    }
}
