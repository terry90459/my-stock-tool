// 初始化本地儲存庫的股票資料
let stockData = JSON.parse(localStorage.getItem('myStocks')) || { TW: [], US: [] };

// 當網頁載入完成時，繪製表格畫面
document.addEventListener('DOMContentLoaded', () => {
    renderTables();
    document.getElementById('btn-add').addEventListener('click', addNewStock);
    document.getElementById('btn-api-update').addEventListener('click', updatePricesViaAPI);
});

// 分頁切換功能
function switchMarket(market) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.market-section').forEach(s => s.classList.remove('active'));
    if(market === 'TW') {
        document.querySelector('.tab-tw').classList.add('active');
        document.getElementById('section-TW').classList.add('active');
    } else {
        document.querySelector('.tab-us').classList.add('active');
        document.getElementById('section-US').classList.add('active');
    }
}

// 核心功能：計算並將資料繪製到網頁畫面上
function renderTables() {
    ['TW', 'US'].forEach(market => {
        const tbody = document.getElementById(`tbody-${market}`);
        tbody.innerHTML = '';
        
        const groups = {};
        stockData[market].forEach((stock, originalIndex) => {
            const symbol = stock.symbol.toUpperCase();
            if (!groups[symbol]) {
                groups[symbol] = { name: stock.name || symbol, items: [] };
            }
            groups[symbol].items.push({ ...stock, originalIndex });
        });
        
        Object.keys(groups).forEach(symbol => {
            const group = groups[symbol];
            let totalShares = 0;
            let totalCost = 0;
            let currentPrice = 0; 
            
            group.items.forEach(item => {
                totalShares += parseFloat(item.shares);
                totalCost += parseFloat(item.shares) * parseFloat(item.cost);
                if (item.currentPrice) currentPrice = parseFloat(item.currentPrice);
            });
            
            const avgCost = totalShares > 0 ? (totalCost / totalShares) : 0;
            const totalMarketValue = totalShares * currentPrice;
            const groupProfit = totalMarketValue - totalCost;
            const groupRate = totalCost > 0 ? (groupProfit / totalCost) * 100 : 0;
            
            const summaryRow = document.createElement('tr');
            summaryRow.className = 'summary-row';
            summaryRow.innerHTML = `
                <td style="text-align:left;">📌 ${symbol} (合併加總)</td>
                <td>${totalShares.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                <td>$${avgCost.toFixed(2)}</td>
                <td>$${Math.round(totalCost).toLocaleString()}</td>
                <td>$${currentPrice.toFixed(2)}</td>
                <td>$${Math.round(totalMarketValue).toLocaleString()}</td>
                <td class="${getProfitClass(groupProfit)}">${groupProfit >= 0 ? '+' : ''}${Math.round(groupProfit).toLocaleString()}</td>
                <td class="${getProfitClass(groupProfit)}">${groupRate >= 0 ? '+' : ''}${groupRate.toFixed(2)}%</td>
                <td>-</td>
            `;
            tbody.appendChild(summaryRow);
            
            group.items.forEach(item => {
                const itemCost = item.shares * item.cost;
                const itemMarketValue = item.shares * currentPrice;
                const itemProfit = itemMarketValue - itemCost;
                const itemRate = itemCost > 0 ? (itemProfit / itemCost) * 100 : 0;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:left; padding-left: 30px; color: #aaa;">└ ${item.name || '未命名'}</td>
                    <td>${parseFloat(item.shares).toLocaleString()}</td>
                    <td>$${parseFloat(item.cost).toFixed(2)}</td>
                    <td>$${Math.round(itemCost).toLocaleString()}</td>
                    <td>$${currentPrice.toFixed(2)}</td>
                    <td>$${Math.round(itemMarketValue).toLocaleString()}</td>
                    <td class="${getProfitClass(itemProfit)}">${itemProfit >= 0 ? '+' : ''}${Math.round(itemProfit).toLocaleString()}</td>
                    <td class="${getProfitClass(itemProfit)}">${itemRate >= 0 ? '+' : ''}${itemRate.toFixed(2)}%</td>
                    <td><button class="btn btn-delete" onclick="deleteStock('${market}', ${item.originalIndex})">刪除</button></td>
                `;
                tbody.appendChild(row);
            });
        });
    });
}

function getProfitClass(value) {
    if (value > 0) return 'profit'; 
    if (value < 0) return 'loss';   
    return 'neutral';
}

function addNewStock() {
    const market = document.getElementById('input-market').value;
    let symbol = document.getElementById('input-symbol').value.trim().toUpperCase();
    const name = document.getElementById('input-name').value.trim();
    const shares = parseFloat(document.getElementById('input-shares').value);
    const cost = parseFloat(document.getElementById('input-cost').value);
    
    if (!symbol || isNaN(shares) || isNaN(cost)) {
        alert('請填寫完整的代號、持股數與購入單價！');
        return;
    }
    
    // 自動判斷並補齊 Yahoo 財經所認得的台股上市櫃格式 (.TW)
    if (market === 'TW' && /^\d+$/.test(symbol)) {
        symbol = symbol + '.TW';
    }
    
    const existing = stockData[market].find(s => s.symbol === symbol);
    const initialPrice = existing && existing.currentPrice ? existing.currentPrice : cost;
    
    const newEntry = { symbol: symbol, name: name || symbol.replace('.TW', ''), shares: shares, cost: cost, currentPrice: initialPrice };
    stockData[market].push(newEntry);
    saveAndRefresh();
    
    document.getElementById('input-symbol').value = '';
    document.getElementById('input-name').value = '';
    document.getElementById('input-shares').value = '';
    document.getElementById('input-cost').value = '';
}

function deleteStock(market, index) {
    if (confirm('確定要刪除這筆投資明細嗎？')) {
        stockData[market].splice(index, 1);
        saveAndRefresh();
    }
}

// 儲存並重新整理網頁
function saveAndRefresh() {
    localStorage.setItem('myStocks', JSON.stringify(stockData));
    renderTables();
}

// 💡 外掛加持版：0 阻擋、0 人工、直接對接 Yahoo 官方即時金融伺服器
async function updatePricesViaAPI() {
    const statusText = document.getElementById('update-status');
    statusText.innerText = '正在透過解鎖通道，下載全球股市即時最精準報價...';
    
    const twSymbols = stockData.TW.map(s => s.symbol);
    const usSymbols = stockData.US.map(s => s.symbol);
    const allSymbols = [...new Set([...twSymbols, ...usSymbols])];
    
    if (allSymbols.length === 0) {
        statusText.innerText = '💡 目前清單內沒有任何持股。';
        return;
    }
    
    try {
        const symbolsQuery = allSymbols.join(',');
        // 直接硬碰硬直連 Yahoo Finance 即時核心 API
        const targetUrl = `https://yahoo.com{encodeURIComponent(symbolsQuery)}`;
        
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`伺服器拒絕 (狀態碼: ${response.status})`);
        
        const data = await response.json();
        
        if (data && data.quoteResponse && data.quoteResponse.result) {
            const results = data.quoteResponse.result;
            let updateCount = 0;
            
            results.forEach(stockInfo => {
                const symbol = stockInfo.symbol;
                // regularMarketPrice 會直接抓取當下最新跳動的盤中即時價
                const price = stockInfo.regularMarketPrice;
                
                stockData.TW.forEach(s => { if (s.symbol === symbol) { s.currentPrice = price; updateCount++; } });
                stockData.US.forEach(s => { if (s.symbol === symbol) { s.currentPrice = price; updateCount++; } });
            });
            
            saveAndRefresh();
            statusText.innerText = `✅ 即時全球股市更新成功！已同步 ${updateCount} 筆交易紀錄。時間：${new Date().toLocaleTimeString()}`;
        } else {
            statusText.innerText = '❌ 解析失敗：收到的即時資料格式不對。';
        }
        
    } catch (error) {
        console.error(error);
        statusText.innerText = `❌ 更新失敗：請確認您的 Chrome 外掛 CORS Unblock 已經切換到 ON 綠燈（錯誤原因：${error.message}）`;
    }
}
