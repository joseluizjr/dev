// ==========================================
// VARIÁVEIS E CONSTANTES GLOBAIS
// ==========================================

// Variáveis do script.js
const inputClienteTable = [];
let relatorioPerformanceTable = [];
let relatorioOtimizado = [];

// Chart Front
let cdiFront = [];
let ibovespaFront = [];
let imabFront = [];
let experienteFront = [];
let moderadoFront = [];
let conservadorFront = [];
let portfolioFront = [];
let selecaoPotencialFront = [];
let selecaoEquilibrioFront = [];
let selecaoCautelaFront = [];

// Chart Drawdown
let experienteDrawdown = [];
let moderadoDrawdown = [];
let conservadorDrawdown = [];
let portfolioDrawdown = [];
let selecaoPotencialDrawdown = [];
let selecaoEquilibrioDrawdown = [];
let selecaoCautelaDrawdown = [];

// Variáveis do simulador.js
var inputRangeEl = [];
var buttonRangeEl = document.querySelector(".js-walletComposition-button");
const buttonsPeriods = document.querySelector(".filterPeriods");

const MAX_VALUE = 10000;
const diasUteis = 252;
const totalLinhas = 0;
const filterPeriodLength = 63;
const RAIZ = Math.sqrt(diasUteis);

// Períodos - declaração única
let fixedPeriod = null; // Período será definido dinamicamente baseado na disponibilidade
let filterPeriod = null; // Período para os filtros

// Arrays de dados - declaração única
let meuPortfolioDiario = [];
let meuPortfolioDiarioImab = [];
let meuPortfolioDiarioIbov = [];
let volatilidadeArray = [];
let imabVolatilidadeArray = [];
let ibovVolatilidadeArray = [];

// Outras variáveis
const tableObject = {};
const errorMessage = "Erro ao processar dados:";

// Variáveis declaradas para resolver erros de lint
const Highcharts = window.Highcharts; // Assuming Highcharts is available globally

// Variável para controlar se o simulador foi inicializado
let simuladorInitialized = false;

// ==========================================
// FUNÇÕES DE VALIDAÇÃO DE PERÍODOS
// ==========================================

// Função para calcular períodos disponíveis baseado na data de início
function calculateAvailablePeriods(startDateTimestamp) {
  const now = new Date();
  const startDate = new Date(startDateTimestamp);
  const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  
  const availablePeriods = [];
  
  // Verifica cada período
  if (monthsDiff >= 3) availablePeriods.push('prof3m');
  if (monthsDiff >= 6) availablePeriods.push('prof6m');
  if (monthsDiff >= 12) availablePeriods.push('prof12m');
  if (monthsDiff >= 24) availablePeriods.push('prof24m');
  if (monthsDiff >= 36) availablePeriods.push('prof36m');
  
  // YTD sempre disponível se iniciou no ano atual ou anteriores
  if (startDate.getFullYear() <= now.getFullYear()) {
    availablePeriods.push('profYTD');
  }
  
  return availablePeriods;
}

// Função para verificar se um período está disponível para fundos selecionados
function isPeriodAvailableForSelectedFunds(periodValue) {
  const selectedFunds = [];
  
  // Coleta fundos com valor > 0
  const rangeInputs = document.querySelectorAll('input[data-type="range-portfolio"]');
  rangeInputs.forEach(input => {
    if (parseFloat(input.value) > 0) {
      const fundId = input.id.replace('fund-', '');
      const fund = window.portfolio?.find(f => f.id === fundId);
      if (fund) {
        selectedFunds.push(fund);
      }
    }
  });
  
  // Se nenhum fundo selecionado, permite todos os períodos
  if (selectedFunds.length === 0) {
    return true;
  }
  
  // Verifica se todos os fundos selecionados suportam o período
  return selectedFunds.every(fund => {
    const availablePeriods = calculateAvailablePeriods(fund.startDate);
    return availablePeriods.includes(periodValue);
  });
}

// Função para atualizar estado dos botões de período
function updatePeriodButtonsState() {
  const periodButtons = document.querySelectorAll('.filter-period-button');
  let hasEnabledButton = false;
  let fallbackButton = null;
  
  periodButtons.forEach(button => {
    const periodValue = button.getAttribute('data-value');
    const isAvailable = isPeriodAvailableForSelectedFunds(periodValue);
    
    if (isAvailable) {
      button.classList.remove('disabled');
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      if (!hasEnabledButton) {
        fallbackButton = button;
        hasEnabledButton = true;
      }
    } else {
      button.classList.add('disabled');
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      // Se o botão desabilitado estava ativo, remove a classe active
      if (button.classList.contains('active')) {
        button.classList.remove('active');
      }
    }
  });
  
  // Se nenhum botão ativo está habilitado, ativa o primeiro disponível
  const activeButton = document.querySelector('.filter-period-button.active:not(.disabled)');
  if (!activeButton && fallbackButton) {
    fallbackButton.classList.add('active');
    filterPeriod = fallbackButton.getAttribute('data-value');
    // Regenera os gráficos com o novo período
    regenerateChartsWithFilter();
  }
}

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================

function convertToTimestamp(days) {
  const baseDate = new Date(1899, 11, 30); // Excel date system starts from Dec 30, 1899
  return baseDate.getTime() + days * 86400000; // Convert days to milliseconds
}

function obterValorInput(input) {
  const valor = document.getElementById(input)?.value || 0; // A função pegando o valor, ou retornando 0 se vazio
  return isNaN(Number.parseFloat(valor)) ? 0 : Number.parseFloat(valor);
}

function dateToTimestamp(dateString) {
  const baseDate = new Date(1899, 11, 30); // Excel start date
  const [year, month, day] = dateString.split("-").map(Number);
  const inputDate = new Date(year, month - 1, day); // Criação no fuso local
  const daysDifference = (inputDate - baseDate) / 86400000;
  return convertToTimestamp(daysDifference);
}

function formatTimestamp(timestamp, locale = "en-US") {
  const date = new Date(timestamp);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // mês começa em 0
  const year = date.getFullYear();

  if (locale.toLowerCase() === "pt-br") {
    return `${day}/${month}/${year}`; // dd/mm/yyyy
  } else {
    return `${month}/${day}/${year}`; // mm/dd/yyyy
  }
}

function formatNumber(value) {
  return value.toFixed(5).replace(".", ",");
}

function updateCellText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.innerText = value;
}

// ==========================================
// FUNÇÕES DE CÁLCULO
// ==========================================

function calculateWalletComposition() {
  let total = 0;

  // Soma os valores dos sliders
  inputRangeEl.forEach((range) => {
    total += Number.parseFloat(range.value);
  });

  // Arredonda para 2 casas decimais
  total = Math.round(total * 100) / 100;

  // Garante que o total nunca ultrapasse 100%
  if (total > 100) {
    total = 100;
  }

  // Atualiza o estado visual da composição
  const compositionElement = document.querySelector(".js-walletComposition");
  const messageElement = document.querySelector(
    ".js-walletComposition-message"
  );

  if (compositionElement) {
    compositionElement.classList.remove("positive", "negative");
  }
  if (messageElement) {
    messageElement.classList.remove("positive", "negative");
  }

  if (total === 100) {
    renderMessageSuccess();

    const existingTooltip = buttonRangeEl?.querySelector(".tooltip");
    if (existingTooltip) {
      existingTooltip.remove();
    }
  } else {
    if (messageElement) {
      messageElement.innerHTML = `Composição inválida. <br /> A composição total deve ser de 100%`;
      messageElement.classList.add("negative");
    }
    if (compositionElement) {
      compositionElement.classList.add("negative");
    }

    // Adiciona tooltip se não existir
    if (buttonRangeEl && !buttonRangeEl.querySelector(".tooltip-content")) {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip-content";

      const tooltipText = document.createElement("p");
      tooltipText.innerHTML =
        "Composição inválida.<br />A composição total deve ser de 100%";
      tooltip.appendChild(tooltipText);
      buttonRangeEl.appendChild(tooltip);
    }
  }

  // Desabilita ou habilita o botão com base no total
  if (buttonRangeEl) {
    buttonRangeEl.disabled = total !== 100;
  }

  if (buttonsPeriods) {
    if (total !== 100) {
      buttonsPeriods.classList.add("disabled");
    } else {
      buttonsPeriods.classList.remove("disabled");
    }
  }

  // Atualiza a exibição
  if (compositionElement) {
    compositionElement.innerHTML = total + "%";
  }
}

function calcularDiferencaDiaria(portfolio) {
  const resultados = [];

  for (let i = 1; i < portfolio.length; i++) {
    const dataAtual = portfolio[i][0];
    const valorAtual = portfolio[i][1];
    const valorAnterior = portfolio[i - 1][1];

    const diferenca = valorAtual / valorAnterior - 1;

    resultados.push([dataAtual, diferenca]);
  }

  return resultados;
}

// Função para calcular o desvio padrão (volatilidade diária)
function calculaVolatilidadeRolling(type, portfolio) {
  if (type === 'volatilidadeArray') {
    volatilidadeArray = [];
  } else if (type === 'ibovVolatilidadeArray') {
    ibovVolatilidadeArray = [];
  } else {
    imabVolatilidadeArray = [];
  }
  const volatilidade = [];
  // const filterPeriodLength = window.BaseRetornosDiarios?.profitabilitiesByPeriod?.prof3m?.length || 0;

  for (let i = filterPeriodLength - 1; i < portfolio.length; i++) {
    const janela = portfolio.slice(i - filterPeriodLength + 1, i + 1);

    const retornos = janela.map(([_, val]) => val).filter((val) => typeof val === "number" && !isNaN(val));

    if (retornos.length === 0) continue;

    const media = retornos.reduce((acc, val) => acc + val, 0) / retornos.length;
    const variancia = retornos.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / retornos.length;
    const desvioPadrao = Math.sqrt(variancia);
    const volatilidadeAnualizada = desvioPadrao * Math.sqrt(252) * 100;

    const timestamp = portfolio[i][0];
    volatilidade.push([timestamp, volatilidadeAnualizada]);
  }

  return volatilidade;
}

// ==========================================
// FUNÇÕES DE GERAÇÃO DE GRÁFICOS
// ==========================================

// generate line charts
const generateLineCharts = (containerId) => {
  if (!window.Highcharts) {
    console.error("Highcharts não está disponível");
    return;
  }

  Highcharts.stockChart(containerId, {
    chart: {
      backgroundColor: null,
      zoomType: null,
      events: {
        load: function () {
          // Bloqueia o scroll do mouse para zoom
          this.container.onwheel = (e) => {
            e.preventDefault();
          };
        },
      },
    },
    title: { text: "" },
    credits: { enabled: false },
    subtitle: { text: "" },
    rangeSelector: { enabled: false },
    navigator: { enabled: false },
    exporting: { enabled: false },
    scrollbar: { enabled: false },

    yAxis: {
      opposite: false,
      gridLineColor: "#071115",
      labels: {
        formatter: function () {
          return this.value + "%";
        },
        style: {
          fontSize: "18px",
          color: "#000",
        },
      },
    },

    xAxis: {
      gridLineColor: "#071115",
      labels: {
        formatter: function () {
          return Highcharts.dateFormat("%d/%m/%y", this.value); // Formato: dd.mm.yy
        },
        style: {
          color: "#000",
        },
      },
      type: "datetime",
      tickPixelInterval: 100,
    },

    legend: {
      enabled: true,
      layout: "horizontal",
      align: "center",
      verticalAlign: "bottom",
      itemStyle: {
        color: "#000",
        fontSize: "14px",
      },
    },

    tooltip: {
      valueDecimals: 2,
      valueSuffix: "%",
      xDateFormat: "%d/%m/%Y",
    },

    series: [
      {
        name: "Meu Portfólio",
        data: volatilidadeArray,
        color: window.colors?.[0] || "#ED7020",
      },
      {
        name: "IBOV",
        data: ibovVolatilidadeArray,
        color: window.colorsIndexes?.[1] || "#ADB6BB",
      },
      {
        name: "IMA-B",
        data: imabVolatilidadeArray,
        color: window.colorsIndexes?.[2] || "#F4A766",
      },
    ],
  });
};

// generate line charts
const generateLineChartsVolatilidade = (containerId) => {
  if (!window.Highcharts) {
    console.error("Highcharts não está disponível");
    return;
  }

  Highcharts.stockChart(containerId, {
    chart: {
      backgroundColor: null,
      zoomType: null,
      events: {
        load: function () {
          // Bloqueia o scroll do mouse para zoom
          this.container.onwheel = (e) => {
            e.preventDefault();
          };
        },
      },
    },
    title: { text: "" },
    credits: { enabled: false },
    subtitle: { text: "" },
    rangeSelector: { enabled: false },
    navigator: { enabled: false },
    exporting: { enabled: false },
    scrollbar: { enabled: false },

    yAxis: {
      opposite: false,
      gridLineColor: "#071115",
      labels: {
        formatter: function () {
          return this.value + "%";
        },
        style: {
          fontSize: "18px",
          color: "#000",
        },
      },
    },

    xAxis: {
      gridLineColor: "#071115",
      labels: {
        formatter: function () {
          return Highcharts.dateFormat("%d/%m/%y", this.value); // Formato: dd.mm.yy
        },
        style: {
          color: "#000",
        },
      },
      type: "datetime",
      tickPixelInterval: 100,
    },

    legend: {
      enabled: true,
      layout: "horizontal",
      align: "center",
      verticalAlign: "bottom",
      itemStyle: {
        color: "#000",
        fontSize: "14px",
      },
    },

    tooltip: {
      valueDecimals: 2,
      valueSuffix: "%",
      xDateFormat: "%d/%m/%Y",
    },

    series: [
      {
        name: "Meu Portfólio",
        data: volatilidadeArray,
        color: window.colors?.[0] || "#ED7020",
      },
      {
        name: "IBOV",
        data: ibovVolatilidadeArray,
        color: window.colorsIndexes?.[1] || "#ADB6BB",
      },
      {
        name: "IMA-B",
        data: imabVolatilidadeArray,
        color: window.colorsIndexes?.[2] || "#F4A766",
      },
    ],
  });
};

// ==========================================
// FUNÇÕES DE GERAÇÃO DE TABELAS
// ==========================================

// Dados da tabela
const tableHTMLVolatility = `
      <div class="table-container" style="width: 100%; display: inline-block;">
        <!-- Tabela de valores -->
          <div class="table-box d-none">
            <table>
              <thead>
                <tr>
                  <th colspan="5">Volatilidade</th>
                </tr>
              </thead>
              <tbody>
                <tr class="section-title">
                  <td colspan="5">Portfólio</td>
                </tr>
                <tr class="portfolio">
                  <td class="linha-1 endDate">-</td>
                  <td class="linha-1 startDate">-</td>
                  <td class="linha-1 end-value">-</td>
                  <td class="linha-1 start-value">-</td>
                </tr>
                <tr class="portfolio">
                  <td class="linha-2 endDate">-</td>
                  <td class="linha-2 startDate">-</td>
                  <td class="linha-2 end-value">-</td>
                  <td class="linha-2 start-value">-</td>
                </tr>
                <tr class="portfolio">
                  <td class="linha-3 endDate">-</td>
                  <td class="linha-3 startDate">-</td>
                  <td class="linha-3 end-value">-</td>
                  <td class="linha-3 start-value">-</td>
                </tr>
                <tr class="portfolio">
                  <td class="linha-4 endDate">-</td>
                  <td class="linha-4 startDate">-</td>
                  <td class="linha-4 end-value">-</td>
                  <td class="linha-4 start-value">-</td>
                </tr>
                <tr class="portfolio d-none">
                  <td class="linha-5 endDate">-</td>
                  <td class="linha-5 startDate">-</td>
                  <td class="linha-5 end-value">-</td>
                  <td class="linha-5 start-value">-</td>
                </tr>
                <tr class="section-title">
                  <td colspan="4">CDI</td>
                </tr>
                <tr class="cdi">
                  <td class="linha-1 endDate">-</td>
                  <td class="linha-1 startDate">-</td>
                  <td class="linha-1 end-value">-</td>
                  <td class="linha-1 start-value">-</td>
                </tr>
                <tr class="cdi">
                  <td class="linha-2 endDate">-</td>
                  <td class="linha-2 startDate">-</td>
                  <td class="linha-2 end-value">-</td>
                  <td class="linha-2 start-value">-</td>
                </tr>
                <tr class="cdi">
                  <td class="linha-3 endDate">-</td>
                  <td class="linha-3 startDate">-</td>
                  <td class="linha-3 end-value">-</td>
                  <td class="linha-3 start-value">-</td>
                </tr>
                <tr class="cdi">
                  <td class="linha-4 endDate">-</td>
                  <td class="linha-4 startDate">-</td>
                  <td class="linha-4 end-value">-</td>
                  <td class="linha-4 start-value">-</td>
                </tr>
                <tr class="cdi d-none">
                  <td class="linha-5 endDate">-</td>
                  <td class="linha-5 startDate">-</td>
                  <td class="linha-5 end-value">-</td>
                  <td class="linha-5 start-value">-</td>
                </tr>
                <tr class="section-title">
                  <td colspan="4">IBOV</td>
                </tr>
                <tr class="ibov">
                  <td class="linha-1 endDate">-</td>
                  <td class="linha-1 startDate">-</td>
                  <td class="linha-1 end-value">-</td>
                  <td class="linha-1 start-value">-</td>
                </tr>
                <tr class="ibov">
                  <td class="linha-2 endDate">-</td>
                  <td class="linha-2 startDate">-</td>
                  <td class="linha-2 end-value">-</td>
                  <td class="linha-2 start-value">-</td>
                </tr>
                <tr class="ibov">
                  <td class="linha-3 endDate">-</td>
                  <td class="linha-3 startDate">-</td>
                  <td class="linha-3 end-value">-</td>
                  <td class="linha-3 start-value">-</td>
                </tr>
                <tr class="ibov">
                  <td class="linha-4 endDate">-</td>
                  <td class="linha-4 startDate">-</td>
                  <td class="linha-4 end-value">-</td>
                  <td class="linha-4 start-value">-</td>
                </tr>
                <tr class="ibov d-none">
                  <td class="linha-5 endDate">-</td>
                  <td class="linha-5 startDate">-</td>
                  <td class="linha-5 end-value">-</td>
                  <td class="linha-5 start-value">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tabela de percentuais -->
          <div class="table-box">
            <table class="percentage-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Portfólio</th>
                  <th>CDI</th>
                  <th>IBOV</th>
                </tr>
              </thead>
              <tbody>
                <tr class="linha-3m">
                  <td>3M</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
                <tr class="linha-6m">
                  <td>6M</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
                <tr class="linha-12m">
                  <td>12M</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
                <tr class="linha-24m">
                  <td>24M</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
                <tr class="linha-36m">
                  <td>36M</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
                <tr class="linha-YTD">
                  <td>YTD</td>
                  <td class="item-1">-</td>
                  <td class="item-2">-</td>
                  <td class="item-3">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

// Generate table
const generateTableHistory = (data) => {
  // Verifica se o elemento tableContainer existe
  const tableContainer = document.getElementById("tableContainer");
  if (!tableContainer) {
    // console.log("Elemento tableContainer não encontrado - não estamos na página de relatório");
    return;
  }

  // Verifica se há dados suficientes para gerar a tabela
  if (!portfolioFront || portfolioFront.length === 0) {
    console.warn("Dados do portfolio não estão disponíveis para gerar a tabela");
    return;
  }

  // Inserindo a tabela no DOM
  tableContainer.innerHTML = tableHTMLVolatility;
};

function renderFrontMonth() {
  const tbody = document.querySelector("#tableContainer tbody");
  if (!tbody) {
    console.error("Elemento tbody não encontrado");
    return;
  }

  tbody.innerHTML = ""; // Limpa o conteúdo anterior

  portfolioFront.forEach((item, index) => {
    const [timestamp, portfolioValue] = item;
    const cdiValue = cdiFront?.[index]?.[1] || 1;
    const ibovValue = ibovespaFront?.[index]?.[1] || 1;

    const tr = document.createElement("tr");
    tr.classList.add(`linha-${index}`);

    // Início
    const tdInicio = document.createElement("td");
    tdInicio.classList.add("inicio");
    tdInicio.innerText = formatTimestamp(timestamp, "pt-br");
    tr.appendChild(tdInicio);

    // Portfolio performance
    const perfPortfolio = (portfolioValue / portfolioFront[0][1] - 1) * 100;
    const tdPortfolio = document.createElement("td");
    tdPortfolio.classList.add("portfolio");
    tdPortfolio.innerText = perfPortfolio.toFixed(2).replace(".", ",") + "%";
    tr.appendChild(tdPortfolio);

    // CDI performance
    const perfCDI = (cdiValue / cdiFront[0][1] - 1) * 100;
    const tdCDI = document.createElement("td");
    tdCDI.classList.add("indice-cdi");
    tdCDI.innerText = perfCDI.toFixed(2).replace(".", ",") + "%";
    tr.appendChild(tdCDI);

    // IBOV (opcional: substitua com dados reais se houver)
    const perfIBOV = (ibovValue / ibovespaFront[0][1] - 1) * 100;
    const tdIBOV = document.createElement("td");
    tdIBOV.classList.add("indice-ibov");
    tdIBOV.innerText = perfIBOV.toFixed(2).replace(".", ",") + "%";
    tr.appendChild(tdIBOV);

    tbody.appendChild(tr);
  });
}

// Função principal que monta o volatilidadeArray
function renderFrontMonthTable() {
  if (!window.BaseRetornosDiarios?.profitabilitiesByPeriod) {
    console.error("BaseRetornosDiarios não está disponível");
    return;
  }

  // Verifica se estamos na página que tem os elementos necessários
  const tableExists = document.getElementById("tableContainer");
  const volatilityChartExists = document.getElementById("volatilidadeDiaria");
  
  if (!tableExists && !volatilityChartExists) {
    // console.log("Não estamos na página de relatórios, pulando renderFrontMonthTable");
    return;
  }

  const { prof3m, prof6m, prof12m, prof24m, prof36m, profYTD } = window.BaseRetornosDiarios.profitabilitiesByPeriod;

  meuPortfolioDiario = [];
  meuPortfolioDiarioImab = [];
  meuPortfolioDiarioIbov = [];
  volatilidadeArray = [];
  imabVolatilidadeArray = [];
  ibovVolatilidadeArray = [];

  const periods = [
    { label: "3m", offset: prof3m?.length - 1 || 0 },
    { label: "6m", offset: prof6m?.length - 1 || 0 },
    { label: "12m", offset: prof12m?.length - 1 || 0 },
    { label: "24m", offset: prof24m?.length - 1 || 0 },
    { label: "36m", offset: prof36m?.length - 1 || 0 },
    { label: "YTD", offset: profYTD?.length - 1 || 0 },
  ];

  // Usa o período atual selecionado em vez de forçar prof36m
  const currentPeriodData = window.BaseRetornosDiarios.profitabilitiesByPeriod[filterPeriod] || prof36m;
  const totalIndex = currentPeriodData?.length - 1 || 0;

  if (!portfolioFront || portfolioFront.length === 0 || !cdiFront || cdiFront.length === 0) {
    console.error("Dados dos gráficos não estão disponíveis");
    return;
  }

  // Verifica se o totalIndex está dentro dos limites
  if (totalIndex >= portfolioFront.length || totalIndex < 0) {
    console.error("Índice total fora dos limites dos dados disponíveis");
    return;
  }

  const endDate = formatTimestamp(portfolioFront[totalIndex][0], "pt-br");
  const portfolioEndValue = portfolioFront[totalIndex][1];
  const cdiEndValue = cdiFront[totalIndex][1];
  const ibovEndValue = ibovespaFront[totalIndex][1];

  periods.forEach((period, i) => {
    const linha = i + 1;
    const index = totalIndex - period.offset;
    
    // Verifica se o índice calculado está dentro dos limites
    if (index < 0 || index >= portfolioFront.length) {
      console.warn(`Índice ${index} fora dos limites para o período ${period.label}`);
      return; // Pula este período
    }
    
    const startDate = formatTimestamp(portfolioFront[index][0], "pt-br");
    const portfolioStartValue = portfolioFront[index][1];
    const cdiStartValue = cdiFront[index][1];
    const ibovStartValue = ibovespaFront[index][1];

    // Atualiza as células da tabela PORTFOLIO
    updateCellText(`.portfolio .linha-${linha}.endDate`, endDate);
    updateCellText(`.portfolio .linha-${linha}.startDate`, startDate);
    updateCellText(`.portfolio .linha-${linha}.end-value`, formatNumber(portfolioEndValue));
    updateCellText(`.portfolio .linha-${linha}.start-value`, formatNumber(portfolioStartValue));

    // Atualiza as células da tabela CDI
    updateCellText(`.cdi .linha-${linha}.endDate`, endDate);
    updateCellText(`.cdi .linha-${linha}.startDate`, startDate);
    updateCellText(`.cdi .linha-${linha}.end-value`, formatNumber(cdiEndValue));
    updateCellText(`.cdi .linha-${linha}.start-value`, formatNumber(cdiStartValue));

    // Atualiza as células da tabela IBOVESPA
    updateCellText(`.ibov .linha-${linha}.endDate`, endDate);
    updateCellText(`.ibov .linha-${linha}.startDate`, startDate);
    updateCellText(`.ibov .linha-${linha}.end-value`, formatNumber(ibovEndValue));
    updateCellText(`.ibov .linha-${linha}.start-value`, formatNumber(ibovStartValue));

    // Atualiza a tabela de percentuais
    const label = period.label;
    const portfolioPerf = ((portfolioEndValue / portfolioStartValue - 1) * 100).toFixed(2);
    const cdiPerf = ((cdiEndValue / cdiStartValue - 1) * 100).toFixed(2);
    const ibovPerf = ((ibovEndValue / ibovStartValue - 1) * 100).toFixed(2);
    updateCellText(`.linha-${label} .item-1`, `${portfolioPerf.replace(".", ",")}%`);
    updateCellText(`.linha-${label} .item-2`, `${cdiPerf.replace(".", ",")}%`);
    updateCellText(`.linha-${label} .item-3`, `${ibovPerf.replace(".", ",")}%`);
  });

  // Calcular a diferença diária
  const resultado = calcularDiferencaDiaria(portfolioFront);
  resultado.forEach(([timestamp, diff]) => {
    meuPortfolioDiario.push([timestamp, Number(diff)]);
  });
  const resultadoImab = calcularDiferencaDiaria(imabFront);
  resultadoImab.forEach(([timestamp, diff]) => {
    meuPortfolioDiarioImab.push([timestamp, Number(diff)]);
  });
  const resultadoIbov = calcularDiferencaDiaria(ibovespaFront);
  resultadoIbov.forEach(([timestamp, diff]) => {
    meuPortfolioDiarioIbov.push([timestamp, Number(diff)]);
  });

  // Calcular a volatilidade diária para o meuPortfolioDiario
  volatilidadeArray = calculaVolatilidadeRolling('volatilidadeArray', meuPortfolioDiario);
  imabVolatilidadeArray = calculaVolatilidadeRolling('imabVolatilidadeArray', meuPortfolioDiarioImab);
  ibovVolatilidadeArray = calculaVolatilidadeRolling('ibovVolatilidadeArray', meuPortfolioDiarioIbov);
  
  // Só gera o gráfico de volatilidade se o elemento existir
  if (document.getElementById("volatilidadeDiaria")) {
    generateLineChartsVolatilidade("volatilidadeDiaria");
  }
}

// ==========================================
// FUNÇÕES DE INICIALIZAÇÃO E CONFIGURAÇÃO
// ==========================================

// Função para ativar o botão de período específico
function activatePeriodButton(periodValue) {
  const allButtons = document.querySelectorAll(".filter-period-button");
  allButtons.forEach((btn) => btn.classList.remove("active"));

  const targetButton = document.querySelector(`[data-value="${periodValue}"]`);
  if (targetButton) {
    targetButton.classList.add("active");
    filterPeriod = periodValue;
    // console.log(`Período ${periodValue} ativado`);
  } else {
    // console.warn(`Botão com data-value="${periodValue}" não encontrado`);
  }
}

// generate filters chart
const createPeriodButtons = () => {
  const filterPeriodsDiv = document.querySelector(".filterPeriods");
  if (!filterPeriodsDiv) {
    console.error("Elemento filterPeriods não encontrado");
    return;
  }

  filterPeriodsDiv.innerHTML = "";

  if (!window.periodKeys || window.periodKeys.length === 0) {
    console.error("periodKeys não está disponível");
    return;
  }

  window.periodKeys.sort((a, b) => {
    if (a.value === 'profYTD') return 1;
    if (b.value === 'profYTD') return -1;

    const aValue = Number.parseInt(a.value.match(/\d+/)?.[0] || 0, 10);
    const bValue = Number.parseInt(b.value.match(/\d+/)?.[0] || 0, 10);
    return aValue - bValue;
  });

  let activePeriodSet = false;

  window.periodKeys.forEach((period, index) => {
    const button = document.createElement("button");
    button.classList.add("filter-period-button");
    button.setAttribute("data-value", period.value);
    button.textContent = period.name;

    // Verifica se o período está disponível para os fundos selecionados
    const isAvailable = isPeriodAvailableForSelectedFunds(period.value);
    
    if (isAvailable) {
      button.classList.remove('disabled');
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      
      // Define o primeiro período disponível como ativo se ainda não foi definido
      if (!activePeriodSet) {
        button.classList.add("active");
        fixedPeriod = period.value;
        filterPeriod = period.value;
        activePeriodSet = true;
      }
    } else {
      button.classList.add('disabled');
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
    }

    filterPeriodsDiv.appendChild(button);

    button.addEventListener("click", () => {
      // Só processa o clique se o botão não estiver desabilitado
      if (button.disabled || button.classList.contains('disabled')) {
        return;
      }

      const allButtons = document.querySelectorAll(".filter-period-button");
      allButtons.forEach((btn) => btn.classList.remove("active"));

      button.classList.add("active");

      // Atualiza apenas o filterPeriod, mantendo fixedPeriod inalterado
      filterPeriod = button.getAttribute("data-value");

      // Regenera apenas os gráficos com o novo período de filtro
      regenerateChartsWithFilter();
    });
  });

  // Se nenhum período foi definido como ativo, ativa o último disponível
  if (!activePeriodSet) {
    const enabledButtons = document.querySelectorAll('.filter-period-button:not(.disabled)');
    if (enabledButtons.length > 0) {
      const lastButton = enabledButtons[enabledButtons.length - 1];
      lastButton.classList.add("active");
      fixedPeriod = lastButton.getAttribute("data-value");
      filterPeriod = lastButton.getAttribute("data-value");
    }
  }
};

function rangeColors(rangeId, rangeColor, bgColor) {
  const slider = document.querySelector(rangeId);
  if (!slider) return;

  slider.addEventListener("input", (event) => {
    const tempSliderValue = event.target.value;
    const progress = (tempSliderValue / slider.max) * 100;
    slider.style.background = `linear-gradient(to right, ${rangeColor} ${progress}%, ${bgColor} ${progress}%)`;
  });
}

function renderMessageSuccess() {
  const messageElement = document.querySelector(
    ".js-walletComposition-message"
  );
  if (messageElement) {
    messageElement.innerHTML = `${lottieSuccessFile} <span>Composição válida</span>`;
    setTimeout(() => {
      messageElement.classList.add("positive");
    }, 250);
  }
}

// Nova função para regenerar apenas os gráficos com o filtro
function regenerateChartsWithFilter() {
  if (!window.BaseRetornosDiarios) {
    console.error("BaseRetornosDiarios não está disponível");
    return;
  }

  // Limpa os arrays dos gráficos
  portfolioFront = [];
  cdiFront = [];
  ibovespaFront = [];
  imabFront = [];

  // Recria os dados dos gráficos usando o filterPeriod
  const filteredPortfolio =
    window.BaseRetornosDiarios.profitabilitiesByPeriod[filterPeriod]?.reduce(
      (acc, prof) => {
        if (
          prof.fund &&
          Object.keys(prof.fund).length ===
            window.BaseRetornosDiarios.funds.length &&
          prof.index &&
          Object.keys(prof.index).length ===
            window.BaseRetornosDiarios.indexes.length
        ) {
          acc.push({
            date: prof.date,
            indexes: Object.entries(prof.index).reduce(
              (acc, [indexId, value]) => {
                acc[indexId] = 100 * (1 + value);
                return acc;
              },
              {}
            ),
            value:
              100 *
              (1 +
                Object.entries(prof.fund).reduce(
                  (accumulator, [fundId, value]) =>
                    accumulator +
                    (obterValorInput(`fund-${fundId}`) / 100) * value,
                  0
                )),
          });
        }
        return acc;
      },
      []
    ) || [];

  // Popula os arrays para os gráficos
  filteredPortfolio.forEach((relatorio) => {
    const timestamp = dateToTimestamp(relatorio.date);
    const ibovIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "ibov")?.id];
    const cdiIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "cdi")?.id];
    const imabIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "ima")?.id];

    if (imabIndexValue) imabFront.push([timestamp, imabIndexValue]);
    if (ibovIndexValue) ibovespaFront.push([timestamp, ibovIndexValue]);
    if (cdiIndexValue) cdiFront.push([timestamp, cdiIndexValue]);
    portfolioFront.push([timestamp, relatorio.value]);
  });

  // Regenera apenas o gráfico de linha
  generateLineCharts("retornoAcumulado");
  
  // Chama renderFrontMonthTable após os dados estarem prontos
  setTimeout(() => {
    renderFrontMonthTable();
  }, 100);
}

// Adicione esta função para inicializar a tabela no carregamento da página
function initializeTableHistory() {
  const tableContainer = document.getElementById("tableContainer");
  if (tableContainer) {
    // Cria uma tabela vazia com a estrutura correta
    tableContainer.innerHTML = tableHTMLVolatility;
    // console.log("Tabela inicial criada");
  } else {
    // console.warn("Elemento #tableContainer não encontrado - pode não estar na página atual");
    // Não é um erro, simplesmente não estamos na página que tem tabela
  }
}

// ==========================================
// FUNÇÕES DE INICIALIZAÇÃO DO SIMULADOR
// ==========================================

function initializeSimulator() {
  if (simuladorInitialized) {
    // console.log("Simulador já foi inicializado");
    return;
  }

  // console.log("Inicializando simulador...");

  // Inicializa a tabela
  initializeTableHistory();

  // Armazena a instância do gráfico
  let chartInstance;

  function updateChart() {
    const inputs = document.querySelectorAll(
      ".mzSimulator__userWallet input[type='range']"
    );
    if (inputs.length === 0) return;

    // Calcula os dados da série e a soma total
    const seriesData = Array.from(inputs)
      .map((input) => ({
        name: input.dataset.name,
        color: input.dataset.color,
        y: Number(input.value),
      }))
      .filter((data) => data.y > 0); // Filtrar apenas valores maiores que 0

    const totalValue = seriesData.reduce((sum, data) => sum + data.y, 0); // Soma total

    if (chartInstance) {
      // Atualiza os dados da série
      chartInstance.series[0].setData(seriesData, true);

      // Atualiza o texto no centro (subtitle)
      chartInstance.update({
        subtitle: {
          text: getSubtitle(totalValue),
          useHTML: true,
        },
      });
    }
  }

  function initialChart() {
    const inputs = document.querySelectorAll(
      ".mzSimulator__userWallet input[type='range']"
    );
    if (inputs.length === 0) {
      console.warn("Nenhum input de range encontrado");
      return;
    }

    inputs.forEach((input) => {
      // Encontra o item correspondente no array `portfolio`
      const portfolioItem = window.portfolio?.find(
        (item) => item.id === input.id || item.name === input.dataset.name
      );

      if (portfolioItem) {
        const newValue = portfolioItem.value;
        const color = portfolioItem.color || "#ED7020";
        const progressDiv = document.querySelector(input.dataset.rangeSlider);

        // Define o valor do input
        input.value = newValue;

        // Dispara o evento de input
        const event = new Event("input", { bubbles: true });
        input.dispatchEvent(event);

        // Atualiza o estilo do progresso
        if (progressDiv) {
          progressDiv.style.width = `${newValue}%`;
          progressDiv.style.background = `linear-gradient(to right, ${color} ${newValue}%, #dddddd 100%)`;
        }
      }
    });

    // Calcula os dados da série e a soma total
    let seriesData = Array.from(inputs)
      .map((input) => ({
        name: input.dataset.name,
        color: input.dataset.color,
        y: Number(input.value),
      }))
      .filter((data) => data.y > 0);

    // Se nenhum valor foi atribuído, define o primeiro item com 100%
    if (seriesData.length === 0 && inputs.length > 0) {
      const firstInput = inputs[0];
      firstInput.value = 100;

      // Dispara o evento para atualizar o estado visual e lógico
      const event = new Event("input", { bubbles: true });
      firstInput.dispatchEvent(event);

      seriesData = [
        {
          name: firstInput.dataset.name,
          color: firstInput.dataset.color,
          y: 100,
        },
      ];

      // Atualiza a barra visual (range slider)
      const progressDiv = document.querySelector(
        firstInput.dataset.rangeSlider
      );
      if (progressDiv) {
        progressDiv.style.width = `100%`;
        progressDiv.style.background = `linear-gradient(to right, ${
          firstInput.dataset.color || "#ED7020"
        } 100%, #dddddd 100%)`;
      }
    }

    setTimeout(() => {
      if (!window.Highcharts) {
        console.error("Highcharts não está disponível para criar o gráfico");
        return;
      }

      chartInstance = Highcharts.chart("portfolioChartProfile", {
        chart: {
          type: "pie",
          backgroundColor: null,
          style: {
            fontFamily: "Graphik",
          },
        },

        title: { text: "" },
        subtitle: {
          useHTML: true,
          text: getSubtitle(100),
          floating: true,
          verticalAlign: "middle",
          fontWeight: 500,
          y: 10,
        },
        credits: { enabled: false },
        rangeSelector: { enabled: false },
        navigator: { enabled: false },
        exporting: { enabled: false },
        scrollbar: { enabled: false },
        legend: { enabled: false },

        accessibility: {
          point: { valueSuffix: "%" },
        },

        plotOptions: {
          pie: {
            allowPointSelect: true,
            enableMouseTracking: true,
            cursor: "pointer",
            innerSize: "70%",
            borderRadius: 0,
            borderWidth: 0,
            connectorWidth: 0,
            animation: true,
            dataLabels: {
              enabled: false,
            },
          },
        },

        tooltip: {
          enabled: true,
          formatter: function () {
            return `<strong>${this.point.name}</strong>: ${this.y.toFixed(0)}%`;
          },
          backgroundColor: "#333",
          borderColor: "#555",
          style: {
            color: "#fff",
            fontSize: "16px",
            paddingTop: "5px",
            paddingBottom: "10px",
          },
        },

        series: [
          {
            name: "Fundos",
            colorByPoint: true,
            data: seriesData,
            animation: true,
          },
        ],
      });

      if (buttonRangeEl) {
        buttonRangeEl.click();
      }
    }, 250);
  }

  function getSubtitle(total) {
    return `<span style="font-size: 56px; color: ${
      total === 100 ? "#161F27" : "#f00"
    };">${total}%</span>`;
  }

  setTimeout(() => {
    // Seleciona todos os inputs do tipo range
    const rangeInputs = document.querySelectorAll(
      "input[type='range'][data-type='range-portfolio']"
    );

    // Seleciona todos os elementos de progresso
    const progressElements = document.querySelectorAll(
      ".js-rangeSlider-progress"
    );

    // Seleciona todos os elementos com a classe js-walletComposition e value
    const walletValueElements = document.querySelectorAll(
      ".js-walletComposition.value"
    );

    // Seleciona o botão de limpar e o botão de composição
    const clearButton = document.querySelector(".js-walletComposition-clear");

    // Adiciona o evento de clique no botão de limpar
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        for (let i = 0; i < 2; i++) {
          // Itera sobre os inputs de faixa (range)
          rangeInputs.forEach((input, index) => {
            const color = input.dataset.color || "#ED7020";

            // Define 100% para o primeiro input, 0% para os demais
            const newValue = index === 0 ? 100 : 0;
            input.value = newValue;

            input.style.background = `linear-gradient(to right, ${color} ${newValue}%, #dddddd 100%)`;

            const event = new Event("input", { bubbles: true });
            input.dispatchEvent(event);

            const progressDiv = document.querySelector(`#fund-${input.id}`);
            if (progressDiv) {
              progressDiv.style.width = `${newValue}%`;
              progressDiv.textContent = `${newValue}%`;
              progressDiv.style.background = `linear-gradient(to right, ${color} ${newValue}%, #dddddd 100%)`;
            }
          });

          // Atualiza os valores de exibição abaixo dos sliders
          progressElements.forEach((element, index) => {
            element.textContent = index === 0 ? "100%" : "0%";
          });

          // Atualiza visualização geral
          walletValueElements.forEach((element) => {
            element.classList.remove("positive", "negative");
            element.classList.add("positive");
            element.textContent = "100%";
          });

          const messageElement = document.querySelector(
            ".js-walletComposition-message"
          );
          if (messageElement) {
            messageElement.innerHTML = "";
          }
        }
        // Atualiza o gráfico
        initialChart();
        createPeriodButtons();
        regenerateChartsWithFilter();
        // renderFrontMonthTable será chamada após regenerateChartsWithFilter processar os dados
        
        // Atualiza estado dos botões de período após limpar
        setTimeout(() => {
          updatePeriodButtonsState();
        }, 100);
      });
    }

    inputRangeEl = document.querySelectorAll(
      "input[data-type=range-portfolio]"
    );
  }, 250);

  setTimeout(() => {
    if (buttonRangeEl) {
      buttonRangeEl.addEventListener("click", function () {
        document.querySelectorAll(".mzSimulator").forEach((element) => {
          element.classList.add("disabled");
        });

        this.innerHTML = "Carregando...";

        // Mantém o período atual selecionado ao clicar em simular
        // Não força mudança para prof36m, usa o período já selecionado
        const currentActivePeriod = document.querySelector('.filter-period-button.active:not(.disabled)');
        if (currentActivePeriod) {
          filterPeriod = currentActivePeriod.getAttribute('data-value');
          fixedPeriod = filterPeriod;
                 } else {
           // Fallback: busca primeiro período disponível baseado nos fundos selecionados
           const availableButtons = document.querySelectorAll('.filter-period-button:not(.disabled)');
           if (availableButtons.length > 0) {
             const firstAvailable = availableButtons[0];
             filterPeriod = firstAvailable.getAttribute('data-value');
             fixedPeriod = filterPeriod;
             firstAvailable.classList.add('active');
           } else {
             // Último fallback para YTD que geralmente está sempre disponível
             filterPeriod = "profYTD";
             fixedPeriod = filterPeriod;
           }
         }

        let currentPortfolio = [];
        portfolioFront = [];
        cdiFront = [];
        ibovespaFront = [];
        imabFront = [];

        document.querySelectorAll(".hide-section-chart").forEach((element) => {
          element.classList.remove("hide-section-chart");

          const loading = document.querySelector("#loading");
          loading.classList.add("d-none");

          // console.clear();
        });

        // Salva a carteira do usuário
        const user_wallet = [];

        inputRangeEl.forEach((range) => {
          if (range.value > 0) {
            user_wallet.push({
              name: range.getAttribute("data-name"),
              y: Number(range.value),
              color: range.getAttribute("data-color"),
            });
          }
        });

        setTimeout(() => {
          this.innerHTML = "Simular";

          if (
            !window.BaseRetornosDiarios?.profitabilitiesByPeriod?.[filterPeriod]
          ) {
            console.error(
              "Dados não disponíveis para o período:",
              filterPeriod
            );
            return;
          }

          currentPortfolio = window.BaseRetornosDiarios.profitabilitiesByPeriod[
            filterPeriod
          ].reduce((acc, prof) => {
            if (
              prof.fund &&
              Object.keys(prof.fund).length ===
                window.BaseRetornosDiarios.funds.length &&
              prof.index &&
              Object.keys(prof.index).length ===
                window.BaseRetornosDiarios.indexes.length
            ) {
              acc.push({
                date: prof.date,
                indexes: Object.entries(prof.index).reduce(
                  (acc, [indexId, value]) => {
                    acc[indexId] = 100 * (1 + value);
                    return acc;
                  },
                  {}
                ),
                value:
                  100 *
                  (1 +
                    Object.entries(prof.fund).reduce(
                      (accumulator, [fundId, value]) =>
                        accumulator +
                        (obterValorInput(`fund-${fundId}`) / 100) * value,
                      0
                    )),
              });
            }
            return acc;
          }, []);

          currentPortfolio.forEach((relatorio) => {
            const timestamp = dateToTimestamp(relatorio.date);
            const ibovIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "ibov")?.id];
            const cdiIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "cdi")?.id];
            const imabIndexValue = relatorio.indexes[window.indexes?.find((index) => index.slug === "ima")?.id];

            if (ibovIndexValue) ibovespaFront.push([timestamp, ibovIndexValue]);
            if (cdiIndexValue) cdiFront.push([timestamp, cdiIndexValue]);
            if (imabIndexValue) imabFront.push([timestamp, imabIndexValue]);
            portfolioFront.push([timestamp, relatorio.value]);
          });

          // Mantém o período atual ativo após processar os dados
          // Não força mudança para prof36m

          setTimeout(() => {
            if (document.querySelector("#tableContainer table")) {
              // console.log(`calcular ${filterPeriod}!`);
              generateTableHistory();
              regenerateChartsWithFilter();
              renderFrontMonthTable();
            } else {
              console.warn(
                "Tabela não encontrada no DOM. Não foi possível atualizar os valores."
              );
            }
          }, 175);

          generateLineCharts("retornoAcumulado");
        }, 250);

        document.querySelectorAll(".mzSimulator").forEach((element) => {
          element.classList.remove("disabled");
        });
      });
    }

    inputRangeEl.forEach((range) => {
      range.addEventListener("input", function () {
        let currentTotal = 0;

        // Calcula o total sem o valor do slider atual
        inputRangeEl.forEach((otherRange) => {
          if (otherRange !== this) {
            currentTotal += Number.parseFloat(otherRange.value);
          }
        });

        // Calcula o valor máximo permitido para o slider atual
        const maxValueForCurrent = Math.min(
          100 - currentTotal,
          Number(this.max)
        );

        // Força o valor atual a respeitar o limite
        this.value = Math.min(Number(this.value), maxValueForCurrent);

        // Atualiza o valor anterior armazenado
        this.dataset.previousValue = this.value;

        // Atualiza o estilo visual do slider
        const value = ((this.value - this.min) / (this.max - this.min)) * 100;
        this.style.background = `linear-gradient(to right, #161F27 0%, #161F27 ${value}%, #fff ${value}%, white 100%)`;

        // Atualiza o progresso do slider
        const rangeSlider = this.getAttribute("data-rangeSlider");
        const progressElement = document.querySelector(rangeSlider);
        if (progressElement) {
          progressElement.innerHTML = this.value + "%";
        }

        // Recalcula a composição total
        calculateWalletComposition();

        // Atualiza o estado dos botões de período baseado na nova seleção
        updatePeriodButtonsState();
      });

      rangeColors(
        `#${range.getAttribute("id")}`,
        range.getAttribute("data-rangeColor"),
        "#dddddd"
      );

      // Inicializa o valor anterior
      range.dataset.previousValue = range.value;
    });

    // Atualiza o gráfico somente ao finalizar a interação com o input range
    document
      .querySelectorAll(".mzSimulator__userWallet input[type='range']")
      .forEach((input) => {
        input.addEventListener("input", updateChart); // Atualiza ao finalizar o evento
      });

    setTimeout(() => {
      initialChart();
      regenerateChartsWithFilter();
      createPeriodButtons();
      // renderFrontMonthTable será chamada após regenerateChartsWithFilter processar os dados
      
      // Atualiza estado dos botões de período após inicialização
      setTimeout(() => {
        updatePeriodButtonsState();
      }, 100);
    }, 250);
  }, 250);

  simuladorInitialized = true;
  // console.log("Simulador inicializado com sucesso");
}

// ==========================================
// EVENT LISTENERS E INICIALIZAÇÃO PRINCIPAL
// ==========================================

// Escuta o evento customizado disparado quando tudo está pronto
window.addEventListener("simuladorReady", (event) => {
  // console.log("Evento simuladorReady recebido:", event.detail);

  // Disponibiliza os dados globalmente
  window.portfolio = event.detail.portfolio;
  window.indexes = event.detail.indexes;
  window.BaseRetornosDiarios = event.detail.BaseRetornosDiarios;
  window.periodKeys = event.detail.periodKeys;

  // Inicializa o simulador
  initializeSimulator();
});

// Fallback caso o evento não seja disparado
document.addEventListener("DOMContentLoaded", () => {
  // console.log("DOM carregado, verificando se dados estão disponíveis...");

  // Aguarda um pouco e verifica se os dados estão disponíveis
  setTimeout(() => {
    if (
      window.BaseRetornosDiarios &&
      window.portfolio &&
      !simuladorInitialized
    ) {
      // console.log("Dados encontrados, inicializando simulador via fallback...");
      initializeSimulator();
    }
  }, 250);
});
