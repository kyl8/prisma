PRISMA UI Sound Pack

Arquivos:
- notification.wav  -> nova notificação / correção recebida
- success.wav       -> ação concluída com sucesso
- submit.wav        -> formulário enviado para revisão
- save.wav          -> salvar rascunho
- warning.wav       -> campo obrigatório / atenção
- error.wav         -> erro leve

Sugestão de volume no navegador:
0.18 a 0.30

Exemplo:
const audio = new Audio('/sounds/success.wav');
audio.volume = 0.24;
audio.play().catch(() => {});

Todos os sons deste pack foram sintetizados para este protótipo.
