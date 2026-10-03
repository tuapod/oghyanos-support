// js/auth.js

const AUTH_WORKER_URL = 'https://oghyanos-api.ltfyamyry-0lt.workers.dev';
const TOKEN_KEY = 'oghyanos_token';
const USER_KEY = 'oghyanos_user';

// ==================== API احراز هویت ====================
const Auth = {
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    },

    getUser() {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    async register(username, password) {
        const res = await fetch(`${AUTH_WORKER_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطا در ثبت‌نام');
        this.setSession(data.token, data.user);
        return data;
    },

    async login(username, password) {
        const res = await fetch(`${AUTH_WORKER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطا در ورود');
        this.setSession(data.token, data.user);
        return data;
    },

    async logout() {
        const token = this.getToken();
        if (token) {
            try {
                await fetch(`${AUTH_WORKER_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {}
        }
        this.clearSession();
        window.location.reload();
    },

    async verify() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await fetch(`${AUTH_WORKER_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                this.clearSession();
                return null;
            }
            const data = await res.json();
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            return data.user;
        } catch {
            return null;
        }
    }
};

// ==================== fetch با توکن ====================
async function apiFetch(url, options = {}) {
    const token = Auth.getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    
    // اگر توکن منقضی شد
    if (res.status === 401) {
        Auth.clearSession();
        if (window.AuthModal) window.AuthModal.show();
        throw new Error('احراز هویت مورد نیاز است');
    }
    
    return res;
}

// ==================== مودال احراز هویت ====================
const AuthModal = {
    el: null,

    init() {
        // ساخت مودال
        const modal = document.createElement('div');
        modal.className = 'auth-overlay';
        modal.innerHTML = `
            <div class="auth-modal">
                <div class="auth-header">
                    <div class="auth-logo"><span>OGHYANOS</span> VPN</div>
                    <h2>خوش آمدید</h2>
                    <p>برای استفاده از پشتیبانی، لطفاً ثبت‌نام کنید</p>
                </div>
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="register">ثبت‌نام</button>
                    <button class="auth-tab" data-tab="login">ورود</button>
                </div>
                <div class="auth-error" id="auth-error"></div>
                
                <!-- فرم ثبت‌نام -->
                <form class="auth-form active" id="register-form">
                    <div class="form-group">
                        <label for="reg-username">نام کاربری</label>
                        <input type="text" id="reg-username" required placeholder="حداقل ۳ کاراکتر" autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label for="reg-password">رمز عبور</label>
                        <input type="password" id="reg-password" required placeholder="حداقل ۶ کاراکتر" autocomplete="new-password">
                    </div>
                    <button type="submit" class="auth-submit">ایجاد حساب</button>
                </form>

                <!-- فرم ورود -->
                <form class="auth-form" id="login-form">
                    <div class="form-group">
                        <label for="log-username">نام کاربری</label>
                        <input type="text" id="log-username" required placeholder="نام کاربری خود را وارد کنید" autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label for="log-password">رمز عبور</label>
                        <input type="password" id="log-password" required placeholder="رمز عبور خود را وارد کنید" autocomplete="current-password">
                    </div>
                    <button type="submit" class="auth-submit">ورود به حساب</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        this.el = modal;
        window.AuthModal = this;

        // مدیریت تب‌ها
        modal.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab');
                modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                modal.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                document.getElementById(`${target}-form`).classList.add('active');
                this.hideError();
            });
        });

        // ارسال فرم ثبت‌نام
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('.auth-submit');
            btn.disabled = true;
            btn.textContent = 'در حال ثبت‌نام...';
            this.hideError();
            
            try {
                await Auth.register(
                    document.getElementById('reg-username').value.trim(),
                    document.getElementById('reg-password').value
                );
                this.hide();
                window.location.reload();
            } catch (err) {
                this.showError(err.message);
                btn.disabled = false;
                btn.textContent = 'ایجاد حساب';
            }
        });

        // ارسال فرم ورود
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('.auth-submit');
            btn.disabled = true;
            btn.textContent = 'در حال ورود...';
            this.hideError();
            
            try {
                await Auth.login(
                    document.getElementById('log-username').value.trim(),
                    document.getElementById('log-password').value
                );
                this.hide();
                window.location.reload();
            } catch (err) {
                this.showError(err.message);
                btn.disabled = false;
                btn.textContent = 'ورود به حساب';
            }
        });
    },

    show() {
        if (this.el) this.el.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    hide() {
        if (this.el) this.el.classList.remove('active');
        document.body.style.overflow = '';
    },

    showError(msg) {
        const errEl = document.getElementById('auth-error');
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.classList.add('active');
    },

    hideError() {
        const errEl = document.getElementById('auth-error');
        if (errEl) errEl.classList.remove('active');
    }
};

// ==================== راه‌اندازی ====================
async function initAuth() {
    // ابتدا مودال را بساز
    AuthModal.init();

    // بررسی وضعیت ورود
    if (!Auth.isLoggedIn()) {
        AuthModal.show();
        return false;
    }

    // تأیید توکن با سرور
    const user = await Auth.verify();
    if (!user) {
        AuthModal.show();
        return false;
    }

    return true;
}

// در دسترس قرار دادن برای فایل‌های دیگر
window.Auth = Auth;
window.apiFetch = apiFetch;