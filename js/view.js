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
        const isAdmin = currentUser?.isAdmin === true;

        // ==================== هدر ====================
        subjectEl.textContent = ticket.subject;
        
        // وضعیت
        const statusMap = {
            'open': { text: 'در انتظار بررسی', class: 'open' },
            'answered': { text: 'پاسخ داده شده', class: '' },
            'closed': { text: 'بسته شده', class: 'closed' }
        };
        const st = statusMap[ticket.status] || statusMap['open'];
        statusEl.querySelector('.text').textContent = st.text;
        statusEl.className = 'status-badge ' + st.class;

        document.getElementById('ticket-id-display').textContent = '#' + ticket.id.substring(0, 8);

        // ==================== سایدبار اطلاعات ====================
        document.getElementById('info-subject').textContent = ticket.subject;
        document.getElementById('info-id').textContent = ticket.id;
        document.getElementById('info-date').textContent = formatDate(ticket.createdAt);
        
        const categoryMap = { 'technical': 'مشکل فنی', 'billing': 'مالی و اشتراک', 'suggestion': 'انتقاد و پیشنهاد' };
        document.getElementById('info-category').textContent = categoryMap[ticket.category] || ticket.category;
        document.getElementById('info-status').textContent = st.text;

        // اگه ادمین داره تیکت یکی دیگه رو می‌بینه
        if (isAdmin && ticket.userId !== currentUser.id) {
            const infoTitle = document.querySelector('.info-title');
            if (infoTitle) infoTitle.textContent = `تیکت کاربر: ${ticket.username}`;
        }

        // ==================== دکمه‌های ادمین ====================
        const closeBtn = document.getElementById('close-ticket-btn');
        const reopenBtn = document.getElementById('reopen-ticket-btn');
        
        if (isAdmin) {
            if (ticket.status === 'closed') {
                closeBtn.style.display = 'none';
                reopenBtn.style.display = 'inline-flex';
            } else {
                closeBtn.style.display = 'inline-flex';
                reopenBtn.style.display = 'none';
            }
        } else {
            closeBtn.style.display = 'none';
            reopenBtn.style.display = 'none';
        }

        // ==================== پیام‌ها ====================
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
                const isReplyAdmin = reply.isAdmin;
                messagesHTML += `
                    <div class="message ${isReplyAdmin ? 'admin' : 'user'}">
                        <div class="message-avatar">${isReplyAdmin ? '🛡️' : '👤'}</div>
                        <div class="message-content">
                            <span class="message-author">${isReplyAdmin ? '🛡️ پشتیبانی OGHYANOS' : escapeHTML(reply.username || ticket.username)}</span>
                            <div class="bubble">${escapeHTML(reply.message)}</div>
                            <span class="message-time">${formatTime(reply.createdAt)}</span>
                        </div>
                    </div>
                `;
            });
        }

        // اگه تیکت بسته شده، بنر نشون بده
        if (ticket.status === 'closed') {
            const closedDate = ticket.closedAt ? formatDate(ticket.closedAt) : '';
            const closedBy = ticket.closedBy ? `توسط ${ticket.closedBy}` : '';
            messagesHTML += `
                <div class="closed-banner">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>این تیکت بسته شده است ${closedBy}${closedDate ? ' - ' + closedDate : ''}</span>
                </div>
            `;
        }

        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // ==================== غیرفعال کردن ارسال در تیکت بسته ====================
        const composer = document.querySelector('.chat-composer');
        if (composer) {
            if (ticket.status === 'closed' && !isAdmin) {
                composer.classList.add('disabled');
            } else {
                composer.classList.remove('disabled');
            }
        }

        // ==================== Event Listener دکمه‌ها ====================
        // (هر بار مجدد اضافه میشه، پس اول کلون می‌کنیم که لیسنر تکراری نشه)
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => changeTicketStatus(ticketId, 'close'));

        const newReopenBtn = reopenBtn.cloneNode(true);
        reopenBtn.parentNode.replaceChild(newReopenBtn, reopenBtn);
        newReopenBtn.addEventListener('click', () => changeTicketStatus(ticketId, 'reopen'));

    } catch (error) {
        console.error(error);
        messagesContainer.innerHTML = '<div class="no-messages">خطا در دریافت اطلاعات تیکت.</div>';
    }
}

// تابع تغییر وضعیت تیکت (بستن یا باز کردن)
async function changeTicketStatus(ticketId, action) {
    const actionText = action === 'close' ? 'بستن' : 'باز کردن';
    
    if (!confirm(`آیا از ${actionText} این تیکت مطمئن هستید؟`)) return;

    const btn = document.getElementById(action === 'close' ? 'close-ticket-btn' : 'reopen-ticket-btn');
    const originalText = btn.querySelector('span').textContent;
    btn.disabled = true;
    btn.querySelector('span').textContent = '...';

    try {
        const response = await apiFetch(`${WORKER_URL}/api/tickets/${ticketId}/${action}`, {
            method: 'POST'
        });

        if (response.ok) {
            // رفرش اطلاعات تیکت
            loadTicketDetails(ticketId);
        } else {
            const data = await response.json();
            alert(data.error || `خطا در ${actionText} تیکت`);
        }
    } catch (error) {
        console.error(error);
        alert('خطا در ارتباط با سرور');
    } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = originalText;
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