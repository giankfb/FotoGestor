# FotoGestor Financeiro V7

Aplicação web React + Vite publicada no GitHub Pages, com Google Apps Script como API e Google Sheets como banco de dados. Este projeto foi separado do AMVF2; não reutilize a planilha nem a URL de Apps Script da associação.

## Módulos incluídos nesta primeira base
- Painel com eventos próximos e resumo do caixa.
- Agenda de eventos.
- Cadastro de clientes e fornecedores.
- Catálogo de serviços e pacotes.
- Lançamentos de caixa (entradas e saídas).
- Contas a receber e contas a pagar, incluindo valor total e valor já pago.
- Relatório financeiro por mês e impressão / salvar em PDF.
- Configurações básicas do estúdio.

## 1. Criar o banco de dados
1. Acesse `https://script.google.com/` e crie um projeto **novo**, independente do AMVF2.
2. Copie o conteúdo de `Apps-Script-Code.gs` para o editor.
3. Selecione a função `setupFotoGestor` e clique em **Executar**. Autorize as permissões solicitadas.
4. Abra **Registro de execução** e copie a URL da planilha criada. O ID também fica salvo automaticamente em Propriedades do script (`SPREADSHEET_ID`).

## 2. Publicar a API
1. No Apps Script, clique em **Implantar > Nova implantação**.
2. Tipo: **Aplicativo da Web**.
3. Executar como: **Você**.
4. Quem tem acesso: selecione a opção adequada à sua conta e ao seu uso. A interface atual não implementa autenticação própria; por isso, não use dados reais sensíveis até adicionar autenticação e restringir o acesso conforme necessário.
5. Implante e copie a URL terminada em `/exec`.

## 3. Configurar o frontend
1. Abra `src/config.js`.
2. Substitua `COLE_A_URL_DO_NOVO_APPS_SCRIPT_AQUI` pela URL `/exec` da implantação nova.
3. Não use a URL do Apps Script da associação.

## 4. Publicar no GitHub Pages
1. Crie um repositório novo, por exemplo `gestor-fotografia`.
2. Envie os arquivos deste projeto para a branch `main`.
3. Em **Settings > Pages**, configure a publicação por **GitHub Actions**.
4. O workflow `.github/workflows/deploy.yml` publica o site em `https://SEU-USUARIO.github.io/gestor-fotografia/`.
5. O `base` em `vite.config.js` já está definido como `/gestor-fotografia/`. Se o nome do repositório mudar, ajuste esse valor para `/<nome-do-repositorio>/`.

## Desenvolvimento local
```bash
npm install
npm run dev
```
Para testar a compilação:
```bash
npm run build
```

## Observações importantes
- Esta é a primeira base funcional de interface e API, ainda precisa ser testada com a planilha nova antes de usar em produção.
- O cadastro de contas mantém os campos de valor total e valor pago; o controle detalhado de parcelas, histórico de pagamentos e baixa integrada ao caixa é uma próxima etapa.
- A versão atual não implementa login/autorização por usuário. Não armazene dados sensíveis antes de implementar esse controle.
- O projeto original da associação deve permanecer em outro repositório e com seu próprio Apps Script e planilha.

## V14 - correções de relatórios e importação
- Relatórios restaurados para um formato simples e selecionável: Agenda, Datas disponíveis, Contas a receber, Contas a pagar e Caixa.
- Relatórios filtráveis por período e prontos para impressão/PDF.
- Importação do Google continua exclusiva da agenda "eventos".
- Evento importado não cria cobrança automaticamente enquanto o valor contratado estiver zerado.
- Ao editar o evento importado e informar um valor contratado maior que zero, o backend cria/atualiza automaticamente o Contas a Receber, como nos eventos cadastrados diretamente.
- Evento importado recebe uma observação informando que veio do Google e precisa ser completado no FotoGestor.
- A partir daqui, o FotoGestor permanece como sistema principal; Google Agenda funciona como consulta/backup rápido.

## V14.1 — cor inicial dos eventos
- Eventos sem recebimento/financeiro começam em vermelho no Google Calendar.
- Pagamento parcial permanece amarelo.
- Pagamento total permanece verde.
- Eventos cancelados permanecem cinza.
- Eventos de dia inteiro continuam sendo importados/criados como eventos de dia inteiro.


## V15 — Google Calendar bidirecional e agenda 02 EVENTOS
- A agenda do Google usada pelo FotoGestor é exclusivamente `02 EVENTOS`; a agenda principal não é usada.
- O nome da agenda fica centralizado na função `googleCalendarName_()` do Apps Script.
- Valores financeiros nunca são enviados para o Google Calendar.
- Eventos novos/pendentes começam vermelhos; parciais ficam amarelos; pagos ficam verdes; cancelados ficam cinza.
- O evento pode ter data inicial/final e horário inicial/final, permitindo um único cadastro para eventos de vários dias.
- Alterações operacionais no FotoGestor (título, data, horário, duração, local) são refletidas no Google.
- Alterações operacionais feitas no Google são verificadas automaticamente pelo Apps Script a cada 5 minutos e refletidas no FotoGestor.
- O financeiro continua sendo exclusivo do FotoGestor. A sincronização do Google não altera valor, recebimentos, contas a receber ou situação financeira.
- Para eventos de dia inteiro com vários dias, o Google usa corretamente a data final exclusiva internamente, enquanto o FotoGestor mostra a última data do evento.
- Exclusões no Google não apagam automaticamente eventos do FotoGestor, para evitar perda acidental de dados/financeiro.

### V15.1 — cliente no título e datas de múltiplos dias
- O título exibido no Google Calendar passa a usar automaticamente o **cliente/contratante selecionado no FotoGestor**; se ainda não houver cliente, usa o título do evento como fallback.
- Alterações manuais do título no Google não sobrescrevem o vínculo do cliente no FotoGestor.
- A data final do formulário é normalizada para `YYYY-MM-DD` internamente, sendo exibida no padrão brasileiro `DD/MM/AAAA`.
- Corrigido o intervalo de eventos de dia inteiro no Google: um evento de 07/12 a 10/12 ocupa os quatro dias corretamente.
- Importação do Google tenta vincular automaticamente o evento a um cliente já cadastrado quando o título coincide exatamente com o nome do cliente.
- Nenhum valor financeiro é enviado ao Google Calendar.


## V15.2 — importação segura e autorização da sincronização
- Adicionada a permissão `https://www.googleapis.com/auth/script.scriptapp` ao manifesto do Apps Script.
- O acesso normal ao Google Calendar não tenta mais consultar gatilhos a cada chamada; o gatilho é instalado apenas pela autorização/configuração.
- A instalação do gatilho ficou idempotente: mantém um único gatilho de sincronização de 5 minutos.
- Importação do Google protegida com `LockService` e deduplicação por `googleEventId`.
- Botão de importação mostra `Importando...`, fica bloqueado durante a operação e informa que os eventos estão sendo salvos.
- A importação exibe o resultado com quantidade importada e quantidade ignorada.
- O modal identifica a agenda como `02 EVENTOS`.
