// 빠른 테스트용 스크립트
console.log('🧪 테스트 스크립트 로드됨');

// 1. 모든 input 요소 찾기
setTimeout(() => {
    console.log('=== YouTube 채팅 요소 검색 결과 ===');
    
    const allInputs = document.querySelectorAll('input');
    console.log('📝 전체 input 요소:', allInputs.length);
    
    allInputs.forEach((input, i) => {
        console.log(`Input ${i}:`, {
            id: input.id,
            placeholder: input.placeholder,
            ariaLabel: input.getAttribute('aria-label'),
            className: input.className
        });
    });
    
    const allButtons = document.querySelectorAll('button');
    console.log('🔘 전체 button 요소:', allButtons.length);
    
    // 채팅 관련 요소만 필터링
    allButtons.forEach((button, i) => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const title = button.title || '';
        if (ariaLabel.includes('Send') || ariaLabel.includes('전송') || 
            title.includes('Send') || title.includes('전송')) {
            console.log(`Send Button ${i}:`, {
                ariaLabel: ariaLabel,
                title: title,
                textContent: button.textContent?.trim()
            });
        }
    });
    
    // iframe 확인
    const iframes = document.querySelectorAll('iframe');
    console.log('🖼️ iframe 요소:', iframes.length);
    
    iframes.forEach((iframe, i) => {
        console.log(`iframe ${i}:`, {
            src: iframe.src,
            id: iframe.id,
            className: iframe.className
        });
    });
    
}, 3000);

// 2. 수동으로 메시지 전송 테스트
window.sendTestMessage = function() {
    const input = document.querySelector('#input') || 
                  document.querySelector('input[placeholder*="chat"]') ||
                  document.querySelector('input[placeholder*="채팅"]');
    
    const button = document.querySelector('#send-button') ||
                   document.querySelector('button[aria-label*="Send"]') ||
                   document.querySelector('button[aria-label*="전송"]');
    
    if (input && button) {
        input.value = '🤖 테스트 메시지 from 확장프로그램!';
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        setTimeout(() => {
            button.click();
            console.log('✅ 테스트 메시지 전송 완료!');
        }, 500);
    } else {
        console.log('❌ 채팅 요소를 찾을 수 없음', { input: !!input, button: !!button });
    }
};

console.log('💡 콘솔에서 sendTestMessage() 실행해보세요!');