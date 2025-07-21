<div class="l-meuPortfolio hide-section-chart">
    <div class="container">
        <div class="mzSimulator--container mzSimulator--stepOne">
            <div class="mzSimulator disabled">
                <!-- user wallet -->
                <div class="mzSimulator__userWallet"></div>
                <!-- user wallet -->

                <div class="mzSimulator__userWallet__buttons">
                    <button class="js-walletComposition-clear">
                        <?php _e("Limpar", LANG_DOMAIN); ?>
                        <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.22318 3.83366L8.22318 1.91699H13.6129V3.83366L19.0026 3.83366V5.75032L2.8335 5.75033V3.83366H8.22318Z" fill="#111112"/>
                            <path d="M5.52834 17.2503C5.52834 18.3089 6.33269 19.167 7.3249 19.167H14.5111C15.5034 19.167 16.3077 18.3089 16.3077 17.2503V7.66699H18.1043V17.2503C18.1043 19.3674 16.4956 21.0837 14.5111 21.0837H7.3249C5.34047 21.0837 3.73178 19.3674 3.73178 17.2503V7.66699H5.52834V17.2503Z" fill="#111112"/>
                        </svg>
                    </button>
                    <div class="actions">
                        <button class="btn btn--bgSecondaryColor mzSimulator__userWallet__button js-walletCompositionToggle-button"><span class="button-text">ver todos os fundos</span> <i class="fa fa-angle-down"></i></button>
                        <button class="btn btn--bgSecondaryColor mzSimulator__userWallet__button js-walletComposition-button">Simular</button>
                    </div>
                </div>
            </div>

            <div class="w-full mzSimulatorChart">
                <h2>Composição de Carteira</h2>
                <div class="w-full" id="portfolioChartProfile" lang="<?php //echo get_language_shortcode(); ?>"></div>
                <span class="value js-walletComposition positive d-none">100%</span>
                <p class="js-walletComposition-message"></p>
            </div>
        </div>
    </div>
</div>


<script>
    // Definição de variáveis
    const colors = ['#ED7020', '#566067', '#183557', '#96A0A7', '#F4A766', '#7A868E', '#518A74', '#9CBBDE', '#5E5E5E', '#8FC0AD', '#ED7020', '#566067', '#183557', '#96A0A7', '#F4A766', '#7A868E', '#518A74', '#9CBBDE', '#5E5E5E', '#8FC0AD', '#ED7020', '#566067', '#183557', '#96A0A7', '#F4A766', '#7A868E', '#518A74', '#9CBBDE', '#5E5E5E', '#8FC0AD'];
    const colorsIndexes = ['#9CBBDE', '#ADB6BB', '#F4A766'];
    const lottieSuccessFile = `<img src="<?php bloginfo('template_directory'); ?>/img/icons/success.svg" />`;

    const userWalletContainer = document.querySelector('.mzSimulator__userWallet');

    let data = {};
    let periodKeys = [];
    let portfolio = [];
    let indexes = [];
    let startPeriod = 'prof36m';
    let currentPortfolio = [];
    let BaseRetornosDiarios = [];

    const periodNames = {
        prof3m: '3 meses',
        prof6m: '6 meses',
        prof12m: '12 meses',
        prof24m: '24 meses',
        prof36m: '36 meses',
        profYTD: 'YTD'
    };

    // Variável para controlar se os dados foram carregados
    let dataLoaded = false;
    let elementsCreated = false;
    
    // Função para carregar o script unificado
    function loadExternalScripts() {
        if (!dataLoaded || !elementsCreated) {
            // console.log('Aguardando dados e elementos serem criados...', { dataLoaded, elementsCreated });
            return;
        }

        // console.log('Carregando script unificado...');
        
        // Carrega apenas o arquivo unificado
        const script = document.createElement('script');
        script.src = '<?php bloginfo('template_directory'); ?>/js/simulador-de-investimentos/simulador-unificado.js';
        script.defer = true;
        script.onload = function() {
            // console.log('simulador-unificado.js carregado com sucesso');
            // console.log('Script unificado carregado e dados estão disponíveis');
        
            // Dispara evento personalizado para indicar que tudo está pronto
            window.dispatchEvent(new CustomEvent('simuladorReady', { 
                detail: { 
                    portfolio, 
                    indexes, 
                    BaseRetornosDiarios,
                    periodKeys 
                } 
            }));
        };
        script.onerror = function() {
            console.error('Erro ao carregar script do simulador');
        };
        document.head.appendChild(script);
    }

    // Função para verificar se todos os elementos foram criados
    function checkElementsCreated() {
        const rangeInputs = document.querySelectorAll('input[data-type="range-portfolio"]');
        const rangeSliders = document.querySelectorAll('.js-rangeSlider-progress');
        
        if (rangeInputs.length > 0 && rangeSliders.length > 0 && rangeInputs.length === portfolio.length) {
            elementsCreated = true;
            // console.log('Todos os elementos foram criados:', {
            //     rangeInputs: rangeInputs.length,
            //     rangeSliders: rangeSliders.length,
            //     portfolioItems: portfolio.length
            // });
            
            // Tenta carregar os scripts externos
            loadExternalScripts();
        } else {
            // console.log('Aguardando criação dos elementos...', {
            //     rangeInputs: rangeInputs.length,
            //     rangeSliders: rangeSliders.length,
            //     portfolioItems: portfolio.length
            // });
        }
    }

    fetch(window.location.origin + window.location.pathname + '?simulador')
        .then(response => {
            if (!response.ok) {
                throw new Error('Falha ao carregar o arquivo');
            }
            return response.json();
        })
        .then(data => {
            // console.log('Dados recebidos da API');
            
            BaseRetornosDiarios = data;

            periodKeys = Object.keys(data.profitabilitiesByPeriod)
                .filter(key => data.profitabilitiesByPeriod[key].length > 0)
                .map(key => ({
                    name: periodNames[key],
                    value: key
                }));

            // console.log('periodKeys processados:', periodKeys);

            // Captura o texto antes do primeiro " - "
            const regex = /^([^\s-]+)/;

            const slugs = data.funds.map(item => {
                const match = item.name.match(regex);
                if (match) {
                    return match[1].toLowerCase();
                }
                return '';
            });

            const slugsIndexes = data.indexes.map(item => {
                const match = item.name.match(regex);
                if (match) {
                    return match[1].toLowerCase();
                }
                return '';
            });

            const themesBySlug = {
                bovv11: "Ibovespa",
                b3br11: "Ibovespa B3 BR+",
                divo11: "Dividendos",
                find11: "Financeiras",
                gove11: "Governança",
                isus11: "Sustentabilidade",
                matb11: "Materiais Básicos",
                pibb11: "IBX-50",
                smac11: "Small Caps",
                htek11: "Saúde (USD)",
                mill11: "Digital Lifestyle",
                reve11: "Receita Verde (USD)",
                silk11: "MSCI A50 CHINA (CNY)",
                spxi11: "S&P500 (USD)",
                spxr11: "S&P500 (BRL)",
                teck11: "Tecnologia (USD)",
                ydro11: "Hidrogênio (USD)",
                b5p211: "Juros Real Curto",
                ib5m11: "Juros Real Longo",
                idka11: "Juros Prefixados",
                imab11: "Juros Real",
                irfm11: "Juros Prefixados",
                goat11: "Inflação BR & bolsa US",
                biti11: "Bitcoin (USD)"
            };

            // Cria um array temporário com todos os dados do portfolio
            const portfolioTemp = data.funds.map((fund, index) => {
                const slug = slugs[index];
                return {
                    name: fund.name,
                    id: fund.id,
                    slug: slug,
                    startDate: new Date(fund.startDate,).getTime(),
                    value: 0, // Todos iniciam com 0
                    theme: themesBySlug[slug] || ''
                };
            });

            // Ordena de acordo com a ordem definida em themesBySlug
            const orderedSlugs = Object.keys(themesBySlug);

            portfolio = orderedSlugs
                .map((slug, i) => {
                    const item = portfolioTemp.find(p => p.slug === slug);
                    if (item) {
                        return {
                            ...item,
                            color: colors[i],        // color na ordem dos slugs do themesBySlug
                            value: i === 0 ? 100 : 0 // primeiro item começa com 100
                        };
                    }
                    return null;
                })
                .filter(Boolean); // Remove slugs que não existem no retorno

            indexes = data.indexes.map((item, index) => ({
                name: item.name,
                id: item.id,
                color: colorsIndexes[index],
                slug: slugsIndexes[index],
            }));

            // Criação de sliders na ordem correta
            portfolio.forEach((item, index) => {
                const rangeSlider = document.createElement('div');
                rangeSlider.classList.add('range-slider');
                rangeSlider.setAttribute('data-count', index + 1);
                rangeSlider.setAttribute('data-start', item.startDate);

                rangeSlider.innerHTML = `
                    <div>
                        <label for="${item.slug.toUpperCase()}">
                            ${item.slug.toUpperCase() === 'DIVO11' ? 'DIVO11/DIVD11' : item.slug.toUpperCase()}
                            ${item.theme ? `<span class="theme">(${item.theme})</span>` : ''}
                        </label>
                        <div class="js-rangeSlider-progress rangeSlider-${index + 1}" id="range-${item.id}">${item.value}%</div>
                    </div>
                    <input
                        id="fund-${item.id}"
                        data-name="${item.slug.toUpperCase()}"
                        data-color="${colors[index]}"
                        data-rangeColor="${colors[index]}"
                        data-rangeSlider=".rangeSlider-${index + 1}"
                        data-type="range-portfolio"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value="${item.value}"
                    />
                `;

                // Adiciona o novo rangeSlider ao container
                userWalletContainer.appendChild(rangeSlider);
            });

            // console.log('Elementos de slider criados');

            // Marca que os dados foram carregados
            dataLoaded = true;

            // Aguarda um pouco para garantir que os elementos foram inseridos no DOM
            setTimeout(() => {
                checkElementsCreated();
            }, 100);

        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
        });

    // clique no botão para ver todos os fundos
    document.addEventListener('DOMContentLoaded', function() {
        const viewAllFundsButton = document.querySelector('.js-walletCompositionToggle-button');
        const userWallet = document.querySelector('.mzSimulator__userWallet');
        
        if (viewAllFundsButton && userWallet) {
            const icon = viewAllFundsButton.querySelector('i.fa');
            const buttonText = viewAllFundsButton.querySelector('.button-text');

            viewAllFundsButton.addEventListener('click', () => {
                // Toggle da classe 'active' na carteira
                userWallet.classList.toggle('active');

                // Verifica se a carteira está ativa
                const isActive = userWallet.classList.contains('active');

                // Alterna o ícone
                if (icon) {
                    icon.classList.toggle('fa-angle-down', !isActive);
                    icon.classList.toggle('fa-angle-up', isActive);
                }

                // Altera o texto do botão
                if (buttonText) {
                    buttonText.textContent = isActive ? 'Ver menos fundos' : 'Ver todos os fundos';
                }
            });
        }
    });

    // Verificação adicional para garantir que tudo está pronto
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (dataLoaded && !elementsCreated) {
                // console.log('Verificação adicional após window.load');
                checkElementsCreated();
            }
        }, 250);
    });
</script>
