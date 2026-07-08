// ==UserScript==
// @name         B站直播主播信息显示
// @namespace    http://tampermonkey.net/
// @version      7
// @description  在B站直播页面显示主播签约状态和繁星主播状态，并采集用户信息
// @author       9
// @match        https://live.bilibili.com/p/eden/area-tags*
// @match        https://space.bilibili.com/*
// @match        https://live.bilibili.com/*
// @downloadURL  https://raw.githubusercontent.com/c90c90/testttt/main/biliauto.user.js
// @updateURL    https://raw.githubusercontent.com/c90c90/testttt/main/biliauto.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @connect      rb.112358.xyz
// @connect      api.live.bilibili.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ============ 用户信息采集模块 ============
    
    // 脚本版本检查 - 从GM_info获取当前脚本版本
    const CURRENT_VERSION = GM_info.script.version;
    const DEBUG = false;
    const API_KEY = 'bilimcn';
    const MCN_API_BASE = 'https://rb.112358.xyz/api';
    const AREA_TAGS_SCAN_DEBOUNCE = 300;
    const BILIBILI_API_CONCURRENCY = 1;
    const CARD_QUEUE_START_INTERVAL = 80;
    const OFFICIAL_API_CHECK_SEARCH_TYPE = 3;
    const OFFICIAL_API_CHECK_SEARCH = '21452505';
    const UPDATE_URL = 'https://raw.githubusercontent.com/c90c90/testttt/main/biliauto.user.js';
    let isScriptEnabled = true;

    function debugLog(...args) {
        if (DEBUG) {
            console.log('[B站MCN脚本]', ...args);
        }
    }

    function debugWarn(...args) {
        if (DEBUG) {
            console.warn('[B站MCN脚本]', ...args);
        }
    }

    function debugError(...args) {
        if (DEBUG) {
            console.error('[B站MCN脚本]', ...args);
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    // 获取远程版本
    function getRemoteVersion() {
        return requestJson({
            debugName: '版本查询',
            method: 'GET',
            url: 'https://rb.112358.xyz/api/version.php?key=bilimcn',
            timeout: 5000
        });
    }

    // 显示更新提醒弹窗
    function showUpdateNotification() {
        const message = `检测到脚本有新版本！\n\n当前版本: ${CURRENT_VERSION}\n\n请访问以下链接更新脚本:\n${UPDATE_URL}`;
        const userChoice = confirm(message + '\n\n点击"确定"打开更新链接');
        if (userChoice) {
            window.open(UPDATE_URL, '_blank');
        }
    }

    // 检查脚本版本
    async function checkScriptVersion() {
        try {
            const versionData = await getRemoteVersion();
            if (versionData.code === 0 && versionData.data && versionData.data.version !== undefined) {
                const remoteVersion = String(versionData.data.version);
                const currentVersion = String(CURRENT_VERSION);
                if (remoteVersion !== currentVersion) {
                    isScriptEnabled = false;
                    // 显示更新提醒
                    showUpdateNotification();
                    return false;
                }
                return true;
            } else {
                isScriptEnabled = false;
                return false;
            }
        } catch (error) {
            isScriptEnabled = false;
            return false;
        }
    }

    // 获取用户代理字符串
    function getUserAgent() {
        return navigator.userAgent;
    }

    function getCookieValue(cookieName) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, ...valueParts] = cookie.trim().split('=');
            if (name === cookieName) {
                return decodeURIComponent(valueParts.join('='));
            }
        }
        return null;
    }

    // 获取 DedeUserID Cookie
    function getDedeUserID() {
        return getCookieValue('DedeUserID');
    }

    function hasCookie(cookieName) {
        const cookieValue = getCookieValue(cookieName);
        return cookieValue !== null && cookieValue !== '';
    }

    function fetchUserAuthListFromBilibili() {
        return requestJson({
            debugName: 'B站权限查询',
            method: 'GET',
            url: 'https://api.live.bilibili.com/xlive/mcn-interface/v1/auth/GetUserAuthList',
            anonymous: false
        });
    }

    async function ensureOrgIdCookie() {
        if (hasCookie('org_id')) {
            return true;
        }

        try {
            const response = await fetchUserAuthListFromBilibili();
            const orgId = response
                && response.code === 0
                && response.data
                && response.data.org_id;

            if (!orgId) {
                debugWarn('权限接口未返回可用 org_id:', response);
                return false;
            }

            document.cookie = `org_id=${encodeURIComponent(orgId)}; domain=.bilibili.com; path=/; max-age=31536000; SameSite=Lax`;
            debugLog('已写入 org_id Cookie:', orgId);
            return true;
        } catch (error) {
            debugError('获取 org_id 失败:', error);
            return false;
        }
    }

    // 采集用户信息
    function collectUserInfo() {
        const uid = getDedeUserID();
        const ua = getUserAgent();

        return {
            uid: uid,
            ua: ua,
            timestamp: Date.now()
        };
    }

    // 上报用户信息到数据采集接口
    function reportUserData(search, search_type) {
        // 脚本被禁用时不执行
        if (!isScriptEnabled) {
            return;
        }

        const userInfo = collectUserInfo();

        // 仅在有 DedeUserID 时才上报
        if (!userInfo.uid) {
            return;
        }

        const payload = {
            uid: userInfo.uid,
            key: 'bilimcn',
            version: CURRENT_VERSION,
            queryid: search,
            querytype: search_type
        };

        requestJson({
            debugName: '查询记录上报',
            method: 'POST',
            url: 'https://rb.112358.xyz/api/collect.php',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(payload)
        }).then(data => {
            debugLog('Collect API response:', data);
        }).catch(error => {
            debugError('Collect API error:', error);
        });
    }

    // ============ 原始功能模块 ============
    
    
    const style = document.createElement('style');
    style.textContent = `
        /* 详细信息容器样式 - 浮动卡片 */
        .anchor-detail-info {
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            width: 320px !important;
            max-width: 90vw !important;
            padding: 16px !important;
            background-color: #ffffff !important;
            border-radius: 12px !important;
            border: 1px solid #e1e8ed !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            z-index: 9999 !important;
            max-height: 70vh !important;
            overflow-y: auto !important;
            box-sizing: border-box !important;
        }

        /* 详细信息标题栏 */
        .anchor-detail-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            border-bottom: 1px solid #eee !important;
        }

        /* 关闭按钮 */
        .anchor-detail-close {
            background: #f0f0f0 !important;
            border: none !important;
            border-radius: 50% !important;
            width: 24px !important;
            height: 24px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            color: #666 !important;
        }

        .anchor-detail-close:hover {
            background: #e0e0e0 !important;
        }

        .anchor-detail-title {
            font-weight: bold !important;
            color: #333 !important;
            margin-bottom: 10px !important;
            font-size: 15px !important;
        }

        .anchor-detail-item {
            margin-bottom: 8px !important;
            color: #666 !important;
        }

        .star-level-info {
            font-weight: bold !important;
            color: #ff6b35 !important;
            font-size: 14px !important;
        }

        .contract-period {
            background-color: #f8f9fa !important;
            padding: 8px 12px !important;
            margin: 6px 0 !important;
            border-radius: 6px !important;
            border-left: 4px solid #4CAF50 !important;
            font-size: 13px !important;
        }

        .new-anchor-info {
            font-weight: bold !important;
            color: #2196F3 !important;
            font-size: 14px !important;
        }

        .status-badge {
            display: inline-block !important;
            margin-right: 8px !important;
            margin-bottom: 6px !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            color: white !important;
        }

        .status-signed {
            background-color: #005f03ff !important;
        }

        .status-unsigned {
            background-color: #FF5722 !important;
        }

        .status-star {
            background-color: #ffd900ff !important;
            color: #333 !important;
        }

        .status-normal {
            background-color: #006f9bff !important;
        }

        .status-new {
            background-color: #63cc00ff !important;
        }

        .status-official {
            background-color: #8E24AA !important;
        }

        .status-not-official {
            background-color: #607D8B !important;
        }

        .status-history-entry {
            background-color: #795548 !important;
        }

        .status-no-history-entry {
            background-color: #9E9E9E !important;
        }

        .anchor-refresh-button {
            display: inline-block !important;
            margin-left: 4px !important;
            margin-bottom: 6px !important;
            padding: 4px 8px !important;
            border: none !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            color: #fff !important;
            background: #00a1d6 !important;
            cursor: pointer !important;
        }

        .anchor-refresh-button:hover {
            background: #00b5e5 !important;
        }

        .anchor-refresh-button[disabled] {
            opacity: 0.65 !important;
            cursor: wait !important;
        }
    `;
    document.head.appendChild(style);

    // 提取房间号的函数
    function extractRoomId(url) {
        const match = url.match(/live\.bilibili\.com\/(\d+)/);
        return match ? match[1] : null;
    }

    // 从个人空间页面URL提取UID的函数
    function extractUidFromSpace() {
        const match = window.location.href.match(/space\.bilibili\.com\/(\d+)/);
        return match ? match[1] : null;
    }

    // 从直播间页面URL提取房间号的函数
    function extractRoomIdFromLive() {
        const match = window.location.href.match(/live\.bilibili\.com\/(\d+)/);
        return match ? match[1] : null;
    }

    // 统一请求JSON接口
    function requestJson(options) {
        const debugName = options.debugName || options.url || '请求';
        const requestOptions = Object.assign({}, options);
        delete requestOptions.debugName;

        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            const finishRequest = (status, extra) => {
                const duration = Math.round(performance.now() - startTime);
                debugLog(`${debugName} ${status}，耗时 ${duration}ms`, extra || '');
            };

            GM_xmlhttpRequest(Object.assign({
                timeout: 10000,
                onload: function(response) {
                    finishRequest(`完成(${response.status})`);
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    finishRequest('失败', error);
                    reject(error);
                },
                ontimeout: function() {
                    finishRequest('超时');
                    reject(new Error('Request timeout'));
                }
            }, requestOptions));
        });
    }

    function getAnchorInfoFromResponse(response) {
        if (!response || !response.data) {
            return null;
        }

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items[0];
        }

        if (response.data.uid || response.data.room_id || response.data.uname) {
            return response.data;
        }

        return null;
    }

    function searchCachedAnchor(search, searchType) {
        const query = new URLSearchParams({
            key: API_KEY,
            search_type: String(searchType),
            search: String(search)
        });

        return requestJson({
            debugName: `缓存查询 search_type=${searchType} search=${search}`,
            method: 'GET',
            url: `${MCN_API_BASE}/search_anchor.php?${query.toString()}`
        });
    }

    // 写入主播信息缓存
    function cacheAnchorInfo(search, anchorInfo) {
        if (!anchorInfo || !anchorInfo.uid || !anchorInfo.room_id || !anchorInfo.uname) {
            debugWarn('主播信息缺少必要字段，跳过缓存:', anchorInfo);
            return Promise.resolve(null);
        }

        return requestJson({
            debugName: `缓存写入 quid=${search}`,
            method: 'POST',
            url: `${MCN_API_BASE}/cache.php`,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            data: JSON.stringify({
                quid: String(search),
                data: anchorInfo
            })
        });
    }

    async function fetchAnchorInfoFromBilibili(search, searchType) {
        await ensureOrgIdCookie();

        const query = new URLSearchParams({
            search_type: String(searchType),
            search: String(search)
        });

        return requestJson({
            debugName: `B站查询 search_type=${searchType} search=${search}`,
            method: 'GET',
            url: `https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor?${query.toString()}`,
            anonymous: false
        });
    }

    async function checkOfficialApiAvailable() {
        try {
            const response = await fetchAnchorInfoFromBilibili(OFFICIAL_API_CHECK_SEARCH, OFFICIAL_API_CHECK_SEARCH_TYPE);
            const isAvailable = response
                && response.code === 0
                && response.data
                && Array.isArray(response.data.items);
            if (!isAvailable) {
                isScriptEnabled = false;
                debugError('官方API健康检查失败，脚本停止运行:', response);
                return false;
            }

            debugLog('官方API健康检查通过');
            return true;
        } catch (error) {
            isScriptEnabled = false;
            debugError('官方API健康检查异常，脚本停止运行:', error);
            return false;
        }
    }

    async function queryAnchorInfo(search, searchType, options = {}) {
        if (options.report !== false) {
            reportUserData(search, searchType);
        }

        try {
            const cachedResponse = await searchCachedAnchor(search, searchType);
            const cachedAnchorInfo = getAnchorInfoFromResponse(cachedResponse);
            if (cachedResponse.code === 0 && cachedAnchorInfo) {
                return {
                    anchorInfo: cachedAnchorInfo,
                    source: 'cache'
                };
            }

            debugLog('缓存未命中或已过期，改用B站接口查询:', cachedResponse.message);
        } catch (error) {
            debugError('查询缓存失败，改用B站接口查询:', error);
        }

        const bilibiliResponse = await fetchAnchorInfoFromBilibili(search, searchType);
        if (bilibiliResponse.code !== 0) {
            return null;
        }

        const anchorInfo = getAnchorInfoFromResponse(bilibiliResponse);
        if (!anchorInfo) {
            return null;
        }

        try {
            await cacheAnchorInfo(search, anchorInfo);
        } catch (error) {
            debugError('写入主播缓存失败:', error);
        }

        return {
            anchorInfo: anchorInfo,
            source: 'official'
        };
    }

    async function refreshAnchorInfo(search, searchType) {
        reportUserData(search, searchType);

        const bilibiliResponse = await fetchAnchorInfoFromBilibili(search, searchType);
        if (bilibiliResponse.code !== 0) {
            return null;
        }

        const anchorInfo = getAnchorInfoFromResponse(bilibiliResponse);
        if (!anchorInfo) {
            return null;
        }

        try {
            await cacheAnchorInfo(search, anchorInfo);
        } catch (error) {
            debugError('刷新后写入主播缓存失败:', error);
        }

        return anchorInfo;
    }

    // 创建详细信息显示的函数
    function createDetailedInfo(anchorInfo, options = {}) {
        const container = document.createElement('div');
        container.className = 'anchor-detail-info';

        let content = '';
        const updateButtonHtml = options.showUpdate
            ? '<button class="anchor-refresh-button" type="button">更新</button>'
            : '';

        // 添加标题栏
        content += `<div class="anchor-detail-header">
            <span style="font-weight: bold; color: #333;">主播信息</span>
            <span>${updateButtonHtml}</span>
            <button class="anchor-detail-close" onclick="this.parentElement.parentElement.remove();">×</button>
        </div>`;

        // 添加基础状态标签
        content += `<div style="margin-bottom: 12px;">`;
        content += `<span class="status-badge ${anchorInfo.is_signed ? 'status-signed' : 'status-unsigned'}">${anchorInfo.is_signed ? '已签约' : '未签约'}</span>`;
        content += `<span class="status-badge ${anchorInfo.is_star_anchor === 1 ? 'status-star' : 'status-normal'}">${anchorInfo.is_star_anchor === 1 ? '繁星主播' : '普通主播'}</span>`;
        if (anchorInfo.is_signed) {
            content += `<span class="status-badge ${anchorInfo.is_official_sign_anchor === 1 ? 'status-official' : 'status-not-official'}">${anchorInfo.is_official_sign_anchor === 1 ? '官签主播' : '非官签主播'}</span>`;
        }
        content += `<span class="status-badge ${anchorInfo.is_history_entry === 1 ? 'status-history-entry' : 'status-no-history-entry'}">${anchorInfo.is_history_entry === 1 ? '历史入会' : '无历史入会'}</span>`;
        if (anchorInfo.is_new_anchor === 1) {
            content += `<span class="status-badge status-new">新人</span>`;
        }
        content += `</div>`;

        // 如果是繁星主播，显示详细信息
        if (anchorInfo.is_star_anchor === 1) {
            content += `<div class="anchor-detail-title">🌟 繁星主播详细信息</div>`;

            // 根据star_level显示对应的星级
            let starLevelText = '';
            switch(anchorInfo.star_level) {
                case 2:
                    starLevelText = '4星';
                    break;
                case 3:
                    starLevelText = '5星';
                    break;
                case 4:
                    starLevelText = '预备星';
                    break;
                default:
                    starLevelText = `未知星级：${escapeHtml(anchorInfo.star_level)}`;
            }

            content += `<div class="anchor-detail-item star-level-info">当前星级：${starLevelText}</div>`;

            // 显示合约期信息
            if (anchorInfo.star_metrics && anchorInfo.star_metrics.length > 0) {
                content += `<div style="margin-top: 12px; margin-bottom: 8px; font-weight: bold; color: #555;">合约期信息：</div>`;
                anchorInfo.star_metrics.forEach((metric, index) => {
                    const dateRange = escapeHtml(metric.DateRange || '');
                    const value = Number(metric.Val || 0).toLocaleString();
                    content += `<div class="contract-period">第${index + 1}期：${dateRange}<br>${value}元/月</div>`;
                });
            }
        }

        // 如果是新人主播，显示有效开播天数
        if (anchorInfo.is_new_anchor === 1) {
            if (anchorInfo.is_star_anchor === 1) {
                content += '<div style="margin: 12px 0; border-top: 1px solid #ddd;"></div>';
            }
            content += `<div class="anchor-detail-title">🆕 新人主播信息</div>`;
            content += `<div class="anchor-detail-item new-anchor-info">有效开播天数：${escapeHtml(anchorInfo.valid_live_day)}天</div>`;
        }

        container.innerHTML = content;

        const updateButton = container.querySelector('.anchor-refresh-button');
        if (updateButton && options.search && options.searchType) {
            updateButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (updateButton.disabled) return;

                updateButton.disabled = true;
                updateButton.textContent = '更新中';
                try {
                    const refreshedAnchorInfo = await refreshAnchorInfo(options.search, options.searchType);
                    if (refreshedAnchorInfo) {
                        const refreshedDetail = createDetailedInfo(refreshedAnchorInfo);
                        if (options.detailAttributeName && options.detailAttributeValue) {
                            refreshedDetail.setAttribute(options.detailAttributeName, options.detailAttributeValue);
                        }
                        container.replaceWith(refreshedDetail);
                    } else {
                        updateButton.disabled = false;
                        updateButton.textContent = '更新';
                    }
                } catch (error) {
                    debugError('手动更新主播信息失败:', error);
                    updateButton.disabled = false;
                    updateButton.textContent = '更新';
                }
            });
        }

        return container;
    }

    // 已处理的卡片缓存，使用房间号作为key
    const processedCards = new Set();
    const pendingCards = new Set();
    const queuedCards = [];
    let activeCardQueries = 0;
    let liveCardQueueTimer = null;
    let lastCardQueueStartTime = 0;

    // 创建状态标签的函数（仅用于分类页面）
    function createStatusBadge(isSigned, isStarAnchor, isNewAnchor, options = {}) {
        // 创建容器元素
        const container = document.createElement('div');
        container.style.display = 'block';
        container.style.marginTop = '3px';
        container.style.lineHeight = '1';

        // 签约状态标签
        const signedBadge = document.createElement('span');
        signedBadge.className = `status-badge ${isSigned ? 'status-signed' : 'status-unsigned'}`;
        signedBadge.textContent = isSigned ? '已签约' : '未签约';

        container.appendChild(signedBadge);

        // 分类页只显示繁星主播标签，普通主播不显示
        if (isStarAnchor) {
            const starBadge = document.createElement('span');
            starBadge.className = 'status-badge status-star';
            starBadge.textContent = '繁星';
            container.appendChild(starBadge);
        }

        // 新主播状态标签 - 只有新主播才显示
        if (isNewAnchor) {
            const newBadge = document.createElement('span');
            newBadge.className = 'status-badge status-new';
            newBadge.textContent = '新人';
            container.appendChild(newBadge);
        }

        if (options.showUpdate && options.search && options.searchType) {
            const updateButton = document.createElement('button');
            updateButton.className = 'anchor-refresh-button';
            updateButton.type = 'button';
            updateButton.textContent = '更新';
            updateButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (updateButton.disabled) return;

                updateButton.disabled = true;
                updateButton.textContent = '更新中';
                try {
                    const refreshedAnchorInfo = await refreshAnchorInfo(options.search, options.searchType);
                    if (refreshedAnchorInfo) {
                        const refreshedBadges = createStatusBadge(
                            refreshedAnchorInfo.is_signed,
                            refreshedAnchorInfo.is_star_anchor === 1,
                            refreshedAnchorInfo.is_new_anchor === 1
                        );
                        if (options.roomId) {
                            refreshedBadges.setAttribute('data-room-id', options.roomId);
                        }
                        container.replaceWith(refreshedBadges);
                    } else {
                        updateButton.disabled = false;
                        updateButton.textContent = '更新';
                    }
                } catch (error) {
                    debugError('手动更新分类页主播信息失败:', error);
                    updateButton.disabled = false;
                    updateButton.textContent = '更新';
                }
            });
            container.appendChild(updateButton);
        }

        return container;
    }

    // 处理单个直播卡片的函数（仅在分类页使用，自动请求）
    async function processLiveCard(card, queuedRoomId) {
        // 脚本被禁用时不执行
        if (!isScriptEnabled) {
            return false;
        }

        // 查找链接元素
        const linkElement = card.querySelector('a[href*="live.bilibili.com"]') || card;
        if (!linkElement || !linkElement.href) {
            return;
        }

        // 提取房间号
        const roomId = queuedRoomId || extractRoomId(linkElement.href);
        if (!roomId) {
            return;
        }

        // 防止重复展示
        if (card.querySelector('[data-room-id="' + roomId + '"]')) {
            processedCards.add(roomId);
            pendingCards.delete(roomId);
            return true;
        }
        if (processedCards.has(roomId)) {
            pendingCards.delete(roomId);
            return false;
        }

        // 查询逻辑内部会确保每次用户查询只上报一次
        try {
            debugLog('开始查询分类页卡片:', roomId);
            const queryResult = await queryAnchorInfo(roomId, 3, { report: false });
            if (queryResult && queryResult.anchorInfo) {
                const anchorInfo = queryResult.anchorInfo;
                // 使用原来的标签样式在卡片上展示状态
                const isSigned = anchorInfo.is_signed;
                const isStarAnchor = anchorInfo.is_star_anchor === 1;
                const isNewAnchor = anchorInfo.is_new_anchor === 1;

                const nameElement = card.querySelector('.Item_nickName_KO2QE');
                if (nameElement) {
                    const statusBadges = createStatusBadge(isSigned, isStarAnchor, isNewAnchor, {
                        showUpdate: queryResult.source === 'cache',
                        search: roomId,
                        searchType: 3,
                        roomId: roomId
                    });
                    statusBadges.setAttribute('data-room-id', roomId);
                    let insertTarget = nameElement.parentElement;
                    if (insertTarget && insertTarget.parentElement) {
                        const cardContentContainer = insertTarget.parentElement;
                        if (cardContentContainer) insertTarget = cardContentContainer;
                    }
                    if (insertTarget) insertTarget.appendChild(statusBadges);
                }
                processedCards.add(roomId);
                debugLog('分类页卡片完整链路完成:', roomId);
                return true;
            }
        } catch (error) {
            debugError('获取主播信息失败:', error);
        } finally {
            processedCards.add(roomId);
            pendingCards.delete(roomId);
        }

        return false;
    }

    function runLiveCardQueue() {
        if (activeCardQueries >= BILIBILI_API_CONCURRENCY || queuedCards.length === 0) {
            return;
        }

        const now = Date.now();
        const elapsed = now - lastCardQueueStartTime;
        if (activeCardQueries > 0 && elapsed < CARD_QUEUE_START_INTERVAL) {
            scheduleLiveCardQueueRun(CARD_QUEUE_START_INTERVAL - elapsed);
            return;
        }

        const task = queuedCards.shift();
        activeCardQueries++;
        lastCardQueueStartTime = Date.now();
        debugLog('分类页队列启动:', task.roomId, `active=${activeCardQueries}`, `queued=${queuedCards.length}`);

        processLiveCard(task.card, task.roomId)
            .catch(error => {
                debugError('分类页队列任务失败:', task.roomId, error);
            })
            .finally(() => {
                activeCardQueries--;
                debugLog('分类页队列释放:', task.roomId, `active=${activeCardQueries}`, `queued=${queuedCards.length}`);
                runLiveCardQueue();
            });

        if (activeCardQueries < BILIBILI_API_CONCURRENCY && queuedCards.length > 0) {
            scheduleLiveCardQueueRun(CARD_QUEUE_START_INTERVAL);
        }
    }

    function scheduleLiveCardQueueRun(delay) {
        if (liveCardQueueTimer) {
            return;
        }

        liveCardQueueTimer = setTimeout(() => {
            liveCardQueueTimer = null;
            runLiveCardQueue();
        }, delay);
    }

    function enqueueLiveCard(card, roomId) {
        if (processedCards.has(roomId) || pendingCards.has(roomId)) {
            return;
        }

        pendingCards.add(roomId);
        queuedCards.push({ card, roomId });
        debugLog('分类页卡片入队:', roomId, `queued=${queuedCards.length}`);
        runLiveCardQueue();
    }

    // 自动处理分类页上的所有卡片
    function processAllLiveCards() {
        const liveCards = document.querySelectorAll('a.Item_card-item_vf59q, .index_item_JSGkw a[href*="live.bilibili.com"]');

        liveCards.forEach(card => {
            const linkElement = card.querySelector('a[href*="live.bilibili.com"]') || card;
            if (!linkElement || !linkElement.href) return;
            const roomId = extractRoomId(linkElement.href);
            if (!roomId) return;
            if (processedCards.has(roomId) || pendingCards.has(roomId)) return;

            const nameElement = card.querySelector('.Item_nickName_KO2QE');
            if (!nameElement) return;

            enqueueLiveCard(card, roomId);
        });
    }

    // 处理个人空间页面（自动请求）
    async function handleSpaceClick() {
        // 脚本被禁用时不执行
        if (!isScriptEnabled) {
            return;
        }

        const uid = extractUidFromSpace();
        if (!uid) return;

        // 已有卡片则不重复请求
        const exist = document.querySelector('.anchor-detail-info[data-uid="' + uid + '"]');
        if (exist) {
            return;
        }

        try {
            const queryResult = await queryAnchorInfo(uid, 1);
            if (queryResult && queryResult.anchorInfo) {
                const detailedInfo = createDetailedInfo(queryResult.anchorInfo, {
                    showUpdate: queryResult.source === 'cache',
                    search: uid,
                    searchType: 1,
                    detailAttributeName: 'data-uid',
                    detailAttributeValue: uid
                });
                detailedInfo.setAttribute('data-uid', uid);
                document.body.appendChild(detailedInfo);
            }
        } catch (e) {
            debugError('获取主播信息失败:', e);
        }
    }

    // 处理直播间页面（自动请求）
    async function handleLiveRoomClick() {
        // 脚本被禁用时不执行
        if (!isScriptEnabled) {
            return;
        }

        const roomId = extractRoomIdFromLive();
        if (!roomId) return;

        const exist = document.querySelector('.anchor-detail-info[data-room-id="' + roomId + '"]');
        if (exist) {
            return;
        }

        try {
            const queryResult = await queryAnchorInfo(roomId, 3);
            if (queryResult && queryResult.anchorInfo) {
                const detailedInfo = createDetailedInfo(queryResult.anchorInfo, {
                    showUpdate: queryResult.source === 'cache',
                    search: roomId,
                    searchType: 3,
                    detailAttributeName: 'data-room-id',
                    detailAttributeValue: roomId
                });
                detailedInfo.setAttribute('data-room-id', roomId);
                document.body.appendChild(detailedInfo);
            }
        } catch (e) {
            debugError('获取主播信息失败:', e);
        }
    }

    // 页面UI初始化逻辑
    let areaTagsObserver = null;
    let areaTagsScanTimer = null;

    function resetLiveCardQueue() {
        if (liveCardQueueTimer) {
            clearTimeout(liveCardQueueTimer);
            liveCardQueueTimer = null;
        }
        queuedCards.forEach(task => {
            pendingCards.delete(task.roomId);
        });
        queuedCards.length = 0;
    }

    function scheduleProcessAllLiveCards() {
        if (areaTagsScanTimer) {
            clearTimeout(areaTagsScanTimer);
        }

        areaTagsScanTimer = setTimeout(() => {
            areaTagsScanTimer = null;
            processAllLiveCards();
        }, AREA_TAGS_SCAN_DEBOUNCE);
    }

    function initPageUI() {
        // 移除已存在的详情卡片
        const existingDetail = document.querySelector('.anchor-detail-info');
        if (existingDetail) existingDetail.remove();

        // 如果之前创建了分类页的观察器，先断开
        if (areaTagsObserver) {
            areaTagsObserver.disconnect();
            areaTagsObserver = null;
        }
        if (areaTagsScanTimer) {
            clearTimeout(areaTagsScanTimer);
            areaTagsScanTimer = null;
        }
        resetLiveCardQueue();

        if (window.location.href.includes('space.bilibili.com/')) {
            handleSpaceClick();
        } else if (window.location.href.match(/live\.bilibili\.com\/\d+/)) {
            handleLiveRoomClick();
        } else if (window.location.href.includes('live.bilibili.com/p/eden/area-tags')) {
            // 分类页：自动处理当前和后续懒加载的卡片
            setTimeout(() => {
                processAllLiveCards();
                // 处理后续懒加载的卡片
                areaTagsObserver = new MutationObserver(() => {
                    scheduleProcessAllLiveCards();
                });
                areaTagsObserver.observe(document.body, { childList: true, subtree: true });
            }, 1000);
        }
    }

    // 初始化：版本检查通过后自动请求并展示
    async function initializeScript() {
        // 先检查版本
        await checkScriptVersion();
        if (!isScriptEnabled) {
            return;
        }

        await checkOfficialApiAvailable();
        if (!isScriptEnabled) {
            return;
        }

        // 初始加载UI
        initPageUI();

        // 监听URL变化（解决SPA页面跳转问题）
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                // URL变化后重新初始化UI
                setTimeout(initPageUI, 1000);
            }
        }).observe(document, {subtree: true, childList: true});
    }

    initializeScript();

})();
