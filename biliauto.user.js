// ==UserScript==
// @name         B站直播主播信息显示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在B站直播页面显示主播签约状态和繁星主播状态
// @author       9
// @match        https://live.bilibili.com/p/eden/area-tags*
// @match        https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 样式定义
    const style = document.createElement('style');
    style.textContent = `
        .anchor-status-container {
            display: block !important;
            width: 100% !important;
            margin-top: 3px !important;
            line-height: 1 !important;
            clear: both !important;
            float: none !important;
        }
        .anchor-status {
            display: inline-block;
            margin-right: 5px;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            color: white;
        }
        .status-signed {
            background-color: #005f03ff;
        }
        .status-unsigned {
            background-color: #FF5722;
        }
        .status-star {
            background-color: #ffd900ff;
            color: #333;
        }
        .status-normal {
            background-color: #006f9bff;
        }
        .status-new {
            background-color: #63cc00ff;
        }
        .status-old {
            background-color: #8400ffff;
        }
    `;
    document.head.appendChild(style);

    // 提取房间号的函数
    function extractRoomId(url) {
        const match = url.match(/live\.bilibili\.com\/(\d+)/);
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

    // 创建状态标签的函数
    function createStatusBadge(isSigned, isStarAnchor, isNewAnchor) {
        // 创建容器元素
        const container = document.createElement('div');
        container.className = 'anchor-status-container';
        
        // 签约状态标签
        const signedBadge = document.createElement('span');
        signedBadge.className = `anchor-status ${isSigned ? 'status-signed' : 'status-unsigned'}`;
        signedBadge.textContent = isSigned ? '已签约' : '未签约';
        
        // 繁星主播状态标签
        const starBadge = document.createElement('span');
        starBadge.className = `anchor-status ${isStarAnchor ? 'status-star' : 'status-normal'}`;
        starBadge.textContent = isStarAnchor ? '繁星主播' : '普通主播';
        
        container.appendChild(signedBadge);
        container.appendChild(starBadge);
        
        // 新主播状态标签 - 只有新主播才显示
        if (isNewAnchor) {
            const newBadge = document.createElement('span');
            newBadge.className = 'anchor-status status-new';
            newBadge.textContent = '新人';
            container.appendChild(newBadge);
        }
        
        return container;
    }

    // 已处理的卡片缓存，使用房间号作为key
    const processedCards = new Set();

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
        if (card.querySelector('.anchor-status-container')) {
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
                    // 创建状态标签
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

    // 开始观察
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始处理
    setTimeout(() => {
        processAllLiveCards();
        
        // 定期检查新的卡片（防止某些情况下观察器失效）
        setInterval(processAllLiveCards, 3000);
    }, 1000);

})();
