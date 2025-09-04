// ==UserScript==
// @name         B站直播主播信息显示
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  在B站直播页面显示主播签约状态和繁星主播状态
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

    // 处理单个直播卡片的函数
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

        // 检查是否已经处理过这个房间号
        if (processedCards.has(roomId)) {
            return;
        }

        // 检查DOM中是否已经有状态标签
        if (card.querySelector('[data-room-id="' + roomId + '"]')) {
            processedCards.add(roomId);
            return;
        }

        // 标记为正在处理，避免重复请求
        processedCards.add(roomId);

        try {
            // 获取主播信息
            const response = await fetchAnchorInfo(roomId);

            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];
                const isSigned = anchorInfo.is_signed;
                const isStarAnchor = anchorInfo.is_star_anchor === 1;
                const isNewAnchor = anchorInfo.is_new_anchor === 1;

                // 查找主播名字元素
                const nameElement = card.querySelector('.Item_nickName_KO2QE');
                if (nameElement) {
                    // 创建状态标签（仅在分类页面显示）
                    const statusBadges = createStatusBadge(isSigned, isStarAnchor, isNewAnchor);

                    // 给状态标签添加房间号标识
                    statusBadges.setAttribute('data-room-id', roomId);

                    // 查找合适的插入位置
                    // 尝试插入到名字元素的父容器的父容器中（卡片内容区域）
                    let insertTarget = nameElement.parentElement;

                    // 如果父容器存在，尝试找到更合适的容器
                    if (insertTarget && insertTarget.parentElement) {
                        // 检查是否有更大的容器可以插入
                        const cardContentContainer = insertTarget.parentElement;
                        if (cardContentContainer) {
                            insertTarget = cardContentContainer;
                        }
                    }

                    if (insertTarget) {
                        insertTarget.appendChild(statusBadges);
                    }
                }
            }
        } catch (error) {
            // 如果请求失败，从缓存中移除，允许下次重试
            processedCards.delete(roomId);
            console.error('获取主播信息失败:', error);
        }
    }

    // 查找并处理所有直播卡片的函数
    function processAllLiveCards() {
        // 查找所有直播卡片
        const liveCards = document.querySelectorAll('a.Item_card-item_vf59q, .index_item_JSGkw a[href*="live.bilibili.com"]');

        liveCards.forEach(card => {
            processLiveCard(card);
        });

        // 清理已删除卡片对应的缓存
        cleanupProcessedCards();
    }

    // 清理已删除卡片的缓存
    function cleanupProcessedCards() {
        const currentRoomIds = new Set();
        const liveCards = document.querySelectorAll('a.Item_card-item_vf59q, .index_item_JSGkw a[href*="live.bilibili.com"]');

        liveCards.forEach(card => {
            const linkElement = card.querySelector('a[href*="live.bilibili.com"]') || card;
            if (linkElement && linkElement.href) {
                const roomId = extractRoomId(linkElement.href);
                if (roomId) {
                    currentRoomIds.add(roomId);
                }
            }
        });

        // 移除不再存在的房间号
        for (const roomId of processedCards) {
            if (!currentRoomIds.has(roomId)) {
                processedCards.delete(roomId);
            }
        }
    }

    // 创建观察器来监听DOM变化
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否有新的直播卡片添加
                        if (node.matches && (node.matches('a.Item_card-item_vf59q') ||
                            node.matches('.index_item_JSGkw') ||
                            node.querySelector('a[href*="live.bilibili.com"]'))) {
                            shouldProcess = true;
                        }
                    }
                });
            }
        });

        if (shouldProcess) {
            // 延迟执行，确保DOM完全加载
            setTimeout(processAllLiveCards, 500);
        }
    });

    // 处理个人空间页面的函数
    async function processSpacePage() {
        // 检查是否在个人空间页面
        if (!window.location.href.includes('space.bilibili.com/')) {
            return;
        }

        // 提取UID
        const uid = extractUidFromSpace();
        if (!uid) {
            return;
        }

        // 检查是否已经添加过浮窗
        if (document.querySelector('.anchor-detail-info[data-uid="' + uid + '"]')) {
            return;
        }

        try {
            // 获取主播信息
            const response = await fetchAnchorInfoByUid(uid);

            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];

                // 创建详细信息显示
                const detailedInfo = createDetailedInfo(anchorInfo);
                detailedInfo.setAttribute('data-uid', uid);

                // 直接添加到页面body中
                document.body.appendChild(detailedInfo);
            }
        } catch (error) {
            console.error('获取主播信息失败:', error);
        }
    }

    // 处理直播间页面的函数
    async function processLiveRoomPage() {
        // 检查是否在直播间页面
        if (!window.location.href.match(/live\.bilibili\.com\/\d+/)) {
            return;
        }

        // 提取房间号
        const roomId = extractRoomIdFromLive();
        if (!roomId) {
            return;
        }

        // 检查是否已经添加过浮窗
        if (document.querySelector('.anchor-detail-info[data-room-id="' + roomId + '"]')) {
            return;
        }

        try {
            // 获取主播信息
            const response = await fetchAnchorInfo(roomId);

            if (response.code === 0 && response.data.items && response.data.items.length > 0) {
                const anchorInfo = response.data.items[0];

                // 创建详细信息显示
                const detailedInfo = createDetailedInfo(anchorInfo);
                detailedInfo.setAttribute('data-room-id', roomId);

                // 直接添加到页面body中
                document.body.appendChild(detailedInfo);
            }
        } catch (error) {
            console.error('获取主播信息失败:', error);
        }
    }

    // 检查当前页面类型并执行对应处理
    function initializeScript() {
        if (window.location.href.includes('space.bilibili.com/')) {
            // 个人空间页面
            setTimeout(() => {
                processSpacePage();

                // 定期检查（防止动态加载内容）
                setInterval(processSpacePage, 2000);
            }, 1000);
        } else if (window.location.href.match(/live\.bilibili\.com\/\d+/)) {
            // 直播间页面
            setTimeout(() => {
                processLiveRoomPage();

                // 定期检查（防止动态加载内容）
                setInterval(processLiveRoomPage, 2000);
            }, 1000);
        } else if (window.location.href.includes('live.bilibili.com/p/eden/area-tags')) {
            // 直播分类页面
            setTimeout(() => {
                processAllLiveCards();

                // 定期检查新的卡片（防止某些情况下观察器失效）
                setInterval(processAllLiveCards, 3000);
            }, 1000);
        }
    }

    // 开始观察
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始处理
    initializeScript();

})();
