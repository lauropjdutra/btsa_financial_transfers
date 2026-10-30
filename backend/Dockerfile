FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/FinancialTransfers.Domain/FinancialTransfers.Domain.csproj", "src/FinancialTransfers.Domain/"]
COPY ["src/FinancialTransfers.Application/FinancialTransfers.Application.csproj", "src/FinancialTransfers.Application/"]
COPY ["src/FinancialTransfers.Infrastructure/FinancialTransfers.Infrastructure.csproj", "src/FinancialTransfers.Infrastructure/"]
COPY ["src/FinancialTransfers.Api/FinancialTransfers.Api.csproj", "src/FinancialTransfers.Api/"]

RUN dotnet restore "src/FinancialTransfers.Api/FinancialTransfers.Api.csproj"

COPY . .
WORKDIR "/src/src/FinancialTransfers.Api"
RUN dotnet publish "FinancialTransfers.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FinancialTransfers.Api.dll"]
