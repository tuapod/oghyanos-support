// js/app.js
const WORKER_URL = 'https://oghyanos-api.ltfyamyry-0lt.workers.dev';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. بررسی احراز هویت
    const isLoggedIn = await initAuth();
    if (!isLoggedIn) return;

    // آپدیت نام کاربر + نشان ادمین
    const user = Auth.getUser();
    const userProfileEl = document.querySelector('.user-profile');
    if (userProfileEl && user) {
        const adminBadge = user.isAdmin 
            ? '<span style="background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; margin-right: 4px;">🛡️ ادمین</span>' 
            : '';
        userProfileEl.innerHTML = `
            <span class="avatar">👤</span>
            <span>${escapeHTML(user.username)}</span>
            ${adminBadge}
            <button class="logout-btn" id="logout-btn">خروج</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', () => {
            if (confirm('آیا از حساب خود خارج می‌شوید؟')) Auth.logout();
        });
    }

    // تغییر عنوان اگه ادمین بود
    if (user && user.isAdmin) {
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) subtitle.textContent = 'پنل مدیریت - مشاهده همه تیکت‌های کاربران';
    }

    // 2. مدیریت تم
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') document.body.classList.add('dark');

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        const icon = themeToggle.querySelector('.icon');
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    });

    // 3. مسیریابی
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');
    const statsContainer = document.getElementById('stats-container');

    function navigateTo(targetId, pushState = true) {
        navButtons.forEach(b => {
            if (b.getAttribute('data-target') === targetId) b.classList.add('active');
            else b.classList.remove('active');
        });
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'new-ticket') {
            statsContainer.style.display = 'none';
            pageTitle.textContent = 'ثبت تیکت جدید';
            if (pushState) history.pushState({ view: 'new' }, '', '/new');
        } else {
            statsContainer.style.display = 'grid';
            pageTitle.textContent = 'تیکت‌های پشتیبانی';
            if (pushState) history.pushState({ view: 'list' }, '', '/');
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-target')));
    });

    window.addEventListener('popstate', () => {
        if (window.location.pathname === '/new') navigateTo('new-ticket', false);
        else navigateTo('tickets-list', false);
    });

    if (window.location.pathname === '/new') navigateTo('new-ticket', false);

    // 4. ارسال فرم تیکت
    const ticketForm = document.getElementById('ticket-form');
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = ticketForm.querySelector('.submit-btn');
        submitBtn.innerText = 'در حال ارسال...';
        submitBtn.disabled = true;

        try {
            const response = await apiFetch(`${WORKER_URL}/api/tickets`, {
                method: 'POST',
                body: JSON.stringify({
                    subject: document.getElementById('subject').value,
                    category: document.getElementById('category').value,
                    message: document.getElementById('message').value
                })
            });

            if (response.ok) {
                alert('تیکت شما با موفقیت ثبت شد!');
                ticketForm.reset();
                navigateTo('tickets-list');
                loadTickets();
            } else {
                const data = await response.json();
                alert(data.error || 'خطا در ثبت تیکت.');
            }
        } catch (error) {
            console.error(error);
        } finally {
            submitBtn.innerText = 'ارسال تیکت';
            submitBtn.disabled = false;
        }
    });

    // 5. بارگذاری تیکت‌ها
    loadTickets();
});

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadTickets() {
    const container = document.getElementById('tickets-container');
    const statOpen = document.getElementById('stat-open');
    const statAnswered = document.getElementById('stat-answered');
    const statTotal = document.getElementById('stat-total');

    // چک کردن ادمین بودن کاربر
    const currentUser = Auth.getUser();
    const isAdmin = currentUser?.isAdmin === true;

    try {
        const response = await apiFetch(`${WORKER_URL}/api/tickets`);
        
        if (response.ok) {
            const tickets = await response.json();
            
            statTotal.textContent = tickets.length;
            statOpen.textContent = tickets.filter(t => t.status === 'open').length;
            statAnswered.textContent = tickets.filter(t => t.status === 'answered').length;

            if (tickets.length === 0) {
                const emptyMessage = isAdmin 
                    ? 'هنوز هیچ تیکتی توسط کاربران ثبت نشده است.'
                    : 'هنوز تیکتی ثبت نکرده‌اید.';
                const emptyHint = isAdmin
                    ? 'به محض ثبت تیکت توسط کاربران، اینجا نمایش داده می‌شود.'
                    : 'برای شروع، از منوی کناری یک تیکت جدید ثبت کنید.';
                    
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <div>${emptyMessage}</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">${emptyHint}</div>
                    </div>`;
                return;
            }

            container.innerHTML = tickets.map(ticket => {
                const statusClass = ticket.status === 'open' ? 'open' : 'answered';
                const statusText = ticket.status === 'open' ? 'در انتظار بررسی' : 'پاسخ داده شده';
                
                // اگه ادمین بود، نام کاربر صاحب تیکت رو نشون بده
                const ownerBadge = isAdmin 
                    ? `<span class="ticket-owner">👤 ${escapeHTML(ticket.username || 'ناشناس')}</span>` 
                    : '';

                // اگه ادمین بود و تعداد پاسخ‌ها رو نشون بده
                const repliesCount = isAdmin && ticket.replies && ticket.replies.length > 0
                    ? `<span class="ticket-replies">💬 ${ticket.replies.length} پاسخ</span>`
                    : '';

                return `
                    <div class="ticket-card" data-ticket-id="${ticket.id}">
                        <div class="ticket-header">
                            <h3>${escapeHTML(ticket.subject)}</h3>
                            ${ownerBadge}
                        </div>
                        <p class="ticket-preview">${escapeHTML(ticket.message.substring(0, 80))}${ticket.message.length > 80 ? '...' : ''}</p>
                        <div class="ticket-footer">
                            <span class="status ${statusClass}">${statusText}</span>
                            ${repliesCount}
                        </div>
                    </div>
                `;
            }).join('');

            // اضافه کردن کلیک به کارت‌ها
            document.querySelectorAll('.ticket-card').forEach(card => {
                card.addEventListener('click', () => {
                    window.location.href = `/view.html?id=${card.getAttribute('data-ticket-id')}`;
                });
            });
        } else {
            const data = await response.json();
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div>${escapeHTML(data.error || 'خطا در دریافت تیکت‌ها')}</div>
                </div>`;
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div>خطا در ارتباط با سرور.</div>
            </div>`;
    }
}