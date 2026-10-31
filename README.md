# Sistema de Transferências Financeiras

Solução completa desenvolvida para o desafio técnico de **Desenvolvedor .NET Pleno**, contemplando uma **API REST em .NET 8 (C#)** e uma interface web corporativa em **React + TypeScript**.

---

## 1. Visão Geral e Decisões Arquiteturais

A solução foi projetada priorizando **clareza, corretude financeira, testabilidade e facilidade de manutenção**, aplicando **Clean Architecture** combinada com táticas do **DDD (Domain-Driven Design)** e princípios **SOLID**:

- **`FinancialTransfers.Domain` (Núcleo de Negócio):** Camada totalmente isolada de frameworks e banco de dados. Contém as entidades ricas `Account` e `Transfer`, encapsulando invariantes críticas (cálculo de cheque especial, cobertura automática de saldo negativo no recebimento, validação de contas ativas, máquina de estados da transferência e emissão de **Domain Events**).
- **`FinancialTransfers.Application` (Casos de Uso):** Orquestra os fluxos de negócio (`TransferService`, `AccountService`), valida limites horários parametrizados por período (diurno vs. noturno), contabiliza tentativas rejeitadas dentro da janela de 1 hora e garante idempotência (`Idempotency-Key`).
- **`FinancialTransfers.Infrastructure` (Persistência Relacional e Mensageria):** Implementa o acesso a dados com **Entity Framework Core 8** e **PostgreSQL (`Npgsql`)**, mapeamento via *Fluent API* com precisão monetária `NUMERIC(18,2)`, controle de concorrência otimista (`ConcurrencyToken`), despacho de *Domain Events* no `UnitOfWork` e fila de mensageria assíncrona em memória com `System.Threading.Channels`.
- **`FinancialTransfers.Api` (Apresentação REST e Workers):** Disponibiliza os endpoints REST documentados via **Swagger/OpenAPI**, tratamento global de exceções (`ExceptionHandlingMiddleware`) e dois serviços em background (`ScheduledTransferPollingWorker` e `ScheduledTransferConsumerWorker`) que revalidam e processam agendamentos vencidos.
- **`FinancialTransfers.Tests` (Testes de Integração):** Suíte automatizada com **xUnit** validando ponta a ponta todos os cenários de negócio exigidos, incluindo concorrência simultânea e uso de cheque especial.

### Tratamento de Concorrência (Duas Transferências Simultâneas)
Para evitar o problema de *gasto duplo* (*race condition*) quando duas transferências tentam utilizar o mesmo saldo simultaneamente:
1. O débito da conta de origem e o crédito da conta de destino ocorrem dentro de uma **transação atômica** (`BeginTransactionAsync` / `CommitAsync`).
2. A entidade `Account` possui um token de versão (`ConcurrencyToken` configurado com `.IsConcurrencyToken()` no EF Core). A cada mutação de saldo (`Debit`/`Credit`), um novo token é gerado. Se duas transações concorrentes lerem o mesmo estado inicial, a segunda atualização afetará 0 linhas no banco relacional, disparando `DbUpdateConcurrencyException`, que é traduzida pelo `UnitOfWork` e pelo middleware para **HTTP `409 Conflict`** com rollback seguro.

---

## 2. Pré-requisitos

- **.NET 8 SDK** (`8.0.x`)
- **PostgreSQL** (versão 14 ou superior)
- **Node.js** (versão 18 ou superior) para o front-end

---

## 3. Como Executar o Projeto Localmente

### Passo 1: Configurar o Banco de Dados PostgreSQL e Executar as Migrations
1. No arquivo `backend/src/FinancialTransfers.Api/appsettings.json`, ajuste a senha do seu PostgreSQL local na string `DefaultConnection`.
2. Abra o terminal na pasta `backend/` e execute a aplicação das migrations:

```bash
cd backend
dotnet ef database update --project src/FinancialTransfers.Infrastructure --startup-project src/FinancialTransfers.Api
```

### Passo 2: Iniciar o Back-end (.NET 8 API)
Ainda na pasta `backend/` (ou pelo Visual Studio executando o projeto `FinancialTransfers.Api`):

```bash
dotnet run --project src/FinancialTransfers.Api --launch-profile http
```
- A API estará disponível em: `http://localhost:5251`
- Documentação **Swagger UI**: `http://localhost:5251/swagger`
- Ao iniciar com o banco conectado, o `DatabaseSeeder` popula automaticamente 4 contas iniciais para facilitar os testes.

### Passo 3: Iniciar o Front-end (React + TypeScript)
Em outro terminal, acesse a pasta `frontend/`:

```bash
cd frontend
npm install
npm run dev
```
- Acesse a interface no navegador em: `http://localhost:5173`

---

## 4. Como Executar os Testes de Integração

Na pasta `backend/`, execute:

```bash
dotnet test
```
Os 10 testes de integração cobrem integralmente os cenários do documento técnico (saldo suficiente, cheque especial, excesso de cheque especial, cobertura de saldo negativo ao receber transferência, limites diurno/noturno, excesso de tentativas contando rejeitadas, revalidação de agendamento sem saldo, idempotência e concorrência simultânea).
