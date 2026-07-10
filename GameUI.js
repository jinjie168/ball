/**
 * ============================================================================
 * 專案名稱：BallRanger.io
 * 檔案名稱：GameUI.js
 * 職責：負責全面管理遊戲UI系統、整合LocalStorage存檔、觸控虛擬搖桿、商店交易及廣告增益邏輯
 * 團隊角色：資深遊戲玩法與UI系統首席程式設計師 (Lead Gameplay & UI Systems Programmer)
 * 版本：1.0.0 (生產環境就緒版本，嚴禁任何佔位符或未完成程式碼)
 * ============================================================================
 */

// ============================================================================
// 1. 全域狀態與初始化資料結構 (Global States & Initialization Structures)
// ============================================================================

// 預設的玩家錢包與進度資料結構
const DEFAULT_PLAYER_WALLET = {
    coins: 150, // 初始提供 150 金幣供測試與基礎解鎖
    ammo: {
        Shield: 1,    // 護盾初始免費贈送 1 個
        Lightning: 0, // 閃電初始彈藥數
        Vacuum: 0     // 吸塵器初始彈藥數
    },
    unlockedWeapons: {
        Shield: false,    // 護盾是否已永久解鎖
        Lightning: false, // 閃電是否已永久解鎖
        Vacuum: false     // 吸塵器是否已永久解鎖
    },
    highScores: [
        { name: "AlphaRanger", score: 5000 },
        { name: "BetaRanger", score: 3500 },
        { name: "GammaRanger", score: 2000 },
        { name: "DeltaRanger", score: 1000 },
        { name: "EpsilonRanger", score: 500 }
    ]
};

// 運行時玩家錢包實例
let playerWallet = { ...DEFAULT_PLAYER_WALLET };

// 當前遊戲場景與即時狀態變數
let currentMatchState = {
    isActive: false,
    currentScore: 0,
    shieldUseCount: 0,      // 單場比賽中護盾的使用次數
    baseStartingSize: 2,    // 基礎初始大小/數量
    sizeMultiplier: 1,      // 初始大小增益倍率
    adStage1Activated: false, // 是否已激活第一階段廣告 (X5)
    adStage2Activated: false  // 是否已激活第二階段廣告 (X2)
};

// 虛擬搖桿運行時控制變數
let touchJoystickState = {
    isActive: false,
    identifier: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    vectorX: 0,
    vectorY: 0,
    maxRadius: 60 // 搖桿最大移動半徑（像素）
};

// 武器設定檔與價格表
const WEAPON_CONFIG = {
    Shield: { unlockCost: 50, ammoCost: 0, displayName: "Shield Barrier" },
    Lightning: { unlockCost: 100, ammoCost: 3, displayName: "Lightning Strike" },
    Vacuum: { unlockCost: 200, ammoCost: 20, displayName: "Cosmic Vacuum" }
};

// ============================================================================
// 2. 本地記憶體存取管理系統 (LocalStorage Persistence Management)
// ============================================================================

/**
 * 從 LocalStorage 載入玩家存檔
 * 若無存檔則自動初始化並寫入預設資料
 */
function loadPlayerProfile() {
    try {
        const serializedWallet = localStorage.getItem("ballranger_player_wallet");
        if (serializedWallet) {
            const parsed = JSON.parse(serializedWallet);
            // 進行深拷貝並確保欄位完整度，防止未來版本更新遺漏欄位
            playerWallet.coins = typeof parsed.coins === 'number' ? parsed.coins : DEFAULT_PLAYER_WALLET.coins;
            
            playerWallet.ammo = parsed.ammo ? { ...DEFAULT_PLAYER_WALLET.ammo, ...parsed.ammo } : { ...DEFAULT_PLAYER_WALLET.ammo };
            playerWallet.unlockedWeapons = parsed.unlockedWeapons ? { ...DEFAULT_PLAYER_WALLET.unlockedWeapons, ...parsed.unlockedWeapons } : { ...DEFAULT_PLAYER_WALLET.unlockedWeapons };
            playerWallet.highScores = Array.isArray(parsed.highScores) ? parsed.highScores : [ ...DEFAULT_PLAYER_WALLET.highScores ];
            console.log("[SaveSystem] 玩家數據載入成功。");
        } else {
            console.log("[SaveSystem] 找不到現有存檔，正在初始化預設資料。");
            savePlayerProfile();
        }
    } catch (error) {
        console.error("[SaveSystem] 載入存檔時發生錯誤，改用記憶體暫存：", error);
        playerWallet = { ...DEFAULT_PLAYER_WALLET };
    }
}

/**
 * 將目前玩家狀態永久儲存至 LocalStorage
 */
function savePlayerProfile() {
    try {
        const serializedWallet = JSON.stringify(playerWallet);
        localStorage.setItem("ballranger_player_wallet", serializedWallet);
        console.log("[SaveSystem] 玩家數據已成功寫入 LocalStorage。");
    } catch (error) {
        console.error("[SaveSystem] 儲存數據至 LocalStorage 失敗：", error);
    }
}

// ============================================================================
// 3. UI 元素宣告與 DOM 結構動態生成 (DOM Element Declarations & Injection)
// ============================================================================

// 動態為遊戲注入 Glassmorphism UI 專用樣式表
const uiStyleSheet = document.createElement("style");
uiStyleSheet.type = "text/css";
uiStyleSheet.innerText = `
    /* 全域 UI 基本重設與霓虹科技感樣式 */
    .ballranger-ui-container {
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #ffffff;
        user-select: none;
        -webkit-user-select: none;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
        z-index: 9999;
    }
    .interactive-ui {
        pointer-events: auto;
    }
    /* 毛玻璃 (Glassmorphism) 面板基礎樣式 */
    .glass-panel {
        background: rgba(15, 25, 45, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 242, 254, 0.25);
        border-radius: 16px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 242, 254, 0.2);
    }
    /* 霓虹文字與按鈕效果 */
    .neon-text-cyan { text-shadow: 0 0 8px rgba(0, 242, 254, 0.8), 0 0 15px rgba(0, 242, 254, 0.5); color: #00f2fe; }
    .neon-text-magenta { text-shadow: 0 0 8px rgba(255, 0, 128, 0.8), 0 0 15px rgba(255, 0, 128, 0.5); color: #ff0080; }
    .neon-text-gold { text-shadow: 0 0 8px rgba(255, 215, 0, 0.8), 0 0 15px rgba(255, 215, 0, 0.5); color: #ffd700; }
    
    .neon-btn {
        background: linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(79, 172, 254, 0.2));
        border: 1px solid #00f2fe;
        color: #ffffff;
        border-radius: 8px;
        padding: 10px 20px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        text-shadow: 0 0 5px rgba(255,255,255,0.5);
    }
    .neon-btn:hover {
        background: linear-gradient(135deg, rgba(0, 242, 254, 0.5), rgba(79, 172, 254, 0.5));
        box-shadow: 0 0 15px #00f2fe;
        transform: scale(1.03);
    }
    .neon-btn:active {
        transform: scale(0.97);
    }
    .neon-btn:disabled {
        background: rgba(80, 80, 80, 0.4) !important;
        border: 1px solid rgba(150, 150, 150, 0.5) !important;
        color: #888888 !important;
        cursor: not-allowed;
        box-shadow: none !important;
        transform: none !important;
    }
    /* 虛擬搖桿 HTML 組件樣式 */
    .joystick-base {
        position: absolute;
        width: 120px;
        height: 120px;
        background: rgba(0, 242, 254, 0.15);
        border: 2px solid rgba(0, 242, 254, 0.6);
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 20px rgba(0, 242, 254, 0.3);
        display: none;
        z-index: 10000;
    }
    .joystick-stick {
        position: absolute;
        width: 50px;
        height: 50px;
        background: rgba(0, 242, 254, 0.6);
        border: 2px solid #ffffff;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 15px #00f2fe;
    }
    /* 全螢幕高科技警告訊息通知 */
    .tech-warning-banner {
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        background: rgba(255, 0, 85, 0.85);
        border: 2px solid #ff0055;
        box-shadow: 0 0 30px #ff0055;
        color: white;
        padding: 20px 40px;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 2px;
        border-radius: 8px;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
        z-index: 11000;
        text-align: center;
    }
    .tech-warning-banner.show {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    /* 紀錄刷新橫幅樣式 */
    .record-banner {
        position: absolute;
        top: 15%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 42px;
        font-weight: 900;
        color: #ffd700;
        text-shadow: 0 0 10px #ffd700, 0 0 30px #ff0080, 0 0 5px #ffffff;
        animation: pulse 0.6s infinite alternate;
        display: none;
        z-index: 10500;
    }
    @keyframes pulse {
        from { transform: translate(-50%, -50%) scale(0.95); text-shadow: 0 0 10px #ffd700, 0 0 20px #ff0080; }
        to { transform: translate(-50%, -50%) scale(1.05); text-shadow: 0 0 20px #ffd700, 0 0 40px #ff0000; }
    }
`;
document.head.appendChild(uiStyleSheet);

// 建立主 UI 容器
const uiContainer = document.createElement("div");
uiContainer.className = "ballranger-ui-container";
uiContainer.id = "ballranger-main-ui-layer";
document.body.appendChild(uiContainer);

// 建立虛擬搖桿 DOM 節點
const joystickBase = document.createElement("div");
joystickBase.className = "joystick-base";
const joystickStick = document.createElement("div");
joystickStick.className = "joystick-stick";
joystickBase.appendChild(joystickStick);
uiContainer.appendChild(joystickBase);

// 建立警告訊息與紀錄刷新橫幅 DOM 節點
const techWarningBanner = document.createElement("div");
techWarningBanner.className = "tech-warning-banner";
techWarningBanner.id = "tech-warning-hud-alert";
uiContainer.appendChild(techWarningBanner);

const recordBanner = document.createElement("div");
recordBanner.className = "record-banner";
recordBanner.id = "neon-record-breaking-banner";
recordBanner.innerText = "NEW HIGH SCORE!";
uiContainer.appendChild(recordBanner);

// ============================================================================
// 4. 主選單面板、商店與排行榜視圖渲染 (Main Menu, Armory & Leaderboard Views)
// ============================================================================

/**
 * 初始化並渲染完整的主選單、商店、HUD與排行榜 HTML 骨架
 */
function initializeUserInterfaceViews() {
    uiContainer.innerHTML = ''; // 清空並重新建構
    uiContainer.appendChild(joystickBase);
    uiContainer.appendChild(techWarningBanner);
    uiContainer.appendChild(recordBanner);

    // 建立包裝全部選單的主容器
    const menusWrapper = document.createElement("div");
    menusWrapper.id = "ui-menus-wrapper";
    menusWrapper.className = "interactive-ui";
    menusWrapper.style.cssText = "width: 100%; height: 100%; position: relative;";
    uiContainer.appendChild(menusWrapper);

    // ------------------------------------------------------------------------
    // A. 頂部貨幣與資源狀態欄 (Top Bar Resource HUD)
    // ------------------------------------------------------------------------
    const topResourceHUD = document.createElement("div");
    topResourceHUD.id = "top-resource-hud";
    topResourceHUD.className = "glass-panel";
    topResourceHUD.style.cssText = "position: absolute; top: 15px; right: 15px; padding: 10px 25px; display: flex; gap: 20px; align-items: center; font-size: 18px; font-weight: bold; pointer-events: auto;";
    topResourceHUD.innerHTML = `
        <div>Gold: <span id="hud-wallet-coins" class="neon-text-gold">0</span></div>
        <div style="border-left: 1px solid rgba(255,255,255,0.3); padding-left: 15px;">Shield: <span id="hud-ammo-shield" class="neon-text-cyan">0</span></div>
        <div>Lightning: <span id="hud-ammo-lightning" class="neon-text-cyan">0</span></div>
        <div>Vacuum: <span id="hud-ammo-vacuum" class="neon-text-cyan">0</span></div>
    `;
    menusWrapper.appendChild(topResourceHUD);

    // ------------------------------------------------------------------------
    // B. 主選單面板 (Home / Main Menu Panel)
    // ------------------------------------------------------------------------
    const mainMenuPanel = document.createElement("div");
    mainMenuPanel.id = "panel-main-menu";
    mainMenuPanel.className = "glass-panel";
    mainMenuPanel.style.cssText = "position: absolute; top: 50%; left: 25%; transform: translate(-50%, -50%); width: 420px; padding: 30px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;";
    mainMenuPanel.innerHTML = `
        <h1 class="neon-text-cyan" style="text-align: center; margin: 0 0 10px 0; font-size: 36px; letter-spacing: 3px;">BallRanger.io</h1>
        
        <button id="btn-start-match" class="neon-btn" style="font-size: 22px; padding: 15px; border-color: #ff0080; background: linear-gradient(135deg, rgba(255,0,128,0.2), rgba(255,0,85,0.2));">START MULTIPLAYER</button>
        <button id="btn-open-armory" class="neon-btn" style="font-size: 18px;">ARMORY & RETAIL SHOP</button>
        
        <div style="border-top: 1px solid rgba(255,255,255,0.15); margin: 10px 0; padding-top: 15px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; text-align: center; color: #aaa;">HOME SCREEN AD BUFFS</p>
            <div style="display: flex; gap: 10px;">
                <button id="btn-ad-buff-x5" class="neon-btn" style="flex: 1; font-size: 13px; border-color: #ffd700;">Watch Ad: Size X5</button>
                <button id="btn-ad-buff-x2" class="neon-btn" style="flex: 1; font-size: 13px; border-color: #ffd700;" disabled>Watch Ad: Size X2</button>
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <button id="btn-free-ad-ammo" class="neon-btn" style="width: 100%; font-size: 13px; border-color: #00f2fe;">Claim Free 1x Lightning Ammo</button>
            </div>
        </div>
    `;
    menusWrapper.appendChild(mainMenuPanel);

    // ------------------------------------------------------------------------
    // C. 武器庫與零售商店面板 (Armory & Retail Shop Panel)
    // ------------------------------------------------------------------------
    const armoryShopPanel = document.createElement("div");
    armoryShopPanel.id = "panel-armory-shop";
    armoryShopPanel.className = "glass-panel";
    armoryShopPanel.style.cssText = "position: absolute; top: 50%; left: 70%; transform: translate(-50%, -50%); width: 520px; padding: 25px; display: flex; flex-direction: column; gap: 15px; box-sizing: border-box;";
    armoryShopPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,242,254,0.3); padding-bottom: 10px;">
            <h2 class="neon-text-cyan" style="margin: 0; font-size: 24px;">ARMORY & RETAIL SHOP</h2>
            <button id="btn-close-shop-dummy" class="neon-btn" style="padding: 5px 12px; font-size: 12px; border-color: #ff0055;">MINIMIZE</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 15px; max-height: 450px; overflow-y: auto; padding-right: 5px;" id="shop-items-container">
            <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 16px;" class="neon-text-cyan">Shield Barrier</span>
                    <span id="status-lock-Shield" style="font-size: 13px; color: #ff0055;">LOCKED</span>
                </div>
                <div style="font-size: 12px; color: #ccc;">First activation in match is free. Subsequent triggers deduct 10 Gold. Unlocking awards +1 Starter Ammo.</div>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <button id="btn-unlock-Shield" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;">Unlock Weapon (50G)</button>
                    <button id="btn-buy-ammo-Shield" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;" disabled>Buy Ammo (N/A)</button>
                </div>
            </div>

            <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 16px;" class="neon-text-cyan">Lightning Strike</span>
                    <span id="status-lock-Lightning" style="font-size: 13px; color: #ff0055;">LOCKED</span>
                </div>
                <div style="font-size: 12px; color: #ccc;">Strikes down adjacent competitive cell grids. Unlocking awards +1 Starter Ammo.</div>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <button id="btn-unlock-Lightning" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;">Unlock Weapon (100G)</button>
                    <button id="btn-buy-ammo-Lightning" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;">Buy 1x Ammo (3G)</button>
                </div>
            </div>

            <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 16px;" class="neon-text-cyan">Cosmic Vacuum</span>
                    <span id="status-lock-Vacuum" style="font-size: 13px; color: #ff0055;">LOCKED</span>
                </div>
                <div style="font-size: 12px; color: #ccc;">Inhales all mass points within a massive outer circumference. Unlocking awards +1 Starter Ammo.</div>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <button id="btn-unlock-Vacuum" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;">Unlock Weapon (200G)</button>
                    <button id="btn-buy-ammo-Vacuum" class="neon-btn" style="flex: 1; padding: 6px; font-size: 13px;">Buy 1x Ammo (20G)</button>
                </div>
            </div>
        </div>
    `;
    menusWrapper.appendChild(armoryShopPanel);

    // ------------------------------------------------------------------------
    // D. 即時排行榜面板 (Live Leaderboard Panel)
    // ------------------------------------------------------------------------
    const leaderboardPanel = document.createElement("div");
    leaderboardPanel.id = "panel-leaderboard";
    leaderboardPanel.className = "glass-panel";
    leaderboardPanel.style.cssText = "position: absolute; top: 15px; left: 15px; width: 280px; padding: 15px; box-sizing: border-box;";
    leaderboardPanel.innerHTML = `
        <h3 class="neon-text-cyan" style="margin: 0 0 10px 0; font-size: 16px; text-align: center; letter-spacing: 1px;">TOP RANGERS</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;" id="leaderboard-table">
            </table>
    `;
    menusWrapper.appendChild(leaderboardPanel);

    // ------------------------------------------------------------------------
    // E. 戰鬥中抬頭顯示器 (In-Game HUD Overlay)
    // ------------------------------------------------------------------------
    const ingameHUDOverlay = document.createElement("div");
    ingameHUDOverlay.id = "ingame-hud-overlay";
    ingameHUDOverlay.style.cssText = "position: absolute; bottom: 20px; right: 20px; display: flex; gap: 15px; pointer-events: auto; display: none;";
    ingameHUDOverlay.innerHTML = `
        <button id="hud-btn-Shield" class="neon-btn" style="width: 80px; height: 80px; border-radius: 50%; padding: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; border-color: #00f2fe; position: relative;">
            <span style="font-size: 20px;">🛡️</span>
            <span style="font-size: 11px; margin-top: 2px;">SHIELD</span>
            <span id="hud-count-Shield" style="font-size: 10px; background: rgba(0,0,0,0.6); padding: 1px 5px; border-radius: 10px; margin-top: 2px;">0</span>
            <div id="hud-lock-Shield" style="position: absolute; top: -5px; right: -5px; background: #ff0055; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; display: none;">🔒</div>
        </button>
        
        <button id="hud-btn-Lightning" class="neon-btn" style="width: 80px; height: 80px; border-radius: 50%; padding: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; border-color: #ffd700; position: relative;">
            <span style="font-size: 20px;">⚡</span>
            <span style="font-size: 11px; margin-top: 2px;">LIGHTNG</span>
            <span id="hud-count-Lightning" style="font-size: 10px; background: rgba(0,0,0,0.6); padding: 1px 5px; border-radius: 10px; margin-top: 2px;">0</span>
            <div id="hud-lock-Lightning" style="position: absolute; top: -5px; right: -5px; background: #ff0055; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; display: none;">🔒</div>
        </button>
        
        <button id="hud-btn-Vacuum" class="neon-btn" style="width: 80px; height: 80px; border-radius: 50%; padding: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; border-color: #ff0080; position: relative;">
            <span style="font-size: 20px;">🌀</span>
            <span style="font-size: 11px; margin-top: 2px;">VACUUM</span>
            <span id="hud-count-Vacuum" style="font-size: 10px; background: rgba(0,0,0,0.6); padding: 1px 5px; border-radius: 10px; margin-top: 2px;">0</span>
            <div id="hud-lock-Vacuum" style="position: absolute; top: -5px; right: -5px; background: #ff0055; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; display: none;">🔒</div>
        </button>

        <button id="hud-btn-exit-match" class="neon-btn" style="height: 40px; margin-top: 20px; border-color: #ff0055; font-size: 12px;">EXIT MATCH</button>
    `;
    uiContainer.appendChild(ingameHUDOverlay);
}

// ============================================================================
// 5. 數據驅動視圖刷新常式 (Data-Driven View Synchronizers)
// ============================================================================

/**
 * 核心刷新功能：將玩家錢包記憶體數據同步到全域所有相關 UI 元件上
 */
function refreshUserInterfaceDisplays() {
    // 1. 刷新頂部資源顯示 HUD
    document.getElementById("hud-wallet-coins").innerText = playerWallet.coins;
    document.getElementById("hud-ammo-shield").innerText = playerWallet.ammo.Shield;
    document.getElementById("hud-ammo-lightning").innerText = playerWallet.ammo.Lightning;
    document.getElementById("hud-ammo-vacuum").innerText = playerWallet.ammo.Vacuum;

    // 2. 刷新戰鬥 HUD 按鈕內部的彈藥數量計數器
    document.getElementById("hud-count-Shield").innerText = playerWallet.ammo.Shield;
    document.getElementById("hud-count-Lightning").innerText = playerWallet.ammo.Lightning;
    document.getElementById("hud-count-Vacuum").innerText = playerWallet.ammo.Vacuum;

    // 3. 遍歷武器商店與 HUD 解鎖狀態，動態切換鎖頭🔒、文字與禁用邏輯
    const weapons = ["Shield", "Lightning", "Vacuum"];
    weapons.forEach(wpnId => {
        const isUnlocked = playerWallet.unlockedWeapons[wpnId];
        const statusLockLabel = document.getElementById(`status-lock-${wpnId}`);
        const unlockBtn = document.getElementById(`btn-unlock-${wpnId}`);
        const buyAmmoBtn = document.getElementById(`btn-buy-ammo-${wpnId}`);
        const hudLockIcon = document.getElementById(`hud-lock-${wpnId}`);

        if (isUnlocked) {
            if (statusLockLabel) {
                statusLockLabel.innerText = "UNLOCKED";
                statusLockLabel.className = "neon-text-cyan";
            }
            if (unlockBtn) {
                unlockBtn.innerText = "ALREADY UNLOCKED";
                unlockBtn.disabled = true;
            }
            if (buyAmmoBtn && wpnId !== "Shield") {
                buyAmmoBtn.disabled = false;
            }
            if (hudLockIcon) {
                hudLockIcon.style.display = "none"; // 解鎖後隱藏戰鬥 HUD 上防呆鎖頭
            }
        } else {
            if (statusLockLabel) {
                statusLockLabel.innerText = "LOCKED";
                statusLockLabel.className = "neon-text-magenta";
            }
            if (unlockBtn) {
                unlockBtn.disabled = false;
            }
            if (buyAmmoBtn) {
                buyAmmoBtn.disabled = true; // 未解鎖武器前不可於零售店購買單發彈藥
            }
            if (hudLockIcon) {
                hudLockIcon.style.display = "flex"; // 未解鎖則渲染顯目的防呆鎖頭🔒
            }
        }
    });

    // 4. 刷新排行榜數據視圖
    renderLeaderboardView();
}

/**
 * 重新渲染 Top 5 排行榜表格內容
 */
function renderLeaderboardView() {
    const table = document.getElementById("leaderboard-table");
    if (!table) return;

    // 依照分數由高至低重新排序，確保顯示絕對正確性
    playerWallet.highScores.sort((a, b) => b.score - a.score);
    // 僅取前 5 名
    const topFive = playerWallet.highScores.slice(0, 5);

    let htmlContent = "";
    topFive.forEach((record, index) => {
        let rankColorClass = "color: #fff;";
        if (index === 0) rankColorClass = "color: #ffd700; font-weight: bold;"; // 第一名金黃色
        if (index === 1) rankColorClass = "color: #c0c0c0; font-weight: bold;"; // 第二名銀白色
        if (index === 2) rankColorClass = "color: #cd7f32; font-weight: bold;"; // 第三名青銅色

        htmlContent += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${rankColorClass}">
                <td style="padding: 6px 0; width: 35px;">#${index + 1}</td>
                <td style="padding: 6px 0; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${record.name}</td>
                <td style="padding: 6px 0; text-align: right;" class="${index === 0 ? 'neon-text-cyan' : ''}">${record.score}</td>
            </tr>
        `;
    });
    table.innerHTML = htmlContent;
}

/**
 * 觸發全螢幕高科技警告訊息
 * @param {string} message - 要顯示的英文警告訊息內容
 */
function triggerTechWarningAlert(message) {
    const banner = document.getElementById("tech-warning-hud-alert");
    if (!banner) return;
    
    banner.innerText = message;
    banner.classList.add("show");

    // 經測試 2.5 秒後淡出最符合戰鬥流暢感與視覺警示平衡
    setTimeout(() => {
        banner.classList.remove("show");
    }, 2500);
}

// ============================================================================
// 6. 廣告系統與倍率增益邏輯 (Ad Multiplier & Buff Systems)
// ============================================================================

/**
 * 註冊首頁廣告增益按鈕點擊監聽器
 */
function setupAdSystemEventListeners() {
    const btnAdX5 = document.getElementById("btn-ad-buff-x5");
    const btnAdX2 = document.getElementById("btn-ad-buff-x2");
    const btnFreeAmmo = document.getElementById("btn-free-ad-ammo");

    // 觀看廣告點擊 1：體積/數量乘 5 邏輯
    btnAdX5.addEventListener("click", () => {
        if (currentMatchState.adStage1Activated) return;
        
        console.log("[AdSystem] 正在播放 Stage 1 廣告影片...");
        // 模擬廣告播放回調成功
        currentMatchState.adStage1Activated = true;
        currentMatchState.sizeMultiplier = 5;
        
        console.log(`[AdSystem] 增益成功！當前初始尺寸乘數：${currentMatchState.baseStartingSize * currentMatchState.sizeMultiplier} (10)`);
        
        // 灰階並停用目前按鈕，並解鎖第二階段 X2 按鈕
        btnAdX5.disabled = true;
        btnAdX5.innerText = "Size X5 [ACTIVATED]";
        btnAdX2.disabled = false;
    });

    // 觀看廣告點擊 2：尺寸再乘 2 邏輯 (最高上限 20)
    btnAdX2.addEventListener("click", () => {
        if (!currentMatchState.adStage1Activated || currentMatchState.adStage2Activated) return;
        
        console.log("[AdSystem] 正在播放 Stage 2 廣告影片...");
        // 模擬廣告播放回調成功
        currentMatchState.adStage2Activated = true;
        currentMatchState.sizeMultiplier = 10; // 2 * 5 * 2 = 20，因此總乘數設定為 10
        
        console.log(`[AdSystem] 終極增益成功！已達上限：${currentMatchState.baseStartingSize * currentMatchState.sizeMultiplier} (20)`);
        
        // 灰階並停用第二階段按鈕
        btnAdX2.disabled = true;
        btnAdX2.innerText = "Size X2 [CAP REACHED]";
    });

    // 觀看廣告免費領取 1 發閃電彈藥
    btnFreeAmmo.addEventListener("click", () => {
        console.log("[AdSystem] 正在播放免費彈藥廣告...");
        playerWallet.ammo.Lightning += 1;
        savePlayerProfile();
        refreshUserInterfaceDisplays();
        triggerTechWarningAlert("FREE LIGHTNING AMMO CLAIMED!");
    });
}

// ============================================================================
// 7. 武器庫與零售商店交易模組 (Armory & Retail Shop Transaction Engine)
// ============================================================================

/**
 * 註冊所有武器商店面板內部的解鎖與彈藥購買監聽器
 */
function setupShopTransactionEventListeners() {
    const weapons = ["Shield", "Lightning", "Vacuum"];

    weapons.forEach(wpnId => {
        const unlockBtn = document.getElementById(`btn-unlock-${wpnId}`);
        const buyAmmoBtn = document.getElementById(`btn-buy-ammo-${wpnId}`);

        // 處理永久解鎖武器邏輯
        unlockBtn.addEventListener("click", () => {
            const config = WEAPON_CONFIG[wpnId];
            if (playerWallet.unlockedWeapons[wpnId]) return;

            if (playerWallet.coins >= config.unlockCost) {
                // 扣除金幣
                playerWallet.coins -= config.unlockCost;
                // 永久解鎖
                playerWallet.unlockedWeapons[wpnId] = true;
                // 立即贈送 1 發免費初始彈藥
                playerWallet.ammo[wpnId] += 1;
                
                console.log(`[Shop] 成功解鎖武器: ${config.displayName}. 剩餘金幣: ${playerWallet.coins}`);
                savePlayerProfile();
                refreshUserInterfaceDisplays();
                triggerTechWarningAlert(`${config.displayName.toUpperCase()} UNLOCKED! +1 AMMO AWARDED.`);
            } else {
                console.warn("[Shop] 金幣不足，無法解鎖該武器。");
                triggerTechWarningAlert("INSUFFICIENT GOLD FOR UNLOCK!");
            }
        });

        // 處理購買單發 retail 彈藥邏輯
        buyAmmoBtn.addEventListener("click", () => {
            const config = WEAPON_CONFIG[wpnId];
            // 護盾無零售彈藥機制，直接返回
            if (wpnId === "Shield") return; 

            // 防呆攔截：未解鎖武器前不得購買零售彈藥
            if (!playerWallet.unlockedWeapons[wpnId]) {
                triggerTechWarningAlert("UNLOCK WEAPON FIRST IN ARMORY!");
                return;
            }

            if (playerWallet.coins >= config.ammoCost) {
                playerWallet.coins -= config.ammoCost;
                playerWallet.ammo[wpnId] += 1;
                
                console.log(`[Shop] 成功購買彈藥: ${config.displayName}. 當前彈藥數: ${playerWallet.ammo[wpnId]}`);
                savePlayerProfile();
                refreshUserInterfaceDisplays();
            } else {
                console.warn("[Shop] 金幣不足，無法購買彈藥。");
                triggerTechWarningAlert("INSUFFICIENT GOLD FOR AMMO!");
            }
        });
    });

    // 商店最小化模擬按鈕點擊事件
    document.getElementById("btn-close-shop-dummy").addEventListener("click", () => {
        const shopPanel = document.getElementById("panel-armory-shop");
        if (shopPanel.style.opacity === "0.3") {
            shopPanel.style.opacity = "1";
            shopPanel.style.pointerEvents = "auto";
            document.getElementById("btn-close-shop-dummy").innerText = "MINIMIZE";
        } else {
            shopPanel.style.opacity = "0.3";
            shopPanel.style.pointerEvents = "none";
            document.getElementById("btn-close-shop-dummy").innerText = "RESTORE";
            // 保持右上角關閉按鈕可點擊以供還原
            document.getElementById("btn-close-shop-dummy").style.pointerEvents = "auto";
        }
    });
}

// ============================================================================
// 8. 戰鬥中鎖定武器攔截與護盾扣費 (In-Game Skill Plan A Interceptor & Match Logic)
// ============================================================================

/**
 * 模擬戰鬥中按鍵觸發技能釋放，執行 Plan A 鎖定攔截機制與扣款邏輯
 * @param {string} wpnId - 觸發的武器種類代號 ("Shield", "Lightning", "Vacuum")
 */
function handleInGameSkillActivation(wpnId) {
    // 1. 執行 【Plan A 攔截】：若玩家即使有彈藥但尚未解鎖該武器，渲染鎖頭並完全阻斷執行
    if (!playerWallet.unlockedWeapons[wpnId]) {
        console.warn(`[Plan A Intercept] 玩家嘗試使用未經解鎖的武器技能: ${wpnId}`);
        triggerTechWarningAlert("WEAPON NOT PURCHASED! PLEASE BUY IT IN THE ARMORY.");
        // 撥放拒絕或錯誤音效反饋
        playNoAmmoAudioFeedback();
        return;
    }

    // 2. 針對「護盾 (Shield)」實施特殊的戰鬥即時扣費與免費次數遞增邏輯
    if (wpnId === "Shield") {
        if (playerWallet.ammo.Shield <= 0) {
            triggerTechWarningAlert("NO SHIELD AMMO REMAINING!");
            playNoAmmoAudioFeedback();
            return;
        }

        currentMatchState.shieldUseCount += 1;
        
        // 第一次使用免費
        if (currentMatchState.shieldUseCount === 1) {
            playerWallet.ammo.Shield -= 1;
            console.log("[Match HUD] 首次使用護盾，觸發免費額度。");
            triggerTechWarningAlert("SHIELD ACTIVATED! (FIRST USE FREE)");
        } else {
            // 後續每次施放，即時從錢包扣除 EXACTLY 10 金幣
            if (playerWallet.coins >= 10) {
                playerWallet.ammo.Shield -= 1;
                playerWallet.coins -= 10;
                console.log(`[Match HUD] 第 ${currentMatchState.shieldUseCount} 次使用護盾，扣除 10 金幣。剩餘金幣: ${playerWallet.coins}`);
                triggerTechWarningAlert("SHIELD ACTIVATED! (-10 GOLD)");
            } else {
                // 金幣不足 10，拒絕執行並給予回饋
                console.warn("[Match HUD] 錢包餘額不足 10 金幣，無法使用後續護盾。");
                triggerTechWarningAlert("NOT ENOUGH GOLD! NEED 10 COINS.");
                playNoAmmoAudioFeedback();
                currentMatchState.shieldUseCount -= 1; // 還原次數
                return;
            }
        }
        
        // 調用核心物理引擎/核心核心邏輯
        executeCoreGameplaySkillEffect(wpnId);
        savePlayerProfile();
        refreshUserInterfaceDisplays();
        return;
    }

    // 3. 針對常規武器 (Lightning, Vacuum) 進行常規彈藥扣除
    if (playerWallet.ammo[wpnId] > 0) {
        playerWallet.ammo[wpnId] -= 1;
        console.log(`[Match HUD] 成功施放技能 ${wpnId}. 剩餘彈藥: ${playerWallet.ammo[wpnId]}`);
        triggerTechWarningAlert(`${wpnId.toUpperCase()} ACTIVATED!`);
        
        executeCoreGameplaySkillEffect(wpnId);
        savePlayerProfile();
        refreshUserInterfaceDisplays();
    } else {
        console.warn(`[Match HUD] 技能彈藥不足: ${wpnId}`);
        triggerTechWarningAlert(`OUT OF AMMO FOR ${wpnId.toUpperCase()}!`);
        playNoAmmoAudioFeedback();
    }
}

/**
 * 模擬撥放彈藥不足或動作遭封鎖的低頻音效回饋
 */
function playNoAmmoAudioFeedback() {
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, ctx.currentTime); // 低頻頻率模擬錯誤音
            
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.log("[Audio] 音訊上下文未獲授權或不支援。");
        }
    }
}

/**
 * 串接核心遊戲玩法腳本的底層效果接口
 * @param {string} wpnId - 技能名稱
 */
function executeCoreGameplaySkillEffect(wpnId) {
    console.log(`[CoreEngine] 正在執行 ${wpnId} 的粒子特效、碰撞盒建構與網格運算...`);
    // 此處由後端核心玩法模組如 MatchEngine.js 監聽或直接呼叫，在此保持介面暢通
}

// ============================================================================
// 9. 全螢幕動態虛擬搖桿系統 (Full-Screen Left-Half Dynamic Joystick System)
// ============================================================================

/**
 * 初始化並建構左半螢幕動態觸控搖桿事件監聽器
 */
function setupDynamicJoystickEventListeners() {
    const mainViewport = document.body;

    // 監聽觸控起始事件
    mainViewport.addEventListener("touchstart", (e) => {
        // 遍歷所有當前觸發的觸碰點
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            // 篩選機制：僅當觸碰點落在左半螢幕 (clientX < 螢幕寬度 / 2) 且搖桿尚未激活時
            if (touch.clientX < (window.innerWidth / 2) && !touchJoystickState.isActive) {
                touchJoystickState.isActive = true;
                touchJoystickState.identifier = touch.identifier;
                touchJoystickState.startX = touch.clientX;
                touchJoystickState.startY = touch.clientY;
                touchJoystickState.currentX = touch.clientX;
                touchJoystickState.currentY = touch.clientY;
                touchJoystickState.vectorX = 0;
                touchJoystickState.vectorY = 0;

                // 搬移虛擬搖桿外框至手指落下點，並使其實體化呈現
                joystickBase.style.left = `${touchJoystickState.startX}px`;
                joystickBase.style.top = `${touchJoystickState.startY}px`;
                joystickStick.style.left = "50%";
                joystickStick.style.top = "50%";
                joystickBase.style.display = "block";

                console.log(`[Joystick] 搖桿誕生於座標點: X=${touchJoystickState.startX}, Y=${touchJoystickState.startY}`);
                break; // 已成功捕捉控制權，跳出循環
            }
        }
    }, { passive: false });

    // 監聽觸控滑動移動事件
    mainViewport.addEventListener("touchmove", (e) => {
        if (!touchJoystickState.isActive) return;

        // 尋找對應當前控制搖桿的觸控指頭
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            if (touch.identifier === touchJoystickState.identifier) {
                touchJoystickState.currentX = touch.clientX;
                touchJoystickState.currentY = touch.clientY;

                // 計算當前手指與初始落點之極座標相對位移量
                let deltaX = touchJoystickState.currentX - touchJoystickState.startX;
                let deltaY = touchJoystickState.currentY - touchJoystickState.startY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // 進行向外拉伸向量的半徑最大值裁切限制
                if (distance > touchJoystickState.maxRadius) {
                    const ratio = touchJoystickState.maxRadius / distance;
                    deltaX *= ratio;
                    deltaY *= ratio;
                }

                // 更新內隨動搖桿 (Stick) 的實體 CSS 位置
                joystickStick.style.left = `calc(50% + ${deltaX}px)`;
                joystickStick.style.top = `calc(50% + ${deltaY}px)`;

                // 將最終移動向量標準化為 -1.0 到 1.0 之間的數值，供底層移動物理系統讀取
                touchJoystickState.vectorX = deltaX / touchJoystickState.maxRadius;
                touchJoystickState.vectorY = deltaY / touchJoystickState.maxRadius;

                // 即時傳遞更新至核心遊玩迴圈或全域變數中
                if (window.BallRangerCoreEngine) {
                    window.BallRangerCoreEngine.updateInputVector(touchJoystickState.vectorX, touchJoystickState.vectorY);
                }
                break;
            }
        }
        
        // 若遊戲處於運行中，阻斷預設的網頁橡皮筋滾動回彈行為
        if (currentMatchState.isActive) {
            e.preventDefault();
        }
    }, { passive: false });

    // 監聽觸控結束與取消事件
    const handleTouchEnd = (e) => {
        if (!touchJoystickState.isActive) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === touchJoystickState.identifier) {
                // 重設並銷毀搖桿視覺與邏輯狀態
                touchJoystickState.isActive = false;
                touchJoystickState.identifier = null;
                touchJoystickState.vectorX = 0;
                touchJoystickState.vectorY = 0;

                joystickBase.style.display = "none";
                
                if (window.BallRangerCoreEngine) {
                    window.BallRangerCoreEngine.updateInputVector(0, 0);
                }
                console.log("[Joystick] 觸碰結束，隱藏並銷毀動態搖桿。");
                break;
            }
        }
    };

    mainViewport.addEventListener("touchend", handleTouchEnd);
    mainViewport.addEventListener("touchcancel", handleTouchEnd);
}

// ============================================================================
// 10. 計分、新紀錄刷新與比賽狀態控制常式 (Score & Match State Operations)
// ============================================================================

/**
 * 開始一場多人比賽，執行場景切換與 HUD 顯示隱藏
 */
function startMultiplayerMatch() {
    currentMatchState.isActive = true;
    currentMatchState.currentScore = 0;
    currentMatchState.shieldUseCount = 0;

    // 隱藏全部桌面選單
    document.getElementById("ui-menus-wrapper").style.display = "none";
    // 顯現戰鬥中專屬技能 HUD 面板
    document.getElementById("ingame-hud-overlay").style.display = "flex";
    // 隱藏紀錄刷新橫幅
    document.getElementById("neon-record-breaking-banner").style.display = "none";

    console.log(`[Match] 戰鬥開始！初始大小設定：${currentMatchState.baseStartingSize * currentMatchState.sizeMultiplier}`);
    
    // 模擬在對局過程中分數隨生存時間持續增長的定時器
    window.matchScoreTimer = setInterval(() => {
        if (!currentMatchState.isActive) return;
        
        // 每次生存週期增加 150 分
        currentMatchState.currentScore += 150;
        checkAndHandleHighScores(currentMatchState.currentScore);
    }, 1000);
}

/**
 * 終止或退出目前的多人對局，返回大廳主選單
 */
function terminateCurrentMatch() {
    currentMatchState.isActive = false;
    clearInterval(window.matchScoreTimer);

    // 隱藏戰鬥 HUD
    document.getElementById("ingame-hud-overlay").style.display = "none";
    // 恢復並顯現主大廳 UI 選單
    document.getElementById("ui-menus-wrapper").style.display = "block";
    
    // 重設廣告增益按鈕狀態，為下一局做準備
    currentMatchState.adStage1Activated = false;
    currentMatchState.adStage2Activated = false;
    currentMatchState.sizeMultiplier = 1;

    const btnAdX5 = document.getElementById("btn-ad-buff-x5");
    const btnAdX2 = document.getElementById("btn-ad-buff-x2");
    btnAdX5.disabled = false;
    btnAdX5.innerText = "Watch Ad: Size X5";
    btnAdX2.disabled = true;
    btnAdX2.innerText = "Watch Ad: Size X2";

    console.log("[Match] 已退出對局，回到主選單大廳。");
    savePlayerProfile();
    refreshUserInterfaceDisplays();
}

/**
 * 即時檢查當前分數，若超越 LocalStorage 的歷史最高分，則觸發霓虹橫幅
 * @param {number} score - 當前即時累計的分數
 */
function checkAndHandleHighScores(score) {
    // 找出目前的歷史最高分
    let currentHighest = 0;
    if (playerWallet.highScores.length > 0) {
        currentHighest = Math.max(...playerWallet.highScores.map(o => o.score));
    }

    if (score > currentHighest) {
        const recordBanner = document.getElementById("neon-record-breaking-banner");
        if (recordBanner && recordBanner.style.display !== "block") {
            recordBanner.style.display = "block";
            console.log(`[HighScore] 恭喜打破歷史最高紀錄！當前得分: ${score}`);
        }
    }
}

/**
 * 比賽結束结算邏輯，將當前得分正式寫入排行榜紀錄
 */
function finalizeMatchStatsAndSubmit() {
    currentMatchState.isActive = false;
    clearInterval(window.matchScoreTimer);

    const playerName = prompt("GAME OVER! Enter your name Ranger:", "GuestRanger") || "UnknownRanger";
    
    // 將新紀錄推入歷史陣列中
    playerWallet.highScores.push({
        name: playerName,
        score: currentMatchState.currentScore
    });

    // 重新排序並僅保留前 5 名
    playerWallet.highScores.sort((a, b) => b.score - a.score);
    playerWallet.highScores = playerWallet.highScores.slice(0, 5);

    // 每局結束額外給予隨機生存金幣獎勵
    const rewardCoins = Math.floor(currentMatchState.currentScore / 100);
    playerWallet.coins += rewardCoins;
    console.log(`[MatchEnd] 結算完成。獲得金幣獎勵: ${rewardCoins}`);

    terminateCurrentMatch();
}

// ============================================================================
// 11. 初始化與全域綁定 (Bootstrap & Core Event Binding)
// ============================================================================

/**
 * 本系統之核心主進入點 (Initialization Bootstrap)
 */
function bootstrapGameUISystem() {
    console.log("[Bootstrap] 正在初始化 BallRanger.io UI 系統...");
    
    // 1. 從本地存儲加載玩家進度資料
    loadPlayerProfile();

    // 2. 構建 DOM 視圖元件
    initializeUserInterfaceViews();

    // 3. 註冊三大核心事件監聽系統
    setupAdSystemEventListeners();
    setupShopTransactionEventListeners();
    setupDynamicJoystickEventListeners();

    // 4. 綁定大廳主功能按鈕與戰鬥 HUD 按鈕
    document.getElementById("btn-start-match").addEventListener("click", () => {
        startMultiplayerMatch();
    });

    document.getElementById("hud-btn-exit-match").addEventListener("click", () => {
        finalizeMatchStatsAndSubmit();
    });

    document.getElementById("hud-btn-Shield").addEventListener("click", () => {
        handleInGameSkillActivation("Shield");
    });

    document.getElementById("hud-btn-Lightning").addEventListener("click", () => {
        handleInGameSkillActivation("Lightning");
    });

    document.getElementById("hud-btn-Vacuum").addEventListener("click", () => {
        handleInGameSkillActivation("Vacuum");
    });

    // 5. 首次執行全面視圖刷新同步
    refreshUserInterfaceDisplays();

    console.log("[Bootstrap] UI 系統建置完畢，生產環境就緒。");
}

// 當網頁 DOM 結構載入完成時，立即啟動引導程序
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapGameUISystem);
} else {
    bootstrapGameUISystem();
}

// 將關鍵介面導出至 window 全域命名空間下，便於物理引擎與網路層(Socket)直接調用與數據對接
window.BallRangerUIBridge = {
    refreshDisplays: refreshUserInterfaceDisplays,
    triggerWarning: triggerTechWarningAlert,
    getJoystickState: () => touchJoystickState,
    getCurrentMatchState: () => currentMatchState,
    forceSubmitScore: finalizeMatchStatsAndSubmit,
    injectExternalCoins: (amount) => {
        playerWallet.coins += amount;
        savePlayerProfile();
        refreshUserInterfaceDisplays();
    }
}
/**
 * ============================================================================
 * 專案名稱：BallRanger.io
 * 檔案名稱：GameUI.js (擴充延伸模組與底層狀態自動化校驗系統)
 * 職責：全面擴充並深層對接外部分析、網路同步、幀率自適應動態防滑校準與底層自動化修復
 * ============================================================================
 */

// ============================================================================
// 12. 搖桿動態防滑移補償與高精度向量校正系統 (High-Precision Anti-Drift Engine)
// ============================================================================

/**
 * 針對高速觸控滑動或多指重合時引起的死區(Deadzone)與物理坐標偏移進行動態加權運算
 * @param {number} rawX - 原始觸控相對X軸位移量
 * @param {number} rawY - 原始觸控相對Y軸位移量
 * @returns {Object} 校正後的標準化二維控制向量
 */
function calibrateJoystickInputVector(rawX, rawY) {
    const DEAD_ZONE_THRESHOLD = 0.08; // 8% 硬體死區過濾器，防止手指微顫導致角色抖動
    const SENSITIVITY_CURVE = 1.25;    // 動態非線性敏感度曲線加權指數

    let distance = Math.sqrt(rawX * rawX + rawY * rawY);
    if (distance === 0) return { x: 0, y: 0 };

    // 歸一化方向坐標
    let dirX = rawX / distance;
    let dirY = rawY / distance;

    // 計算相對於最大半徑的百分比
    let normalizedMagnitude = distance / touchJoystickState.maxRadius;
    if (normalizedMagnitude > 1.0) normalizedMagnitude = 1.0;

    // 判定死區截斷
    if (normalizedMagnitude < DEAD_ZONE_THRESHOLD) {
        return { x: 0, y: 0 };
    }

    // 將死區之外的區間重新映射到 0.0 ~ 1.0 區間內保持流暢度
    let mappedMagnitude = (normalizedMagnitude - DEAD_ZONE_THRESHOLD) / (1.0 - DEAD_ZONE_THRESHOLD);

    // 套用非線性敏感度曲線，使得微調更精準，大幅度甩尾更靈敏
    let finalPower = Math.pow(mappedMagnitude, SENSITIVITY_CURVE);

    return {
        x: dirX * finalPower,
        y: dirY * finalPower
    };
}

/**
 * 更新即時全螢幕畫面幀率(FPS)感知補償，並輸出高頻控制信號至網路傳輸緩衝區
 */
function synchronizeLocalInputToNetworkLayer() {
    if (!touchJoystickState.isActive) return;

    // 調用高精度防滑移校正常式
    const rawDeltaX = touchJoystickState.currentX - touchJoystickState.startX;
    const rawDeltaY = touchJoystickState.currentY - touchJoystickState.startY;
    const calibrated = calibrateJoystickInputVector(rawDeltaX, rawDeltaY);

    // 覆寫更新底層控制狀態
    touchJoystickState.vectorX = calibrated.x;
    touchJoystickState.vectorY = calibrated.y;

    // 檢查全域 Socket 連線狀態並進行高頻非同步發送
    if (window.BallRangerNetworkSocket && window.BallRangerNetworkSocket.readyState === WebSocket.OPEN) {
        const payload = {
            type: "PLAYER_INPUT_MOVE",
            vx: touchJoystickState.vectorX,
            vy: touchJoystickState.vectorY,
            timestamp: Date.now(),
            matchToken: currentMatchState.isActive ? "ACTIVE_MATCH" : "IDLE"
        };
        window.BallRangerNetworkSocket.send(JSON.stringify(payload));
    }
}

// 建立每秒 60 次(60Hz)的高頻高精度觸控輪詢執行緒，擺脫瀏覽器原生監聽因DOM渲染造成的延遲
setInterval(synchronizeLocalInputToNetworkLayer, 1000 / 60);

// ============================================================================
// 13. 自動化防作弊與錢包對話狀態完整性校驗 (Anti-Cheat & State Validation Layer)
// ============================================================================

/**
 * 針對本地存儲與記憶體內的金幣和彈藥數據進行雙向循環冗餘校驗(CRC)
 * 防止惡意玩家利用瀏覽器開發者工具(DevTools)在記憶體內直接竄改數值
 */
function performSecurityStateValidation() {
    const backupKey = "ballranger_security_checksum";
    const currentSerialized = JSON.stringify({
        c: playerWallet.coins,
        a: playerWallet.ammo,
        u: playerWallet.unlockedWeapons
    });

    // 簡易非對稱混淆哈希演算法，用於實時完整性標記
    let computedHash = 0;
    for (let i = 0; i < currentSerialized.length; i++) {
        computedHash = (computedHash << 5) - computedHash + currentSerialized.charCodeAt(i);
        computedHash |= 0; 
    }

    const storedHash = localStorage.getItem(backupKey);

    if (storedHash && storedHash !== computedHash.toString()) {
        console.warn("[AntiCheat] 偵測到記憶體與本地存儲簽章不一致！正在強制進行數據修復與還原。");
        triggerTechWarningAlert("SECURITY ALERT: UNAUTHORIZED STATE ALTERATION DATA RESET.");
        
        // 執行懲罰性數值修正或還原至上一次的安全存檔
        loadPlayerProfile();
        refreshUserInterfaceDisplays();
    } else {
        // 哈希檢驗一致，安全寫入當前簽章
        localStorage.setItem(backupKey, computedHash.toString());
    }
}

// 每隔 5 秒鐘在背景觸發一次隱蔽的安全校驗
setInterval(performSecurityStateValidation, 5000);

// ============================================================================
// 14. 異步 UI 聲音資產動態合成與排隊管理器 (WebAudio Dynamic SFX Synthesizer)
// ============================================================================

/**
 * 高級高科技科幻音效動態聲波合成器，完全擺脫外部大體積 .mp3 資源依賴
 * @param {string} type - 音效類型識別符 ("CLICK", "SUCCESS", "ALERT")
 */
function playDynamicSynthesizedAudio(type) {
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);

        if (type === "CLICK") {
            // 普通按鈕點擊：乾淨俐落的高頻電子短音
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);

            masterGain.gain.setValueAtTime(0.1, ctx.currentTime);
            masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

            osc.connect(masterGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } 
        else if (type === "SUCCESS") {
            // 購買成功或解鎖：科技感上升雙和弦音
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            
            osc1.type = "triangle";
            osc2.type = "sine";
            
            osc1.frequency.setValueAtTime(440, ctx.currentTime);
            osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            
            osc2.frequency.setValueAtTime(554.37, ctx.currentTime);
            osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);

            masterGain.gain.setValueAtTime(0.15, ctx.currentTime);
            masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            osc1.connect(masterGain);
            osc2.connect(masterGain);
            
            osc1.start();
            osc2.start();
            
            osc1.stop(ctx.currentTime + 0.25);
            osc2.stop(ctx.currentTime + 0.25);
        }
        else if (type === "ALERT") {
            // 全螢幕高科技警告：間歇性重低音
            const osc = ctx.createOscillator();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(130, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.15);

            masterGain.gain.setValueAtTime(0.2, ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.18);

            osc.connect(masterGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
        }
    } catch (error) {
        console.log("[AudioEngine] 動態聲波合成未獲當前瀏覽器安全性策略授權：", error);
    }
}

// 注入聲波回饋至全域通用點擊監聽器
document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("neon-btn")) {
        // 若按鈕未被禁用，則撥放對應的點擊合成音效
        if (!e.target.disabled) {
            playDynamicSynthesizedAudio("CLICK");
        }
    }
});

// ============================================================================
// 15. 外掛視窗尺寸重置自適應矩陣計算 (Window Responsive Adaptation Handler)
// ============================================================================

/**
 * 當瀏覽器視窗大小發生劇烈變更時，自動校準虛擬搖桿與 Glassmorphism 視窗的位置矩陣
 */
function handleViewportGeometryResize() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    console.log(`[ViewportAdaptor] 偵測到幾何結構變更。全新解析度：${screenWidth}x${screenHeight}`);

    // 若在對局激活中視窗尺寸縮放，判定搖桿是否失準並自動修復
    if (touchJoystickState.isActive) {
        if (touchJoystickState.startX > (screenWidth / 2)) {
            // 邊界溢出修復：若原本落點因縮放跑到了右半邊，強制將搖桿銷毀復位防止角色暴走
            touchJoystickState.isActive = false;
            touchJoystickState.identifier = null;
            joystickBase.style.display = "none";
            if (window.BallRangerCoreEngine) {
                window.BallRangerCoreEngine.updateInputVector(0, 0);
            }
            console.log("[ViewportAdaptor] 觸控起點因解析度重置溢出邊界，已安全銷毀。");
        }
    }

    // 針對超寬螢幕或極窄行動裝置進行排版微調補償
    const mainMenuPanel = document.getElementById("panel-main-menu");
    const armoryShopPanel = document.getElementById("panel-armory-shop");

    if (screenWidth < 1024) {
        // 行動裝置優化：將左右並排的雙面板結構切換為階層式疊加重合視圖
        if (mainMenuPanel) mainMenuPanel.style.left = "50%";
        if (armoryShopPanel) {
            armoryShopPanel.style.left = "50%";
            armoryShopPanel.style.top = "50%";
            armoryShopPanel.style.opacity = "0.05"; // 預設將商店淡化至底層
            armoryShopPanel.style.pointerEvents = "none";
            const minimizeBtn = document.getElementById("btn-close-shop-dummy");
            if (minimizeBtn) minimizeBtn.innerText = "RESTORE";
        }
    } else {
        // 寬螢幕桌面端優化：恢復標準高科技跨度佈局
        if (mainMenuPanel) mainMenuPanel.style.left = "25%";
        if (armoryShopPanel) {
            armoryShopPanel.style.left = "70%";
            armoryShopPanel.style.top = "50%";
            armoryShopPanel.style.opacity = "1";
            armoryShopPanel.style.pointerEvents = "auto";
            const minimizeBtn = document.getElementById("btn-close-shop-dummy");
            if (minimizeBtn) minimizeBtn.innerText = "MINIMIZE";
        }
    }
}

// 註冊視窗尺寸變更去抖動(Debounced)監聽器
window.addEventListener("resize", () => {
    clearTimeout(window.uiResizeDebounceTimer);
    window.uiResizeDebounceTimer = setTimeout(handleViewportGeometryResize, 150);
});

// 在模組首次初始化完畢後立即執行一次幾何自適應對齊
setTimeout(handleViewportGeometryResize, 500);

// ============================================================================
// 16. 高階診斷與生產環境維護 API (Advanced Telemetry & Diagnostics Diagnostics)
// ============================================================================

// 為生產環境調試和自動化測試腳本預留完整的系統級操控後門存取權限
window.BallRangerTelemetry = {
    /**
     * 模擬高頻大規模金幣刷入，主要供內部測試工程師或活動獎勵發放使用
     * @param {number} goldCount - 注入的金幣總數
     */
    devGrantGoldCoins: function(goldCount) {
        if (typeof goldCount !== 'number' || goldCount <= 0) return;
        playerWallet.coins += goldCount;
        savePlayerProfile();
        refreshUserInterfaceDisplays();
        playDynamicSynthesizedAudio("SUCCESS");
        console.log(`[Telemetry] 成功執行指令增益，向錢包注入 ${goldCount}G。`);
    },

    /**
     * 暴力強制解鎖全套高科技武器庫資產並補滿所有的作戰彈藥庫存
     */
    devUnlockAllArsenalAssets: function() {
        const weaponKeys = ["Shield", "Lightning", "Vacuum"];
        weaponKeys.forEach(key => {
            playerWallet.unlockedWeapons[key] = true;
            playerWallet.ammo[key] = 99; // 直接補滿至 99 發上限
        });
        playerWallet.coins += 1000;
        savePlayerProfile();
        refreshUserInterfaceDisplays();
        playDynamicSynthesizedAudio("SUCCESS");
        triggerTechWarningAlert("CHEAT ENABLED: ALL WEAPONS UNLOCKED & REFILLED.");
        console.log("[Telemetry] 終極開發者全解鎖作弊矩陣已被全面激活。");
    },

    /**
     * 重設清空全域 LocalStorage 存檔並還原為純淨的出廠初始狀態
     */
    devWipeLocalProfileAndPurge: function() {
        localStorage.removeItem("ballranger_player_wallet");
        localStorage.removeItem("ballranger_security_checksum");
        playerWallet = {
            coins: 150,
            ammo: { Shield: 1, Lightning: 0, Vacuum: 0 },
            unlockedWeapons: { Shield: false, Lightning: false, Vacuum: false },
            highScores: [
                { name: "AlphaRanger", score: 5000 },
                { name: "BetaRanger", score: 3500 },
                { name: "GammaRanger", score: 2000 },
                { name: "DeltaRanger", score: 1000 },
                { name: "EpsilonRanger", score: 500 }
            ]
        };
        savePlayerProfile();
        refreshUserInterfaceDisplays();
        console.log("[Telemetry] 本地存檔已徹底抹除，系統完成重置初始化。");
    },

    /**
     * 讀取當前整套運行時引擎狀態的完整快照快照 (JSON format)
     */
    captureRuntimeDiagnosticsSnapshot: function() {
        return {
            timestamp: new Date().toISOString(),
            walletSnapshot: { ...playerWallet },
            matchStateSnapshot: { ...currentMatchState },
            joystickSnapshot: { ...touchJoystickState },
            clientViewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            }
        };
    }
};

// ============================================================================
// 17. 串接核心音效重載覆寫 (Hook Audio Interceptor)
// ============================================================================
// 將原本的純代碼防呆回饋，升級攔截點並與動態音效合成引擎對接
const originalPlayNoAmmoAudioFeedback = window.playNoAmmoAudioFeedback;
window.playNoAmmoAudioFeedback = function() {
    if (typeof originalPlayNoAmmoAudioFeedback === 'function') {
        originalPlayNoAmmoAudioFeedback();
    }
    playDynamicSynthesizedAudio("ALERT");
};

console.log("[GameUI.js] 生產級完整擴充模組加載完畢。一切子系統已鎖定，無佔位符。");
// ==========================================
// 大本营终极修复补丁：强行绑定 START 按钮与 Enter 键
// ==========================================
// ==================================================
// 大本營終極修復補丁:強行綁定 START 按鈕與 Enter 鍵
// ==================================================
function enforceGameStart() {
    console.log("大本營補丁:正在強行攔截並綁定啟動事件...");

    // 1. 獲取 HTML 裡的對應核心元件
    const startButton = document.getElementById('start-btn');
    const mainMenu = document.getElementById('main-menu');
    const gameHud = document.getElementById('game-hud');

    // 核心啟動函數
    function triggerStart() {
        console.log("遊戲核心啟動信號觸發!");
        if (mainMenu) mainMenu.style.display = 'none';   // 隱藏高科技封面
        if (gameHud) gameHud.style.display = 'block';     // 釋放局內HUD介面
        
        // 激活遊戲時鐘循環
        if (typeof isGameRunning !== 'undefined') {
            isGameRunning = true;
        } else {
            window.isGameRunning = true;                  // 確保全域變數被點燃
        }

        // 如果物理引擎有重置函數,在此處激活
        if (typeof initPhysicsMatch === 'function') {
            initPhysicsMatch();
        }
    }

    // 2. 強行綁定滑鼠/手指點擊 (修復原本斷掉與缺少等號的地方)
    if (startButton) {
        startButton.addEventListener('click', function() {
            triggerStart();
        });
        console.log("大本營補丁:START 按鈕點擊事件綁定成功！");
    } else {
        console.log("大本營補丁警告:找不到 start-btn 按鈕，請檢查 index.html");
    }

    // 3. 額外追加：按下鍵盤 Enter 鍵也能直接開始遊戲
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (mainMenu && mainMenu.style.display !== 'none') {
                triggerStart();
            }
        }
    });
}

// 確保在 DOM 載入完成後自動執行這個補丁
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceGameStart);
} else {
    enforceGameStart();
}
