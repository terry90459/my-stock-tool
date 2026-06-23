// 初始化本地儲存庫的股票資料
let stockData = JSON.parse(localStorage.getItem('myStocks')) || { TW: [], US: [] };

// 當網頁載入完成時，繪製表格畫面
document.addEventListener('DOMContentLoaded', () => {
    renderTables();
    
    // 綁定「加入清單」按鈕事件
    document.getElementById('btn-add').addEventListener('click', addNewStock);
    
    // 綁定「API 更新現價」按鈕事件
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
        
        // 依照標的代號進行群組分類
        const groups = {};
        stockData[market].forEach((stock, originalIndex) => {
            const symbol = stock.symbol.toUpperCase();
            if (!groups[symbol]) {
                groups[symbol] = {
                    name: stock.name || symbol,
                    items: []
                };
            }
            groups[symbol].items.push({ ...stock, originalIndex });
        });
        
        // 逐一將分類好的股票群組渲染出來
        Object.keys(groups).forEach(symbol => {
            const group = groups[symbol];
            
            // 計算此標的的總合併數據
            let totalShares = 0;
            let totalCost = 0;
            let currentPrice = 0; // 以最後一筆設定的現價為基準
            
            group.items.forEach(item => {
                totalShares += parseFloat(item.shares);
                totalCost += parseFloat(item.shares) * parseFloat(item.cost);
                if (item.currentPrice) {
                    currentPrice = parseFloat(item.currentPrice);
                }
            });
            
            const avgCost = totalShares > 0 ? (totalCost / totalShares) : 0;
            const totalMarketValue = totalShares * currentPrice;
            const groupProfit = totalMarketValue - totalCost;
            const groupRate = totalCost > 0 ? (groupProfit / totalCost) * 100 : 0;
            
            // 1. 先輸出最上方的「合併計算總計列」
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
            
            // 2. 接著輸出該標的底下「各筆獨立的買入明細欄位」
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

// 判斷損益正負號並給予紅、綠或白色的 CSS 樣式名稱
function getProfitClass(value) {
    if (value > 0) return 'profit'; // 正數變紅
    if (value < 0) return 'loss';   // 負數變綠
    return 'neutral';
}

// 新增持股紀錄
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
    
    // 確保輸入的是純數字格式（移除可能殘留的後綴）
    symbol = symbol.replace('.TW', '').replace('.TWO', '');
    
    // 檢查同標的是否已有現價紀錄
    const existing = stockData[market].find(s => s.symbol === symbol);
    const initialPrice = existing && existing.currentPrice ? existing.currentPrice : cost;
    
    const newEntry = {
        symbol: symbol,
        name: name || symbol,
        shares: shares,
        cost: cost,
        currentPrice: initialPrice
    };
    
    stockData[market].push(newEntry);
    saveAndRefresh();
    
    // 清空輸入欄位
    document.getElementById('input-symbol').value = '';
    document.getElementById('input-name').value = '';
    document.getElementById('input-shares').value = '';
    document.getElementById('input-cost').value = '';
}

// 刪除持股明細
function deleteStock(market, index) {
    if (confirm('確定要刪除這筆投資明細嗎？')) {
        stockData[market].splice(index, 1);
        saveAndRefresh();
    }
}

// 儲存至瀏覽器本地儲存區並重新整理畫面
function saveAndRefresh() {
    localStorage.setItem('myStocks', JSON.stringify(stockData));
    renderTables();
}

// 💡 串接開源社群維護的「全台股每日數據靜態檔」（原生 100% 開放 CORS，絕不阻擋）
async function updatePricesViaAPI() {
    const statusText = document.getElementById('update-status');
    statusText.innerText = '正在下載全台股最新報價清單...';
    
    const twSymbols = [...new Set(stockData.TW.map(s => s.symbol))];
    if (twSymbols.length === 0) {
        statusText.innerText = '💡 目前台股清單內沒有任何持股。';
        return;
    }
    
    try {
        // 使用 GitHub 上開源社群每日自動備份的證交所最新 JSON 檔案
        // 這個網域（://githubusercontent.com）天生完全開放 CORS，任何人、任何網頁都能直接下載
        const url = 'https://githubusercontent.com/w96k/twse-openapi/main/data/exchangeReport/STOCK_DAY_AVG_ALL.json';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("開源伺服器無回應");
        
        const data = await response.json();
        let updateCount = 0;
        
        twSymbols.forEach(symbol => {
            // 在一千多檔股票中精準比對您的持股代號
            const match = data.find(item => item.Code === symbol);
            if (match && match.ClosingPrice) {
                const price = parseFloat(match.ClosingPrice);
                stockData.TW.forEach(stock => {
                    if (stock.symbol === symbol) {
                        stock.currentPrice = price;
                    }
                });
                updateCount++;
            }
        });
        
        saveAndRefresh();
        statusText.innerText = `✅ 台股自動更新成功！已同步 ${updateCount} 檔最新市價。時間：${new Date().toLocaleTimeString()}`;
        
    } catch (error) {
        console.error(error);
        statusText.innerText = `❌ 更新失敗：開源數據源暫時無法連線（${error.message}）`;
    }
}
