using FinancialTransfers.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinancialTransfers.Infrastructure.Persistence.Configurations;

public class TransferConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> builder)
    {
        builder.ToTable("transfers");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Amount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(t => t.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.IsScheduled)
            .IsRequired();

        builder.Property(t => t.ScheduledForUtc);

        builder.Property(t => t.CreatedAtUtc)
            .IsRequired();

        builder.Property(t => t.ExecutedAtUtc);

        builder.Property(t => t.CancelledAtUtc);

        builder.Property(t => t.FailureReason)
            .HasMaxLength(500);

        builder.Property(t => t.IdempotencyKey)
            .HasMaxLength(100);

        builder.HasIndex(t => t.IdempotencyKey)
            .IsUnique()
            .HasFilter("\"IdempotencyKey\" IS NOT NULL");

        builder.HasIndex(t => new { t.SourceAccountId, t.CreatedAtUtc });
        builder.HasIndex(t => new { t.Status, t.ScheduledForUtc });

        builder.HasOne(t => t.SourceAccount)
            .WithMany()
            .HasForeignKey(t => t.SourceAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.DestinationAccount)
            .WithMany()
            .HasForeignKey(t => t.DestinationAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(t => t.DomainEvents);
    }
}
