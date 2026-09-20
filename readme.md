# Porto Hack Santos 2026

Projeto desenvolvido para o **Porto Hack Santos 2026**, hackathon voltado à criação de soluções para o setor portuário.

## Backend

A branch `backend` contém um serviço Node.js independente. Ela não deriva das
branches `architecture` ou `frontend`.

### Executar

```bash
npm start
```

O serviço usa a porta `3001` por padrão e expõe:

- `GET /health`
- `GET /api/prisma/policy`

O endpoint de política fornece o prompt padrão do PRISMA. Toda análise exige
uma decisão recomendada e previsões quantitativas só são permitidas quando
existirem dados históricos suficientes.

### Testar

```bash
npm test
```
