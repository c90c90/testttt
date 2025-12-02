// ==UserScript==
// @name         B站直播主播信息显示
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  update手动请求
// @author       9
// @match        https://live.bilibili.com/p/eden/area-tags*
// @match        https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor*
// @include      /^https:\/\/live\.bilibili\.com\/\d+$/
// @include      /^https:\/\/live\.bilibili\.com\/\d+\?.+$/
// @include      /^https:\/\/space\.bilibili\.com\/\d+$/
// @include      /^https:\/\/space\.bilibili\.com\/\d+\?.+$/
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 样式定义
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

        /* 右下角悬浮球 */
        .anchor-float-button {
            position: fixed !important;
            right: 24px !important;
            top: 24px !important;
            width: 52px !important;
            height: 52px !important;
            border-radius: 50% !important;
            background: #00a1d6 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #fff !important;
            font-size: 24px !important;
            cursor: pointer !important;
            z-index: 10000 !important;
        }

        .anchor-float-button:hover {
            background: #00b5e5 !important;
        }

        /* 分类页卡片上的查询按钮 */
        .anchor-card-button {
            display: inline-block !important;
            margin-top: 4px !important;
            padding: 2px 6px !important;
            font-size: 12px !important;
            color: #fff !important;
            background: #00a1d6 !important;
            border-radius: 4px !important;
            cursor: pointer !important;
        }

        .anchor-card-button:hover {
            background: #00b5e5 !important;
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

    // 请求主播信息的函数
    function fetchAnchorInfo(roomId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor?search_type=3&search=${roomId}`,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // 请求主播信息的函数（通过UID）
    function fetchAnchorInfoByUid(uid) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor?search_type=1&search=${uid}`,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // 创建详细信息显示的函数
    function createDetailedInfo(anchorInfo) {
        const container = document.createElement('div');
        container.className = 'anchor-detail-info';

        let content = '';

        // 添加标题栏
        content += `<div class="anchor-detail-header">
            <span style="font-weight: bold; color: #333;">主播信息</span>
            <button class="anchor-detail-close" onclick="this.parentElement.parentElement.remove();">×</button>
        </div>`;

        // 添加基础状态标签
        content += `<div style="margin-bottom: 12px;">`;
        content += `<span class="status-badge ${anchorInfo.is_signed ? 'status-signed' : 'status-unsigned'}">${anchorInfo.is_signed ? '已签约' : '未签约'}</span>`;
        content += `<span class="status-badge ${anchorInfo.is_star_anchor === 1 ? 'status-star' : 'status-normal'}">${anchorInfo.is_star_anchor === 1 ? '繁星主播' : '普通主播'}</span>`;
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
                    starLevelText = `未知星级：${anchorInfo.star_level}`;
            }

            content += `<div class="anchor-detail-item star-level-info">当前星级：${starLevelText}</div>`;

            // 显示合约期信息
            if (anchorInfo.star_metrics && anchorInfo.star_metrics.length > 0) {
                content += `<div style="margin-top: 12px; margin-bottom: 8px; font-weight: bold; color: #555;">合约期信息：</div>`;
                anchorInfo.star_metrics.forEach((metric, index) => {
                    content += `<div class="contract-period">第${index + 1}期：${metric.DateRange}<br>${metric.Val.toLocaleString()}元/月</div>`;
                });
            }
        }

        // 如果是新人主播，显示有效开播天数
        if (anchorInfo.is_new_anchor === 1) {
            if (anchorInfo.is_star_anchor === 1) {
                content += '<div style="margin: 12px 0; border-top: 1px solid #ddd;"></div>';
            }
            content += `<div class="anchor-detail-title">🆕 新人主播信息</div>`;
            content += `<div class="anchor-detail-item new-anchor-info">有效开播天数：${anchorInfo.valid_live_day}天</div>`;
        }

        container.innerHTML = content;
        return container;
    }

    // 已处理的卡片缓存，使用房间号作为key
    const processedCards = new Set();

    // 创建状态标签的函数（仅用于分类页面）
    function createStatusBadge(isSigned, isStarAnchor, isNewAnchor) {
        // 创建容器元素
        const container = document.createElement('div');
        container.style.display = 'block';
        container.style.marginTop = '3px';
        container.style.lineHeight = '1';

        // 签约状态标签
        const signedBadge = document.createElement('span');
        signedBadge.className = `status-badge ${isSigned ? 'status-signed' : 'status-unsigned'}`;
        signedBadge.textContent = isSigned ? '已签约' : '未签约';

        // 繁星主播状态标签
        const starBadge = document.createElement('span');
        starBadge.className = `status-badge ${isStarAnchor ? 'status-star' : 'status-normal'}`;
        starBadge.textContent = isStarAnchor ? '繁星主播' : '普通主播';

        container.appendChild(signedBadge);
        container.appendChild(starBadge);

        // 新主播状态标签 - 只有新主播才显示
        if (isNewAnchor) {
            const newBadge = document.createElement('span');
            newBadge.className = 'status-badge status-new';
            newBadge.textContent = '新人';
            container.appendChild(newBadge);
        }

        return container;
    }

    // 处理单个直播卡片的函数（仅在分类页使用，按按钮后才请求）
    async function processLiveCard(card) {
        // 查找链接元素
        const linkElement = card.querySelector('a[href*="live.bilibili.com"]') || card;
        if (!linkElement || !linkElement.href) {
            return;
        }

        // 提取房间号
        const roomId = extractRoomId(linkElement.href);
        if (!roomId) {
            return;
        }

        // 防止重复展示
        if (card.querySelector('[data-room-id="' + roomId + '"]')) {
            return true;
        }

        try {
            // 获取主播信息
            const response = await fetchAnchorInfo(roomId);

            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];

                // 使用原来的标签样式在卡片上展示状态
                const isSigned = anchorInfo.is_signed;
                const isStarAnchor = anchorInfo.is_star_anchor === 1;
                const isNewAnchor = anchorInfo.is_new_anchor === 1;

                const nameElement = card.querySelector('.Item_nickName_KO2QE');
                if (nameElement) {
                    const statusBadges = createStatusBadge(isSigned, isStarAnchor, isNewAnchor);
                    statusBadges.setAttribute('data-room-id', roomId);
                    let insertTarget = nameElement.parentElement;
                    if (insertTarget && insertTarget.parentElement) {
                        const cardContentContainer = insertTarget.parentElement;
                        if (cardContentContainer) insertTarget = cardContentContainer;
                    }
                    if (insertTarget) insertTarget.appendChild(statusBadges);
                }

                processedCards.add(roomId);
                return true;
            }
        } catch (error) {
            console.error('获取主播信息失败:', error);
        }

        return false;
    }

    // 为分类页上的所有卡片添加“查询”按钮
    function addButtonsForAllCards() {
        const liveCards = document.querySelectorAll('a.Item_card-item_vf59q, .index_item_JSGkw a[href*="live.bilibili.com"]');

        liveCards.forEach(card => {
            // 避免重复添加
            if (card.querySelector('.anchor-card-button')) return;

            const linkElement = card.querySelector('a[href*="live.bilibili.com"]') || card;
            if (!linkElement || !linkElement.href) return;
            const roomId = extractRoomId(linkElement.href);
            if (!roomId) return;
            if (processedCards.has(roomId)) return;

            const nameElement = card.querySelector('.Item_nickName_KO2QE');
            if (!nameElement) return;

            const btn = document.createElement('span');
            btn.className = 'anchor-card-button';
            btn.textContent = '查询';
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (btn.dataset.loading) return;
                btn.dataset.loading = '1';
                btn.textContent = '查询中';
                const success = await processLiveCard(card);
                if (success) {
                    btn.remove();
                } else {
                    btn.removeAttribute('data-loading');
                    btn.textContent = '查询';
                }
            });

            let insertTarget = nameElement.parentElement;
            if (insertTarget && insertTarget.parentElement) {
                const cardContentContainer = insertTarget.parentElement;
                if (cardContentContainer) insertTarget = cardContentContainer;
            }
            if (insertTarget) insertTarget.appendChild(btn);
        });
    }

    // 创建右下角悬浮球
    function createFloatButton(onClick) {
        if (document.querySelector('.anchor-float-button')) return;
        const btn = document.createElement('div');
        btn.className = 'anchor-float-button';
        btn.textContent = '信息';
        btn.addEventListener('click', onClick);
        document.body.appendChild(btn);
    }

    // 处理个人空间页面（点击后再请求）
    async function handleSpaceClick() {
        const uid = extractUidFromSpace();
        if (!uid) return;

        // 已有卡片则仅切换显示
        const exist = document.querySelector('.anchor-detail-info[data-uid="' + uid + '"]');
        if (exist) {
            exist.remove();
            return;
        }

        try {
            const response = await fetchAnchorInfoByUid(uid);
            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];
                const detailedInfo = createDetailedInfo(anchorInfo);
                detailedInfo.setAttribute('data-uid', uid);
                document.body.appendChild(detailedInfo);
            }
        } catch (e) {
            console.error('获取主播信息失败:', e);
        }
    }

    // 处理直播间页面（点击后再请求）
    async function handleLiveRoomClick() {
        const roomId = extractRoomIdFromLive();
        if (!roomId) return;

        const exist = document.querySelector('.anchor-detail-info[data-room-id="' + roomId + '"]');
        if (exist) {
            exist.remove();
            return;
        }

        try {
            const response = await fetchAnchorInfo(roomId);
            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];
                const detailedInfo = createDetailedInfo(anchorInfo);
                detailedInfo.setAttribute('data-room-id', roomId);
                document.body.appendChild(detailedInfo);
            }
        } catch (e) {
            console.error('获取主播信息失败:', e);
        }
    }

    // 初始化：只创建悬浮球，不自动请求
    function initializeScript() {
        if (window.location.href.includes('space.bilibili.com/')) {
            createFloatButton(handleSpaceClick);
        } else if (window.location.href.match(/live\.bilibili\.com\/\d+/)) {
            createFloatButton(handleLiveRoomClick);
        } else if (window.location.href.includes('live.bilibili.com/p/eden/area-tags')) {
            // 分类页：不自动请求，在每个卡片上放按钮
            setTimeout(() => {
                addButtonsForAllCards();
                // 处理后续懒加载的卡片
                const observer = new MutationObserver(() => {
                    addButtonsForAllCards();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }, 1000);
        }
    }

    initializeScript();

})();
