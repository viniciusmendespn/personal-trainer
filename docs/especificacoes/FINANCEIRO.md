Quero criar uma funcionalidade de **Finanças** para o Personal Trainer.

## Objetivo

Permitir que o personal controle mensalidades dos alunos, acompanhe pagamentos, veja histórico financeiro, receba notificações de vencimento e, opcionalmente, integre pagamentos via Pix usando Mercado Pago.

## Requisitos

O personal deve conseguir definir para cada aluno:

* valor do plano;
* recorrência mensal ou anual;
* data de vencimento.

O sistema deve gerar e controlar cobranças automaticamente com base nessas configurações.

Cada cobrança deve ter status:

* pendente (criada x dias antes do vencimento - recomendação 15 dias, mas parametrizável);
* paga;
* vencida.

O personal deve conseguir registrar pagamentos manualmente.

O personal deve poder alterar valor, recorrência e vencimento para cobranças futuras, sem alterar o histórico já registrado.

O aluno deve conseguir visualizar suas cobranças e seu histórico financeiro.

O personal deve conseguir visualizar o histórico financeiro de cada aluno.

O histórico deve exibir valor, recorrência, vencimento, data de pagamento, status, forma de pagamento e origem do pagamento, manual ou Mercado Pago.

## Notificações

O sistema deve notificar personal e aluno quando uma cobrança estiver próxima do vencimento ou vencida.

As notificações devem parar quando a cobrança for marcada como paga.

Reutilizar o padrão de notificações já existente no projeto, se houver.

## Mercado Pago

A integração com Mercado Pago deve ser opcional.

Antes de implementar, analisar o arquivo `MERCADOPAGO_PIX.md` e seguir os padrões existentes no projeto.

Criar uma área de configuração do Mercado Pago no portal do personal.

Nessa tela, o personal deve poder informar seu Access Token do Mercado Pago.

O Access Token deve ser salvo com segurança, usado apenas no backend e nunca exposto no frontend ou em logs.

Na tela de configuração, exibir uma observação informativa:

“Pagamentos via Pix pelo Mercado Pago podem ter taxa de processamento cobrada pelo próprio Mercado Pago. A taxa divulgada atualmente para Pix com QR Code é de aproximadamente 0,49% por transação, mas esse valor pode variar conforme sua conta, condições comerciais ou regras vigentes do Mercado Pago. Consulte sua conta Mercado Pago para confirmar as taxas aplicáveis.”

Quando o Access Token estiver configurado:

* o aluno deve poder gerar Pix para uma cobrança pendente;
* o sistema deve exibir QR Code Pix e código copia e cola;
* o Mercado Pago deve notificar o sistema via webhook após o pagamento;
* o sistema deve validar o pagamento e marcar a cobrança como paga automaticamente;
* o histórico financeiro deve ser atualizado.

Quando o Access Token não estiver configurado:

* a gestão financeira deve continuar funcionando normalmente;
* os pagamentos serão registrados manualmente pelo personal;
* o aluno visualizará suas cobranças, mas sem opção de pagamento via Pix.

Quando a API do Mercado Pago retornar informações de taxa, valor líquido ou valor recebido, salvar essas informações no histórico financeiro da cobrança.

Não fixar a taxa de 0,49% como regra de negócio rígida.

## Antes de implementar

Antes de alterar o código:

1. analisar o arquivo `MERCADOPAGO_PIX.md`;
2. analisar a arquitetura atual do projeto;
3. identificar telas, APIs, banco de dados, componentes e fluxos existentes que podem ser reutilizados;
4. apresentar um plano simples de implementação;
5. só depois iniciar a implementação.

## Importante

* Não quebrar funcionalidades existentes.
* Reutilizar padrões e arquitetura atual sempre que possível.
* Evitar duplicação de lógica.
* Garantir que o histórico financeiro não seja alterado quando o plano do aluno mudar.
* Garantir que funcione com pagamento manual e com Mercado Pago.
* Garantir permissões corretas: aluno vê apenas seus dados, personal vê apenas seus alunos.
* Manter a solução preparada para futuras integrações com outros meios de pagamento.
