// YouTube 챗봇 - 채팅 DOM 조작 스크립트
console.log('🤖 YouTube 챗봇 로드됨!');

class YouTubeChatBot {
    constructor() {
        this.isEnabled = false;
        this.responses = {};
        this.chatInput = null;
        this.sendButton = null;
        this.lastMessageTime = 0;
        this.messageDelay = 2000; // 2초 딜레이
        
        this.init();
    }
    
    async init() {
        // 설정 로드
        await this.loadSettings();
        
        // 페이지 로드 대기
        this.waitForChatElements();
        
        // 채팅 감시 시작
        this.startChatMonitoring();
        
        console.log('✅ 챗봇 초기화 완료');
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['botEnabled', 'botResponses']);
            this.isEnabled = result.botEnabled || false;
            this.responses = result.botResponses || this.getDefaultResponses();
            
            console.log('📱 설정 로드됨:', { enabled: this.isEnabled, responses: Object.keys(this.responses).length });
        } catch (error) {
            console.error('❌ 설정 로드 실패:', error);
            this.responses = this.getDefaultResponses();
        }
    }
    
    getDefaultResponses() {
        return {
            '!안녕': '안녕하세요! 👋',
            '!시간': () => `현재 시간: ${new Date().toLocaleTimeString('ko-KR')} 🕐`,
            '!봇': '네, 저는 자동 응답 봇입니다! 🤖',
            '!명령어': '사용 가능한 명령어: !안녕, !시간, !봇, !명령어 📝',
            '!후원': '후원해주셔서 감사합니다! 💝',
            '안녕': '안녕하세요~ 😊',
            '고마워': '천만에요! 😄',
            '굿': '👍 굿!',
            'ㅋㅋ': 'ㅋㅋㅋ 😂'
        };
    }
    
    waitForChatElements() {
        console.log('🔍 채팅 요소 검색 시작...');
        
        const checkInterval = setInterval(() => {
            // 더 많은 선택자로 채팅 입력창 찾기
            this.chatInput = document.querySelector('#input') || 
                           document.querySelector('input[placeholder*="채팅"]') ||
                           document.querySelector('input[placeholder*="chat"]') ||
                           document.querySelector('input[aria-label*="채팅"]') ||
                           document.querySelector('input[aria-label*="chat"]') ||
                           document.querySelector('yt-live-chat-text-input-field-renderer input') ||
                           document.querySelector('#chatframe')?.contentDocument?.querySelector('#input') ||
                           document.querySelector('iframe[src*="live_chat"]')?.contentDocument?.querySelector('#input');
            
            // 전송 버튼 찾기 (더 포괄적으로)
            this.sendButton = document.querySelector('#send-button') ||
                            document.querySelector('button[aria-label*="전송"]') ||
                            document.querySelector('button[aria-label*="Send"]') ||
                            document.querySelector('button[title*="전송"]') ||
                            document.querySelector('button[title*="Send"]') ||
                            document.querySelector('yt-live-chat-text-input-field-renderer button') ||
                            document.querySelector('#chatframe')?.contentDocument?.querySelector('#send-button');
            
            // 디버깅 정보
            if (!this.chatInput) {
                console.log('🔍 채팅 입력창 검색 중...', {
                    allInputs: document.querySelectorAll('input').length,
                    chatInputs: document.querySelectorAll('input[placeholder*="chat"], input[placeholder*="채팅"]').length,
                    iframes: document.querySelectorAll('iframe').length
                });
            }
            
            if (!this.sendButton) {
                console.log('🔍 전송 버튼 검색 중...', {
                    allButtons: document.querySelectorAll('button').length,
                    sendButtons: document.querySelectorAll('button[aria-label*="Send"], button[aria-label*="전송"]').length
                });
            }
            
            if (this.chatInput && this.sendButton) {
                console.log('✅ 채팅 요소 찾음!', {
                    input: this.chatInput.tagName,
                    button: this.sendButton.tagName
                });
                clearInterval(checkInterval);
                this.setupChatElements();
            }
        }, 1000);
        
        // 30초 후 포기
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.chatInput || !this.sendButton) {
                console.log('⚠️ 채팅 요소를 찾을 수 없음 - 페이지를 새로고침하세요');
            }
        }, 30000);
    }
    
    setupChatElements() {
        // 입력창에 스타일 추가 (봇 활성화 표시)
        if (this.isEnabled) {
            this.chatInput.style.border = '2px solid #00ff00';
            this.chatInput.style.boxShadow = '0 0 10px rgba(0,255,0,0.3)';
        }
        
        console.log('🎯 채팅 요소 설정 완료');
    }
    
    startChatMonitoring() {
        // MutationObserver로 새 채팅 감지
        const chatContainer = document.querySelector('#chatframe') ||
                            document.querySelector('#chat') ||
                            document.querySelector('[id*="chat"]') ||
                            document.body;
        
        if (!chatContainer) {
            console.log('⚠️ 채팅 컨테이너를 찾을 수 없음');
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkForChatMessage(node);
                    }
                });
            });
        });
        
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('👀 채팅 감시 시작');
        
        // 주기적으로 기존 메시지도 체크
        setInterval(() => {
            this.checkAllChatMessages();
        }, 3000);
    }
    
    checkForChatMessage(element) {
        if (!this.isEnabled) return;
        
        // 채팅 메시지 텍스트 추출
        const messageText = this.extractMessageText(element);
        if (messageText) {
            this.handleChatMessage(messageText);
        }
    }
    
    checkAllChatMessages() {
        if (!this.isEnabled) return;
        
        // 최근 채팅 메시지들 확인
        const messages = document.querySelectorAll(
            'yt-live-chat-text-message-renderer, ' +
            '[class*="chat-message"], ' +
            '[class*="message"]'
        );
        
        // 최신 3개 메시지만 확인
        const recentMessages = Array.from(messages).slice(-3);
        recentMessages.forEach(msg => {
            const text = this.extractMessageText(msg);
            if (text) {
                this.handleChatMessage(text);
            }
        });
    }
    
    extractMessageText(element) {
        // 여러 방식으로 텍스트 추출 시도
        let text = '';
        
        // YouTube 채팅 메시지에서 텍스트 추출
        const textElement = element.querySelector('#message') ||
                          element.querySelector('.message') ||
                          element.querySelector('[id*="message"]') ||
                          element.querySelector('[class*="message"]');
        
        if (textElement) {
            text = textElement.textContent || textElement.innerText;
        } else {
            text = element.textContent || element.innerText;
        }
        
        return text.trim().toLowerCase();
    }
    
    async handleChatMessage(messageText) {
        // 너무 자주 응답하지 않도록 딜레이 체크
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageDelay) {
            return;
        }
        
        // 응답할 메시지 찾기
        const response = this.findResponse(messageText);
        if (response) {
            console.log('💬 응답 대상:', messageText, '→', response);
            await this.sendMessage(response);
            this.lastMessageTime = now;
        }
    }
    
    findResponse(messageText) {
        for (const [trigger, response] of Object.entries(this.responses)) {
            if (messageText.includes(trigger.toLowerCase())) {
                // 함수인 경우 실행해서 반환
                return typeof response === 'function' ? response() : response;
            }
        }
        return null;
    }
    
    async sendMessage(message) {
        if (!this.chatInput || !this.sendButton) {
            console.log('❌ 채팅 요소가 없음');
            return;
        }
        
        try {
            // 입력창에 메시지 입력
            this.chatInput.value = message;
            this.chatInput.focus();
            
            // input 이벤트 발생
            this.chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.chatInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 잠시 대기
            await this.sleep(500);
            
            // 전송 버튼 클릭
            this.sendButton.click();
            
            console.log('✅ 메시지 전송:', message);
            
        } catch (error) {
            console.error('❌ 메시지 전송 실패:', error);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 외부에서 봇 상태 변경
    async updateSettings(enabled, responses) {
        this.isEnabled = enabled;
        if (responses) {
            this.responses = responses;
        }
        
        // 설정 저장
        await chrome.storage.local.set({
            botEnabled: enabled,
            botResponses: this.responses
        });
        
        // UI 업데이트
        if (this.chatInput) {
            if (enabled) {
                this.chatInput.style.border = '2px solid #00ff00';
                this.chatInput.style.boxShadow = '0 0 10px rgba(0,255,0,0.3)';
            } else {
                this.chatInput.style.border = '';
                this.chatInput.style.boxShadow = '';
            }
        }
        
        console.log('⚙️ 설정 업데이트:', { enabled, responses: Object.keys(this.responses).length });
    }
}

// 챗봇 인스턴스 생성
const chatBot = new YouTubeChatBot();

// 팝업에서 설정 변경 메시지 수신
chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSettings') {
        chatBot.updateSettings(request.enabled, request.responses);
        sendResponse({ success: true });
    } else if (request.action === 'getStatus') {
        sendResponse({ 
            enabled: chatBot.isEnabled,
            responses: Object.keys(chatBot.responses).length,
            hasChat: !!(chatBot.chatInput && chatBot.sendButton)
        });
    }
});

console.log('🚀 YouTube 챗봇 활성화됨!');