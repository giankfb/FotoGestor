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

## V15 — sincronização agenda
- Google Calendar fixado na agenda `02 EVENTOS`.
- Valores financeiros nunca são enviados ao Google Calendar.
- FotoGestor continua sendo a fonte oficial do financeiro.
- Sincronização bidirecional dos dados de agenda: título, data, data final, horário, horário final e local.
- A leitura do FotoGestor atualiza automaticamente esses campos a partir do evento correspondente no Google.
- Eventos podem ocupar vários dias como um único cadastro, usando Data de início e Data de término.
- Eventos de dia inteiro continuam como eventos de dia inteiro no Google.
- Cores continuam sob controle do FotoGestor: vermelho pendente, amarelo parcial, verde pago e cinza cancelado.
