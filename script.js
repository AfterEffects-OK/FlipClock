// State
let is24Hour = true;
let prevTimeStr = "000000";
let prevDateStr = "000000";
let prevDayOfWeekStr = "(日)";
let dowLanguage = 'ja';
let clockScale = 1.0;
let currentTheme = 'dark'; 
let initialPinchDistance = 0; // for pinch zoom
let initialPinchScale = 1.0; // for pinch zoom
let currentSlide = 0; // 0: Weather, 1: RSS
let autoSwipeInterval = null;
let slides = []; // 全スライド要素
let settingsIndex = -1; // 設定スライドのインデックス
let isAppInitialized = false; // アプリ初期化済みフラグ
window.flipClockPlugins = []; // 登録されたプラグインのリスト
// アニメーション関連の定数 (CSSから取得)
const FLIP_DURATION_NORMAL_MS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flip-duration-normal')) * 1000;
const FLIP_DURATION_FAST_MS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flip-duration-fast')) * 1000;
const HOUR_FLIP_DELAY_MS = FLIP_DURATION_FAST_MS + 40; // 高速フリップ時間 + バッファ
let isDowAnimating = false; // 曜日フリップアニメーションの実行中フラグ
let isTimeModeAnimating = false; // 時刻モード切り替えアニメーションの実行中フラグ
const DOW_FLIP_SEQUENCE_3CHAR = [
    '(日)', '(月)', '(火)', '(水)', '(木)', '(金)', '(土)', // 日本語
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'      // 英語
];

/**
 * 外部ファイルからスライドを追加するためのグローバル関数
 * @param {object} config - { id, icon, html, onInit }
 */
window.addFlipClockSlide = function(config) {
    window.flipClockPlugins.push(config);
    // アプリが既に起動している場合は即座に追加して再描画
    if (isAppInitialized) {
        injectPlugin(config);
        initCarousel();
        // カルーセル位置の再計算が必要な場合があるため更新
        updateCarousel();
    }
};

/**
 * プラグインをDOMに注入する内部関数
 */
function injectPlugin(plugin) {
    const track = document.getElementById('carousel-track');
    const settingsSlide = document.getElementById('slide-settings');
    
    // 既存の要素があるか確認
    const existingEl = document.getElementById(plugin.id);

    const div = document.createElement('div');
    div.className = 'carousel-slide';
    div.id = plugin.id;
    div.dataset.icon = plugin.icon;
    div.innerHTML = plugin.html;
    
    if (existingEl) {
        // 既存があれば置換（更新）
        track.replaceChild(div, existingEl);
    } else {
        // 設定画面の直前に挿入する
        track.insertBefore(div, settingsSlide);
    }
    
    if (typeof plugin.onInit === 'function') {
        plugin.onInit(div);
    }
}

// DOM Elements
const body = document.body;
const timeWrapper = document.querySelector('.time-wrapper'); // Used for height calc
const contentRow = document.getElementById('content-row'); // Used for scaling
const toggleSettingsBtn = document.getElementById('toggle-settings');

const btns = {
    mode24: document.getElementById('mode-24'),
    mode12: document.getElementById('mode-12'),
    langJa: document.getElementById('lang-ja'),
    langEn: document.getElementById('lang-en'),
    themeBtns: document.querySelectorAll('.theme-btn'), 
    customColorPicker: document.getElementById('custom-color-picker'),
    sizeSlider: document.getElementById('size-slider'), // コンテナDIV
    resetSizeBtn: document.getElementById('reset-size-btn'),
    rssUrlInput: document.getElementById('rss-url'),
};

// Define objects to store DOM elements for better code structure
const allDigits = {
    time: {
        hTens: document.getElementById('h-tens'),
        hOnes: document.getElementById('h-ones'),
        mTens: document.getElementById('m-tens'),
        mOnes: document.getElementById('m-ones'),
        sTens: document.getElementById('s-tens'),
        sOnes: document.getElementById('s-ones')
    },
    date: {
        yTens: document.getElementById('d-year-tens'),
        yOnes: document.getElementById('d-year-ones'),
        mTens: document.getElementById('d-month-tens'),
        mOnes: document.getElementById('d-month-ones'),
        dTens: document.getElementById('d-day-tens'),
        dOnes: document.getElementById('d-day-ones')
    },
    dow: {
        char1: document.getElementById('dow-char1'),
        char2: document.getElementById('dow-char2'),
        char3: document.getElementById('dow-char3')
    }
};

// Weather Widget Elements
const weatherWidgetContainer = document.getElementById('weather-widget-container');
const areaSelect = document.getElementById('areaSelect');
const refreshBtn = document.getElementById('refreshBtn');
const loading = document.getElementById('loading');
const weatherContent = document.getElementById('weather-content');
const todayCard = document.getElementById('todayCard');
const forecastList = document.getElementById('forecastList');
const errorMessage = document.getElementById('errorMessage');
const syncTime = document.getElementById('syncTime');

// RSS Elements
const rssLoading = document.getElementById('rss-loading');
const rssError = document.getElementById('rss-error');
const rssList = document.getElementById('rss-list');
const rssListView = document.getElementById('rss-list-view');
const rssDetailView = document.getElementById('rss-detail-view');
const rssBackBtn = document.getElementById('rss-back-btn');
const rssDetailTitle = document.getElementById('rss-detail-title');
const rssDetailDate = document.getElementById('rss-detail-date');
const rssDetailDesc = document.getElementById('rss-detail-desc');
const rssDetailLink = document.getElementById('rss-detail-link');
const rssDetailQr = document.getElementById('rss-detail-qr');

// Initialize
function init() {
    // 保存された設定を読み込む
    loadSettings();


    // テーマとサイズを適用
    setTheme(currentTheme);
    
    // Load User Plugins from LocalStorage
    loadSavedPlugins();
    
    // 全てのカードの初期アニメーション速度を通常に設定
    setAllCardsAnimationDuration(FLIP_DURATION_NORMAL_MS);

    const initialDowStr = getDayOfWeek('ja');
    flipDow(initialDowStr, true);
    prevDayOfWeekStr = initialDowStr;
    
    updateDisplay(true);

    // requestAnimationFrameを使ったメインループを開始
    requestAnimationFrame(updateLoop);
    
    // Event Listeners for Time/Language
    btns.mode24.addEventListener('click', () => setMode(true));
    btns.mode12.addEventListener('click', () => setMode(false));
    btns.langJa.addEventListener('click', () => setDowLanguage('ja'));
    btns.langEn.addEventListener('click', () => setDowLanguage('en'));
    
    // Event Listeners for Theme
    btns.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            setTheme(theme);
        });
    });

    // カスタムカラーピッカーの値が変更されたら、カスタムテーマを即時適用
    btns.customColorPicker.addEventListener('input', () => {
        if (currentTheme === 'custom') {
            setTheme('custom');
        }
    });
    
    // 設定パネルの開閉トグル
    toggleSettingsBtn.addEventListener('click', toggleSettingsPanel);

    // サイズ調整用のイベントリスナー
    btns.resetSizeBtn.addEventListener('click', resetSize);
    initCustomSlider();

    // マウスホイールでのサイズ調整
    timeWrapper.addEventListener('wheel', handleWheelScale);

    // ピンチイン・アウトでのサイズ調整
    timeWrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    timeWrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    timeWrapper.addEventListener('touchend', handleTouchEnd);
    
    // Register Plugins (Insert before carousel init)
    window.flipClockPlugins.forEach(injectPlugin);
    isAppInitialized = true;

    // Initialize Carousel (Dynamic slides)
    initCarousel();

    // Initialize Weather
    fetchWeatherData(areaSelect.value);
    areaSelect.addEventListener('change', (e) => {
        saveSettings();
        fetchWeatherData(e.target.value);
    });
    refreshBtn.addEventListener('click', () => {
        if (currentSlide === 0) {
            fetchWeatherData(areaSelect.value, true);
        } else {
            fetchRSS(btns.rssUrlInput.value, true);
        }
    });
    btns.rssUrlInput.addEventListener('change', saveSettings);

    // Sync weather widget height to clock height
    window.addEventListener('resize', syncWeatherHeight);
    // Initial sync
    setTimeout(syncWeatherHeight, 100);

    // ページを閉じる/リロードする際にも確実に保存 (PWA/モバイル対応)
    window.addEventListener('pagehide', saveSettings);

    // Carousel Swipe Events
    weatherWidgetContainer.addEventListener('touchstart', handleSwipeStart, { passive: false });
    weatherWidgetContainer.addEventListener('touchmove', handleSwipeMove, { passive: false });
    weatherWidgetContainer.addEventListener('touchend', handleSwipeEnd);
    weatherWidgetContainer.addEventListener('mousedown', handleSwipeStart);
    weatherWidgetContainer.addEventListener('mousemove', handleSwipeMove);
    weatherWidgetContainer.addEventListener('mouseup', handleSwipeEnd);
    weatherWidgetContainer.addEventListener('mouseleave', handleSwipeEnd);
    
    // RSS Back Button
    rssBackBtn.addEventListener('click', () => {
        rssDetailView.classList.add('hidden');
        rssListView.classList.remove('hidden');
        stopRssDetailTimeout();
    });
    
    // Initial RSS Fetch if URL exists
    if (btns.rssUrlInput.value) {
        fetchRSS(btns.rssUrlInput.value);
    }

    startAutoSwipe();

    // RSS Detail View Auto-Close on Inactivity
    const resetDetailTimer = () => {
        if (!rssDetailView.classList.contains('hidden')) {
            startRssDetailTimeout();
        }
    };
    rssDetailView.addEventListener('mousemove', resetDetailTimer);
    rssDetailView.addEventListener('touchstart', resetDetailTimer);
    rssDetailView.addEventListener('click', resetDetailTimer);
    rssDetailView.addEventListener('scroll', resetDetailTimer, true);

    // Setup Drag and Drop for Plugins
    setupPluginDropZone();
    renderPluginList();
}

/**
 * すべてのフリップカードのアニメーション時間を設定します。
 * @param {number} durationMs - アニメーション時間 (ミリ秒)
 */
function setAllCardsAnimationDuration(durationMs) {
    const durationS = `${durationMs / 1000}s`;
    // :rootの--flip-duration変数を更新することで、すべてのカードに影響を与えます。
    document.documentElement.style.setProperty('--flip-duration', durationS);
}

/**
 * localStorageから設定を読み込み、適用します。
 */
function loadSettings() {
    currentTheme = localStorage.getItem('flipClockTheme') || 'dark';
    const customColor = localStorage.getItem('flipClockCustomColor');
    clockScale = parseFloat(localStorage.getItem('flipClockScale')) || 1.0;
    const savedArea = localStorage.getItem('flipClockArea');
    const savedRssUrl = localStorage.getItem('flipClockRssUrl');

    if (customColor) {
        btns.customColorPicker.value = customColor;
    }

    if (savedArea) {
        areaSelect.value = savedArea;
    }

    if (savedRssUrl !== null) {
        btns.rssUrlInput.value = savedRssUrl;
    } else {
        btns.rssUrlInput.value = "https://www3.nhk.or.jp/rss/news/cat0.xml";
    }

    // CSS変数を更新してサイズを適用
    contentRow.style.setProperty('--clock-scale', clockScale);

    // カスタムスライダーの位置を更新
    updateSliderThumbPosition(clockScale);
}

/**
 * 現在の設定をlocalStorageに保存します。
 */
function saveSettings() {
    localStorage.setItem('flipClockTheme', currentTheme);
    localStorage.setItem('flipClockScale', clockScale);
    localStorage.setItem('flipClockArea', areaSelect.value);
    localStorage.setItem('flipClockRssUrl', btns.rssUrlInput.value);
}

/**
 * メインの更新ループ。requestAnimationFrameで呼び出されます。
 */
function updateLoop() {
    updateDisplay(false);
    // 次のフレームで再度updateLoopを呼び出す
    requestAnimationFrame(updateLoop);
}

/**
 * 設定スライドへの切り替えをトグルします。
 */
function toggleSettingsPanel() {
    if (currentSlide === settingsIndex) {
        currentSlide = 0; // Go back to Weather
        toggleSettingsBtn.querySelector('i').classList.replace('fa-times', 'fa-cog'); // 歯車アイコンに戻す
        toggleSettingsBtn.setAttribute('aria-label', '設定を開く');
    } else {
        currentSlide = settingsIndex; // Go to Settings
        toggleSettingsBtn.querySelector('i').classList.replace('fa-cog', 'fa-times'); // 閉じるアイコンに変更
        toggleSettingsBtn.setAttribute('aria-label', '設定を閉じる');
    }
    updateCarousel();
    startAutoSwipe();
}

/**
 * テーマを切り替え、bodyのクラスとカスタムCSS変数を更新します。
 * @param {string} themeName 'dark', 'light', 'transparent', 'custom'
 */
function setTheme(themeName) {
    currentTheme = themeName;
    
    // 1. クラスの更新とボタンのアクティブ状態の設定
    const weatherWidget = document.getElementById('weather-widget-container');
    body.classList.remove('theme-light', 'theme-transparent', 'theme-custom'); 
    btns.themeBtns.forEach(btn => btn.classList.remove('active'));

    const activeButton = document.getElementById(`theme-${themeName}`);
    if (activeButton) {
        activeButton.classList.add('active');
    } else if (themeName === 'custom') {
            document.getElementById('theme-custom').classList.add('active');
    }

    // CSS変数のリセット
    document.documentElement.style.removeProperty('--body-bg');
    document.documentElement.style.removeProperty('--text-color');


    // 2. CSS変数とクラスの適用
    switch(themeName) {
        case 'dark':
            document.documentElement.style.setProperty('--body-bg', '#1a1a1a');
            document.documentElement.style.setProperty('--text-color', '#e0e0e0');
            weatherWidget.classList.add('dark');
            break;
        case 'light':
            body.classList.add('theme-light');
            weatherWidget.classList.remove('dark');
            break;
        case 'transparent':
            body.classList.add('theme-transparent');
            weatherWidget.classList.add('dark'); // 透明テーマは暗い背景前提なのでDarkモード
            break;
        case 'custom':
            const color = btns.customColorPicker.value;
            body.classList.add('theme-custom');
            document.documentElement.style.setProperty('--body-bg', color);
            weatherWidget.classList.add('dark'); // カスタムも一旦Darkベース
            // 背景色に応じて文字色を自動変更する機能を削除
            break;
    }
    saveSettings();
}

/**
 * カスタムスライダーの初期化とイベントリスナーの設定
 */
function initCustomSlider() {
    const slider = btns.sizeSlider;
    const thumb = slider.querySelector('.slider-thumb');
    let isDragging = false;

    const updateScaleFromPosition = (clientX) => {
        const rect = slider.getBoundingClientRect();
        const min = 0.2;
        const max = 5.0;
        
        let position = (clientX - rect.left) / rect.width;
        position = Math.max(0, Math.min(1, position)); // 0-1の範囲にクランプ

        clockScale = min + (max - min) * position;
        updateClockScale();
    };

    slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        thumb.style.transition = 'none'; // ドラッグ中はトランジションを無効化
        updateScaleFromPosition(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateScaleFromPosition(e.clientX);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            thumb.style.transition = ''; // トランジションを元に戻す
            saveSettings();
        }
    });
}

/**
 * スケール値に基づいて時計の表示を更新します。
 */
function updateClockScale() {
    contentRow.style.setProperty('--clock-scale', clockScale);
    updateSliderThumbPosition(clockScale);
}

/**
 * スケール値に基づいてスライダーのつまみの位置を更新します。
 * @param {number} scale - 現在のスケール値
 */
function updateSliderThumbPosition(scale) {
    const slider = btns.sizeSlider;
    const thumb = slider.querySelector('.slider-thumb');
    const min = 0.2;
    const max = 5.0;

    // スケール値から0-1の割合を計算
    const percentage = (scale - min) / (max - min);
    
    // つまみの幅を考慮して位置を計算
    const thumbWidth = thumb.offsetWidth;
    const trackWidth = slider.offsetWidth;
    const position = percentage * (trackWidth - thumbWidth);
    
    // trackWidthが0の場合にNaNになるのを防ぐ
    if (!isFinite(position)) return;

    thumb.style.left = `${position}px`;
}

/**
 * 時計のサイズをデフォルトにリセットします。
 */
function resetSize() {
    clockScale = 1.0;
    // トランジションを追加して滑らかにリセット
    contentRow.style.transition = 'transform 0.3s ease-in-out';
    updateClockScale();
    saveSettings();
    // トランジションが終わった後に元に戻す
    setTimeout(() => {
        contentRow.style.transition = 'transform 0.3s';
    }, 300);
}

/**
 * マウスホイールで時計のサイズを調整します。
 * @param {WheelEvent} event
 */
function handleWheelScale(event) {
    event.preventDefault(); // ページのスクロールを防止

    const scaleStep = 0.05;
    const min = 0.2;
    const max = 5.0;

    // ホイールを下にスクロールするとdeltaYは正、上にスクロールすると負
    if (event.deltaY < 0) {
        // 上にスクロール -> 拡大
        clockScale += scaleStep;
    } else {
        // 下にスクロール -> 縮小
        clockScale -= scaleStep;
    }
    clockScale = Math.max(min, Math.min(max, clockScale));
    updateClockScale();
    saveSettings();
}

/**
 * 2点間の距離を計算します。
 * @param {TouchList} touches
 * @returns {number}
 */
function getDistance(touches) {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );
}

/**
 * ピンチ操作の開始をハンドルします。
 * @param {TouchEvent} event
 */
function handleTouchStart(event) {
    if (event.touches.length === 2) {
        event.preventDefault(); // ページのズームを防止
        initialPinchDistance = getDistance(event.touches);
        initialPinchScale = clockScale;
    }
}

/**
 * ピンチ操作中の動きをハンドルします。
 * @param {TouchEvent} event
 */
function handleTouchMove(event) {
    if (event.touches.length === 2) {
        event.preventDefault(); // ページのスクロール/ズームを防止
        const newDistance = getDistance(event.touches);
        const scaleFactor = newDistance / initialPinchDistance;
        
        let newScale = initialPinchScale * scaleFactor;
        newScale = Math.max(0.2, Math.min(5.0, newScale)); // 最小・最大値の範囲内に収める

        clockScale = newScale;
        updateClockScale();
    }
}

/**
 * ピンチ操作の終了をハンドルします。
 * @param {TouchEvent} event
 */
function handleTouchEnd(event) {
    if (initialPinchDistance > 0) {
        initialPinchDistance = 0;
        saveSettings();
    }
}

// --- Carousel Initialization ---
function initCarousel() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    
    // Get all slides
    slides = Array.from(track.querySelectorAll('.carousel-slide'));
    
    // Find settings slide index
    settingsIndex = slides.findIndex(slide => slide.id === 'slide-settings');
    if (settingsIndex === -1) settingsIndex = slides.length - 1; // Default to last if not found

    // Generate dots
    dotsContainer.innerHTML = '';
    slides.forEach((slide, index) => {
        const iconClass = slide.getAttribute('data-icon') || 'fas fa-circle';
        const dot = document.createElement('i');
        dot.className = `${iconClass} dot ${index === 0 ? 'active' : ''}`;
        dot.dataset.index = index;
        dotsContainer.appendChild(dot);
    });
}

// --- Carousel Swipe Logic ---
let swipeStartX = 0;
let swipeStartY = 0;
let isSwiping = false;
let isMouseDown = false;

function handleSwipeStart(e) {
    if (e.type === 'mousedown') {
        isMouseDown = true;
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
    } else {
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
    }
    isSwiping = false;
}

function handleSwipeMove(e) {
    if (e.type === 'mousemove' && !isMouseDown) return;
    if (!swipeStartX) return;

    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const diffX = swipeStartX - currentX;
    const diffY = swipeStartY - currentY;

    // Detect horizontal swipe vs vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        isSwiping = true;
        if (e.cancelable) e.preventDefault(); // Prevent scrolling while swiping
    }
}

function handleSwipeEnd(e) {
    if (e.type === 'mouseup' || e.type === 'mouseleave') {
        if (!isMouseDown) return;
        isMouseDown = false;
    }
    if (!swipeStartX || !isSwiping) return;

    const endX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
    const diffX = swipeStartX - endX;
    const threshold = 50; // Swipe threshold

    if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
            // Swipe Left -> Next Slide
            if (currentSlide < slides.length - 1) currentSlide++;
        } else {
            // Swipe Right -> Prev Slide
            if (currentSlide > 0) currentSlide--;
        }
        updateCarousel();
        startAutoSwipe();
    }

    swipeStartX = 0;
    swipeStartY = 0;
    isSwiping = false;
}

function updateCarousel() {
    const track = document.getElementById('carousel-track');
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    // Update settings icon state if swiped manually
    if (currentSlide === settingsIndex) {
        toggleSettingsBtn.querySelector('i').classList.replace('fa-cog', 'fa-times');
    } else {
        toggleSettingsBtn.querySelector('i').classList.replace('fa-times', 'fa-cog');
    }
    
    // Update dots
    document.querySelectorAll('.dot').forEach(dot => {
        dot.classList.toggle('active', parseInt(dot.dataset.index) === currentSlide);
    });
    
    // Fetch RSS if switching to it and empty
    if (currentSlide === 1 && !rssList.hasChildNodes() && btns.rssUrlInput.value) {
        fetchRSS(btns.rssUrlInput.value);
    }
}

function startAutoSwipe() {
    if (autoSwipeInterval) clearInterval(autoSwipeInterval);
    autoSwipeInterval = setInterval(() => {
        if (!rssDetailView.classList.contains('hidden') || currentSlide === settingsIndex) return;
        
        // Cycle through content slides (0 to settingsIndex - 1)
        let nextSlide = currentSlide + 1;
        if (nextSlide >= settingsIndex) {
            nextSlide = 0;
        }
        currentSlide = nextSlide;
        
        updateCarousel();
    }, 30000);
}

/**
 * 指定されたモードとDateオブジェクトに基づいて時刻文字列を返します。
 * @param {boolean} is24 - 24時間モードかどうか
 * @param {Date} date - Dateオブジェクト
 * @returns {string} 時刻文字列 (HHTTSS)
 */
function getFormattedTimeString(is24, date = new Date()) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    // getHourDisplayNumberを使用
    hours = getHourDisplayNumber(is24, hours);

    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');

    return hStr + mStr + sStr;
}

/**
 * 24時間表示(0-23)を、指定されたモード(12H:1-12, 24H:0-23)に対応する数値に変換します。
 *
 * 注: 12Hモードでは、00:xx (午前0時台) は '00' と表示されます。
 * 12:xx (正午) は '12' と表示されます。
 *
 * @param {boolean} is24 - 24時間モードかどうか
 * @param {number} hour24 - 現在の24時間表示の時 (0-23)
 * @returns {number} 表示すべき時 (0-23)
 */
function getHourDisplayNumber(is24, hour24) {
        if (is24) {
            return hour24; // 0-23
        } else {
            if (hour24 === 0) return 0; // 00:xx (午前0時台) は '00' を表示
            if (hour24 >= 13) {
                return hour24 - 12; // 午後 (13-23 -> 1-11)
            }
            return hour24; // 午前 (1-11) または正午 (12)
        }
}

/**
 * 時刻モードを切り替え、フリップアニメーションを起動します。
 * @param {boolean} newIs24Hour - 新しいモードが24時間かどうか
 */
async function setMode(newIs24Hour) {
    if (isTimeModeAnimating) return; // アニメーション中は操作を無視
    if (is24Hour === newIs24Hour) return; // モードが同じなら何もしない

    const now = new Date();
    const current24Hour = now.getHours(); // 0-23 (内部的な基準時間)

    const oldIs24Hour = is24Hour; // 古いモードを保存
    const targetModeIs24H = newIs24Hour; // 目標モードをローカルに保存
    
    // 1. UIの更新 (ボタンのアクティブ状態)
    is24Hour = newIs24Hour;
    btns.mode24.classList.remove('active');
    btns.mode12.classList.remove('active');
    if (is24Hour) {
        btns.mode24.classList.add('active');
    } else {
        btns.mode12.classList.add('active');
    }
    
    isTimeModeAnimating = true;
    
    // 2. アニメーションの開始点 (古いモードの表示値) をアニメーションなしでセット
    //    および、アニメーション速度を高速に設定
    setAllCardsAnimationDuration(FLIP_DURATION_FAST_MS);

    const hTens = allDigits.time.hTens;
    const hOnes = allDigits.time.hOnes; 
    
    const oldHourNumber = getHourDisplayNumber(oldIs24Hour, current24Hour); 
    const oldHourStr = String(oldHourNumber).padStart(2, '0');
    
    // アニメーションの開始点を古い値に強制的に設定 (アニメーションなし)
    flipCard(hTens, oldHourStr[0], true);
    flipCard(hOnes, oldHourStr[1], true);
    
    
    // 3. 循環アニメーションシーケンスの構築 (修正: 00:00で24H表示に切り替わり、次のステップでターゲットモードに切り替える)
    const sequence = []; 
    let hourToAnimate;
    let displayFormatIs24H = oldIs24Hour; // 最初は古いモードのフォーマットを使用

    // 現在の24Hの時 (0-23) からスタート
    // 24ステップ回すことで必ず現在の時間に戻ってこれる
    for (let i = 1; i <= 24; i++) { 
        hourToAnimate = (current24Hour + i) % 24; // 24Hの値 (0-23)

        let displayHourNumber;
        
        if (hourToAnimate === 0) {
            // 24Hの00:xxに到達した瞬間は、必ず 00 (24H形式) を表示する
            displayHourNumber = 0; 
            displayFormatIs24H = true; // 表示形式を24Hに強制
        } else if (hourToAnimate === 1) {
            // 00:xxの次のステップ (01:xx) からターゲットモードのフォーマットに切り替える
            displayFormatIs24H = targetModeIs24H;
            displayHourNumber = getHourDisplayNumber(displayFormatIs24H, hourToAnimate);
        } else {
            // それ以外の時間は、現在の displayFormatIs24H に従って表示する
            displayHourNumber = getHourDisplayNumber(displayFormatIs24H, hourToAnimate);
        }
        
        const displayStr = String(displayHourNumber).padStart(2, '0');
        sequence.push(displayStr);
        
        // 停止条件: ターゲットモードに切り替わった後、現在の24H時間に戻ったら停止
        // ターゲットモードへの切り替えは hourToAnimate === 1 で発生するため、
        // hourToAnimate >= 1 の時点で停止条件をチェックする
        if (hourToAnimate === current24Hour && i > 12) { 
                // i > 12 は無限ループを防ぎ、最低12時間分フリップを保証するための措置
                break;
        }
    }

    // 4. アニメーションの実行
    await animateHourTransition(sequence, HOUR_FLIP_DELAY_MS);

    // 5. アニメーション完了後、prevTimeStrを新しい状態に設定し、通常の更新に戻す
    // アニメーション完了直後の最新の時刻でprevTimeStrを更新する
    prevTimeStr = getFormattedTimeString(is24Hour, new Date()); 
    isTimeModeAnimating = false;

    // 6. アニメーション速度を通常に戻す
    setAllCardsAnimationDuration(FLIP_DURATION_NORMAL_MS);
    // updateDisplayはメインループから呼ばれるため、ここでの呼び出しは不要
    // updateDisplay(false); 
}

/**
 * 時刻の桁をフルサイクルでアニメーションさせます。
 * @param {string[]} sequence - '03', '04', ..., '02' のように、表示する2桁の文字列配列
 * @param {number} flipDelay - フリップ間の遅延時間 (ms)
 */
async function animateHourTransition(sequence, flipDelay) {
    const hTens = allDigits.time.hTens;
    const hOnes = allDigits.time.hOnes; 

    for (let i = 0; i < sequence.length; i++) {
        const nextHStr = sequence[i]; // フリップ後の表示値
        
        // flipCardは現在のtopの値を見て、newValueが異なるときのみアニメーションをトリガーします。
        flipCard(hTens, nextHStr[0], false);
        flipCard(hOnes, nextHStr[1], false); 

        // フリップが完了するまで待機
        await new Promise(resolve => setTimeout(resolve, flipDelay));
    }
}


function setDowLanguage(lang) {
    // アニメーション実行中は操作を無視
    if (isDowAnimating) return;
    
    // 言語が同じなら何もしない
    if (dowLanguage === lang) return;

    // 言語ボタンのアクティブ状態を更新
    btns.langJa.classList.remove('active');
    btns.langEn.classList.remove('active');
    if (lang === 'ja') {
        btns.langJa.classList.add('active');
    } else {
        btns.langEn.classList.add('active');
    }
    
    dowLanguage = lang;
    
    const newDayOfWeekStr = getDayOfWeek();
    
    // 言語が変わった場合は、フリップシーケンスを実行
    if (newDayOfWeekStr !== prevDayOfWeekStr) {
        // 言語切り替えフラグを立てて実行
        animateDowTransition(newDayOfWeekStr, false, true); 
    }
}

/**
 * 曜日表示の3文字文字列を返します。
 * @param {string} lang 取得したい言語 ('ja' or 'en')
 * @returns {string} 3文字形式の曜日文字列 (例: "(水)", "Wed")
 */
function getDayOfWeek(lang = dowLanguage) {
    const now = new Date();
    const dayIndex = now.getDay();
    
    if (lang === 'ja') {
        const daysJa = ["(日)", "(月)", "(火)", "(水)", "(木)", "(金)", "(土)"];
        return daysJa[dayIndex];
    } else {
        // 英語 (Thuを使用)
        const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return daysEn[dayIndex];
    }
}

/**
 * 指定されたDateオブジェクトに基づいて日付文字列を返します。
 * @param {Date} date - Dateオブジェクト
 * @returns {string} 日付文字列 (YYMMDD)
 */
function getDateString(date) {
    const year = date.getFullYear() % 100;
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const yStr = String(year).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');

    return yStr + mStr + dStr;
}

function updateDisplay(isInitial) {
    const now = new Date(); // Dateオブジェクトを一度だけ取得

    // --- Time Update ---
    const timeStr = getFormattedTimeString(is24Hour, now); 
    
    const timeDigitMap = [
        { el: allDigits.time.hTens, val: timeStr[0] },
        { el: allDigits.time.hOnes, val: timeStr[1] },
        { el: allDigits.time.mTens, val: timeStr[2] },
        { el: allDigits.time.mOnes, val: timeStr[3] },
        { el: allDigits.time.sTens, val: timeStr[4] },
        { el: allDigits.time.sOnes, val: timeStr[5] }
    ];

    timeDigitMap.forEach((item, index) => {
        const prevVal = prevTimeStr[index];
        // 時刻モードアニメーション中は、時(H)の桁はanimateHourTransitionで制御されるため、
        // Hの桁(インデックス0, 1)はスキップする
        if (isTimeModeAnimating && (index === 0 || index === 1) ) {
            return;
        }
        
        if (item.val !== prevVal) {
            flipCard(item.el, item.val, isInitial);
        }
    });

    prevTimeStr = timeStr;


    // --- Date and Day of Week Update ---
    // 毎分00秒、または日付が変わるタイミングで更新
    if (now.getSeconds() === 0 || isInitial) {
        const dateStr = getDateString(now);
        
        // 1. Date Flipping
        const dateDigitMap = [
            { el: allDigits.date.yTens, val: dateStr[0] },
            { el: allDigits.date.yOnes, val: dateStr[1] },
            { el: allDigits.date.mTens, val: dateStr[2] },
            { el: allDigits.date.mOnes, val: dateStr[3] },
            { el: allDigits.date.dTens, val: dateStr[4] },
            { el: allDigits.date.dOnes, val: dateStr[5] }
        ];

        dateDigitMap.forEach((item, index) => {
            const prevVal = prevDateStr[index];
            if (item.val !== prevVal) {
                flipCard(item.el, item.val, isInitial);
            }
        });
        
        // 2. Day of Week Flipping (日付が変わったら曜日も更新)
        if (dateStr !== prevDateStr || isInitial) {
            const newDayOfWeekStr = getDayOfWeek();
            
            // 日付が変わった場合、または初回でprevDayOfWeekStrが初期値の場合
            if (newDayOfWeekStr !== prevDayOfWeekStr && !isDowAnimating) {
                animateDowTransition(newDayOfWeekStr, isInitial, false);
            }
        }
        
        prevDateStr = dateStr;
    }
}

/**
 * 指定されたミリ秒待機し、フリップ操作を実行するPromiseヘルパー
 * @param {string} value - 次の曜日文字列
 * @param {number} delayMs - 待機ミリ秒数
 */
function performDowFlip(value, delayMs) {
    return new Promise(resolve => {
        setTimeout(() => {
            // アニメーションなしで即座に設定するフラグはfalse (アニメーションが必要)
            flipDow(value, false); 
            prevDayOfWeekStr = value;
            resolve();
        }, delayMs);
    });
}

/**
 * 曜日表示をフリップシーケンスに沿ってアニメーションさせます。(非同期処理でカクつきを解消)
 * @param {string} targetDowStr 目的の曜日文字列 (例: "Wed")
 * @param {boolean} isInitial 初回ロードかどうか
 * @param {boolean} isLanguageSwitch 言語切り替えによる呼び出しであるか
 */
async function animateDowTransition(targetDowStr, isInitial, isLanguageSwitch) {
    if (isDowAnimating) return;

    // アニメーション速度を高速に設定
    setAllCardsAnimationDuration(FLIP_DURATION_FAST_MS);

    const currentDow3Char = prevDayOfWeekStr; 
    const target3Char = targetDowStr;

    // 初期化またはエラー時は即座にセットして終了
    if (isInitial || !DOW_FLIP_SEQUENCE_3CHAR.includes(currentDow3Char) || !DOW_FLIP_SEQUENCE_3CHAR.includes(target3Char)) {
        flipDow(target3Char, true);
        prevDayOfWeekStr = target3Char;
        // 速度を通常に戻す
        setAllCardsAnimationDuration(FLIP_DURATION_NORMAL_MS);
        return;
    }

    let currentIndex = DOW_FLIP_SEQUENCE_3CHAR.indexOf(currentDow3Char);
    let targetIndex = DOW_FLIP_SEQUENCE_3CHAR.indexOf(target3Char);

    const sequenceToAnimate = [];
    let tempIndex = currentIndex;
    
    // 日付更新 (次の曜日に進む) のケース
    const isSingleStep = !isLanguageSwitch && (
        targetIndex === (currentIndex + 1) % DOW_FLIP_SEQUENCE_3CHAR.length ||
        (currentIndex === DOW_FLIP_SEQUENCE_3CHAR.length - 1 && targetIndex === 0)
    );

    if (isSingleStep) {
        // 日付更新時は、次の曜日のみフリップ (1ステップ)
        sequenceToAnimate.push(target3Char);
    } else {
        // 言語切り替え時は、フリップシーケンス全体を経由して遷移
        
        // 1. 現在の言語のシーケンスの最後まで (土曜日/Sat)
        const languageBoundary = dowLanguage === 'ja' ? 6 : DOW_FLIP_SEQUENCE_3CHAR.length - 1;
        while (tempIndex !== languageBoundary) {
            tempIndex = (tempIndex + 1) % DOW_FLIP_SEQUENCE_3CHAR.length;
            sequenceToAnimate.push(DOW_FLIP_SEQUENCE_3CHAR[tempIndex]);
            if (tempIndex === DOW_FLIP_SEQUENCE_3CHAR.length - 1) break; // 英語の土曜日まで到達したらストップ
        }
        
        // 2. 目標の曜日に到達するまで (ターゲット言語のシーケンス)
        const startTargetLanguage = dowLanguage === 'ja' ? 0 : 7;
        tempIndex = startTargetLanguage - 1; // 0 または 7 から開始
        while (true) {
            tempIndex = (tempIndex + 1);
            const nextDow = DOW_FLIP_SEQUENCE_3CHAR[tempIndex % DOW_FLIP_SEQUENCE_3CHAR.length];
            sequenceToAnimate.push(nextDow);

            if (nextDow === target3Char) {
                break;
            }
            if (sequenceToAnimate.length > 20) break; // 無限ループ対策
        }
    }
    
    if (sequenceToAnimate.length === 0) return; 

    isDowAnimating = true;
    // アニメーションが完全に完了するのを待つための遅延時間 (CSSアニメーション時間 + わずかなバッファ)
    const flipDelay = FLIP_DURATION_FAST_MS + 50; 
    
    try {
        // sequenceToAnimateを順番に処理し、各フリップが完了するのを待つ
        for (const nextValue of sequenceToAnimate) {
            await performDowFlip(nextValue, flipDelay);
        }
    } catch (error) {
        console.error("曜日フリップアニメーション中にエラーが発生しました:", error);
    } finally {
        // 全てのフリップが完了したらフラグをリセット
        isDowAnimating = false;
        // アニメーション速度を通常に戻す
        setAllCardsAnimationDuration(FLIP_DURATION_NORMAL_MS);
    }
}

/**
 * 3つの曜日フリップカードを同時にフリップさせるヘルパー関数。
 * @param {string} dowStr 3文字の曜日文字列 (例: "(水)", "Wed")
 * @param {boolean} isInitial アニメーションなしで即座に設定するかどうか
 */
function flipDow(dowStr, isInitial) {
    const chars = dowStr.split('');
    if (chars.length !== 3) return;

    // 各文字を個別のフリップカードに適用
    flipCard(allDigits.dow.char1, chars[0], isInitial);
    flipCard(allDigits.dow.char2, chars[1], isInitial);
    flipCard(allDigits.dow.char3, chars[2], isInitial);
}

function flipCard(card, newValue, isInitial) {
    const top = card.querySelector('.top span');
    const bottom = card.querySelector('.bottom span');
    const topFlip = card.querySelector('.top-flip span');
    const bottomFlip = card.querySelector('.bottom-flip span');

    const durationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flip-duration')) * 1000;

    if (isInitial) {
        // アニメーションなしで即座に設定
        top.textContent = newValue;
        bottom.textContent = newValue;
        topFlip.textContent = newValue;
        bottomFlip.textContent = newValue;
        return;
    }

    const currentValue = top.textContent;
    // 新しい値が現在の値と同じ場合はフリップしない
    if (currentValue === newValue) return;

    // 1. 次の値と現在の値をフリップ要素にセット
    topFlip.textContent = currentValue; 
    bottomFlip.textContent = newValue;  
    top.textContent = newValue; // topの最終的な値はnewValue

    // 2. アニメーションをリセットし、再実行を強制
    card.classList.remove('flipping');
    // リフローを強制 (重要)
    void card.offsetWidth; 
    card.classList.add('flipping');

    // 3. アニメーション終了後にクラスをクリアし、底側の表示を確定
    // ANIMATION_DURATIONの後に実行
    setTimeout(() => {
        bottom.textContent = newValue;
        topFlip.textContent = newValue; // topFlipの値もnewValueに統一 (次のアニメーション準備)
        card.classList.remove('flipping');
    }, durationMs); 
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

/**
 * 天気ウィジェットの高さを時計の高さに合わせます。
 */
function syncWeatherHeight() {
    const clockHeight = timeWrapper.offsetHeight;
    const weatherWidget = document.getElementById('weather-widget-container');
    if (weatherWidget && clockHeight > 0) {
        weatherWidget.style.height = `${clockHeight}px`;
    }
}

// --- Weather Widget Functions ---
let autoRefreshInterval = null;

function getWeatherIcon(code) {
    const c = code.substring(0, 1);
    let paths = '';
    if (c === "1") {
        paths = '<circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />';
    } else if (c === "2") {
        paths = '<path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.4-4.3-4.5C16.9 6.2 13.9 4 10.5 4 7.2 4 4.5 6.4 4 9.6 1.7 10 0 12 0 14.3 0 16.9 2.1 19 4.7 19h12.8z" />';
    } else if (c === "3") {
        paths = '<path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5 5v.01M7 16v.01M9 19v.01M11 16v.01M13 19v.01M15 16v.01M17 19v.01" /><path d="M16 13a4 4 0 0 1-8 0" />';
    } else {
        paths = '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full overflow-visible">${paths}</svg>`;
}

const windDirections = {
    "北": 0, "北北東": 22.5, "北東": 45, "東北東": 67.5, "東": 90, "東南東": 112.5, "南東": 135, "南南東": 157.5, "南": 180, "南南西": 202.5, "南西": 225, "西南西": 247.5, "西": 270, "西北西": 292.5, "北西": 315, "北北西": 337.5
};

function getWindRotation(windStr) {
    for (let dir in windDirections) {
        if (windStr.includes(dir)) return windDirections[dir];
    }
    return 0;
}

function getMinimalWind(windStr, sizeClass = "w-5 h-5", arrowClass = "w-7 h-7") {
    const rotation = getWindRotation(windStr);
    const isStrong = windStr.includes("強");
    const iconColor = "opacity-60"; 
    const arrowColor = isStrong ? "text-blue-600 dark:text-blue-400" : "opacity-90";

    return `
        <div class="flex items-center space-x-1.5">
            <div class="${sizeClass} ${iconColor}">
                <svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="overflow-visible">
                    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                </svg>
            </div>
            <div class="wind-arrow ${arrowClass} ${arrowColor}" style="transform: rotate(${rotation}deg)">
                <svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="overflow-visible">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                </svg>
            </div>
        </div>
    `;
}

async function fetchWeatherData(areaCode, isManual = false) {
    if (!isManual) {
        loading.classList.remove('hidden');
        weatherContent.classList.add('hidden');
    }
    refreshBtn.classList.add('refreshing');
    errorMessage.classList.add('hidden');
    
    try {
        const response = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${areaCode}.json`);
        const data = await response.json();
        renderForecast(data);
        
        const reportDate = new Date(data[0].reportDatetime);
        const hours = reportDate.getHours().toString().padStart(2, '0');
        const minutes = reportDate.getMinutes().toString().padStart(2, '0');
        syncTime.innerText = `JMA Report: ${hours}:${minutes}`;
        
    } catch (error) {
        errorMessage.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
        refreshBtn.classList.remove('refreshing');
        resetAutoRefresh(areaCode);
    }
}

function resetAutoRefresh(areaCode) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        fetchWeatherData(areaCode, true);
    }, 600000); 
}

function renderForecast(data) {
    const detailReport = data[0];
    const weeklyReport = data[1];
    
    const todayArea = detailReport.timeSeries[0].areas[0];
    const todayWeatherCode = todayArea.weatherCodes[0];
    const todayWind = todayArea.winds[0];

    // Precipitation Probability (POP)
    const shortTermPops = {};
    let maxPop = '--';
    
    if (detailReport.timeSeries[1]) {
        const popSeries = detailReport.timeSeries[1];
        const pops = popSeries.areas[0].pops;
        const timeDefines = popSeries.timeDefines;
        timeDefines.forEach((t, i) => {
            const d = new Date(t).toDateString();
            if (!shortTermPops[d]) shortTermPops[d] = [];
            if (pops[i] !== undefined) {
                shortTermPops[d].push(parseInt(pops[i]));
            }
        });
    }

    const todayKey = new Date().toDateString();
    if (shortTermPops[todayKey] && shortTermPops[todayKey].length > 0) {
        maxPop = Math.max(...shortTermPops[todayKey]);
    }

    const shortTermTemps = {};
    if (detailReport.timeSeries[2]) {
        const tempTimeSeries = detailReport.timeSeries[2];
        tempTimeSeries.timeDefines.forEach((t, i) => {
            const dateStr = new Date(t).toDateString();
            if (!shortTermTemps[dateStr]) shortTermTemps[dateStr] = [];
            if (tempTimeSeries.areas[0].temps[i]) {
                shortTermTemps[dateStr].push(parseInt(tempTimeSeries.areas[0].temps[i]));
            }
        });
    }

    const tTemps = shortTermTemps[todayKey] || [];
    const maxToday = tTemps.length > 0 ? Math.max(...tTemps) : '--';
    const minToday = tTemps.length > 1 ? Math.min(...tTemps) : '--';

    todayCard.innerHTML = `
        <div class="minimal-card p-2 flex flex-col items-center">
            <div class="text-[12px] font-[900] opacity-80 tracking-[0.6em] mb-1 uppercase text-center w-full ml-[0.6em]">TODAY</div>
            <div class="flex flex-row items-center justify-between w-full px-4">
                <div class="flex items-center space-x-3">
                    <div class="w-16 h-16">
                        ${getWeatherIcon(todayWeatherCode)}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xl font-black text-rose-500 dark:text-rose-400 leading-none">${maxToday}°</span>
                        <span class="text-sm font-black text-blue-500 dark:text-blue-400 mt-1">${minToday}°</span>
                        <div class="flex items-center mt-1 text-slate-600 dark:text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0116 0H4z M12 12v6a2 2 0 004 0" /></svg>
                            <span class="text-xs font-bold">${maxPop}%</span>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                    ${getMinimalWind(todayWind, "w-6 h-6", "w-8 h-8")}
                </div>
            </div>
        </div>
    `;

    forecastList.innerHTML = '';
    const weeklyTimeSeries = weeklyReport.timeSeries[0];
    const weeklyTempSeries = weeklyReport.timeSeries[1];
    const limitedTimeDefines = weeklyTimeSeries.timeDefines.slice(0, 5);

    limitedTimeDefines.forEach((time, index) => {
        const date = new Date(time);
        const dateKey = date.toDateString();
        const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;
        const weatherCode = weeklyTimeSeries.areas[0].weatherCodes[index];
        const pops = weeklyTimeSeries.areas[0].pops;
        let pop = pops ? pops[index] : null;

        if (shortTermPops[dateKey] && shortTermPops[dateKey].length > 0) {
            pop = Math.max(...shortTermPops[dateKey]);
        }
        
        let minT = weeklyTempSeries.areas[0].tempsMin[index];
        let maxT = weeklyTempSeries.areas[0].tempsMax[index];

        if ((!minT || !maxT) && shortTermTemps[dateKey]) {
            const temps = shortTermTemps[dateKey];
            if (temps.length >= 2) {
                minT = Math.min(...temps);
                maxT = Math.max(...temps);
            } else if (temps.length === 1) {
                maxT = temps[0];
                minT = "-";
            }
        }

        const dayItem = document.createElement('div');
        dayItem.className = "minimal-card py-0.5 px-2 flex items-center justify-between";
        
        const tempDisplay = (minT !== undefined && maxT !== undefined) 
            ? `
                <div class="flex items-center space-x-2 min-w-[60px] justify-end">
                    <span class="text-xs font-black text-rose-500 dark:text-rose-400">${maxT}°</span>
                    <div class="h-2 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
                    <span class="text-xs font-black text-blue-500 dark:text-blue-400">${minT}°</span>
                </div>
            ` 
            : '<div class="w-12"></div>';

        const popDisplay = pop ? `
            <div class="flex items-center text-slate-600 dark:text-slate-400 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0116 0H4z M12 12v6a2 2 0 004 0" /></svg>
                <span class="text-[10px] font-bold">${pop}%</span>
            </div>
        ` : '';

        dayItem.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="text-xs font-bold w-8">${dayLabel}</span>
                <div class="w-6 h-6 opacity-80">
                    ${getWeatherIcon(weatherCode)}
                </div>
            </div>
            <div class="flex items-center">
                ${popDisplay}
                ${tempDisplay}
            </div>
        `;
        forecastList.appendChild(dayItem);
    });

    weatherContent.classList.remove('hidden');
}

// --- RSS Functions ---
let rssAutoRefreshInterval = null;
let rssDetailTimeout = null;

function startRssDetailTimeout() {
    if (rssDetailTimeout) clearTimeout(rssDetailTimeout);
    rssDetailTimeout = setTimeout(() => {
        if (!rssDetailView.classList.contains('hidden')) {
            rssDetailView.classList.add('hidden');
            rssListView.classList.remove('hidden');
        }
    }, 300000); // 5 minutes
}

function stopRssDetailTimeout() {
    if (rssDetailTimeout) clearTimeout(rssDetailTimeout);
}

function resetRssAutoRefresh(url) {
    if (rssAutoRefreshInterval) clearInterval(rssAutoRefreshInterval);
    if (!url) return;
    rssAutoRefreshInterval = setInterval(() => {
        fetchRSS(url, true);
    }, 1800000); // 30 minutes
}

async function fetchRSS(url, isManual = false) {
    if (!url) return;
    
    if (!isManual && rssList.hasChildNodes()) return; // Don't refetch if already loaded unless manual

    rssLoading.classList.remove('hidden');
    rssError.classList.add('hidden');
    rssList.innerHTML = '';

    refreshBtn.classList.add('refreshing');

    try {
        // 1. Try rss2json first (More reliable parsing)
        const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
        const response = await fetch(rss2jsonUrl);
        const data = await response.json();

        if (data.status === 'ok') {
            renderRSS(data.items);
        } else {
            throw new Error('rss2json error');
        }
    } catch (error) {
        console.warn('Primary RSS fetch failed, trying fallback...', error);
        try {
            // 2. Fallback: allorigins.win (Raw XML proxy)
            const timestamp = new Date().getTime();
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${timestamp}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const text = await response.text();
            if (!text) throw new Error('No content received');

            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            const parserError = xmlDoc.querySelector("parsererror");
            if (parserError) throw new Error('XML Parsing Error');
            
            // Handle RSS (item) and Atom (entry)
            let items = Array.from(xmlDoc.querySelectorAll("item"));
            if (items.length === 0) {
                items = Array.from(xmlDoc.querySelectorAll("entry"));
            }
            
            const rssItems = items.map(item => {
                const title = item.querySelector("title")?.textContent || "";
                
                // Link handling
                let link = item.querySelector("link")?.textContent;
                if (!link) {
                    const linkNode = item.querySelector("link[rel='alternate']") || item.querySelector("link");
                    link = linkNode?.getAttribute("href");
                }
                
                // Date handling
                const pubDate = item.querySelector("pubDate, published, updated")?.textContent || "";

                // Description handling
                const description = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || "";
                
                return { title, link, pubDate, description };
            });

            if (rssItems.length > 0) {
                renderRSS(rssItems);
            } else {
                throw new Error('No items found');
            }
        } catch (fallbackError) {
            console.error(fallbackError);
            rssError.classList.remove('hidden');
        }
    } finally {
        rssLoading.classList.add('hidden');
        refreshBtn.classList.remove('refreshing');
        resetRssAutoRefresh(url);
    }
}

function renderRSS(items) {
    rssList.innerHTML = '';
    // Limit to 10 items
    items.slice(0, 10).forEach(item => {
        const div = document.createElement('div');
        div.className = "minimal-card p-2 px-3 flex flex-col justify-center cursor-pointer hover:opacity-80 transition-opacity";
        
        // Click handler to show detail view
        div.onclick = () => {
            rssDetailTitle.textContent = item.title;
            rssDetailDate.textContent = dateStr; // Use the computed date string
            
            const cleanDesc = getCleanDescription(item.description);
            rssDetailDesc.textContent = formatDescription(cleanDesc);
            
            rssDetailLink.href = item.link;
            rssDetailQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.link)}`;
            rssListView.classList.add('hidden');
            rssDetailView.classList.remove('hidden');
            startRssDetailTimeout();
        };

        let dateStr = "";
        try {
            const date = new Date(item.pubDate);
            if (!isNaN(date.getTime())) {
                dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            }
        } catch (e) {}

        div.innerHTML = `
            <div class="text-[11px] font-bold leading-tight">${item.title}</div>
        `;
        rssList.appendChild(div);
    });
}

function formatDescription(text) {
    // Estimate: 340px width - padding ~24px = 316px.
    // font-size 12px. Approx 26 chars per line.
    // 5 lines = 130 chars. Adjusted to 115 to ensure wrapping starts correctly after 5th line.
    const threshold = 115; 
    if (!text || text.length <= threshold) return text;

    const firstPart = text.substring(0, threshold);
    const rest = text.substring(threshold);
    
    let formattedRest = "";
    for (let i = 0; i < rest.length; i += 15) {
        formattedRest += rest.substring(i, i + 15) + "\n";
    }
    
    return firstPart + "\n" + formattedRest;
}

function getCleanDescription(html) {
    if (!html) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
}

// --- Plugin System Functions ---

function loadSavedPlugins() {
    const savedPlugins = JSON.parse(localStorage.getItem('flipClockUserPlugins') || '[]');
    savedPlugins.forEach(code => {
        try {
            // スクリプトタグとして追加して実行
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
        } catch (e) {
            console.error('Failed to load saved plugin:', e);
        }
    });
}

function setupPluginDropZone() {
    const dropZone = document.getElementById('plugin-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                if (!file.name.endsWith('.js')) {
                    alert('Only .js files are supported.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => installPlugin(e.target.result);
                reader.readAsText(file);
            });
        }
    });
}

function renderPluginList() {
    const listContainer = document.getElementById('plugin-list');
    if (!listContainer) return;
    
    const savedPlugins = JSON.parse(localStorage.getItem('flipClockUserPlugins') || '[]');
    listContainer.innerHTML = '';

    if (savedPlugins.length === 0) {
        return;
    }

    savedPlugins.forEach((code, index) => {
        // Try to extract ID from code for display name
        let name = `Plugin ${index + 1}`;
        const idMatch = code.match(/id:\s*['"]([^'"]+)['"]/);
        if (idMatch && idMatch[1]) {
            name = idMatch[1];
        }

        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-black/10 dark:bg-white/5 p-2 rounded';
        item.innerHTML = `
            <span class="text-xs font-bold truncate flex-1 mr-2 opacity-80">${name}</span>
            <button class="text-red-400 hover:text-red-500 transition-colors" title="Delete">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        
        item.querySelector('button').addEventListener('click', () => {
            if (confirm(`Delete plugin "${name}"?`)) {
                savedPlugins.splice(index, 1);
                localStorage.setItem('flipClockUserPlugins', JSON.stringify(savedPlugins));
                location.reload();
            }
        });

        listContainer.appendChild(item);
    });
}

function installPlugin(code) {
    try {
        // 実行して登録
        const script = document.createElement('script');
        script.textContent = code;
        document.body.appendChild(script);

        // 成功したら保存
        const savedPlugins = JSON.parse(localStorage.getItem('flipClockUserPlugins') || '[]');
        // 重複チェック（簡易的：全く同じコードなら保存しない）
        if (!savedPlugins.includes(code)) {
            savedPlugins.push(code);
            localStorage.setItem('flipClockUserPlugins', JSON.stringify(savedPlugins));
            alert('Plugin installed successfully!');
            renderPluginList();
        } else {
            alert('Plugin updated!');
            renderPluginList();
        }
    } catch (e) {
        alert('Error installing plugin: ' + e.message);
    }
}

// Start
window.onload = init;