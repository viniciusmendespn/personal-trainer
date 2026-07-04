# Promo Codes e Indicações — Necessidade

Quero implementar no CoachPilot um sistema de promo codes para campanha de lançamento e crescimento por indicação.

## Objetivo

Permitir que usuários indiquem outros personais usando um promo code próprio. O indicado ganha 1 mês grátis do plano associado ao código e, se virar assinante pagante desse plano, o usuário que indicou também ganha 1 mês grátis.

Hoje existe apenas o plano Gestão Pro, mas a estrutura deve permitir outros planos no futuro.

## Regras principais

* Todo usuário cadastrado deve ter um promo code fixo próprio para a campanha de indicação.
* Esse promo code pode ser compartilhado com vários outros usuários.
* O usuário não pode usar o próprio promo code.
* Cada usuário só pode usar um promo code por campanha.
* Na campanha de indicação, cada usuário só pode usar um promo code de indicação uma única vez.
* Cada promo code deve estar associado a um plano específico.
* Hoje, o promo code de indicação deve conceder 1 mês grátis do plano Gestão Pro.
* No futuro, poderão existir promo codes associados a outros planos.
* O benefício de indicação deve valer apenas para o plano associado ao código, sem add-ons.
* Outros tipos de promo codes podem existir no futuro, como campanhas especiais, bônus administrativos ou promoções temporárias.
* O uso de um promo code de indicação não deve impedir o usuário de usar outros tipos de promo codes futuramente, desde que respeitem as regras específicas de cada campanha.
* Após o indicado pagar o primeiro mês do plano associado ao promo code, o indicador ganha automaticamente 1 mês grátis.
* O indicador deve receber uma notificação avisando que ganhou 1 mês grátis porque um usuário virou assinante usando seu código.

## Regra de campanha dos promo codes

Cada promo code deve estar vinculado a uma campanha.

Exemplos de campanhas:

* campanha de indicação;
* campanha de lançamento;
* campanha Black Friday;
* campanha de parceiro;
* bônus administrativo;
* campanha de reativação.

A regra principal deve ser:

* o usuário pode usar apenas 1 promo code por campanha;
* o usuário não pode usar mais de um código dentro da mesma campanha;
* o uso de um código em uma campanha não impede o uso de códigos de outras campanhas no futuro.

Exemplo:

Na campanha de indicação, o usuário pode usar apenas um código de indicação para ganhar 1 mês grátis do plano Gestão Pro.

Depois disso, ele não poderá usar outro código de indicação novamente.

Porém, no futuro, ele ainda poderá usar outros promo codes de campanhas diferentes, se forem válidos, como Black Friday, bônus administrativo ou campanha especial.

Isso permite que o sistema seja flexível para novas promoções, sem permitir abuso dentro da mesma campanha.

## Regra de plano dos promo codes

Cada promo code deve estar associado a um plano específico.

Hoje, o plano disponível é o Gestão Pro.

Mesmo assim, a estrutura deve permitir que no futuro existam promo codes para outros planos.

Exemplos:

* promo code para Gestão Pro;
* promo code para outro plano futuro;
* promo code de campanha associado a um plano específico;
* promo code de parceiro associado a um plano específico.

O benefício concedido pelo promo code deve ser aplicado apenas ao plano definido no próprio código ou na campanha vinculada ao código.

Isso evita que um código criado para um plano específico seja usado indevidamente em outro plano no futuro.

## Necessidade de estrutura flexível

O sistema deve ter uma forma genérica de aplicar promo codes que concedem dias de assinatura grátis para um plano específico.

Isso deve permitir criar outros códigos no futuro, com diferentes quantidades de dias e planos, como:

* 7 dias grátis;
* 15 dias grátis;
* 30 dias grátis;
* 45 dias grátis;
* campanhas especiais;
* códigos de parceiros;
* bônus manuais;
* códigos associados a planos futuros.

Cada promo code deve carregar de forma segura a informação de:

* campanha associada;
* plano associado;
* quantidade de dias concedidos;
* regras de uso.

Essas informações não devem depender de dados enviados pelo frontend.

## Fluxos necessários

### Cadastro

Ao criar uma conta, o usuário já deve receber automaticamente seu promo code fixo para compartilhar.

Esse código deve pertencer à campanha de indicação e, inicialmente, estar associado ao plano Gestão Pro.

### Uso do promo code

O usuário deve conseguir inserir um promo code na tela de assinatura.

Se o código for válido, o sistema deve aplicar os dias grátis ao plano associado ao promo code.

Hoje, esse plano será o Gestão Pro.

### Recompensa por indicação

Quando o usuário indicado pagar o primeiro mês do plano associado ao promo code, o sistema deve identificar quem indicou e adicionar 30 dias grátis ao indicador.

Hoje, essa recompensa será aplicada ao plano Gestão Pro.

### Notificação

O indicador deve ser avisado quando ganhar o benefício.

Mensagem sugerida:

"Boa! Um personal assinou o CoachPilot usando seu código. Você ganhou 30 dias grátis no plano Gestão Pro."

## Tela para o usuário

Criar uma área simples de "Indique e Ganhe", mostrando:

* código do usuário;
* botão para copiar;
* explicação do benefício;
* quantidade de indicações;
* quantidade de meses grátis ganhos.

Texto sugerido:

"Compartilhe seu código com outros personais. Eles ganham 30 dias grátis no CoachPilot Pro e, quando virarem assinantes, você também ganha 30 dias grátis."

## Restrições importantes

* Impedir uso duplicado de promo code pelo mesmo usuário dentro da mesma campanha.
* Impedir uso do próprio código.
* Garantir que cada promo code esteja associado a uma campanha.
* Garantir que cada promo code esteja associado a um plano específico.
* Garantir que o benefício seja aplicado apenas ao plano associado ao código.
* Garantir que a recompensa do indicador só aconteça após pagamento confirmado do plano associado ao código.
* Evitar recompensa duplicada caso o webhook de pagamento seja processado mais de uma vez.
* Permitir desativar ou limitar promo codes futuros.
* Registrar histórico de uso dos códigos e benefícios concedidos.

## Resultado esperado

Criar uma base de crescimento por indicação em que:

* todo usuário vira um potencial divulgador;
* novos usuários têm incentivo para testar o plano Gestão Pro;
* usuários ativos têm incentivo real para indicar;
* o sistema fica preparado para campanhas futuras com promo codes de diferentes durações;
* o sistema fica preparado para promo codes associados a diferentes planos no futuro.
