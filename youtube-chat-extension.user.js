// ==UserScript==
// @name         YouTube 후원 챗봇 (donation-manager 연동)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  donation-manager에서 후원 알림을 YouTube 채팅으로 자동 전송
// @author       donation-manager
// @match        https://www.youtube.com/live_chat*
// @match        https://www.youtube.com/watch*
// @match        https://studio.youtube.com/live_chat*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 설정
    const SERVER_URL = 'https://donation-manager-ufm1.onrender.com'; // 배포 서버 주소
    const RECONNECT_INTERVAL = 5000; // 재연결 간격 (ms)
    const MESSAGE_DELAY = 500; // 메시지 전송 후 딜레이 (ms) - 모더레이터는 더 빠르게 가능

    let socket = null;
    let isConnected = false;
    let messageQueue = [];
    let isSending = false;

    // 상태 표시 UI 생성
    function createStatusUI() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'donation-bot-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 99999;
            font-family: 'Malgun Gothic', sans-serif;
        `;
        statusDiv.innerHTML = '🤖 후원봇: 연결 중...';
        document.body.appendChild(statusDiv);
        return statusDiv;
    }

    // 상태 업데이트
    function updateStatus(message, color = 'white') {
        const statusDiv = document.getElementById('donation-bot-status');
        if (statusDiv) {
            statusDiv.innerHTML = message;
            statusDiv.style.borderLeft = `3px solid ${color}`;
        }
    }

    // 채팅 입력창 찾기
    function findChatInput() {
        // YouTube 라이브 채팅 입력창 셀렉터들
        const selectors = [
            '#input.yt-live-chat-text-input-field-renderer', // 기본
            'yt-live-chat-text-input-field-renderer #input',
            '#chat-input #input',
            'div[contenteditable="true"]#input',
            '#chatframe', // iframe 내부
        ];

        for (const selector of selectors) {
            const input = document.querySelector(selector);
            if (input) return input;
        }

        // iframe 내부 확인
        const iframe = document.querySelector('#chatframe');
        if (iframe && iframe.contentDocument) {
            for (const selector of selectors) {
                const input = iframe.contentDocument.querySelector(selector);
                if (input) return input;
            }
        }

        return null;
    }

    // 전송 버튼 찾기
    function findSendButton() {
        const selectors = [
            '#send-button button',
            'yt-button-renderer#send-button button',
            '#send-button yt-icon-button',
            'button[aria-label="보내기"]',
            'button[aria-label="Send"]',
        ];

        for (const selector of selectors) {
            const btn = document.querySelector(selector);
            if (btn) return btn;
        }

        // iframe 내부 확인
        const iframe = document.querySelector('#chatframe');
        if (iframe && iframe.contentDocument) {
            for (const selector of selectors) {
                const btn = iframe.contentDocument.querySelector(selector);
                if (btn) return btn;
            }
        }

        return null;
    }

    // 메시지 전송
    async function sendMessage(text) {
        const input = findChatInput();
        const sendBtn = findSendButton();

        if (!input) {
            console.error('❌ 채팅 입력창을 찾을 수 없습니다');
            updateStatus('🤖 후원봇: ❌ 채팅창 없음', 'red');
            return false;
        }

        if (!sendBtn) {
            console.error('❌ 전송 버튼을 찾을 수 없습니다');
            updateStatus('🤖 후원봇: ❌ 전송버튼 없음', 'red');
            return false;
        }

        try {
            // 입력창에 포커스
            input.focus();

            // 텍스트 입력 (contenteditable div용)
            input.textContent = text;

            // input 이벤트 발생시켜서 YouTube가 인식하게 함
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // 잠시 대기
            await new Promise(r => setTimeout(r, 100));

            // 전송 버튼 클릭
            sendBtn.click();

            console.log('✅ 메시지 전송:', text);
            updateStatus(`🤖 후원봇: ✅ 전송됨`, 'lime');

            return true;
        } catch (error) {
            console.error('❌ 메시지 전송 실패:', error);
            updateStatus('🤖 후원봇: ❌ 전송 실패', 'red');
            return false;
        }
    }

    // 메시지 큐 처리
    async function processQueue() {
        if (isSending || messageQueue.length === 0) return;

        isSending = true;

        while (messageQueue.length > 0) {
            const message = messageQueue.shift();
            await sendMessage(message);
            await new Promise(r => setTimeout(r, MESSAGE_DELAY));
        }

        isSending = false;
    }

    // Socket.IO 연결
    function connectToServer() {
        // Socket.IO 스크립트 동적 로드
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = SERVER_URL + '/socket.io/socket.io.js';
            script.onload = () => {
                console.log('✅ Socket.IO 로드됨');
                initSocket();
            };
            script.onerror = () => {
                console.error('❌ Socket.IO 로드 실패');
                updateStatus('🤖 후원봇: ❌ 서버 연결 실패', 'red');
                setTimeout(connectToServer, RECONNECT_INTERVAL);
            };
            document.head.appendChild(script);
        } else {
            initSocket();
        }
    }

    // 소켓 초기화
    function initSocket() {
        try {
            socket = io(SERVER_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: RECONNECT_INTERVAL
            });

            socket.on('connect', () => {
                isConnected = true;
                console.log('🔗 donation-manager 서버 연결됨');
                updateStatus('🤖 후원봇: ✅ 연결됨', 'lime');

                // 서버에 챗봇 클라이언트임을 알림
                socket.emit('chatbotConnect', { type: 'youtube-extension' });
            });

            socket.on('disconnect', () => {
                isConnected = false;
                console.log('❌ 서버 연결 끊김');
                updateStatus('🤖 후원봇: ❌ 연결 끊김', 'red');
            });

            // 채팅 메시지 수신
            socket.on('sendYouTubeChat', (data) => {
                console.log('📨 채팅 메시지 수신:', data);
                if (data.message) {
                    messageQueue.push(data.message);
                    processQueue();
                }
            });

            // 여러 메시지 한번에 수신
            socket.on('sendYouTubeChatBulk', (data) => {
                console.log('📨 다중 채팅 메시지 수신:', data);
                if (data.messages && Array.isArray(data.messages)) {
                    messageQueue.push(...data.messages);
                    processQueue();
                }
            });

            socket.on('connect_error', (error) => {
                console.error('❌ 연결 에러:', error);
                updateStatus('🤖 후원봇: ❌ 연결 에러', 'orange');
            });

        } catch (error) {
            console.error('❌ 소켓 초기화 실패:', error);
            updateStatus('🤖 후원봇: ❌ 초기화 실패', 'red');
            setTimeout(connectToServer, RECONNECT_INTERVAL);
        }
    }

    // 초기화
    function init() {
        console.log('🤖 YouTube 후원 챗봇 시작...');

        // 페이지 로드 대기
        setTimeout(() => {
            createStatusUI();
            connectToServer();
        }, 2000);
    }

    // 페이지 로드 후 시작
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
