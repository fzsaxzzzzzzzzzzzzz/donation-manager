// YouTube 챗봇 팝업 스크립트
console.log('🎛️ 팝업 로드됨');

class ChatBotPopup {
    constructor() {
        this.isEnabled = false;
        this.responses = {};
        this.currentTab = null;
        
        this.init();
    }
    
    async init() {
        // 현재 탭 정보 가져오기
        await this.getCurrentTab();
        
        // 설정 로드
        await this.loadSettings();
        
        // UI 이벤트 설정
        this.setupEvents();
        
        // 챗봇 상태 확인
        await this.checkBotStatus();
        
        // 로딩 화면 숨기기
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        console.log('✅ 팝업 초기화 완료');
    }
    
    async getCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            console.log('📑 현재 탭:', this.currentTab?.url);
        } catch (error) {
            console.error('❌ 탭 정보 가져오기 실패:', error);
        }
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['botEnabled', 'botResponses']);
            this.isEnabled = result.botEnabled || false;
            this.responses = result.botResponses || this.getDefaultResponses();
            
            this.updateUI();
            console.log('📱 설정 로드 완료');
        } catch (error) {
            console.error('❌ 설정 로드 실패:', error);
            this.responses = this.getDefaultResponses();
            this.updateUI();
        }
    }
    
    getDefaultResponses() {
        return {
            '!안녕': '안녕하세요! 👋',
            '!시간': '현재 시간 확인 중... 🕐',
            '!봇': '네, 저는 자동 응답 봇입니다! 🤖',
            '!명령어': '사용 가능한 명령어: !안녕, !시간, !봇, !명령어 📝',
            '!후원': '후원해주셔서 감사합니다! 💝',
            '안녕': '안녕하세요~ 😊',
            '고마워': '천만에요! 😄',
            '굿': '👍 굿!',
            'ㅋㅋ': 'ㅋㅋㅋ 😂'
        };
    }
    
    setupEvents() {
        // 토글 스위치
        const toggleSwitch = document.getElementById('toggleSwitch');
        toggleSwitch.addEventListener('click', () => {
            this.toggleBot();
        });
        
        // 새로고침 버튼
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshStatus();
        });
        
        // 테스트 버튼
        document.getElementById('testBtn').addEventListener('click', () => {
            this.sendTestMessage();
        });
    }
    
    updateUI() {
        // 토글 스위치 상태
        const toggleSwitch = document.getElementById('toggleSwitch');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (this.isEnabled) {
            toggleSwitch.classList.add('active');
            statusIndicator.className = 'status-indicator status-online';
            statusText.textContent = '활성화됨';
        } else {
            toggleSwitch.classList.remove('active');
            statusIndicator.className = 'status-indicator status-offline';
            statusText.textContent = '비활성화됨';
        }
        
        // 응답 목록 업데이트
        this.updateResponsesList();
        
        // 통계 업데이트
        document.getElementById('totalResponses').textContent = Object.keys(this.responses).length;
    }
    
    updateResponsesList() {
        const responsesList = document.getElementById('responsesList');
        const responseCount = document.getElementById('responseCount');
        
        responsesList.innerHTML = '';
        
        const entries = Object.entries(this.responses).slice(0, 6); // 최대 6개만 표시
        entries.forEach(([trigger, response]) => {
            const item = document.createElement('div');
            item.className = 'response-item';
            
            const responseText = typeof response === 'function' ? '동적 응답' : response;
            const shortResponse = responseText.length > 20 ? responseText.substring(0, 20) + '...' : responseText;
            
            // 보안 강화: innerHTML 대신 textContent 사용
            const triggerEl = document.createElement('div');
            triggerEl.className = 'response-trigger';
            triggerEl.textContent = trigger;
            
            const arrowEl = document.createElement('div');
            arrowEl.className = 'response-arrow';
            arrowEl.textContent = '→';
            
            const responseEl = document.createElement('div');
            responseEl.className = 'response-text';
            responseEl.textContent = shortResponse;
            
            item.appendChild(triggerEl);
            item.appendChild(arrowEl);
            item.appendChild(responseEl);
            
            responsesList.appendChild(item);
        });
        
        const total = Object.keys(this.responses).length;
        responseCount.textContent = `(${total}개)`;
        
        if (total > 6) {
            const moreItem = document.createElement('div');
            moreItem.className = 'response-item';
            moreItem.style.opacity = '0.7';
            // 보안 강화: innerHTML 대신 안전한 DOM 조작
            const moreTrigger = document.createElement('div');
            moreTrigger.className = 'response-trigger';
            moreTrigger.textContent = '...';
            
            const moreArrow = document.createElement('div');
            moreArrow.className = 'response-arrow';
            moreArrow.textContent = '→';
            
            const moreText = document.createElement('div');
            moreText.className = 'response-text';
            moreText.textContent = `외 ${total - 6}개 더`;
            
            moreItem.appendChild(moreTrigger);
            moreItem.appendChild(moreArrow);
            moreItem.appendChild(moreText);
            responsesList.appendChild(moreItem);
        }
    }
    
    async toggleBot() {
        this.isEnabled = !this.isEnabled;
        
        // 설정 저장
        await chrome.storage.local.set({ 
            botEnabled: this.isEnabled,
            botResponses: this.responses 
        });
        
        // 컨텐트 스크립트에 변경사항 전달
        await this.sendMessageToTab({
            action: 'updateSettings',
            enabled: this.isEnabled,
            responses: this.responses
        });
        
        this.updateUI();
        console.log('🔄 봇 상태 변경:', this.isEnabled);
    }
    
    async checkBotStatus() {
        if (!this.isYouTubePage()) {
            document.getElementById('statusText').textContent = 'YouTube 페이지가 아님';
            document.getElementById('statusIndicator').className = 'status-indicator status-warning';
            document.getElementById('chatStatus').textContent = '❌';
            return;
        }
        
        try {
            const response = await this.sendMessageToTab({ action: 'getStatus' });
            if (response) {
                const chatStatusEl = document.getElementById('chatStatus');
                chatStatusEl.textContent = response.hasChat ? '✅' : '❌';
                
                if (!response.hasChat) {
                    document.getElementById('statusText').textContent = '채팅창 찾기 실패';
                    document.getElementById('statusIndicator').className = 'status-indicator status-warning';
                }
            }
        } catch (error) {
            console.error('❌ 상태 확인 실패:', error);
            document.getElementById('chatStatus').textContent = '❌';
        }
    }
    
    isYouTubePage() {
        return this.currentTab?.url?.includes('youtube.com/watch');
    }
    
    async sendMessageToTab(message) {
        if (!this.currentTab?.id) return null;
        
        try {
            return await chrome.tabs.sendMessage(this.currentTab.id, message);
        } catch (error) {
            console.error('❌ 탭 메시지 전송 실패:', error);
            return null;
        }
    }
    
    async refreshStatus() {
        document.getElementById('refreshBtn').textContent = '🔄 확인 중...';
        
        await this.checkBotStatus();
        await this.loadSettings();
        
        setTimeout(() => {
            document.getElementById('refreshBtn').textContent = '🔄 새로고침';
        }, 1000);
    }
    
    async sendTestMessage() {
        if (!this.isYouTubePage()) {
            alert('YouTube 시청 페이지에서만 사용할 수 있습니다.');
            return;
        }
        
        const testBtn = document.getElementById('testBtn');
        testBtn.textContent = '🧪 테스트 중...';
        testBtn.disabled = true;
        
        try {
            // 컨텐트 스크립트를 통해 테스트 메시지 전송
            await chrome.tabs.executeScript(this.currentTab.id, {
                code: `
                    const input = document.querySelector('#input') || 
                                document.querySelector('yt-live-chat-text-input-field-renderer input');
                    const button = document.querySelector('#send-button') || 
                                 document.querySelector('yt-live-chat-text-input-field-renderer button');
                    
                    if (input && button) {
                        input.value = '🤖 챗봇 테스트 메시지';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => button.click(), 500);
                        console.log('✅ 테스트 메시지 전송됨');
                    } else {
                        console.log('❌ 채팅 요소를 찾을 수 없음');
                    }
                `
            });
            
            setTimeout(() => {
                testBtn.textContent = '✅ 전송됨';
                setTimeout(() => {
                    testBtn.textContent = '🧪 테스트 메시지';
                    testBtn.disabled = false;
                }, 1500);
            }, 1000);
            
        } catch (error) {
            console.error('❌ 테스트 메시지 전송 실패:', error);
            testBtn.textContent = '❌ 실패';
            setTimeout(() => {
                testBtn.textContent = '🧪 테스트 메시지';
                testBtn.disabled = false;
            }, 2000);
        }
    }
}

// 팝업이 열릴 때 초기화
document.addEventListener('DOMContentLoaded', () => {
    new ChatBotPopup();
});

console.log('🚀 팝업 스크립트 로드 완료');