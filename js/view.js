// js/view.js
const WORKER_URL = 'https://oghyanos-api.ltfyamyry-0lt.workers.dev';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. بررسی احراز هویت
    const isLoggedIn = await initAuth();
    if (!isLoggedIn) return;

    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    if (!ticketId) {
        document.getElementById('chat-messages').innerHTML = '<div class="no-messages">آیدی تیکت یافت نشد.</div>';
        return;
    }

    loadTicketDetails(ticketId);

    const sendBtn = document.getElementById('send-reply');
    const replyInput = document.getElementById('reply-input');

    sendBtn.addEventListener('click', () => sendReply(ticketId));
    replyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendReply(ticketId);
        }
    });

    document.getElementById('toggle-info').addEventListener('click', () => {
        document.getElementById('info-sidebar').classList.toggle('open');
    });
    document.getElementById('close-info').addEventListener('click', () => {
        document.getElementById('info-sidebar').classList.remove('open');
    });
});

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleString('fa-IR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return dateString; }
}

function formatTime(dateString) {
    try {
        return new Date(dateString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadTicketDetails(ticketId) {
    const subjectEl = document.getElementById('chat-subject');
    const statusEl = document.getElementById('chat-status');
    const messagesContainer = document.getElementById('chat-messages');

    try {
        const response = await apiFetch(`${WORKER_URL}/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('تیکت پیدا نشد');
        
        const ticket = await response.json();
        const currentUser = Auth.getUser();

        subjectEl.textContent = ticket.subject;
        const statusText = ticket.status === 'open' ? 'در انتظار بررسی' : 'پاسخ داده شده';
        statusEl.querySelector('.text').textContent = statusText;
        if (ticket.status === 'open') statusEl.classList.add('open');
        else statusEl.classList.remove('open');

        document.getElementById('ticket-id-display').textContent = '#' + ticket.id.substring(0, 8);
        document.getElementById('info-subject').textContent = ticket.subject;
        document.getElementById('info-id').textContent = ticket.id;
        document.getElementById('info-date').textContent = formatDate(ticket.createdAt);
        
        const categoryMap = { 'technical': 'مشکل فنی', 'billing': 'مالی و اشتراک', 'suggestion': 'انتقاد و پیشنهاد' };
        document.getElementById('info-category').textContent = categoryMap[ticket.category] || ticket.category;
        document.getElementById('info-status').textContent = statusText;

        // اگه ادمین داره تیکت یکی دیگه رو می‌بینه، نشون بده
        if (currentUser.isAdmin && ticket.userId !== currentUser.id) {
            const infoTitle = document.querySelector('.info-title');
            if (infoTitle) infoTitle.textContent = `تیکت کاربر: ${ticket.username}`;
        }

        // پیام اصلی (از صاحب تیکت)
        let messagesHTML = `
            <div class="message user">
                <div class="message-avatar">👤</div>
                <div class="message-content">
                    <span class="message-author">${escapeHTML(ticket.username)}</span>
                    <div class="bubble">${escapeHTML(ticket.message)}</div>
                    <span class="message-time">${formatTime(ticket.createdAt)}</span>
                </div>
            </div>
        `;

        if (ticket.replies && ticket.replies.length > 0) {
            ticket.replies.forEach(reply => {
                const isAdmin = reply.isAdmin;
                messagesHTML += `
                    <div class="message ${isAdmin ? 'admin' : 'user'}">
                        <div class="message-avatar">${isAdmin ? '🛡️' : '👤'}</div>
                        <div class="message-content">
                            <span class="message-author">${isAdmin ? '🛡️ پشتیبانی OGHYANOS' : escapeHTML(reply.username || ticket.username)}</span>
                            <div class="bubble">${escapeHTML(reply.message)}</div>
                            <span class="message-time">${formatTime(reply.createdAt)}</span>
                        </div>
                    </div>
                `;
            });
        }

        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

    } catch (error) {
        console.error(error);
        messagesContainer.innerHTML = '<div class="no-messages">خطا در دریافت اطلاعات تیکت.</div>';
    }
}
async function sendReply(ticketId) {
    const replyInput = document.getElementById('reply-input');
    const message = replyInput.value.trim();
    if (!message) return;

    const sendBtn = document.getElementById('send-reply');
    sendBtn.disabled = true;

    try {
        const response = await apiFetch(`${WORKER_URL}/api/tickets/${ticketId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            replyInput.value = '';
            loadTicketDetails(ticketId);
        } else {
            const data = await response.json();
            alert(data.error || 'خطا در ارسال پاسخ');
        }
    } catch (error) {
        console.error(error);
    } finally {
        sendBtn.disabled = false;
    }
}