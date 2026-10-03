const WORKER_URL = 'https://oghyanos-api.ltfyamyry-0lt.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    // 1. مدیریت تم (Dark/Light)
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    
    if (currentTheme === 'dark') {
        document.body.classList.add('dark');
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        const icon = themeToggle.querySelector('.icon');
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    });

    // 2. مدیریت ناوبری و مسیریابی
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
        btn.addEventListener('click', () => {
            navigateTo(btn.getAttribute('data-target'));
        });
    });

    window.addEventListener('popstate', () => {
        if (window.location.pathname === '/new') {
            navigateTo('new-ticket', false);
        } else {
            navigateTo('tickets-list', false);
        }
    });

    if (window.location.pathname === '/new') {
        navigateTo('new-ticket', false);
    }

    // 3. ارسال فرم تیکت جدید
    const ticketForm = document.getElementById('ticket-form');
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = ticketForm.querySelector('.submit-btn');
        submitBtn.innerText = 'در حال ارسال...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${WORKER_URL}/api/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                alert('خطا در ثبت تیکت.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('خطا در ارتباط با سرور.');
        } finally {
            submitBtn.innerText = 'ارسال تیکت';
            submitBtn.disabled = false;
        }
    });

    // 4. بارگذاری اولیه تیکت‌ها
    loadTickets();
});

// ✅ تابع اصلاح‌شده دریافت تیکت‌ها با Event Delegation
async function loadTickets() {
    const container = document.getElementById('tickets-container');
    const statOpen = document.getElementById('stat-open');
    const statAnswered = document.getElementById('stat-answered');
    const statTotal = document.getElementById('stat-total');

    try {
        const response = await fetch(`${WORKER_URL}/api/tickets`);
        
        if (response.ok) {
            const tickets = await response.json();
            
            statTotal.textContent = tickets.length;
            statOpen.textContent = tickets.filter(t => t.status === 'open').length;
            statAnswered.textContent = tickets.filter(t => t.status === 'answered').length;

            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <div>هنوز تیکتی ثبت نکرده‌اید.</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">برای شروع، از منوی کناری یک تیکت جدید ثبت کنید.</div>
                    </div>`;
                return;
            }

            // ✅ استفاده از data-id به جای onclick مستقیم
            container.innerHTML = tickets.map(ticket => `
                <div class="ticket-card" data-ticket-id="${ticket.id}">
                    <h3>${ticket.subject}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.95rem;">${ticket.message.substring(0, 80)}...</p>
                    <span class="status">${ticket.status === 'open' ? 'در انتظار بررسی' : 'پاسخ داده شده'}</span>
                </div>
            `).join('');

            // ✅ اضافه کردن لیسنر کلیک به همه کارت‌ها بعد از رندر شدن
            document.querySelectorAll('.ticket-card').forEach(card => {
                card.addEventListener('click', () => {
                    const ticketId = card.getAttribute('data-ticket-id');
                    window.location.href = `/view.html?id=${ticketId}`;
                });
            });

        } else {
            throw new Error('Server error');
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
