using FinancialTransfers.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinancialTransfers.Infrastructure.Persistence.Configurations;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.HolderName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(a => a.DocumentNumber)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(a => a.DocumentNumber)
            .IsUnique();

        builder.Property(a => a.Balance)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.OverdraftLimit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(a => a.DaytimeHourlyLimit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.DaytimeMaxAttemptsPerHour)
            .IsRequired();

        builder.Property(a => a.NighttimeHourlyLimit)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.NighttimeMaxAttemptsPerHour)
            .IsRequired();

        builder.Property(a => a.CreatedAtUtc)
            .IsRequired();

        // Controle de Concorrência Otimista para lidar com transferências simultâneas.
        builder.Property(a => a.ConcurrencyToken)
            .IsConcurrencyToken()
            .IsRequired();

        builder.Ignore(a => a.DomainEvents);
        builder.Ignore(a => a.UsedOverdraft);
        builder.Ignore(a => a.AvailableOverdraft);
        builder.Ignore(a => a.TotalAvailableFunds);
        builder.Ignore(a => a.IsActive);
    }
}
