/**
 * BOT DE PROSPECÇÃO WHATSAPP — MODO ANTI-SPAM
 * ============================================
 * INSTALAÇÃO:
 *   npm install whatsapp-web.js qrcode-terminal
 *
 * COMO USAR:
 *   node whatsapp-bot.js
 */

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// ════════════════════════════════════════════
//  CONFIGURAÇÕES ANTI-SPAM
// ════════════════════════════════════════════
const CONFIG = {
  // Dispara no máximo X mensagens por sessão (nunca passe de 50/dia)
  mensagensPorSessao: 30,

  // Intervalo entre mensagens: 3 a 7 minutos (ritmo humano real)
  // 30 msgs x ~5min medios = ~2h30 de disparo, igual a um humano
  intervaloMinMs: 3 * 60 * 1000,
  intervaloMaxMs: 7 * 60 * 1000,
  // Pausa longa a cada 8 mensagens (simula "parei pra fazer outra coisa")
  pausaLongaACada: 8,
  pausaLongaMs: 15 * 60 * 1000, // 15 minutos

  fusoHorario: "America/Sao_Paulo",

  // Arquivo de log — controla quem já recebeu (evita reenvio)
  arquivoLog: "./enviados.json",
};

// ════════════════════════════════════════════
//  LISTA DE CONTATOS (adicione os 100 aqui)
//  Formato: "5511999999999" (55 = Brasil + DDD + número)
// ════════════════════════════════════════════
const contatos = [
  "559999999999",
  // ... adicione seus contatos aqui
];

// ════════════════════════════════════════════
//  SAUDAÇÃO DINÂMICA por horário
// ════════════════════════════════════════════
function getSaudacao() {
  const hora = parseInt(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: CONFIG.fusoHorario,
    }).format(new Date()),
    10
  );
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

// ════════════════════════════════════════════
//  VARIAÇÕES DE MENSAGEM
//  O WhatsApp detecta mensagens 100% idênticas em série.
//  O bot sorteia uma variação diferente a cada envio.
// ════════════════════════════════════════════
const variacoesFinal = [
  "Fico à disposição para qualquer dúvida! 😊",
  "Qualquer dúvida é só me chamar! 👋",
  "Estou à disposição caso queira mais informações!",
  "Me avise se quiser saber mais detalhes! 🙂",
];

function getMensagem() {
  const saudacao = getSaudacao();
  const variacao = variacoesFinal[Math.floor(Math.random() * variacoesFinal.length)];

  // -----------------------------------------------------------
  // ✏️  COMPLETE SUA MENSAGEM AQUI
  //
  // O ${saudacao} é trocado automaticamente:
  //   → Se rodar de manhã : "Bom dia, meu nome é Lucas eu gostaria de te convidar para um evento..."
  //   → Se rodar à tarde  : "Boa tarde, meu nome é Lucas eu gostaria de te convidar para um evento..."
  //   → Se rodar à noite  : "Boa noite, meu nome é Lucas eu gostaria de te convidar para um evento..."
  // -----------------------------------------------------------
  return `${saudacao} Aqui é o Lucas da Fiat Viviani! 🚨 FIAT DAY chegando! 🚗🔥

Eu gostaria de te fazer um convite para o evento que ocorrerá no dia 21/03, sábado, das 9h até 15h aqui na Fiat Viviani.

Estamos com um evento especial e por tempo limitado com condições que não aparecem no dia a dia:

✅ Taxa 0% em vários modelos Fiat
✅ Planos de pagamento facilitados
✅ Seminovos com IPVA 2026 totalmente quitado
✅ Ofertas exclusivas válidas apenas no FIAT DAY

É a chance perfeita para trocar de carro fazendo um excelente negócio.

Se você já tem algum modelo em mente, me fala qual é que eu verifico a disponibilidade e já deixo uma condição reservada para você no evento.

Mas preciso ver antes que as melhores ofertas acabem. Qual carro você está pensando? 🚗

Att, Lucas - Fiat Viviani 😊

${variacao}`;
  // -----------------------------------------------------------
}

// ════════════════════════════════════════════
//  CONTROLE DE LOG — evita reenvio duplicado
// ════════════════════════════════════════════
function carregarEnviados() {
  try {
    if (fs.existsSync(CONFIG.arquivoLog)) {
      return JSON.parse(fs.readFileSync(CONFIG.arquivoLog, "utf8"));
    }
  } catch {}
  return [];
}

function salvarEnviado(numero) {
  const lista = carregarEnviados();
  lista.push({ numero, data: new Date().toISOString() });
  fs.writeFileSync(CONFIG.arquivoLog, JSON.stringify(lista, null, 2));
}

function jaRecebeu(numero) {
  return carregarEnviados().some((e) => e.numero === numero);
}

// ════════════════════════════════════════════
//  UTILITÁRIOS
// ════════════════════════════════════════════
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function intervaloAleatorio() {
  return (
    Math.floor(Math.random() * (CONFIG.intervaloMaxMs - CONFIG.intervaloMinMs + 1)) +
    CONFIG.intervaloMinMs
  );
}

function log(msg) {
  const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: CONFIG.fusoHorario });
  console.log(`[${hora}] ${msg}`);
}

// ════════════════════════════════════════════
//  DISPARO COM PROTEÇÕES ANTI-SPAM
// ════════════════════════════════════════════
async function dispararMensagens(client) {
  const pendentes = contatos.filter((n) => !jaRecebeu(n));
  const total = Math.min(pendentes.length, CONFIG.mensagensPorSessao);

  if (total === 0) {
    log("✅ Todos os contatos já receberam a mensagem!");
    return;
  }

  log(`🚀 Iniciando: ${total} mensagens agora | ${pendentes.length - total} ficam para amanhã\n`);

  for (let i = 0; i < total; i++) {
    const numero = pendentes[i];
    const chatId = `${numero}@c.us`;

    try {
      // Envia o banner primeiro
      const bannerPath = path.join(__dirname, "banner.png");
      if (fs.existsSync(bannerPath)) {
        const banner = MessageMedia.fromFilePath(bannerPath);
        await client.sendMessage(chatId, banner);
        await esperar(3000); // 3 segundos entre imagem e texto
      }
      // Envia o texto da mensagem
      await client.sendMessage(chatId, getMensagem());
      salvarEnviado(numero);
      log(`✅ [${i + 1}/${total}] Enviado → ${numero}`);
    } catch (err) {
      log(`❌ [${i + 1}/${total}] Falha → ${numero}: ${err.message}`);
    }

    // Pausa longa a cada 10 mensagens
    if ((i + 1) % CONFIG.pausaLongaACada === 0 && i < total - 1) {
      const min = Math.round(CONFIG.pausaLongaMs / 60000);
      log(`\n⏸️  Pausa de ${min} min para não acionar filtros do WhatsApp...\n`);
      await esperar(CONFIG.pausaLongaMs);
    } else if (i < total - 1) {
      const espera = intervaloAleatorio();
      log(`   ⏱️  Próximo em ${Math.round(espera / 1000)}s...`);
      await esperar(espera);
    }
  }

  const restantes = pendentes.length - total;
  log(
    `\n🎉 Sessão concluída! ${
      restantes > 0
        ? `Rode novamente amanhã para os ${restantes} restantes.`
        : "Todos os contatos foram atingidos!"
    }`
  );
}

// ════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\n📱 Escaneie o QR Code com seu WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => log("🔐 Autenticado!"));

client.on("ready", async () => {
  log("✅ WhatsApp conectado!\n");
  await dispararMensagens(client);
});

client.on("auth_failure", (msg) => log(`❌ Falha na autenticação: ${msg}`));

client.initialize();
