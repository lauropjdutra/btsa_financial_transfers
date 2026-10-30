using System.Net;
using System.Text.Json;
using FinancialTransfers.Application.Common;
using FinancialTransfers.Domain.Common;

namespace FinancialTransfers.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title) = exception switch
        {
            DomainException => (HttpStatusCode.UnprocessableEntity, "Violação de Regra de Negócio"),
            NotFoundException => (HttpStatusCode.NotFound, "Recurso Não Encontrado"),
            ConcurrencyConflictException => (HttpStatusCode.Conflict, "Conflito de Concorrência Simultânea"),
            _ => (HttpStatusCode.InternalServerError, "Erro Interno no Servidor")
        };

        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Erro inesperado ao processar requisição {Path}", context.Request.Path);
        }
        else
        {
            _logger.LogWarning("Exceção controlada ({Title}): {Message}", title, exception.Message);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var payload = new
        {
            status = (int)statusCode,
            title,
            detail = exception.Message,
            timestampUtc = DateTime.UtcNow
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
