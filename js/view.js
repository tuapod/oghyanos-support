const WORKER_URL = 'https://oghyanos-api.ltfyamyry-0lt.workers.dev'; // آدرس ورکر خودت رو بذار

document.addEventListener('DOMContentLoaded', () => {
    // 1. خواندن آیدی تیکت از URL
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    if (!ticketId) {
        document.getElementById('chat-messages').innerHTML = '<div class="loading-state">آیدی تیکت یافت نشد.</div>';
        return;
    }

    // 2. بارگذاری اطلاعات تیکت
    loadTicketDetails(ticketId);

    // 3. مدیریت ارسال پاسخ
    const sendBtn = document.getElementById('send-reply');
    const replyInput = document.getElementById('reply-input');

    sendBtn.addEventListener('click', () => sendReply(ticketId));
    replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendReply(ticketId);
        }
    });
});

async function loadTicketDetails(ticketId) {
    const subjectEl = document.getElementById('chat-subject');
    const statusEl = document.getElementById('chat-status');
    const messagesContainer = document.getElementById('chat-messages');

    try {
        // دریافت اطلاعات تیکت از ورکر
        const response = await fetch(`${WORKER_URL}/api/tickets/${ticketId}`);
        
        if (!response.ok) throw new Error('تیکت پیدا نشد');
        
        const ticket = await response.json();

        // آپدیت هدر
        subjectEl.textContent = ticket.subject;
        
        if (ticket.status === 'open') {
            statusEl.textContent = 'در انتظار بررسی';
            statusEl.classList.add('open');
        } else {
            statusEl.textContent = 'پاسخ داده شده';
            statusEl.classList.remove('open');
        }

        // ساخت پیام‌ها
        let messagesHTML = `
            <div class="message user">
                <div class="bubble">${ticket.message}</div>
                <span class="message-time">${new Date(ticket.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;

        // اگر پاسخی وجود داشت
        if (ticket.replies && ticket.replies.length > 0) {
            ticket.replies.forEach(reply => {
                messagesHTML += `
                    <div class="message ${reply.isAdmin ? 'admin' : 'user'}">
                        <div class="bubble">${reply.message}</div>
                        <span class="message-time">${new Date(reply.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                `;
            });
        }

        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // اسکرول به آخر

    } catch (error) {
        console.error(error);
        messagesContainer.innerHTML = '<div class="loading-state">خطا در دریافت اطلاعات تیکت.</div>';
    }
}

async function sendReply(ticketId) {
    const replyInput = document.getElementById('reply-input');
    const message = replyInput.value.trim();
    
    if (!message) return;

    const sendBtn = document.getElementById('send-reply');
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
        const response = await fetch(`${WORKER_URL}/api/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        if (response.ok) {
            replyInput.value = '';
            loadTicketDetails(ticketId); // بارگذاری مجدد پیام‌ها
        } else {
            alert('خطا در ارسال پاسخ');
        }
    } catch (error) {
        console.error(error);
        alert('خطا در ارتباط با سرور');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'ارسال';
    }
}